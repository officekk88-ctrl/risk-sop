import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listProjects, listRisks, listTasks } from "@/lib/mvp-store";

const priorityLabel = { LOW: "低", MEDIUM: "中", HIGH: "高", URGENT: "紧急" };

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const rows = await Promise.all(projects.map(async (project) => ({
    project,
    risks: await listRisks(project.id, session.email, session.role) ?? [],
    tasks: await listTasks(project.id, session.email, session.role) ?? [],
  })));
  const myTasks = rows.flatMap(({ project, tasks }) => tasks
    .filter((task) => task.status !== "DONE" && (session.role === "ADMIN" || task.assigneeEmail === session.email))
    .map((task) => ({ project, task })))
    .sort((left, right) => left.task.dueDate.localeCompare(right.task.dueDate));
  const blockedProjects = rows.filter(({ risks }) => risks.some((risk) => risk.level === "CRITICAL" && !["CLOSED", "AVOIDED"].includes(risk.status)));

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header">
        <div><p className="eyebrow">行动中心</p><h1>我的任务</h1><p className="muted">集中处理尽调、整改和项目推进事项，不必在模块之间来回查找。</p></div>
      </header>
      <section className="focus-layout">
        <div className="focus-main">
          <div className="section-heading"><div><h2>待我处理</h2><p className="muted">按截止日期排序 · 共 {myTasks.length} 项</p></div></div>
          <div className="action-list">
            {myTasks.map(({ project, task }) => (
              <Link className="action-row" href={task.riskId ? `/projects/${project.id}/risks` : `/projects/${project.id}/operations`} key={task.id}>
                <span className={`priority-dot priority-${(task.priority ?? "MEDIUM").toLowerCase()}`} aria-hidden="true" />
                <span className="action-copy"><strong>{task.title}</strong><small>{project.name} · {task.status === "IN_PROGRESS" ? "进行中" : "待处理"}</small></span>
                <span className="action-meta"><small>{priorityLabel[task.priority ?? "MEDIUM"]}优先级</small><strong>{task.dueDate || "未设置日期"}</strong></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
            {!myTasks.length ? <div className="card empty-state"><h2>当前没有待办</h2><p className="muted">新的尽调、整改或审批任务会集中出现在这里。</p></div> : null}
          </div>
        </div>
        <aside className="focus-side">
          <article className="card attention-card">
            <span className="stat-label">重大风险阻塞</span>
            <strong className="stat-value">{blockedProjects.length}</strong>
            <p className="muted">这些项目暂时不能直接通过决策门。</p>
            {blockedProjects.slice(0, 3).map(({ project }) => <Link href={`/projects/${project.id}/risks`} key={project.id}>{project.name}<span>查看风险 →</span></Link>)}
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
