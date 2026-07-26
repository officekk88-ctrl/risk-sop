import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectNavigation } from "@/components/project-navigation";
import { cloneProjectAction } from "@/app/projects/actions";
import { getSession } from "@/lib/auth";
import { resolveProjectRole } from "@/lib/domain";
import { getProject, listDocuments, listRisks, listTasks, projectProgress } from "@/lib/mvp-store";

const projectStatusLabel = {
  DRAFT: "资料准备", DUE_DILIGENCE: "尽调中", NEGOTIATING: "谈判中", SIGNED: "已签约",
  CONSTRUCTION: "设计施工中", OPENING_PREP: "开业准备中", OPEN: "已开业", PAUSED: "暂停",
  ABANDONED: "放弃", DECISION_PENDING: "待决策", ARCHIVED: "已归档",
};
const stageStatusLabel = { NOT_STARTED: "未开始", IN_PROGRESS: "进行中", COMPLETED: "已完成", BLOCKED: "已阻塞" };
const projectRoleLabel = { DECISION_MAKER: "决策人", PROJECT_MANAGER: "项目负责人", MEMBER: "项目成员", REVIEWER: "内部审核", EXPERT: "专业顾问" };

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [project, documents, risks, tasks] = await Promise.all([
    getProject(id, session.email, session.role),
    listDocuments(id, session.email, session.role),
    listRisks(id, session.email, session.role),
    listTasks(id, session.email, session.role),
  ]);
  if (!project || !documents || !risks || !tasks) notFound();

  const progress = projectProgress(project);
  const projectRole = resolveProjectRole(project, session.email, session.role);
  const activeStage = project.stages?.find((stage) => stage.status === "IN_PROGRESS")
    ?? project.stages?.find((stage) => stage.status === "BLOCKED")
    ?? project.stages?.find((stage) => stage.status === "NOT_STARTED");
  const openRisks = risks.filter((risk) => !["CLOSED", "AVOIDED"].includes(risk.status));
  const criticalRisks = openRisks.filter((risk) => risk.level === "CRITICAL");
  const missingEvidence = project.checklist.filter((item) => item.status === "TODO" || item.status === "VERIFY").length;
  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const parsedDocuments = documents.filter((document) => document.parseStatus === "COMPLETED").length;
  const nextChecklist = project.checklist.find((item) => item.status === "VERIFY") ?? project.checklist.find((item) => item.status === "TODO");
  const primaryAction = projectRole === "DECISION_MAKER"
    ? { href: `/projects/${id}/operations`, label: criticalRisks.length ? "查看决策阻塞" : "审核当前决策" }
    : projectRole === "EXPERT"
      ? { href: `/projects/${id}/experts`, label: "处理专家复核" }
      : criticalRisks.length
        ? { href: `/projects/${id}/risks`, label: "处理阻塞风险" }
        : nextChecklist
          ? { href: `/projects/${id}/checklist#${nextChecklist.code}`, label: "继续当前核验" }
          : { href: `/projects/${id}/operations`, label: "进入阶段决策" };

  const nextActions = [
    ...(criticalRisks.length ? [{ title: `处理 ${criticalRisks.length} 项重大阻塞风险`, detail: criticalRisks[0].title, href: `/projects/${id}/risks`, tone: "danger" }] : []),
    ...(nextChecklist ? [{ title: `继续核验：${nextChecklist.title}`, detail: `清单 ${nextChecklist.code} · ${nextChecklist.status === "VERIFY" ? "已有信息待核实" : "等待材料与判断"}`, href: `/projects/${id}/checklist#${nextChecklist.code}`, tone: "primary" }] : []),
    ...(openTasks.length ? [{ title: `完成 ${openTasks.length} 项未结任务`, detail: openTasks[0].title, href: "/tasks", tone: "warning" }] : []),
  ].slice(0, 3);

  return (
    <AppShell email={session.email}>
      <header className="topbar project-hero">
        <div>
          <div className="title-line"><span className="tag">{projectStatusLabel[project.status]}</span><span className="role-chip">{projectRoleLabel[projectRole]}</span><span className="muted">{project.city} · {project.venue.district || "行政区待补充"}</span></div>
          <h1>{project.name}</h1>
          <p className="muted">{project.venue.address || "场地地址待补充"}</p>
        </div>
        {projectRole === "PROJECT_MANAGER" ? <details className="project-menu">
          <summary className="button secondary">项目设置</summary>
          <div className="project-menu-panel">
            <Link href={`/projects/${id}/edit`}>编辑项目资料</Link>
            <Link href={`/projects/${id}/members`}>成员管理</Link>
            <Link href={`/projects/${id}/documents`}>全部材料</Link>
            <Link href={`/projects/${id}/experts`}>专家复核</Link>
            <form action={cloneProjectAction.bind(null, id)}><button type="submit">复制项目</button></form>
          </div>
        </details> : null}
      </header>
      <ProjectNavigation projectId={id} role={projectRole} />

      <section className="stage-focus card">
        <div className="stage-focus-copy">
          <span className="eyebrow">当前阶段</span>
          <h2>{activeStage?.name ?? "等待启动项目流程"}</h2>
          <p className="muted">{criticalRisks.length ? `${criticalRisks.length} 项重大风险正在阻塞推进，请优先处理。` : nextChecklist ? `完成剩余 ${missingEvidence} 项核验后，可提交下一阶段判断。` : "尽调核验已完成，可以准备阶段决策。"}</p>
        </div>
        <div className="stage-focus-progress">
          <strong>{progress.percent}%</strong>
          <span>尽调完成度</span>
          <div className="progress full"><i style={{ width: `${progress.percent}%` }} /></div>
        </div>
        <Link className="button" href={primaryAction.href}>{primaryAction.label}</Link>
      </section>

      <div className="project-health" aria-label="项目关注事项">
        <Link href={`/projects/${id}/checklist`}><span>待补材料与核验</span><strong>{missingEvidence}</strong><small>{parsedDocuments} 份材料已解析</small></Link>
        <Link className={criticalRisks.length ? "health-danger" : undefined} href={`/projects/${id}/risks`}><span>重大风险</span><strong>{criticalRisks.length}</strong><small>{openRisks.length} 条风险未关闭</small></Link>
        <Link href="/tasks"><span>未完成任务</span><strong>{openTasks.length}</strong><small>{openTasks.filter((task) => task.assigneeEmail === session.email).length} 项分配给我</small></Link>
      </div>

      <section className="focus-layout">
        <div className="focus-main">
          <div className="section-heading"><div><h2>下一步行动</h2><p className="muted">系统根据阻塞程度与项目进度排序</p></div></div>
          <div className="action-list">
            {nextActions.map((action, index) => (
              <Link className="action-row" href={action.href} key={action.title}>
                <span className={`action-number action-${action.tone}`}>{index + 1}</span>
                <span className="action-copy"><strong>{action.title}</strong><small>{action.detail}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
            {!nextActions.length ? <div className="card empty-state"><h2>当前阶段已完成</h2><p className="muted">可以进入决策页确认结论并推进下一阶段。</p><Link className="button" href={`/projects/${id}/operations`}>进入阶段决策</Link></div> : null}
          </div>
        </div>
        <aside className="focus-side">
          <article className="card project-facts">
            <div className="section-heading"><h2>项目信息</h2><Link href={`/projects/${id}/edit`}>编辑</Link></div>
            <dl>
              <div><dt>负责人</dt><dd>{project.ownerEmail}</dd></div>
              <div><dt>计划开业</dt><dd>{project.profile?.plannedOpeningDate || "待设置"}</dd></div>
              <div><dt>场地面积</dt><dd>{project.venue.areaSqm ? `${project.venue.areaSqm}㎡` : "待补充"}</dd></div>
              <div><dt>计划球场</dt><dd>{project.venue.plannedCourts ? `${project.venue.plannedCourts}片` : "待补充"}</dd></div>
            </dl>
          </article>
        </aside>
      </section>

      <section className="stage-timeline card">
        <div className="section-heading"><div><h2>项目流程</h2><p className="muted">只突出当前阶段，历史与未来阶段保持轻量</p></div><Link href={`/projects/${id}/operations`}>查看决策详情 →</Link></div>
        <div className="stage-track">
          {project.stages?.map((stage) => <div className={`stage-node stage-${stage.status.toLowerCase()}`} key={stage.id}><i /><strong>{stage.name}</strong><span>{stageStatusLabel[stage.status]}</span></div>)}
        </div>
      </section>
    </AppShell>
  );
}
