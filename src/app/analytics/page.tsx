import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listExperienceFeedback, listProjects, listRisks, listTasks, projectProgress } from "@/lib/mvp-store";

const categoryLabel = { FLOW: "操作流程", CLARITY: "界面清晰度", MOBILE: "移动端", AI: "AI助手", OTHER: "其他" };

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const bundles = await Promise.all(projects.map(async (project) => ({
    project,
    risks: await listRisks(project.id, session.email, session.role) ?? [],
    tasks: await listTasks(project.id, session.email, session.role) ?? [],
  })));
  const feedback = session.role === "ADMIN" ? await listExperienceFeedback(session.email, session.role) : [];
  const risks = bundles.flatMap((bundle) => bundle.risks);
  const tasks = bundles.flatMap((bundle) => bundle.tasks);
  const overdue = tasks.filter((task) => task.status !== "DONE" && new Date(task.dueDate) < new Date()).length;
  const averageProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + projectProgress(project).percent, 0) / projects.length) : 0;
  const averageFeedback = feedback.length ? (feedback.reduce((sum, item) => sum + item.score, 0) / feedback.length).toFixed(1) : "—";
  const areas = Object.entries(risks.reduce<Record<string, number>>((map, risk) => {
    map[risk.specialty || "未分类"] = (map[risk.specialty || "未分类"] || 0) + 1;
    return map;
  }, {})).sort((left, right) => right[1] - left[1]);

  return (
    <AppShell email={session.email}>
      <header className="topbar"><div><p className="eyebrow">统计分析</p><h1>项目效能与体验</h1><p className="muted">聚合授权范围内的项目推进、风险任务和真实使用反馈。</p></div></header>
      <section className="stats">
        <article className="card"><span className="stat-label">项目/门店</span><strong className="stat-value">{projects.length}</strong><span className="stat-foot">已开业 {projects.filter((project) => project.status === "OPEN").length}</span></article>
        <article className="card"><span className="stat-label">平均尽调进度</span><strong className="stat-value">{averageProgress}%</strong></article>
        <article className="card"><span className="stat-label">开放重大风险</span><strong className="stat-value">{risks.filter((risk) => risk.level === "CRITICAL" && risk.status !== "CLOSED").length}</strong></article>
        <article className="card"><span className="stat-label">逾期任务</span><strong className="stat-value">{overdue}</strong></article>
      </section>
      <div className="two-column">
        <section className="card table-card">
          <div className="section-heading"><div><h2>项目横向分析</h2><p className="muted">阶段、进度、风险和任务</p></div></div>
          <div className="data-list">{bundles.map(({ project, risks: projectRisks, tasks: projectTasks }) => <Link className="data-row" href={`/projects/${project.id}`} key={project.id}><div className="data-main"><strong>{project.name}</strong><span className="muted">{project.city} · {project.status}</span></div><span>进度 {projectProgress(project).percent}%</span><span>风险 {projectRisks.filter((risk) => risk.status !== "CLOSED").length}</span><span>任务 {projectTasks.filter((task) => task.status !== "DONE").length}</span></Link>)}</div>
        </section>
        <section className="card table-card">
          <div className="section-heading"><div><h2>高频风险领域</h2><p className="muted">用于优化规则与清单模板</p></div></div>
          <div className="data-list">{areas.map(([name, count]) => <div className="data-row" key={name}><div className="data-main"><strong>{name}</strong></div><strong>{count}</strong></div>)}{!areas.length ? <p className="muted">暂无风险数据。</p> : null}</div>
        </section>
      </div>
      {session.role === "ADMIN" ? <section className="card feedback-analytics">
        <div className="section-heading"><div><h2>体验反馈</h2><p className="muted">用于验证流程是否真正变得简单</p></div><strong className="feedback-average">{averageFeedback}<small>/ 5</small></strong></div>
        <div className="feedback-list">{feedback.slice(0, 10).map((item) => <article key={item.id}><span className="tag">{categoryLabel[item.category]}</span><strong>{item.score} / 5</strong><p>{item.comment || "未填写补充意见"}</p><small>{item.email} · {new Date(item.createdAt).toLocaleString("zh-CN")}</small></article>)}{!feedback.length ? <div className="empty-state"><p className="muted">尚未收到体验反馈。</p></div> : null}</div>
      </section> : null}
    </AppShell>
  );
}
