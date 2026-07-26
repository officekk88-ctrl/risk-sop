import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectNavigation } from "@/components/project-navigation";
import { getSession } from "@/lib/auth";
import { resolveProjectRole } from "@/lib/domain";
import { getProject, listReports } from "@/lib/mvp-store";
import { generateReportAction, voidReportAction } from "./actions";

const decisionLabel = { PROCEED: "建议推进", CONDITIONAL: "附条件推进", PAUSE: "暂缓推进", REJECT: "不建议推进" };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const [project, reports] = await Promise.all([getProject(id, session.email, session.role), listReports(id, session.email, session.role)]);
  if (!project || !reports) notFound();
  const projectRole = resolveProjectRole(project, session.email, session.role);
  const generate = generateReportAction.bind(null, id);

  return <AppShell email={session.email}>
    <header className="topbar page-header"><div><p className="eyebrow">{project.name}</p><h1>决策报告</h1><p className="muted">汇总已确认事实、正式风险和人工意见，形成可追溯的报告快照。</p></div></header>
    <ProjectNavigation projectId={id} role={projectRole} />
    <section className="notice"><strong>报告边界</strong><span>决策结论由当前用户人工选择；报告仅使用正式风险和已登记业务数据，不包含待确认 AI 候选风险。</span></section>
    <details className="card create-panel" open={!reports.length}><summary>生成新版本报告</summary>
      <form action={generate} className="form-grid compact-form">
        <label className="field">阶段建议<select name="outcome" defaultValue="CONDITIONAL">{Object.entries(decisionLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="field field-wide">人工决策说明<textarea name="rationale" rows={4} placeholder="说明选择该建议的已确认事实、未关闭风险和适用条件（至少 10 个字）" required /></label>
        <div className="form-actions"><button className="button" type="submit">生成不可变快照</button></div>
      </form>
    </details>
    <section className="card table-card"><div className="section-heading"><div><h2>报告版本</h2><p className="muted">共 {reports.length} 个版本</p></div></div><div className="data-list">
      {reports.map((report) => <div className="data-row" key={report.id}><div className="file-icon">V{report.version}</div><div className="data-main"><strong>{decisionLabel[report.snapshot.decision.outcome]} · {report.snapshot.templateVersion}</strong><span className="muted">{new Date(report.createdAt).toLocaleString("zh-CN")} · {report.createdBy} · {report.status === "FINAL" ? "已固化" : "已作废"}</span><span className="muted">快照：材料 {report.snapshot.documents.length} · 风险 {report.snapshot.risks.length} · 任务 {report.snapshot.tasks.length} · 专家意见 {report.snapshot.expertAssignments?.length ?? 0}</span></div><Link className="button secondary mini" href={`/projects/${id}/reports/${report.id}`}>在线预览</Link><a className="button mini" href={`/api/projects/${id}/reports/${report.id}/pdf`}>PDF</a><a className="button secondary mini" href={`/api/projects/${id}/reports/${report.id}/word`}>Word</a>{report.status==="FINAL"?<form action={voidReportAction.bind(null,id,report.id)}><button className="danger-button" type="submit">作废</button></form>:null}</div>)}
      {!reports.length ? <div className="empty-state"><h2>暂无报告</h2><p className="muted">选择阶段建议并填写人工决策说明后生成首个版本。</p></div> : null}
    </div></section>
  </AppShell>;
}
