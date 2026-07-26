import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectForm } from "@/components/project-form";
import { updateProjectAction } from "@/app/projects/actions";
import { getSession } from "@/lib/auth";
import { getProject } from "@/lib/mvp-store";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const project = await getProject(id, session.email, session.role);
  if (!project) notFound();
  const action = updateProjectAction.bind(null, id);
  return (
    <AppShell email={session.email}>
      <header className="page-header"><p className="eyebrow">编辑项目</p><h1>{project.name}</h1><p className="muted">修改项目及当前候选场地资料。</p></header>
      <ProjectForm action={action} project={project} />
    </AppShell>
  );
}
