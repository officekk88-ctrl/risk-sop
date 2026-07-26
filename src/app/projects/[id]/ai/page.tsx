import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectNavigation } from "@/components/project-navigation";
import { AIChat } from "@/components/ai-chat";
import { getSession } from "@/lib/auth";
import { resolveProjectRole } from "@/lib/domain";
import { getProject, listConversations, listDocuments, listRisks, listTasks } from "@/lib/mvp-store";
import { isAIConfigured } from "@/lib/openai-client";

export default async function AIPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [project, documents, conversations, risks, tasks] = await Promise.all([
    getProject(id, session.email, session.role),
    listDocuments(id, session.email, session.role),
    listConversations(id, session.email, session.role),
    listRisks(id, session.email, session.role), listTasks(id, session.email, session.role),
  ]);
  if (!project || !documents || !conversations) notFound();
  const projectRole = resolveProjectRole(project, session.email, session.role);
  const latest = conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const parsedDocuments = documents.filter((document) => document.parseStatus === "COMPLETED" && document.extractedText);

  return <AppShell email={session.email}>
    <header className="topbar page-header"><div><p className="eyebrow">{project.name}</p><h1>AI 风险助手</h1><p className="muted">结合项目、清单、风险、任务和所选材料提供辅助分析。</p></div></header>
    <ProjectNavigation projectId={id} role={projectRole} />
    {!isAIConfigured() ? <section className="notice"><strong>AI 服务未启用</strong><span>请在服务端配置自己的 OPENAI_API_KEY 和 OPENAI_MODEL；浏览器不会接触密钥。</span></section> : null}
    <section className="notice"><strong>AI 辅助分析与自动学习</strong><span>每轮完整问答会自动进入知识库待审核区，用户可查看学习记录；审核发布前不会用于后续回答。AI 不替代专业意见或主管部门审批。</span></section>
    <AIChat projectId={id} documents={parsedDocuments} risks={risks ?? []} tasks={tasks ?? []} initialConversationId={latest?.id} initialMessages={latest?.messages ?? []} />
  </AppShell>;
}
