import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectNavigation } from "@/components/project-navigation";
import { createRiskAction, createTaskAction, updateRiskAction, updateTaskAction } from "./actions";
import { getSession } from "@/lib/auth";
import { resolveProjectRole } from "@/lib/domain";
import { getProject, listDocuments, listRisks, listTasks } from "@/lib/mvp-store";

const levelLabel = { CRITICAL: "重大", HIGH: "较高", MEDIUM: "一般", INFO: "提示" };
const riskStatusLabel = { OPEN: "新发现", ANALYZING: "待分析", EVIDENCE_PENDING: "待补材料", MITIGATING: "整改中", REVIEW_PENDING: "待复核", ACCEPTED: "已接受", AVOIDED: "已规避", CLOSED: "已关闭", UNRESOLVED: "无法关闭" };
const taskStatusLabel = { TODO: "待处理", IN_PROGRESS: "进行中", DONE: "已完成" };
const flowSteps = ["发现", "分析", "整改", "复核", "关闭"];

function flowIndex(status: keyof typeof riskStatusLabel) {
  if (status === "OPEN") return 0;
  if (["ANALYZING", "EVIDENCE_PENDING"].includes(status)) return 1;
  if (status === "MITIGATING") return 2;
  if (["REVIEW_PENDING", "UNRESOLVED"].includes(status)) return 3;
  return 4;
}

export default async function RisksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { filter = "open" } = await searchParams;
  const [project, risks, tasks, documents] = await Promise.all([
    getProject(id, session.email, session.role),
    listRisks(id, session.email, session.role),
    listTasks(id, session.email, session.role),
    listDocuments(id, session.email, session.role),
  ]);
  if (!project || !risks || !tasks || !documents) notFound();
  const projectRole = resolveProjectRole(project, session.email, session.role);
  const canManageRisk = ["PROJECT_MANAGER", "REVIEWER"].includes(projectRole);
  const canCreateRisk = ["PROJECT_MANAGER", "REVIEWER", "MEMBER"].includes(projectRole);
  const openRisks = risks.filter((risk) => !["CLOSED", "AVOIDED"].includes(risk.status));
  const critical = openRisks.filter((risk) => risk.level === "CRITICAL");
  const reviewPending = openRisks.filter((risk) => risk.status === "REVIEW_PENDING");
  const overdueTasks = tasks.filter((task) => task.status !== "DONE" && task.dueDate && new Date(task.dueDate) < new Date());
  const visibleRisks = risks.filter((risk) => {
    if (filter === "critical") return risk.level === "CRITICAL" && !["CLOSED", "AVOIDED"].includes(risk.status);
    if (filter === "review") return risk.status === "REVIEW_PENDING";
    if (filter === "closed") return ["CLOSED", "AVOIDED"].includes(risk.status);
    return !["CLOSED", "AVOIDED"].includes(risk.status);
  });

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header">
        <div><p className="eyebrow">{project.name}</p><h1>风险整改闭环</h1><p className="muted">发现风险 → 明确责任 → 完成整改 → 上传依据 → 复核关闭。</p></div>
        {canCreateRisk ? <a className="button" href="#new-risk">登记新风险</a> : null}
      </header>
      <ProjectNavigation projectId={id} role={projectRole} />

      <section className="risk-overview">
        <a className={filter === "open" ? "active" : ""} href="?filter=open"><span>未关闭风险</span><strong>{openRisks.length}</strong><small>需要持续跟进</small></a>
        <a className={filter === "critical" ? "active risk-alert" : "risk-alert"} href="?filter=critical"><span>重大阻塞</span><strong>{critical.length}</strong><small>影响决策门通过</small></a>
        <a className={filter === "review" ? "active" : ""} href="?filter=review"><span>等待复核</span><strong>{reviewPending.length}</strong><small>整改材料待确认</small></a>
        <a href="/tasks"><span>逾期任务</span><strong>{overdueTasks.length}</strong><small>进入任务中心处理</small></a>
      </section>

      <div className="risk-filter-heading"><span>{filter === "critical" ? "重大阻塞风险" : filter === "review" ? "等待复核的风险" : filter === "closed" ? "已关闭风险" : "正在处理的风险"}</span><a href={filter === "closed" ? "?filter=open" : "?filter=closed"}>{filter === "closed" ? "返回处理中" : "查看已关闭"}</a></div>
      <section className="risk-flow-list">
        {visibleRisks.map((risk) => {
          const riskTasks = tasks.filter((task) => task.riskId === risk.id);
          const activeStep = flowIndex(risk.status);
          const canUpdateRisk = canManageRisk || risk.ownerEmail === session.email;
          return (
            <article className={`card risk-flow-card level-${risk.level.toLowerCase()}`} id={risk.id} key={risk.id}>
              <header>
                <div><span className="item-code">{levelLabel[risk.level]}风险 · {riskStatusLabel[risk.status]}</span><h2>{risk.title}</h2><p className="muted">{risk.stageCode || "未指定阶段"} · 负责人 {risk.ownerEmail || "待指定"} · 截止 {risk.dueDate || "待设置"}</p></div>
                <span className="tag">{risk.source === "MANUAL" ? "人工登记" : risk.source === "AI_REVIEW" ? "AI发现·人工确认" : "清单转入"}</span>
              </header>

              <div className="risk-flow" aria-label={`当前处于${flowSteps[activeStep]}阶段`}>
                {flowSteps.map((step, index) => <div className={index < activeStep ? "done" : index === activeStep ? "active" : ""} key={step}><i>{index < activeStep ? "✓" : index + 1}</i><span>{step}</span></div>)}
              </div>

              <div className="risk-core">
                <div><span>事实与依据</span><p>{risk.evidence || risk.description || "尚未填写证据依据"}</p></div>
                <div><span>整改要求</span><p>{risk.recommendation || "尚未填写整改建议"}</p></div>
                <div><span>关闭所需材料</span><p>{risk.requiredEvidence || "按风险情况补充证明材料"}</p></div>
              </div>

              <details className="risk-detail">
                <summary>查看详情与处理记录</summary>
                <div className="risk-detail-body">
                  <dl><div><dt>风险描述</dt><dd>{risk.description}</dd></div><div><dt>风险评分</dt><dd>概率 {risk.probability ?? 3}/5 · 影响 {risk.impact ?? 3}/5 · 综合 {(risk.probability ?? 3) * (risk.impact ?? 3)}</dd></div><div><dt>潜在损失</dt><dd>{risk.potentialLoss || "待评估"}</dd></div></dl>
                  {canUpdateRisk ? <form action={updateRiskAction.bind(null, id, risk.id)} className="risk-decision-form"><label><span>风险状态</span><select name="status" defaultValue={risk.status}>{Object.entries(riskStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>复核或关闭依据</span><input name="closeReason" defaultValue={risk.closeReason} placeholder="关闭风险时必须填写依据" /></label><button className="button mini" type="submit">更新风险</button></form> : <div className="notice"><strong>只读查看</strong><span>由风险负责人或项目审核角色更新正式状态。</span></div>}
                </div>
              </details>

              <section className="risk-tasks">
                <div className="section-heading"><div><h3>整改任务</h3><p className="muted">{riskTasks.filter((task) => task.status !== "DONE").length} 项未完成</p></div></div>
                {riskTasks.map((task) => {
                  const canUpdateTask = canManageRisk || task.assigneeEmail === session.email;
                  return <form action={updateTaskAction.bind(null, id, task.id)} className="risk-task-row" key={task.id}><span className={`task-check task-${task.status.toLowerCase()}`}>{task.status === "DONE" ? "✓" : ""}</span><span><strong>{task.title}</strong><small>{task.assigneeEmail} · 截止 {task.dueDate}</small></span><select name="status" defaultValue={task.status} disabled={!canUpdateTask}>{Object.entries(taskStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input name="completionNote" defaultValue={task.completionNote} placeholder="处理说明或完成依据" disabled={!canUpdateTask} /><button className="button secondary mini" type="submit" disabled={!canUpdateTask}>保存</button></form>;
                })}
                {canManageRisk ? <form action={createTaskAction.bind(null, id, risk.id)} className="risk-task-row add-risk-task"><span className="task-check">＋</span><input name="title" defaultValue={`整改：${risk.title}`} required /><input name="assigneeEmail" type="email" defaultValue={risk.ownerEmail || session.email} required /><input name="dueDate" type="date" required /><button className="button secondary mini" type="submit">分配任务</button></form> : null}
              </section>
            </article>
          );
        })}
        {!visibleRisks.length ? <div className="card empty-state"><h2>该范围内没有风险</h2><p className="muted">风险变化后会自动归入对应状态。</p></div> : null}
      </section>

      {canCreateRisk ? <details className="card workspace-section" id="new-risk" open={!risks.length}>
        <summary><span><strong>登记新风险</strong><small>关联事实、材料、负责人和关闭要求</small></span><b>展开填写</b></summary>
        <form action={createRiskAction.bind(null, id)} className="form-grid compact-form workspace-section-body">
          <label className="field field-wide">风险标题<input name="title" required /></label><label className="field">风险等级<select name="level" defaultValue="HIGH">{Object.entries(levelLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="field">关联检查项<select name="checklistCode" defaultValue=""><option value="">不关联</option>{project.checklist.map((item) => <option value={item.code} key={item.code}>{item.code} · {item.title}</option>)}</select></label>
          <label className="field field-wide">关联文件<select name="documentId" defaultValue=""><option value="">不关联</option>{documents.map((document) => <option value={document.id} key={document.id}>{document.fileName}</option>)}</select></label>
          <label className="field">所属阶段<select name="stageCode"><option value="">待确定</option>{project.stages?.map((stage) => <option value={stage.code} key={stage.code}>{stage.name}</option>)}</select></label><label className="field">专业领域<input name="specialty" placeholder="产权/消防/工程/合同" /></label>
          <label className="field">发生概率（1-5）<input name="probability" type="number" min="1" max="5" defaultValue="3" /></label><label className="field">影响程度（1-5）<input name="impact" type="number" min="1" max="5" defaultValue="3" /></label>
          <label className="field field-wide">风险描述<input name="description" required /></label><label className="field field-wide">发现依据<input name="evidence" placeholder="文件、页码、现场事实或核实记录" /></label><label className="field field-wide">整改建议<input name="recommendation" /></label>
          <label className="field">责任人<input name="ownerEmail" type="email" defaultValue={session.email} required /></label><label className="field">整改期限<input name="dueDate" type="date" /></label><label className="field field-wide">可能损失<input name="potentialLoss" /></label><label className="field field-wide">关闭所需证明材料<input name="requiredEvidence" /></label>
          <div className="form-actions"><button className="button" type="submit">确认登记风险</button></div>
        </form>
      </details> : null}
    </AppShell>
  );
}
