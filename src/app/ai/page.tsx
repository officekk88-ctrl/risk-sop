import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listConversations, listDocuments, listProjects } from "@/lib/mvp-store";

export default async function AIHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const rows = await Promise.all(projects.map(async (project) => ({ project, conversations: await listConversations(project.id, session.email, session.role) ?? [], documents: await listDocuments(project.id, session.email, session.role) ?? [] })));

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">AI工作区</p><h1>AI 专家咨询</h1><p className="muted">选择项目进入在线咨询或材料结构化初审。AI输出不替代领域专家结论。</p></div></header>
      <div className="project-cards">
        {rows.map(({ project, conversations, documents }) => {
          const parsed = documents.filter((item) => item.parseStatus === "COMPLETED" && item.extractedText).length;
          return <article className="card project-card" key={project.id}><div className="section-heading"><span className="tag">{conversations.length} 个会话</span><span className="muted">{parsed} 份可审材料</span></div><h2>{project.name}</h2><p className="muted">{project.city}{project.venue.district ? ` · ${project.venue.district}` : ""}</p><div className="header-actions"><Link className="button" href={`/projects/${project.id}/ai`}>开始咨询</Link><Link className="button secondary" href={`/projects/${project.id}/reviews`}>材料初审</Link></div></article>;
        })}
        {!rows.length ? <div className="card empty-state"><h2>暂无可访问项目</h2></div> : null}
      </div>
    </AppShell>
  );
}
