import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listProjects, listRisks, listTasks } from "@/lib/mvp-store";

export default async function RisksHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const rows = await Promise.all(projects.map(async (project) => ({ project, risks: await listRisks(project.id, session.email, session.role) ?? [], tasks: await listTasks(project.id, session.email, session.role) ?? [] })));
  const openTotal = rows.reduce((sum, row) => sum + row.risks.filter((risk) => risk.status !== "CLOSED").length, 0);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">全局风险</p><h1>风险台账</h1><p className="muted">当前共 {openTotal} 条未关闭正式风险，仅统计人工登记或已确认的AI风险。</p></div></header>
      <div className="project-cards">
        {rows.map(({ project, risks, tasks }) => {
          const open = risks.filter((risk) => risk.status !== "CLOSED");
          const critical = open.filter((risk) => risk.level === "CRITICAL").length;
          const high = open.filter((risk) => risk.level === "HIGH").length;
          const openTasks = tasks.filter((task) => task.status !== "DONE").length;
          return <Link className="card project-card" href={`/projects/${project.id}/risks`} key={project.id}><div className="section-heading"><span className={critical ? "tag warning-tag" : "tag"}>未关闭 {open.length}</span><span className="muted">整改 {openTasks}</span></div><h2>{project.name}</h2><p className="muted">{project.city}{project.venue.district ? ` · ${project.venue.district}` : ""}</p><p className="card-foot">重大 {critical} · 高风险 {high} · 正式风险总数 {risks.length}</p></Link>;
        })}
        {!rows.length ? <div className="card empty-state"><h2>暂无可访问项目</h2></div> : null}
      </div>
    </AppShell>
  );
}
