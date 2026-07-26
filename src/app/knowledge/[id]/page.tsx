import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { knowledgeCategoryLabel } from "@/lib/knowledge-base";
import { getKnowledgeEntryDetail } from "@/lib/mvp-store";
import type { KnowledgeStatus } from "@/lib/domain";

const statusLabels: Record<KnowledgeStatus, string> = { PENDING: "待审核", PUBLISHED: "已发布", ARCHIVED: "已归档" };
const originLabels = { MANUAL: "人工提交", DOCUMENT_IMPORT: "文档导入", AI_CONSULTATION: "AI 咨询自动学习", SYSTEM_SEED: "系统基础知识" } as const;

function dateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const detail = await getKnowledgeEntryDetail({ entryId: id, email: session.email, role: session.role });
  if (!detail) notFound();
  const { entry, createdByLabel, updatedByLabel } = detail;

  return <AppShell email={session.email}>
    <header className="topbar page-header"><div><p className="eyebrow">{knowledgeCategoryLabel(entry.category)}</p><h1>{entry.title}</h1><p className="muted">{entry.code} · v{entry.version}</p></div><Link className="button secondary" href={`/knowledge?category=${entry.category}`}>返回该领域知识库</Link></header>

    <article className="card knowledge-detail">
      <div className="knowledge-detail-tags"><span className={`tag knowledge-status-${entry.status.toLowerCase()}`}>{statusLabels[entry.status]}</span><span className="tag">{originLabels[entry.origin]}</span></div>
      <section><h2>摘要</h2><p>{entry.summary}</p></section>
      <section><h2>详细正文</h2><div className="knowledge-content">{entry.content}</div></section>
      <section><h2>来源</h2><p>{entry.sourceName || "未注明来源"}</p>{entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noreferrer">打开公开来源 ↗</a> : null}{entry.projectId ? <p><Link href={`/projects/${entry.projectId}/ai`}>查看原 AI 咨询项目</Link></p> : null}</section>
      <section><h2>关键词</h2><div className="knowledge-detail-tags">{entry.keywords.length ? entry.keywords.map((keyword) => <span className="tag" key={keyword}>{keyword}</span>) : <span className="muted">暂无关键词</span>}</div></section>
      <dl className="knowledge-metadata">
        <div><dt>创建时间</dt><dd>{dateTime(entry.createdAt)}</dd></div>
        <div><dt>更新时间</dt><dd>{dateTime(entry.updatedAt)}</dd></div>
        <div><dt>创建者</dt><dd>{createdByLabel}</dd></div>
        <div><dt>更新者</dt><dd>{updatedByLabel}</dd></div>
      </dl>
    </article>
  </AppShell>;
}
