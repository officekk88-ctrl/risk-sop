import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { KnowledgeEntryDialog } from "@/components/knowledge-entry-dialog";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getSession } from "@/lib/auth";
import type { KnowledgeCategory, KnowledgeStatus } from "@/lib/domain";
import { KNOWLEDGE_CATEGORIES, knowledgeCategoryLabel } from "@/lib/knowledge-base";
import { listKnowledgeEntryDetails, listKnowledgeSourceDocuments } from "@/lib/mvp-store";
import { isAIConfigured } from "@/lib/openai-client";
import { importKnowledgeDocumentAction, submitKnowledgeAction, updateKnowledgeAction } from "./actions";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string; origin?: string; notice?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [params, details, sourceDocuments] = await Promise.all([
    searchParams,
    listKnowledgeEntryDetails({ email: session.email, role: session.role, includeUnpublished: session.role === "ADMIN" }),
    listKnowledgeSourceDocuments({ email: session.email, role: session.role }),
  ]);
  const entries = details.map((item) => item.entry);
  const query = (params.q ?? "").trim().toLowerCase();
  const category = KNOWLEDGE_CATEGORIES.some((item) => item.value === params.category) ? params.category as KnowledgeCategory : "";
  const status = ["PENDING", "PUBLISHED", "ARCHIVED"].includes(params.status ?? "") ? params.status as KnowledgeStatus : "";
  const origin = ["MANUAL", "DOCUMENT_IMPORT", "AI_CONSULTATION", "SYSTEM_SEED"].includes(params.origin ?? "") ? params.origin : "";
  const filteredDetails = details.filter(({ entry }) => (!category || entry.category === category) && (!status || entry.status === status) && (!origin || entry.origin === origin) && (!query || `${entry.code} ${entry.title} ${entry.summary} ${entry.content} ${entry.keywords.join(" ")}`.toLowerCase().includes(query)));
  const published = entries.filter((entry) => entry.status === "PUBLISHED").length;
  const pending = entries.filter((entry) => entry.status === "PENDING").length;
  const categoriesUsed = new Set(entries.filter((entry) => entry.status === "PUBLISHED").map((entry) => entry.category)).size;
  const consultationLearned = entries.filter((entry) => entry.origin === "AI_CONSULTATION").length;

  return <AppShell email={session.email}>
    <header className="topbar page-header"><div><p className="eyebrow">可审核的长期记忆</p><h1>专业知识库</h1><p className="muted">按开馆尽调领域沉淀经验。只有已审核发布的知识会参与 AI 咨询。</p></div></header>
    {params.notice ? <div className="notice admin-success"><strong>操作成功</strong><span>{params.notice}</span></div> : null}
    {params.error ? <div className="form-error admin-page-error"><strong>操作未完成：</strong>{params.error}</div> : null}

    <div className="stats compact-stats knowledge-stats">
      <article className="card"><span className="stat-label">已发布记忆</span><strong className="stat-value">{published}</strong><span className="stat-foot">可供 AI 检索</span></article>
      <article className="card"><span className="stat-label">待审核学习</span><strong className="stat-value">{pending}</strong><span className="stat-foot">候选知识</span></article>
      <article className="card"><span className="stat-label">已覆盖领域</span><strong className="stat-value">{categoriesUsed}</strong><span className="stat-foot">共 {KNOWLEDGE_CATEGORIES.length} 类</span></article>
      <article className="card"><span className="stat-label">咨询自动学习</span><strong className="stat-value">{consultationLearned}</strong><span className="stat-foot">每轮问答自动沉淀</span></article>
    </div>

    <section className="card knowledge-categories">
      <div className="section-heading"><div><h2>尽调专业领域</h2><p className="muted">点击领域后直接查看该领域的知识条目。</p></div></div>
      <div className="category-grid">{KNOWLEDGE_CATEGORIES.map((item) => <Link className="knowledge-category-link" href={`/knowledge?category=${item.value}#knowledge-entries`} key={item.value}><strong>{item.label}</strong><span>{item.description}</span><em>查看该领域知识 →</em></Link>)}</div>
    </section>

    <section className="knowledge-library" id="knowledge-entries">
      <div className="section-heading"><div><h2>知识条目{category ? ` · ${knowledgeCategoryLabel(category)}` : ""}</h2><p className="muted">共显示 {filteredDetails.length} 条。点击任一条目，在弹窗中查看完整内容与来源。</p></div></div>
      <form className="knowledge-filter" method="get" action="/knowledge#knowledge-entries">
        <input name="q" defaultValue={params.q} placeholder="搜索标题、摘要、正文或关键词" />
        <select name="category" defaultValue={category}><option value="">全部领域</option>{KNOWLEDGE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select name="origin" defaultValue={origin}><option value="">全部来源</option><option value="AI_CONSULTATION">AI 咨询学习</option><option value="SYSTEM_SEED">系统专业知识</option><option value="DOCUMENT_IMPORT">文档导入</option><option value="MANUAL">人工提交</option></select>
        <select name="status" defaultValue={status}><option value="">全部状态</option><option value="PENDING">待审核</option><option value="PUBLISHED">已发布</option><option value="ARCHIVED">已归档</option></select>
        <button className="button secondary" type="submit">筛选</button>
      </form>
      <div className="knowledge-list">
        {filteredDetails.map((item) => <KnowledgeEntryDialog key={item.entry.id} {...item} />)}
        {!filteredDetails.length ? <div className="card empty-state"><h2>暂无匹配知识</h2><p className="muted">可在页面底部添加新的学习内容。</p></div> : null}
      </div>
    </section>

    <div className="knowledge-management-divider"><span>添加与管理</span></div>

    <section className="card knowledge-submit knowledge-import">
      <div className="section-heading"><div><h2>AI 文档阅读与导入</h2><p className="muted">上传后自动解析全文，由 AI 拆分、分类并生成待审核知识。支持 PDF、Word、Markdown、Excel 和 TXT，单文件最大 10MB。</p></div></div>
      {!isAIConfigured() ? <div className="notice"><strong>AI 服务未启用</strong><span>请先在服务端配置自己的 OPENAI_API_KEY 和 OPENAI_MODEL。</span></div> : null}
      <form action={importKnowledgeDocumentAction} className="knowledge-upload-form"><label className="field"><span>选择知识文档</span><input name="file" type="file" accept=".pdf,.docx,.md,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/markdown,text/plain" required /></label><PendingSubmitButton idleText="上传并调用 AI 阅读" pendingText="正在解析并调用 AI，请稍候…" disabled={!isAIConfigured()} /></form>
      <p className="muted knowledge-upload-note">导入结果不会自动发布。请管理员检查分类、原文准确性和适用范围后再发布。</p>
      {sourceDocuments.length ? <details className="knowledge-import-history"><summary>查看最近导入记录（{sourceDocuments.length}）</summary><div className="knowledge-source-list">{sourceDocuments.slice(0, 20).map((source) => <article key={source.id}><div><strong>{source.fileName}</strong><span className={`tag source-${source.status.toLowerCase()}`}>{source.status === "PROCESSING" ? "处理中" : source.status === "IMPORTED" ? "已完成" : "失败"}</span></div><p>{source.status === "FAILED" ? source.error : source.aiSummary || "正在解析并等待 AI 阅读……"}</p><small>{new Date(source.createdAt).toLocaleString("zh-CN")} · {(source.sizeBytes / 1024).toFixed(1)} KB · 生成 {source.entryIds.length} 条</small></article>)}</div></details> : null}
    </section>

    <section className="card knowledge-submit">
      <div className="section-heading"><div><h2>添加知识</h2><p className="muted">任何项目成员均可提交；内容先进入待审核区，不会立即影响 AI 判断。</p></div></div>
      <form action={submitKnowledgeAction} className="form-grid">
        <label className="field"><span>专业领域</span><select name="category" defaultValue={category || "SITE_PROPERTY"} required>{KNOWLEDGE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="field"><span>知识标题</span><input name="title" minLength={2} maxLength={100} required /></label>
        <label className="field field-wide"><span>摘要</span><textarea name="summary" rows={2} minLength={5} maxLength={300} required /></label><label className="field field-wide"><span>知识正文</span><textarea name="content" rows={6} minLength={10} maxLength={12000} placeholder="写明适用条件、判断方法、所需证据、例外情况和建议复核人……" required /></label>
        <label className="field"><span>关键词</span><input name="keywords" maxLength={300} placeholder="消防，验收，疏散（逗号分隔）" /></label><label className="field"><span>来源</span><input name="sourceName" maxLength={200} placeholder="法规名称、专家意见或项目复盘" /></label><label className="field"><span>来源链接</span><input name="sourceUrl" type="url" maxLength={1000} placeholder="https://…（可选）" /></label>
        <div className="form-actions"><button className="button" type="submit">保存为待审核知识</button></div>
      </form>
    </section>

    {session.role === "ADMIN" ? <section className="knowledge-review-section">
      <div className="section-heading"><div><h2>审核与维护</h2><p className="muted">审核当前筛选范围内的知识，发布后才会参与 AI 检索。</p></div></div>
      <div className="knowledge-list">{filteredDetails.map(({ entry }) => <article className="card knowledge-entry" key={entry.id}><details><summary>{entry.status === "PENDING" ? "待审核 · " : "维护 · "}{entry.title}</summary><form action={updateKnowledgeAction.bind(null, entry.id)} className="form-grid knowledge-edit">
        <label className="field"><span>专业领域</span><select name="category" defaultValue={entry.category}>{KNOWLEDGE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="field"><span>状态</span><select name="status" defaultValue={entry.status}><option value="PENDING">待审核</option><option value="PUBLISHED">审核并发布</option><option value="ARCHIVED">归档停用</option></select></label>
        <label className="field field-wide"><span>标题</span><input name="title" defaultValue={entry.title} minLength={2} maxLength={100} required /></label><label className="field field-wide"><span>摘要</span><textarea name="summary" defaultValue={entry.summary} rows={2} minLength={5} maxLength={300} required /></label><label className="field field-wide"><span>正文</span><textarea name="content" defaultValue={entry.content} rows={7} minLength={10} maxLength={12000} required /></label>
        <label className="field"><span>关键词</span><input name="keywords" defaultValue={entry.keywords.join("，")} maxLength={300} /></label><label className="field"><span>来源</span><input name="sourceName" defaultValue={entry.sourceName} maxLength={200} /></label><label className="field"><span>来源链接</span><input name="sourceUrl" type="url" defaultValue={entry.sourceUrl} maxLength={1000} /></label><div className="form-actions"><button className="button" type="submit">保存审核结果</button></div>
      </form></details></article>)}</div>
    </section> : null}
  </AppShell>;
}
