import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listDocuments, listKnowledgeEntryDetails, listProjects, listReports, listRisks } from "@/lib/mvp-store";

export default async function ResourcesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);
  const [rows, knowledge] = await Promise.all([
    Promise.all(projects.map(async (project) => ({
      project,
      documents: await listDocuments(project.id, session.email, session.role) ?? [],
      reports: await listReports(project.id, session.email, session.role) ?? [],
      risks: await listRisks(project.id, session.email, session.role) ?? [],
    }))),
    listKnowledgeEntryDetails({ email: session.email, role: session.role, includeUnpublished: session.role === "ADMIN" }),
  ]);
  const documents = rows.flatMap((row) => row.documents.map((document) => ({ ...document, projectName: row.project.name })));
  const reports = rows.flatMap((row) => row.reports.map((report) => ({ ...report, projectName: row.project.name })));
  const publishedKnowledge = knowledge.filter(({ entry }) => entry.status === "PUBLISHED");
  const resources = [
    { href: "/documents", title: "材料中心", description: "上传、解析和管理项目证据材料", value: documents.length, meta: `${documents.filter((item) => item.parseStatus === "COMPLETED").length} 份已解析`, tone: "blue" },
    { href: "/reports", title: "决策报告", description: "生成、下载和归档正式报告", value: reports.length, meta: `${new Set(reports.map((item) => item.projectId)).size} 个项目已有报告`, tone: "green" },
    { href: "/knowledge", title: "知识库", description: "查询已审核发布的专业知识", value: publishedKnowledge.length, meta: session.role === "ADMIN" ? `${knowledge.length - publishedKnowledge.length} 条待审核或归档` : "仅已发布内容参与检索", tone: "purple" },
    { href: "/analytics", title: "统计分析", description: "查看项目进度、风险和阶段耗时", value: rows.reduce((sum, row) => sum + row.risks.filter((risk) => !["CLOSED", "AVOIDED"].includes(risk.status)).length, 0), meta: "条风险正在跟进", tone: "orange" },
  ];
  const recentDocuments = documents.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5);
  const recentReports = reports.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header"><div><p className="eyebrow">资料与洞察</p><h1>资源中心</h1><p className="muted">项目材料、正式报告、专业知识和管理分析集中查询。</p></div></header>
      <div className="resource-grid resource-metrics">
        {resources.map((item) => (
          <Link className={`card resource-card resource-${item.tone}`} href={item.href} key={item.href}>
            <span className="resource-value">{item.value}</span><span className="tag">{item.meta}</span><h2>{item.title}</h2><p className="muted">{item.description}</p><strong>进入查看 →</strong>
          </Link>
        ))}
      </div>

      <section className="resource-recent-grid">
        <article className="card recent-resource">
          <div className="section-heading"><div><h2>最近材料</h2><p className="muted">跨项目快速访问</p></div><Link href="/documents">全部材料 →</Link></div>
          <div className="data-list">{recentDocuments.map((document) => <a className="recent-resource-row" href={`/api/projects/${document.projectId}/documents/${document.id}`} target="_blank" key={document.id}><span className="file-icon">材</span><span><strong>{document.fileName}</strong><small>{document.projectName} · {document.parseStatus === "COMPLETED" ? "已解析" : document.parseStatus === "FAILED" ? "解析失败" : "处理中"}</small></span><i>↗</i></a>)}{!recentDocuments.length ? <p className="muted">暂无项目材料。</p> : null}</div>
        </article>
        <article className="card recent-resource">
          <div className="section-heading"><div><h2>最近报告</h2><p className="muted">正式决策快照</p></div><Link href="/reports">全部报告 →</Link></div>
          <div className="data-list">{recentReports.map((report) => <Link className="recent-resource-row" href={`/projects/${report.projectId}/reports/${report.id}`} key={report.id}><span className="file-icon">V{report.version}</span><span><strong>{report.projectName}</strong><small>{new Date(report.createdAt).toLocaleDateString("zh-CN")} · {report.status === "FINAL" ? "已固化" : "已作废"}</small></span><i>→</i></Link>)}{!recentReports.length ? <p className="muted">暂无正式报告。</p> : null}</div>
        </article>
      </section>
    </AppShell>
  );
}
