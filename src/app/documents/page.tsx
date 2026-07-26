import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listDocuments, listProjects } from "@/lib/mvp-store";

export default async function DocumentsHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const rows = await Promise.all(projects.map(async (project) => ({ project, documents: await listDocuments(project.id, session.email, session.role) ?? [] })));
  const total = rows.reduce((sum, row) => sum + row.documents.length, 0);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">全局材料</p><h1>材料中心</h1><p className="muted">当前可访问项目共 {total} 份有效材料，按项目进入上传、解析、预览和下载。</p></div></header>
      <div className="project-cards">
        {rows.map(({ project, documents }) => {
          const completed = documents.filter((item) => item.parseStatus === "COMPLETED").length;
          const failed = documents.filter((item) => item.parseStatus === "FAILED").length;
          const pending = documents.length - completed - failed;
          return <Link className="card project-card" href={`/projects/${project.id}/documents`} key={project.id}><div className="section-heading"><span className="tag">{documents.length} 份</span><span className="muted">已解析 {completed}</span></div><h2>{project.name}</h2><p className="muted">{project.city}{project.venue.district ? ` · ${project.venue.district}` : ""}</p><p className="card-foot">待处理 {pending} · 解析失败 {failed} · 点击进入项目材料</p></Link>;
        })}
        {!rows.length ? <div className="card empty-state"><h2>暂无可访问项目</h2></div> : null}
      </div>
    </AppShell>
  );
}
