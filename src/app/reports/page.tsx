import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listProjects, listReports } from "@/lib/mvp-store";

const decisionLabel = { PROCEED: "建议推进", CONDITIONAL: "附条件推进", PAUSE: "暂缓推进", REJECT: "不建议推进" };

export default async function ReportsHubPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const rows = await Promise.all(projects.map(async (project) => ({ project, reports: await listReports(project.id, session.email, session.role) ?? [] })));
  const total = rows.reduce((sum, row) => sum + row.reports.length, 0);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">全局报告</p><h1>审核报告</h1><p className="muted">共 {total} 份已生成的不可变报告快照，按项目进入预览或下载PDF。</p></div></header>
      <div className="project-cards">
        {rows.map(({ project, reports }) => {
          const latest = reports.toSorted((left, right) => right.version - left.version)[0];
          return <Link className="card project-card" href={`/projects/${project.id}/reports`} key={project.id}><div className="section-heading"><span className="tag">{reports.length} 份报告</span><span className="muted">{latest ? `最新 V${latest.version}` : "待生成"}</span></div><h2>{project.name}</h2><p className="muted">{latest ? decisionLabel[latest.snapshot.decision.outcome] : "尚未生成综合报告"}</p><p className="card-foot">{latest ? `${new Date(latest.createdAt).toLocaleString("zh-CN")} · ${latest.snapshot.templateVersion}` : "进入项目选择决策并生成首份报告"}</p></Link>;
        })}
        {!rows.length ? <div className="card empty-state"><h2>暂无可访问项目</h2></div> : null}
      </div>
    </AppShell>
  );
}
