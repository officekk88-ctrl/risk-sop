import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { getReport } from "@/lib/mvp-store";

const decisionLabel = { PROCEED: "建议推进", CONDITIONAL: "附条件推进", PAUSE: "暂缓推进", REJECT: "不建议推进" };
const checklistLabel = { TODO: "待处理", PASSED: "通过", FAILED: "不通过", VERIFY: "待核实", NOT_APPLICABLE: "不适用" };
const riskLevelLabel = { CRITICAL: "重大", HIGH: "较高", MEDIUM: "一般", INFO: "提示" };
const riskStatusLabel = { OPEN: "新发现", ANALYZING: "待分析", EVIDENCE_PENDING: "待补材料", MITIGATING: "整改中", REVIEW_PENDING: "待复核", ACCEPTED: "已接受", AVOIDED: "已规避", CLOSED: "已关闭", UNRESOLVED: "无法关闭" };

export default async function ReportPreviewPage({ params }: { params: Promise<{ id: string; reportId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, reportId } = await params;
  const report = await getReport(id, reportId, session.email, session.role);
  if (!report) notFound();
  const snapshot = report.snapshot;
  const flaggedChecklist = snapshot.checklist.filter((item) => item.status === "FAILED" || item.status === "VERIFY");

  return <AppShell email={session.email}>
    <header className="topbar page-header no-print"><div><p className="eyebrow">报告在线预览 · V{report.version}</p><h1>{snapshot.project.name}</h1><p className="muted">快照生成于 {new Date(snapshot.generatedAt).toLocaleString("zh-CN")}</p></div><div className="header-actions"><a className="button" href={`/api/projects/${id}/reports/${report.id}/pdf`}>下载 PDF</a><a className="button secondary" href={`/api/projects/${id}/reports/${report.id}/word`}>下载 Word</a><Link className="button secondary" href={`/projects/${id}/reports`}>返回报告列表</Link></div></header>
    <article className="report-paper">
      <div className="report-cover"><span>内部初审</span><h1>匹克球馆开馆综合审核报告</h1><h2>{snapshot.project.name}</h2><p>{snapshot.templateVersion} · V{report.version}</p><p>生成时间：{new Date(snapshot.generatedAt).toLocaleString("zh-CN")}</p></div>
      <section><h2>一、审核范围</h2><p>当前候选场地：{snapshot.project.venue.address || "地址待补充"}</p><p>本快照包含 {snapshot.documents.length} 份材料、{snapshot.checklist.length} 项清单、{snapshot.risks.length} 条正式风险和 {snapshot.tasks.length} 项整改任务。报告不包含待人工确认的 AI 候选风险。</p></section>
      <section><h2>二、项目与场地概况</h2><div className="report-kv"><strong>城市/区域</strong><span>{snapshot.project.city} / {snapshot.project.venue.district || "待补充"}</span><strong>地址</strong><span>{snapshot.project.venue.address || "待补充"}</span><strong>面积/净高</strong><span>{snapshot.project.venue.areaSqm ?? "未知"}㎡ / {snapshot.project.venue.clearHeightM ?? "未知"}m</span><strong>证载/拟经营用途</strong><span>{snapshot.project.venue.certificateUsage || "待核实"} / {snapshot.project.venue.intendedUsage || "匹克球馆"}</span></div></section>
      <section><h2>三、已取得及缺失材料</h2>{snapshot.documents.length ? <table><thead><tr><th>材料</th><th>分类</th><th>解析状态</th><th>页数</th></tr></thead><tbody>{snapshot.documents.map((document) => <tr key={document.id}><td>{document.fileName}</td><td>{document.category}</td><td>{document.parseStatus}</td><td>{document.pageCount ?? "—"}</td></tr>)}</tbody></table> : <p>当前快照未登记有效材料。</p>}</section>
      <section><h2>四、尽调检查结果</h2><p>{Object.entries(snapshot.checklistSummary).map(([status, count]) => `${checklistLabel[status as keyof typeof checklistLabel]} ${count}`).join("；")}</p>{flaggedChecklist.length ? <ul>{flaggedChecklist.map((item) => <li key={item.code}><strong>{item.code} {item.title}</strong>：{checklistLabel[item.status]}；{item.note || "无核实备注"}</li>)}</ul> : <p>当前没有已标记不通过或待核实的检查项。</p>}</section>
      <section><h2>五、主要风险</h2>{snapshot.risks.length ? snapshot.risks.map((risk) => <div className={`report-risk level-${risk.level.toLowerCase()}`} key={risk.id}><h3>{riskLevelLabel[risk.level]} / {riskStatusLabel[risk.status]} · {risk.title}</h3><p><strong>事实与依据：</strong>{risk.evidence || risk.description}</p><p><strong>建议措施：</strong>{risk.recommendation || "待制定"}</p><p className="muted">来源：{risk.source === "AI_REVIEW" ? "AI 初审后人工确认" : "人工登记"}</p></div>) : <p>当前没有已确认正式风险；这不代表项目不存在风险。</p>}</section>
      <section><h2>六、整改与待办</h2>{snapshot.tasks.length ? <table><thead><tr><th>任务</th><th>负责人</th><th>截止日期</th><th>状态</th></tr></thead><tbody>{snapshot.tasks.map((task) => <tr key={task.id}><td>{task.title}</td><td>{task.assigneeEmail}</td><td>{task.dueDate}</td><td>{task.status}</td></tr>)}</tbody></table> : <p>当前没有已登记整改任务。</p>}</section>
      <section><h2>七、阶段决策与专家意见</h2>{snapshot.decisionGates?.length ? <ul>{snapshot.decisionGates.filter((gate)=>gate.decision!=="PENDING").map((gate)=><li key={gate.id}><strong>{gate.name}</strong>：{gate.decision}；{gate.rationale}</li>)}</ul>:<p>暂无已审批决策门。</p>}{snapshot.expertAssignments?.length ? snapshot.expertAssignments.map((item)=><div className="report-risk" key={item.id}><h3>{item.title} · {item.expertName}</h3><p>{item.opinion}</p><p className="muted">资质/范围：{item.qualification || "待核验"}</p></div>):<p>暂无已交付的专家意见。</p>}</section>
      <section><h2>八、综合决策建议</h2><div className="decision-box"><strong>{decisionLabel[snapshot.decision.outcome]}</strong><p>{snapshot.decision.rationale}</p><small>{snapshot.decision.decidedBy} · {new Date(snapshot.decision.decidedAt).toLocaleString("zh-CN")}</small></div></section>
      <section><h2>九、推进前置条件</h2><ol>{snapshot.conditions.map((condition, index) => <li key={index}>{condition}</li>)}</ol></section>
      <section><h2>十、适用边界与声明</h2><p>{snapshot.disclaimer}</p><p>政策和主管部门口径可能变化，涉及属地要求的事项应在关键决策前再次核验。本报告是内部风险管理文件，不是行政许可、验收证明、法律意见或专业鉴定报告。</p></section>
      <footer>开馆风控台 · {snapshot.templateVersion} · 报告 V{report.version}</footer>
    </article>
  </AppShell>;
}
