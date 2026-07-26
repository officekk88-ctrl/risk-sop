import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listProjects, projectProgress } from "@/lib/mvp-store";

export default async function ChecklistsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">全局尽调</p><h1>尽调清单</h1><p className="muted">汇总所有可访问项目的完成度、不通过项和待核实项。</p></div><Link className="button" href="/projects/new">新建项目</Link></header>
      <div className="project-cards">
        {projects.map((project) => {
          const progress = projectProgress(project);
          const failed = project.checklist.filter((item) => item.status === "FAILED").length;
          const verify = project.checklist.filter((item) => item.status === "VERIFY").length;
          const todo = project.checklist.filter((item) => item.status === "TODO").length;
          return <Link className="card project-card" href={`/projects/${project.id}`} key={project.id}><div className="section-heading"><span className="tag">{progress.percent}%</span><span className="muted">{progress.completed}/{progress.total}</span></div><h2>{project.name}</h2><p className="muted">{project.city}{project.venue.district ? ` · ${project.venue.district}` : ""}</p><div className="progress full"><span style={{ width: `${progress.percent}%` }} /></div><p className="card-foot">不通过 {failed} · 待核实 {verify} · 待处理 {todo}</p></Link>;
        })}
        {!projects.length ? <div className="card empty-state"><h2>暂无项目</h2><p className="muted">创建项目后将自动生成37项尽调清单。</p></div> : null}
      </div>
    </AppShell>
  );
}
