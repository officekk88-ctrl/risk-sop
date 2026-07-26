import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { deleteDocumentAction, parseDocumentAction, uploadDocumentAction } from "./actions";
import { getSession } from "@/lib/auth";
import { getProject, listDocuments } from "@/lib/mvp-store";

const categoryLabel = { OWNERSHIP: "产权", AUTHORIZATION: "授权/转租", CONTRACT: "租赁合同", FIRE: "消防", PLANNING: "规划", ENGINEERING: "工程", SITE_PHOTO: "现场照片", OTHER: "其他" };
const parseLabel = { PENDING: "待解析", PROCESSING: "解析中", COMPLETED: "已解析", FAILED: "解析失败" };

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const project = await getProject(id, session.email, session.role);
  const documents = await listDocuments(id, session.email, session.role);
  if (!project || !documents) notFound();
  const uploadAction = uploadDocumentAction.bind(null, id);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">材料与证据</p><h1>{project.name}</h1><p className="muted">上传文件受项目权限保护，当前单文件上限 10MB。</p></div><div className="header-actions"><Link className="button" href={`/projects/${id}/reviews`}>AI 材料初审</Link><Link className="button secondary" href={`/projects/${id}`}>返回项目</Link></div></header>
      <form action={uploadAction} className="card form-grid compact-form">
        <label className="field">材料分类<select name="category" defaultValue="CONTRACT">{Object.entries(categoryLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="field field-wide">选择文件（最多20份）<input name="files" type="file" accept=".pdf,.docx,.xlsx,.zip,.jpg,.jpeg,.png" multiple required /></label>
        <label className="field">材料来源<input name="source" placeholder="产权人/主管部门/现场取得" /></label><label className="field">提供人<input name="provider" /></label>
        <label className="field">证据形态<select name="evidenceForm" defaultValue="SCAN"><option value="ORIGINAL_VERIFIED">原件已核验</option><option value="COPY">复印件</option><option value="SCAN">扫描件</option><option value="ORIGINAL_PENDING">待核原件</option></select></label>
        <label className="field">有效期至<input name="expiresAt" type="date" /></label><label className="field field-wide">标签<input name="tags" placeholder="逗号分隔，如：签约前、消防、关键材料" /></label><label className="checkbox-field"><input name="sensitive" type="checkbox" />敏感文件（限制下载并标记）</label>
        <div className="form-actions"><button className="button" type="submit">批量上传材料</button></div>
      </form>
      <section className="card table-card">
        <div className="section-heading"><div><h2>项目文件</h2><p className="muted">{documents.length} 份有效材料</p></div></div>
        <div className="data-list">
          {documents.map((document) => {
            const remove = deleteDocumentAction.bind(null, id, document.id);
            const parse = parseDocumentAction.bind(null, id, document.id);
            return <div className="document-block" key={document.id}><div className="data-row"><div className="file-icon">{document.fileName.split(".").pop()?.toUpperCase()}</div><div className="data-main"><strong>{document.fileName} <small>V{document.version ?? 1}{document.sensitive ? " · 敏感" : ""}</small></strong><span className="muted">{categoryLabel[document.category]} · {fileSize(document.sizeBytes)} · {new Date(document.createdAt).toLocaleString("zh-CN")} · {parseLabel[document.parseStatus]}{document.pageCount ? ` · ${document.pageCount} 页` : ""}</span><span className="muted">来源：{document.source || "待补充"} · 提供人：{document.provider || "待补充"} · {document.evidenceForm || "SCAN"}{document.expiresAt ? ` · 有效期 ${document.expiresAt}` : ""}{document.tags?.length ? ` · ${document.tags.join(" / ")}` : ""}</span>{document.parseError ? <span className="error-text">{document.parseError}</span> : null}</div>{!document.fileName.toLowerCase().endsWith(".zip")?<form action={parse}><button className="button secondary mini" type="submit">{document.parseStatus === "COMPLETED" ? "重新解析" : "解析"}</button></form>:null}<a className="button secondary mini" href={`/api/projects/${id}/documents/${document.id}`} target="_blank">查看</a><a className="button secondary mini" href={`/api/projects/${id}/documents/${document.id}?download=1`}>下载</a><form action={remove}><button className="danger-button" type="submit">删除</button></form></div>{document.extractedText ? <details className="parsed-preview"><summary>查看已提取文字</summary><pre>{document.extractedText.slice(0, 6000)}</pre></details> : null}</div>;
          })}
          {!documents.length ? <div className="empty-state"><h2>暂无材料</h2><p className="muted">上传权属、合同或消防资料后，可在后续任务中交给 AI 初审。</p></div> : null}
        </div>
      </section>
    </AppShell>
  );
}
