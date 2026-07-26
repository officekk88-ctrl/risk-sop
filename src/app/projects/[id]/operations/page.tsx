import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectNavigation } from "@/components/project-navigation";
import { getSession } from "@/lib/auth";
import { resolveProjectRole, type Venue } from "@/lib/domain";
import { getProject, listDocuments, listRisks, listTasks } from "@/lib/mvp-store";
import { createGeneralTaskAction, deleteVenueAction, saveVenueAction, updateGateAction, updateGeneralTaskAction, updateProfileAction, updateStageAction } from "./actions";

const decisionLabel = { PENDING: "待审批", PASSED: "通过", CONDITIONAL: "有条件通过", PAUSED: "暂停", REJECTED: "否决", EXPERT_REVIEW: "专家复核" };
const stageStatusLabel = { NOT_STARTED: "未开始", IN_PROGRESS: "进行中", COMPLETED: "已完成", BLOCKED: "已阻塞" };
const operationLabel = { SELF: "自营", JOINT: "联营", FRANCHISE: "加盟", ENTRUSTED: "委托经营" };
const relationLabel = { DIRECT: "产权人直租", AGENCY: "代理", SUBLEASE: "转租", COOPERATION: "合作经营", ASSET_MANAGEMENT: "资产管理", UNKNOWN: "待核实" };

function commercialScore(venue: Venue) {
  const values = [venue.trafficScore, venue.customerScore, venue.visibilityScore, venue.parkingScore, venue.costScore, venue.efficiencyScore].map((value) => value ?? 0);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function riskScore(venue: Venue) {
  return Math.round(((venue.complianceRisk ?? 0) + (venue.engineeringRisk ?? 0) + (venue.neighborRisk ?? 0)) / 3);
}

export default async function OperationsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [project, risks, tasks, documents] = await Promise.all([
    getProject(id, session.email, session.role),
    listRisks(id, session.email, session.role),
    listTasks(id, session.email, session.role),
    listDocuments(id, session.email, session.role),
  ]);
  if (!project || !risks || !tasks || !documents) notFound();
  const profile = project.profile!;
  const projectRole = resolveProjectRole(project, session.email, session.role);
  const canApprove = ["PROJECT_MANAGER", "DECISION_MAKER", "REVIEWER"].includes(projectRole);
  const venues = [...(project.venues ?? [])].sort((left, right) => commercialScore(right) - commercialScore(left));
  const openCritical = risks.filter((risk) => risk.level === "CRITICAL" && !["CLOSED", "AVOIDED"].includes(risk.status));
  const currentStage = project.stages?.find((stage) => stage.status === "IN_PROGRESS")
    ?? project.stages?.find((stage) => stage.status === "BLOCKED")
    ?? project.stages?.find((stage) => stage.status === "NOT_STARTED");
  const currentGate = project.decisionGates?.find((gate) => gate.stageCode === currentStage?.code)
    ?? project.decisionGates?.find((gate) => gate.decision === "PENDING");
  const generalTasks = tasks.filter((task) => !task.riskId);
  const parsedDocuments = documents.filter((document) => document.parseStatus === "COMPLETED").length;

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header">
        <div><p className="eyebrow">{project.name}</p><h1>阶段与决策</h1><p className="muted">只处理当前决策；历史阶段、项目配置和候选场地按需展开。</p></div>
        <div className="header-actions"><Link className="button secondary" href={`/projects/${id}/experts`}>专家复核</Link></div>
      </header>
      <ProjectNavigation projectId={id} role={projectRole} />

      <section className={`decision-focus card ${openCritical.length ? "decision-blocked" : ""}`}>
        <div className="decision-status">
          <span className="eyebrow">当前决策门</span>
          <span className={`decision-badge decision-${(currentGate?.decision ?? "PENDING").toLowerCase()}`}>{decisionLabel[currentGate?.decision ?? "PENDING"]}</span>
        </div>
        <div className="decision-title">
          <div><h2>{currentGate?.name ?? currentStage?.name ?? "等待启动项目阶段"}</h2><p className="muted">{currentStage ? `${currentStage.code} · ${stageStatusLabel[currentStage.status]}` : "尚未指定当前阶段"}</p></div>
          <div className="decision-readiness"><strong>{openCritical.length ? "暂不可直接通过" : "可提交审批"}</strong><span>{openCritical.length ? `${openCritical.length} 项重大风险阻塞` : `${parsedDocuments} 份材料已完成解析`}</span></div>
        </div>

        <div className="decision-evidence-grid">
          <section>
            <h3>审批所需材料</h3>
            <ul>{(currentGate?.requiredMaterials.length ? currentGate.requiredMaterials : currentStage?.requiredMaterials ?? []).map((item) => <li key={item}><i />{item}</li>)}</ul>
            {!currentGate?.requiredMaterials.length && !currentStage?.requiredMaterials.length ? <p className="muted">当前未配置必需材料。</p> : null}
          </section>
          <section>
            <h3>阻塞条件</h3>
            {openCritical.map((risk) => <Link className="blocker-row" href={`/projects/${id}/risks#${risk.id}`} key={risk.id}><span>重大风险</span><strong>{risk.title}</strong><i>→</i></Link>)}
            {!openCritical.length ? <div className="clear-state"><span>✓</span><strong>没有未关闭重大风险</strong></div> : null}
          </section>
        </div>

        {currentGate ? canApprove ? (
          <form action={updateGateAction.bind(null, id, currentGate.id)} className="decision-form">
            <label><span>审批结论</span><select name="decision" defaultValue={currentGate.decision}>{Object.entries(decisionLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label className="decision-rationale"><span>审批依据与附加条件</span><textarea name="rationale" defaultValue={currentGate.rationale} placeholder="写明已确认事实、仍需满足的条件和决策理由" required /></label>
            <button className="button" type="submit">确认当前决策</button>
          </form>
        ) : (
          <div className="notice"><strong>等待有权限的角色审批</strong><span>当前角色可以查看材料与阻塞条件，但不能修改正式决策。</span></div>
        ) : <div className="notice"><strong>当前没有匹配的决策门</strong><span>请由项目负责人检查阶段配置。</span></div>}
      </section>

      <section className="decision-support">
        <article className="card support-card"><span>当前阶段</span><strong>{currentStage?.name ?? "待指定"}</strong><small>{project.stages?.filter((stage) => stage.status === "COMPLETED").length ?? 0} / {project.stages?.length ?? 0} 阶段已完成</small></article>
        <article className="card support-card"><span>证据材料</span><strong>{documents.length}</strong><small>{parsedDocuments} 份已解析</small></article>
        <article className="card support-card"><span>普通任务</span><strong>{generalTasks.filter((task) => task.status !== "DONE").length}</strong><small>等待项目团队处理</small></article>
        <article className="card support-card"><span>候选场地</span><strong>{venues.length}</strong><small>商业与风险分开评估</small></article>
      </section>

      <section className="card stage-history">
        <div className="section-heading"><div><h2>阶段时间线</h2><p className="muted">历史结论只读概览；需要调整时展开高级管理。</p></div></div>
        <div className="stage-track">
          {project.stages?.map((stage) => <div className={`stage-node stage-${stage.status.toLowerCase()}`} key={stage.id}><i /><strong>{stage.name}</strong><span>{stageStatusLabel[stage.status]}</span></div>)}
        </div>
      </section>

      <details className="card workspace-section" open={!currentGate}>
        <summary><span><strong>阶段与决策门管理</strong><small>修改阶段状态、历史结论或其他决策门</small></span><b>展开管理</b></summary>
        <div className="workspace-section-body">
          <h3>标准阶段</h3>
          <div className="data-list">{project.stages?.map((stage) => <form action={updateStageAction.bind(null, id, stage.id)} className="stage-row" key={stage.id}><div className="data-main"><span className="item-code">{stage.code}</span><strong>{stage.name}</strong><span className="muted">{stage.decidedBy ? `${stage.decidedBy} · ${new Date(stage.decidedAt!).toLocaleString("zh-CN")}` : "尚未形成阶段结论"}</span></div><select name="status" defaultValue={stage.status}>{Object.entries(stageStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><select name="decision" defaultValue={stage.decision}>{Object.entries(decisionLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input name="conditions" defaultValue={stage.conditions} placeholder="前置条件" /><input name="note" defaultValue={stage.note} placeholder="审核意见" /><button className="button mini" type="submit">保存</button></form>)}</div>
          <h3>全部决策门</h3>
          <div className="data-list">{project.decisionGates?.filter((gate) => gate.id !== currentGate?.id).map((gate) => <form action={updateGateAction.bind(null, id, gate.id)} className="gate-row" key={gate.id}><div className="data-main"><span className="item-code">{gate.code}</span><strong>{gate.name}</strong><span className="muted">必需：{gate.requiredMaterials.join("、") || "未配置"}</span></div><select name="decision" defaultValue={gate.decision} disabled={!canApprove}>{Object.entries(decisionLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input name="rationale" defaultValue={gate.rationale} placeholder="审批依据/条件" required disabled={!canApprove} /><button className="button mini" type="submit" disabled={!canApprove}>审批</button></form>)}</div>
        </div>
      </details>

      <details className="card workspace-section">
        <summary><span><strong>项目建档信息</strong><small>建筑、权属、消防和经营条件</small></span><b>展开编辑</b></summary>
        <form action={updateProfileAction.bind(null, id)} className="form-grid compact-form workspace-section-body">
          <div className="form-section-title"><h2>建筑与经营</h2><p className="muted">用于匹配适用流程和材料要求。</p></div>
          <label className="field">建筑类型<input name="buildingType" defaultValue={profile.buildingType} /></label><label className="field">所在楼层<input name="floor" defaultValue={profile.floor} /></label>
          <label className="field">建筑层高（m）<input name="buildingHeightM" type="number" step="0.1" min="0" defaultValue={profile.buildingHeightM ?? ""} /></label><label className="field">计划开业日<input name="plannedOpeningDate" type="date" defaultValue={profile.plannedOpeningDate} /></label>
          <label className="field">项目预算（元）<input name="budget" type="number" min="0" defaultValue={profile.budget ?? ""} /></label><label className="field">经营模式<select name="operationMode" defaultValue={profile.operationMode}>{Object.entries(operationLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <div className="form-section-title"><h2>权属与租赁</h2></div>
          <label className="field">产权人<input name="propertyOwner" defaultValue={profile.propertyOwner} /></label><label className="field">出租人<input name="lessor" defaultValue={profile.lessor} /></label>
          <label className="field">出租关系<select name="leasingRelation" defaultValue={profile.leasingRelation}>{Object.entries(relationLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field">产权证编号<input name="certificateNumber" defaultValue={profile.certificateNumber} /></label>
          <label className="field">土地性质<input name="landNature" defaultValue={profile.landNature} /></label><label className="field">房屋性质<input name="propertyNature" defaultValue={profile.propertyNature} /></label><label className="field">剩余使用年限<input name="remainingYears" type="number" min="0" defaultValue={profile.remainingYears ?? ""} /></label>
          <fieldset className="field field-wide"><legend>权利负担</legend><div className="checkbox-line">{["抵押", "查封", "共有", "权属争议"].map((value) => <label key={value}><input type="checkbox" name="encumbrances" value={value} defaultChecked={profile.encumbrances.includes(value)} />{value}</label>)}</div></fieldset>
          <div className="form-section-title"><h2>场地与配套</h2></div>
          <label className="field">原使用用途<input name="originalUse" defaultValue={profile.originalUse} /></label><label className="field">当前状态<input name="currentCondition" defaultValue={profile.currentCondition} /></label>
          <label className="field field-wide">消防设施及疏散条件<textarea name="fireFacilities" defaultValue={profile.fireFacilities} /></label><label className="field">安全出口数量<input name="exits" type="number" min="0" defaultValue={profile.exits ?? ""} /></label>
          <label className="field">供电<input name="powerCapacity" defaultValue={profile.powerCapacity} /></label><label className="field">暖通<input name="hvac" defaultValue={profile.hvac} /></label><label className="field">给排水<input name="waterDrainage" defaultValue={profile.waterDrainage} /></label><label className="field">网络<input name="network" defaultValue={profile.network} /></label><label className="field">停车<input name="parking" defaultValue={profile.parking} /></label>
          <label className="field field-wide">周边敏感点<textarea name="sensitiveNeighbors" defaultValue={profile.sensitiveNeighbors} /></label><label className="checkbox-field"><input name="nightOperation" type="checkbox" defaultChecked={profile.nightOperation} />计划夜间经营</label><label className="field field-wide">噪声与投诉风险<textarea name="noiseRisk" defaultValue={profile.noiseRisk} /></label>
          <div className="form-actions"><button className="button" type="submit">保存建档信息</button></div>
        </form>
      </details>

      <details className="card workspace-section">
        <summary><span><strong>候选场地比较</strong><small>{venues.length} 个场地，商业与合规分别评分</small></span><b>展开管理</b></summary>
        <div className="workspace-section-body">
          <div className="comparison-grid">{venues.map((venue, index) => <article className="comparison-card" key={venue.id}><span className="item-code">排名 {index + 1}{venue.isPrimary ? " · 主场地" : ""}</span><h3>{venue.name}</h3><p>{venue.district} · {venue.address}</p><div className="score-pair"><span>商业<strong>{commercialScore(venue)}</strong></span><span>风险<strong>{riskScore(venue)}</strong></span></div>{!venue.isPrimary ? <form action={deleteVenueAction.bind(null, id, venue.id!)}><button className="danger-button" type="submit">删除候选</button></form> : null}</article>)}</div>
          <details className="nested-create"><summary>新增候选场地</summary><form action={saveVenueAction.bind(null, id)} className="form-grid compact-form">
            <input type="hidden" name="id" value="" /><label className="field">场地名称<input name="name" required /></label><label className="field">行政区<input name="district" /></label><label className="field field-wide">详细地址<input name="address" required /></label>
            <label className="field">面积㎡<input name="areaSqm" type="number" min="0" /></label><label className="field">净高m<input name="clearHeightM" type="number" step="0.1" min="0" /></label><label className="field">计划球场<input name="plannedCourts" type="number" min="0" /></label><label className="field">月租金<input name="monthlyRent" type="number" min="0" /></label><label className="field">租期月<input name="leaseMonths" type="number" min="0" /></label><label className="field">证载用途<input name="certificateUsage" /></label><label className="field">拟经营用途<input name="intendedUsage" defaultValue="匹克球馆" /></label>
            {["trafficScore:交通", "customerScore:客群", "visibilityScore:可见性", "parkingScore:停车", "costScore:成本", "efficiencyScore:场效", "complianceRisk:合规风险", "engineeringRisk:工程风险", "neighborRisk:邻里风险"].map((pair) => { const [name, label] = pair.split(":"); return <label className="field" key={name}>{label}（0-100）<input name={name} type="number" min="0" max="100" defaultValue="50" /></label>; })}
            <label className="field">预计月收入<input name="expectedRevenue" type="number" min="0" /></label><label className="field">计划投资<input name="plannedInvestment" type="number" min="0" /></label><label className="field field-wide">淘汰原因<input name="eliminatedReason" /></label><label className="field field-wide">备注<textarea name="notes" /></label><label className="checkbox-field"><input name="isPrimary" type="checkbox" />设为主场地</label><div className="form-actions"><button className="button" type="submit">保存候选场地</button></div>
          </form></details>
        </div>
      </details>

      <details className="card workspace-section">
        <summary><span><strong>普通项目任务</strong><small>{generalTasks.filter((task) => task.status !== "DONE").length} 项未完成</small></span><b>展开管理</b></summary>
        <div className="workspace-section-body"><form action={createGeneralTaskAction.bind(null, id)} className="task-row add-task"><input name="title" placeholder="任务名称" required /><input name="assigneeEmail" type="email" defaultValue={session.email} required /><input name="dueDate" type="date" required /><select name="priority" defaultValue="MEDIUM"><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option><option value="URGENT">紧急</option></select><button className="button mini" type="submit">创建</button></form><div className="data-list">{generalTasks.map((task) => <form action={updateGeneralTaskAction.bind(null, id, task.id)} className="task-row" key={task.id}><div className="data-main"><strong>{task.title}</strong><span className="muted">{task.priority ?? "MEDIUM"} · {task.assigneeEmail} · {task.dueDate}</span></div><select name="status" defaultValue={task.status}><option value="TODO">待处理</option><option value="IN_PROGRESS">进行中</option><option value="DONE">已完成</option></select><input name="completionNote" defaultValue={task.completionNote} placeholder="完成依据" /><button className="button secondary mini" type="submit">保存</button></form>)}</div></div>
      </details>
    </AppShell>
  );
}
