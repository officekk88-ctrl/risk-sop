import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReviewLauncher } from "@/components/review-launcher";
import { getSession } from "@/lib/auth";
import { getProject, listAIReviews, listDocuments } from "@/lib/mvp-store";
import { decideFindingAction, finalizeNoFindingsAction } from "./actions";

const reviewStatusLabel = { PROCESSING: "处理中", REVIEW_REQUIRED: "待人工确认", CONFIRMED: "已完成确认", REJECTED: "已驳回/无风险转入", FAILED: "初审失败" };
const levelLabel = { CRITICAL: "重大", HIGH: "较高", MEDIUM: "一般", INFO: "提示" };
const confidenceLabel = { HIGH: "高置信度", MEDIUM: "中置信度", LOW: "低置信度" };

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [project, documents, reviews] = await Promise.all([
    getProject(id, session.email, session.role),
    listDocuments(id, session.email, session.role),
    listAIReviews(id, session.email, session.role),
  ]);
  if (!project || !documents || !reviews) notFound();
  const parsedDocuments = documents.filter((document) => document.parseStatus === "COMPLETED" && document.extractedText);
  const documentMap = new Map(documents.map((document) => [document.id, document]));

  return <AppShell email={session.email}>
    <header className="topbar page-header"><div><p className="eyebrow">AI 文件结构化初审</p><h1>{project.name}</h1><p className="muted">模型生成候选结果，只有人工逐条确认后才写入正式风险台账。</p></div><div className="header-actions"><Link className="button secondary" href={`/projects/${id}/risks`}>正式风险台账</Link><Link className="button secondary" href={`/projects/${id}`}>返回项目</Link></div></header>
    <section className="notice"><strong>人工确认边界</strong><span>低置信度、产权、合同效力、规划用途、消防、结构安全和法定资质事项必须由对应专业人员复核。确认操作代表“纳入内部风险管理”，不代表法律或行政结论。</span></section>
    <ReviewLauncher projectId={id} documents={parsedDocuments} />
    <section className="review-list">
      {reviews.map((review) => {
        const document = documentMap.get(review.documentId);
        return <article className="card review-card" key={review.id}>
          <div className="section-heading"><div><span className="item-code">{reviewStatusLabel[review.status]}</span><h2>{document?.fileName ?? "材料已删除"}</h2><p className="muted">审核规则 {review.promptVersion} · {new Date(review.createdAt).toLocaleString("zh-CN")}</p></div>{review.output ? <span className="tag">{confidenceLabel[review.output.overallConfidence]}</span> : null}</div>
          {review.status === "FAILED" ? <p className="error-text">{review.error || "初审失败"}</p> : null}
          {review.output ? <>
            <div className="review-summary"><div><strong>材料类型</strong><p>{review.output.documentType}</p></div><div><strong>摘要</strong><p>{review.output.summary}</p></div></div>
            {review.output.extractedFields.length ? <details className="review-details"><summary>查看提取字段（{review.output.extractedFields.length}）</summary><div className="field-results">{review.output.extractedFields.map((field, index) => <div key={`${field.label}-${index}`}><strong>{field.label}</strong><span>{field.value || "未识别"}</span><small>{confidenceLabel[field.confidence]} · {field.evidence || "无直接原文"}</small></div>)}</div></details> : null}
            {review.output.missingItems.length ? <details className="review-details" open><summary>缺失或待补材料（{review.output.missingItems.length}）</summary><ul>{review.output.missingItems.map((item, index) => <li key={`${item.item}-${index}`}><strong>{levelLabel[item.riskLevel]} · {item.item}</strong>：{item.reason}</li>)}</ul></details> : null}
            {review.output.limitations.length ? <div className="review-limitations"><strong>局限与人工复核</strong><ul>{review.output.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
            <div className="finding-list"><h3>候选风险（{review.output.findings.length}）</h3>{review.output.findings.map((finding) => {
              const decide = decideFindingAction.bind(null, id, review.id, finding.id);
              return <article className={`finding-card level-${finding.level.toLowerCase()}`} key={finding.id}>
                <div className="finding-meta"><span className="tag">{levelLabel[finding.level]}</span><span className="tag">{confidenceLabel[finding.confidence]}</span>{finding.requiresExpertReview ? <span className="tag warning-tag">必须专业复核</span> : null}<span className="muted">{finding.status === "PENDING" ? "待确认" : finding.status === "CONFIRMED" ? "已转正式风险" : "已驳回"}</span></div>
                {finding.status === "PENDING" ? <form action={decide} className="finding-form">
                  <label className="field field-wide">风险标题<input name="title" defaultValue={finding.title} required /></label>
                  <label className="field">风险等级<select name="level" defaultValue={finding.level}>{Object.entries(levelLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label className="field field-wide">风险描述<textarea name="description" defaultValue={finding.description} rows={3} required /></label>
                  <label className="field field-wide">原文依据<textarea name="evidence" defaultValue={finding.evidence} rows={2} /></label>
                  <label className="field field-wide">建议措施<textarea name="recommendation" defaultValue={finding.recommendation} rows={2} /></label>
                  <label className="field field-wide">确认或驳回说明<input name="decisionNote" placeholder="填写核验过程、修改理由或驳回依据" required /></label>
                  <div className="finding-actions"><button className="button" name="decision" value="CONFIRM" type="submit">确认并转正式风险</button><button className="danger-button bordered" name="decision" value="REJECT" type="submit">驳回候选风险</button></div>
                </form> : <div className="decision-result"><p><strong>处理说明：</strong>{finding.decisionNote}</p><p className="muted">{finding.decidedBy} · {finding.decidedAt ? new Date(finding.decidedAt).toLocaleString("zh-CN") : ""}</p>{finding.confirmedRiskId ? <Link className="button secondary mini" href={`/projects/${id}/risks`}>查看正式风险</Link> : null}</div>}
              </article>;
            })}</div>
            {!review.output.findings.length && review.status === "REVIEW_REQUIRED" ? <form action={finalizeNoFindingsAction.bind(null, id, review.id)} className="inline-form"><input name="note" placeholder="填写人工核验说明，确认本次无候选风险转入" required /><button className="button" type="submit">确认并归档本次结果</button></form> : null}
            {review.resolutionNote ? <p><strong>归档说明：</strong>{review.resolutionNote}</p> : null}
          </> : review.status === "PROCESSING" ? <p className="muted">正在等待 AI 返回结构化结果……</p> : null}
        </article>;
      })}
      {!reviews.length ? <div className="card empty-state"><h2>暂无初审记录</h2><p className="muted">先在材料中心完成文字解析，再从上方选择一份材料发起初审。</p></div> : null}
    </section>
  </AppShell>;
}
