import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectForm } from "@/components/project-form";
import { createProjectAction } from "@/app/projects/actions";
import { getSession } from "@/lib/auth";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <AppShell email={session.email}>
      <header className="page-header"><p className="eyebrow">新建项目</p><h1>建立候选场地档案</h1><p className="muted">创建后自动生成首版固定尽调清单。</p></header>
      <ProjectForm action={createProjectAction} />
    </AppShell>
  );
}
