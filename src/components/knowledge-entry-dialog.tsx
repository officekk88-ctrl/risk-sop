"use client";

import { useRef } from "react";
import Link from "next/link";
import type { KnowledgeEntry, KnowledgeStatus } from "@/lib/domain";
import { knowledgeCategoryLabel } from "@/lib/knowledge-base";

const statusLabels: Record<KnowledgeStatus, string> = { PENDING: "待审核", PUBLISHED: "已发布", ARCHIVED: "已归档" };
const originLabels = { MANUAL: "人工提交", DOCUMENT_IMPORT: "文档导入", AI_CONSULTATION: "AI 咨询自动学习", SYSTEM_SEED: "系统基础知识" } as const;

function dateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

export function KnowledgeEntryDialog({ entry, createdByLabel, updatedByLabel }: { entry: KnowledgeEntry; createdByLabel: string; updatedByLabel: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <>
    <article className="card knowledge-entry">
      <button className="knowledge-entry-button" type="button" onClick={() => dialogRef.current?.showModal()}>
        <div className="knowledge-entry-head"><div><span className={`tag knowledge-status-${entry.status.toLowerCase()}`}>{statusLabels[entry.status]}</span>{entry.origin === "AI_CONSULTATION" ? <span className="tag knowledge-origin-ai">AI 自动学习</span> : null}<span className="knowledge-code">{entry.code} · v{entry.version}</span><h3>{entry.title}</h3><p className="muted">{knowledgeCategoryLabel(entry.category)} · 来源：{entry.sourceName || "未注明"}</p></div><span className="muted">更新于 {new Date(entry.updatedAt).toLocaleDateString("zh-CN")}</span></div>
        <p className="knowledge-summary">{entry.summary}</p>
      </button>
    </article>
    <dialog className="knowledge-dialog" ref={dialogRef} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}>
      <div className="knowledge-dialog-inner">
        <header><div><div className="knowledge-detail-tags"><span className={`tag knowledge-status-${entry.status.toLowerCase()}`}>{statusLabels[entry.status]}</span><span className="tag">{originLabels[entry.origin]}</span></div><h2>{entry.title}</h2><p className="muted">{entry.code} · v{entry.version} · {knowledgeCategoryLabel(entry.category)}</p></div><button aria-label="关闭知识详情" className="knowledge-dialog-close" type="button" onClick={() => dialogRef.current?.close()}><span aria-hidden="true">×</span>关闭</button></header>
        <section><h3>摘要</h3><p>{entry.summary}</p></section>
        <section><h3>详细正文</h3><div className="knowledge-content">{entry.content}</div></section>
        <section><h3>来源</h3><p>{entry.sourceName || "未注明来源"}</p>{entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noreferrer">打开公开来源 ↗</a> : null}{entry.projectId ? <p><Link href={`/projects/${entry.projectId}/ai`}>查看原 AI 咨询项目</Link></p> : null}</section>
        <section><h3>关键词</h3><div className="knowledge-detail-tags">{entry.keywords.length ? entry.keywords.map((keyword) => <span className="tag" key={keyword}>{keyword}</span>) : <span className="muted">暂无关键词</span>}</div></section>
        <dl className="knowledge-metadata"><div><dt>创建时间</dt><dd>{dateTime(entry.createdAt)}</dd></div><div><dt>更新时间</dt><dd>{dateTime(entry.updatedAt)}</dd></div><div><dt>创建者</dt><dd>{createdByLabel}</dd></div><div><dt>更新者</dt><dd>{updatedByLabel}</dd></div></dl>
      </div>
    </dialog>
  </>;
}
