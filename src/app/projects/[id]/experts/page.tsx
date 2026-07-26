import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { getProject, listDocuments, listExpertAssignments, listRisks } from "@/lib/mvp-store";
import { createExpertAction, updateExpertAction } from "./actions";

const specialty = { LEGAL:"法律与租赁", POLICY:"政策许可", FIRE:"消防", STRUCTURE:"结构安全", ENGINEERING:"设计工程", FINANCE:"投资财务", OPERATIONS:"运营安全保险" };
const statusLabel = { PENDING:"待接单", ACCEPTED:"已接受", MORE_INFO:"待补材料", DELIVERED:"已交付", CONFIRMED:"内部确认", RETURNED:"已退回" };
export default async function ExpertsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) redirect("/login"); const { id } = await params;
  const [project, assignments, risks, documents] = await Promise.all([getProject(id,session.email,session.role),listExpertAssignments(id,session.email,session.role),listRisks(id,session.email,session.role),listDocuments(id,session.email,session.role)]);
  if (!project || !assignments || !risks || !documents) notFound();
  return <AppShell email={session.email}><header className="topbar page-header"><div><p className="eyebrow">人机协同</p><h1>专家复核 · {project.name}</h1><p className="muted">正式法律意见、消防检测、结构鉴定等必须交由具备资质的人员或机构处理。</p></div><Link className="button secondary" href={`/projects/${id}/operations`}>返回全流程</Link></header>
    <section className="notice"><strong>专业责任边界</strong><span>AI 输出不替代现场勘察、检测、鉴定、行政确认或依法需要的专业签章。</span></section>
    <details className="card create-panel" open={!assignments.length}><summary>发起专家复核</summary><form action={createExpertAction.bind(null,id)} className="form-grid compact-form">
      <label className="field">专业领域<select name="specialty">{Object.entries(specialty).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field">紧急程度<select name="urgency"><option value="NORMAL">普通</option><option value="URGENT">紧急</option></select></label>
      <label className="field">来源类型<select name="sourceType"><option value="GENERAL">综合事项</option><option value="RISK">风险</option><option value="DOCUMENT">文件</option><option value="CHECKLIST">清单</option><option value="AI_CONVERSATION">AI咨询</option></select></label><label className="field">关联对象<select name="sourceId"><option value="">不关联</option>{risks.map((risk)=><option value={risk.id} key={risk.id}>风险：{risk.title}</option>)}{documents.map((doc)=><option value={doc.id} key={doc.id}>材料：{doc.fileName}</option>)}</select></label>
      <label className="field field-wide">问题标题<input name="title" required /></label><label className="field field-wide">标准化问题包<textarea name="question" required placeholder="说明需复核的事实、已有材料、争议点和期望交付成果" /></label>
      <label className="field">交付日期<input name="dueDate" type="date" required /></label><label className="field">专家姓名/机构<input name="expertName" required /></label><label className="field">专家邮箱<input name="expertEmail" type="email" required /></label><label className="field">资质与服务范围<input name="qualification" /></label><label className="field">资质有效期<input name="qualificationExpiresAt" type="date" /></label><div className="form-actions"><button className="button" type="submit">生成并发送复核委托</button></div>
    </form></details>
    <section className="risk-board">{assignments.map((item)=><article className="card" key={item.id}><div className="section-heading"><div><span className="item-code">{specialty[item.specialty]} · {statusLabel[item.status]}</span><h2>{item.title}</h2></div><span className="tag">{item.urgency === "URGENT" ? "紧急" : "普通"}</span></div><p>{item.question}</p><p className="muted">专家：{item.expertName}（{item.expertEmail}） · 资质：{item.qualification || "待核验"} · 交付 {item.dueDate}</p><form action={updateExpertAction.bind(null,id,item.id)} className="form-grid compact-form"><label className="field">复核状态<select name="status" defaultValue={item.status}>{Object.entries(statusLabel).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className="field field-wide">专业意见/补充材料要求<textarea name="opinion" defaultValue={item.opinion} /></label><div className="form-actions"><button className="button mini" type="submit">保存复核记录</button></div></form></article>)}{!assignments.length?<div className="card empty-state"><h2>暂无专家委托</h2><p>可从风险、材料或综合事项发起复核。</p></div>:null}</section>
  </AppShell>;
}
