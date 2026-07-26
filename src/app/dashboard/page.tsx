import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { beijingGreeting } from "@/lib/beijing-time";
import type { ChecklistStatus, Project } from "@/lib/domain";
import { listProjects, listRisks, listTasks, projectProgress } from "@/lib/mvp-store";

const projectStatusLabel = {
  DRAFT: "资料准备",
  DUE_DILIGENCE: "尽调中",
  NEGOTIATING: "谈判中",
  SIGNED: "已签约",
  CONSTRUCTION: "设计施工中",
  OPENING_PREP: "开业准备中",
  OPEN: "已开业",
  PAUSED: "暂停",
  ABANDONED: "放弃",
  DECISION_PENDING: "待决策",
  ARCHIVED: "已归档",
};

function checklistCounts(project: Project): Record<ChecklistStatus, number> {
  return project.checklist.reduce<Record<ChecklistStatus, number>>((counts, item) => {
    counts[item.status] += 1;
    return counts;
  }, { TODO: 0, PASSED: 0, FAILED: 0, VERIFY: 0, NOT_APPLICABLE: 0 });
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const activeProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const projectOperations = await Promise.all(activeProjects.map(async (project) => {
    const [risks, tasks] = await Promise.all([
      listRisks(project.id, session.email, session.role),
      listTasks(project.id, session.email, session.role),
    ]);
    return {
      project,
      progress: projectProgress(project),
      counts: checklistCounts(project),
      risks: risks ?? [],
      tasks: tasks ?? [],
    };
  }));
  const totalApplicable = projectOperations.reduce((total, item) => total + item.progress.total, 0);
  const totalCompleted = projectOperations.reduce((total, item) => total + item.progress.completed, 0);
  const totalPercent = totalApplicable ? Math.round((totalCompleted / totalApplicable) * 100) : 0;
  const openCriticalRisks = projectOperations.reduce((total, item) => total + item.risks.filter((risk) => risk.level === "CRITICAL" && risk.status !== "CLOSED").length, 0);
  const openTasks = projectOperations.reduce((total, item) => total + item.tasks.filter((task) => task.status !== "DONE").length, 0);
  const myOpenTasks = projectOperations.flatMap(({ project, tasks }) => tasks
    .filter((task) => task.status !== "DONE" && (session.role === "ADMIN" || task.assigneeEmail === session.email))
    .map((task) => ({ project, task })))
    .sort((left, right) => left.task.dueDate.localeCompare(right.task.dueDate));
  const blockedProject = projectOperations.find(({ risks }) => risks.some((risk) => risk.level === "CRITICAL" && !["CLOSED", "AVOIDED"].includes(risk.status)));
  const pendingProject = projectOperations.find(({ project }) => project.checklist.some((item) => item.status === "VERIFY" || item.status === "TODO"));
  const todayActions = [
    ...(blockedProject ? [{ title: `处理 ${blockedProject.project.name} 的重大风险`, detail: "该风险正在阻塞项目决策", href: `/projects/${blockedProject.project.id}/risks`, tone: "danger" }] : []),
    ...(myOpenTasks[0] ? [{ title: myOpenTasks[0].task.title, detail: `${myOpenTasks[0].project.name} · 截止 ${myOpenTasks[0].task.dueDate || "待设置"}`, href: "/tasks", tone: "warning" }] : []),
    ...(pendingProject ? [{ title: `继续 ${pendingProject.project.name} 的尽调`, detail: `当前完成 ${pendingProject.progress.percent}%`, href: `/projects/${pendingProject.project.id}/checklist`, tone: "primary" }] : []),
  ].slice(0, 3);
  const stats = [
    { label: "未归档项目", value: String(activeProjects.length), foot: `共 ${projects.length} 个项目`, href: "/projects", target: "项目中心" },
    { label: "整体尽调完成率", value: `${totalPercent}%`, foot: `${totalCompleted} / ${totalApplicable} 项已判断`, href: "/checklists", target: "尽调清单" },
    { label: "未关闭重大风险", value: String(openCriticalRisks), foot: openCriticalRisks ? "涉及一个或多个项目" : "当前没有未关闭重大风险", href: "/risks", target: "风险台账" },
    { label: "未完成整改任务", value: String(openTasks), foot: openTasks ? "需要继续跟进" : "当前没有未完成任务", href: "/risks", target: "风险与整改" },
  ];

  return (
    <AppShell email={session.email}>
      <header className="topbar dashboard-hero">
        <div><p className="eyebrow"><span className="live-dot" aria-hidden="true" />项目总览</p><h1>{beijingGreeting()}，项目负责人</h1><p className="muted">从重点风险开始，快速推进尽调、材料审核与整改闭环。</p></div>
        <div className="header-actions"><Link className="button secondary" href="/messages">查看消息</Link><Link className="button" href="/projects/new"><span aria-hidden="true">＋</span> 新建项目</Link></div>
      </header>

      <section className="today-focus">
        <div className="section-heading"><div><p className="eyebrow">行动优先</p><h2>今天需要处理的事</h2></div><Link href="/tasks">查看全部任务 →</Link></div>
        <div className="today-actions">
          {todayActions.map((action, index) => <Link className="card today-action" href={action.href} key={action.title}><span className={`action-number action-${action.tone}`}>{index + 1}</span><span><strong>{action.title}</strong><small>{action.detail}</small></span><i aria-hidden="true">→</i></Link>)}
          {!todayActions.length ? <article className="card today-action"><span className="action-number action-primary">✓</span><span><strong>当前没有紧急事项</strong><small>可以进入项目检查下一阶段准备情况</small></span></article> : null}
        </div>
      </section>
      <div className="stats">
        {stats.map((stat, index) => (
          <Link className={`card stat-card-link stat-tone-${index + 1}`} href={stat.href} aria-label={`${stat.label}：${stat.value}，进入${stat.target}`} key={stat.label}>
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-foot">{stat.foot}<span className="stat-arrow" aria-hidden="true">→</span></span>
          </Link>
        ))}
      </div>

      <section className="dashboard-project-list">
        <div className="section-heading dashboard-list-heading">
          <div><h2>进行中的项目</h2><p className="muted">快速查看项目健康度和进入下一步</p></div>
          <Link className="button secondary mini" href="/projects">项目管理</Link>
        </div>
        {projectOperations.map(({ project, progress, counts, risks, tasks }) => {
          const openRisks = risks.filter((risk) => risk.status !== "CLOSED").length;
          const pendingTasks = tasks.filter((task) => task.status !== "DONE").length;
          return (
            <article className="card dashboard-project-card" key={project.id}>
              <header className="dashboard-project-header">
                <div>
                  <div className="dashboard-title-line"><span className="tag">{projectStatusLabel[project.status]}</span><span className="muted">{project.city} · {project.venue.district || "行政区待补充"}</span></div>
                  <h2>{project.name}</h2>
                  <p className="muted">{project.venue.address || "场地地址待补充"} · {project.venue.areaSqm ?? "—"}㎡ · {project.venue.plannedCourts ?? "—"}片球场</p>
                </div>
                <Link className="button mini" href={`/projects/${project.id}`}>进入项目办理</Link>
              </header>

              <div className="project-progress-row">
                <div className="project-progress-copy"><strong>尽调完成率 {progress.percent}%</strong><span>{progress.completed} / {progress.total} 项已形成人工判断</span></div>
                <div className="progress full" aria-label={`${project.name}尽调完成${progress.percent}%`}><span style={{ width: `${progress.percent}%` }} /></div>
              </div>

              <div className="project-metrics" aria-label={`${project.name}尽调数据统计`}>
                <div><span>通过</span><strong className="metric-passed">{counts.PASSED}</strong></div>
                <div><span>不通过</span><strong className="metric-failed">{counts.FAILED}</strong></div>
                <div><span>待核实</span><strong className="metric-verify">{counts.VERIFY}</strong></div>
                <div><span>待处理</span><strong>{counts.TODO}</strong></div>
                <div><span>开放风险</span><strong>{openRisks}</strong></div>
                <div><span>整改任务</span><strong>{pendingTasks}</strong></div>
              </div>

              <Link className="dashboard-checklist-link" href={`/projects/${project.id}`}>
                <span><strong>查看项目下一步</strong><small>进入项目总览，优先处理阻塞风险与待办事项</small></span>
                <span aria-hidden="true">进入项目 →</span>
              </Link>
            </article>
          );
        })}
        {!projectOperations.length ? <article className="card empty-state"><p>当前没有未完成项目。</p><Link className="button" href="/projects/new">创建第一个项目</Link></article> : null}
      </section>
    </AppShell>
  );
}
