import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectNavigation } from "@/components/project-navigation";
import { updateChecklistAction } from "@/app/projects/actions";
import { uploadChecklistEvidenceAction } from "../checklist-actions";
import { getSession } from "@/lib/auth";
import { resolveProjectRole, type ProjectChecklistItem } from "@/lib/domain";
import { getProject, listDocuments, projectProgress } from "@/lib/mvp-store";

const statusLabel = { TODO: "待处理", PASSED: "通过", FAILED: "不通过", VERIFY: "待核实", NOT_APPLICABLE: "不适用" };
const aiJudgmentLabel = { PASSED: "倾向通过", FAILED: "倾向不通过", VERIFY: "建议核实" };

function groupChecklist(items: ProjectChecklistItem[]) {
  return items.reduce<Record<string, ProjectChecklistItem[]>>((groups, item) => {
    (groups[item.category] ??= []).push(item);
    return groups;
  }, {});
}

export default async function ProjectChecklistPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { filter = "all" } = await searchParams;
  const [project, documents] = await Promise.all([getProject(id, session.email, session.role), listDocuments(id, session.email, session.role)]);
  if (!project || !documents) notFound();
  const projectRole = resolveProjectRole(project, session.email, session.role);
  const progress = projectProgress(project);
  const visibleItems = project.checklist.filter((item) => {
    if (filter === "pending") return item.status === "TODO";
    if (filter === "verify") return item.status === "VERIFY";
    if (filter === "abnormal") return item.status === "FAILED" || item.aiAssessment?.judgment === "FAILED";
    return true;
  });
  const groups = groupChecklist(visibleItems);
  const pending = project.checklist.filter((item) => item.status === "TODO").length;
  const verify = project.checklist.filter((item) => item.status === "VERIFY").length;
  const abnormal = project.checklist.filter((item) => item.status === "FAILED" || item.aiAssessment?.judgment === "FAILED").length;

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header">
        <div><p className="eyebrow">{project.name}</p><h1>尽调核验</h1><p className="muted">按业务分类逐项完成“证据材料 → AI分析 → 人工结论”。</p></div>
        <div className="header-actions"><a className="button secondary" href={`/projects/${id}/documents`}>全部材料</a><a className="button" href={`?filter=pending#pending-items`}>继续待处理项</a></div>
      </header>
      <ProjectNavigation projectId={id} role={projectRole} />

      <section className="checklist-summary card">
        <div><span className="stat-label">总体进度</span><strong>{progress.percent}%</strong><div className="progress full"><i style={{ width: `${progress.percent}%` }} /></div></div>
        <a className={filter === "pending" ? "active" : undefined} href="?filter=pending"><span>待处理</span><strong>{pending}</strong></a>
        <a className={filter === "verify" ? "active" : undefined} href="?filter=verify"><span>待核实</span><strong>{verify}</strong></a>
        <a className={filter === "abnormal" ? "active" : undefined} href="?filter=abnormal"><span>发现异常</span><strong>{abnormal}</strong></a>
      </section>

      <div className="checklist-filter-heading"><span>{filter === "pending" ? "待处理项" : filter === "verify" ? "待核实项" : filter === "abnormal" ? "异常项" : "全部清单"}</span>{filter !== "all" ? <a href="?filter=all">清除筛选</a> : null}</div>
      <div className="checklist-focus-list" id="pending-items">
        {Object.entries(groups).map(([category, items], groupIndex) => {
          const completed = items.filter((item) => ["PASSED", "FAILED", "NOT_APPLICABLE"].includes(item.status)).length;
          return (
            <details className="card checklist-group" open={groupIndex === 0} key={category}>
              <summary>
                <span><strong>{category}</strong><small>{completed} / {items.length} 项已判断</small></span>
                <span className="group-progress"><i style={{ width: `${Math.round(completed / items.length * 100)}%` }} /></span>
                <b>{items.length - completed ? `${items.length - completed}项待完成` : "已完成"}</b>
              </summary>
              <div className="focused-items">
                {items.map((item) => {
                  const evidenceDocuments = documents.filter((document) => document.checklistCodes.includes(item.code));
                  return (
                    <details className={`focused-item item-${item.status.toLowerCase()}`} id={item.code} key={item.code}>
                      <summary>
                        <span className="item-code">{item.code}</span>
                        <span className="focused-title"><strong>{item.title}</strong><small>{evidenceDocuments.length ? `${evidenceDocuments.length}份对应材料` : "缺少对应材料"}</small></span>
                        {item.aiAssessment ? <span className={`ai-chip ai-${item.aiAssessment.judgment.toLowerCase()}`}>AI：{aiJudgmentLabel[item.aiAssessment.judgment]}</span> : <span className="ai-chip">等待AI分析</span>}
                        <span className={`status-pill status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span>
                      </summary>
                      <div className="focused-item-body">
                        <section className="flow-step">
                          <div className="flow-step-title"><i>1</i><span><strong>证据材料</strong><small>建议：{item.evidence}</small></span></div>
                          <div className="evidence-links">{evidenceDocuments.map((document) => <a href={`/api/projects/${id}/documents/${document.id}`} target="_blank" key={document.id}>{document.fileName}<span>{document.parseStatus === "COMPLETED" ? "已解析" : "处理中"}</span></a>)}</div>
                          <form action={uploadChecklistEvidenceAction.bind(null, id, item.code)} className="compact-upload"><input name="file" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" required /><button className="button secondary mini" type="submit">上传并分析</button></form>
                        </section>
                        <section className="flow-step">
                          <div className="flow-step-title"><i>2</i><span><strong>AI辅助分析</strong><small>AI建议不会自动成为正式结论</small></span></div>
                          {item.aiAssessment ? <div className="ai-summary"><strong>{aiJudgmentLabel[item.aiAssessment.judgment]} · {item.aiAssessment.confidence === "HIGH" ? "高" : item.aiAssessment.confidence === "MEDIUM" ? "中" : "低"}置信度</strong><p>{item.aiAssessment.analysis}</p>{item.aiAssessment.recommendation ? <small>建议：{item.aiAssessment.recommendation}</small> : null}</div> : <p className="muted">上传材料后，系统会在这里提供初步分析。</p>}
                        </section>
                        <section className="flow-step">
                          <div className="flow-step-title"><i>3</i><span><strong>人工结论</strong><small>由项目人员确认后生效</small></span></div>
                          <form action={updateChecklistAction.bind(null, id, item.code)} className="human-decision">
                            <select aria-label={`${item.title}状态`} name="status" defaultValue={item.status}>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
                            <input aria-label={`${item.title}备注`} name="note" defaultValue={item.note} placeholder="填写判断依据或待补事项" />
                            <button className="button mini" type="submit">确认人工结论</button>
                          </form>
                        </section>
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
        {!visibleItems.length ? <div className="card empty-state"><h2>该筛选下没有清单项</h2><p className="muted">当前事项已经处理完毕，可以查看全部清单。</p><a className="button" href="?filter=all">查看全部清单</a></div> : null}
      </div>
    </AppShell>
  );
}
