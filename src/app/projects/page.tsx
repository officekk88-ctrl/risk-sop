import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listProjects, projectProgress } from "@/lib/mvp-store";

const statusLabel = { DRAFT: "草稿", DUE_DILIGENCE: "尽调中", NEGOTIATING: "谈判中", SIGNED: "已签约", CONSTRUCTION: "设计施工中", OPENING_PREP: "开业准备中", OPEN: "已开业", PAUSED: "暂停", ABANDONED: "放弃", DECISION_PENDING: "待决策", ARCHIVED: "已归档" };

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const projects = await listProjects(session.email, session.role);

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header">
        <div><p className="eyebrow">项目中心</p><h1>项目与候选场地</h1><p className="muted">每个项目可管理多个候选场地并进行商业与风险双维度比较。</p></div>
        <Link className="button" href="/projects/new">新建项目</Link>
      </header>
      <div className="project-cards">
        {projects.map((project) => {
          const progress = projectProgress(project);
          return (
            <Link className="card project-card" href={`/projects/${project.id}`} key={project.id}>
              <div className="section-heading"><span className="tag">{statusLabel[project.status]}</span><span className="muted">{progress.percent}%</span></div>
              <h2>{project.name}</h2>
              <p className="muted">{project.city}{project.venue.district ? ` · ${project.venue.district}` : ""}</p>
              <div className="progress full"><span style={{ width: `${progress.percent}%` }} /></div>
              <p className="card-foot">已判断 {progress.completed} / {progress.total} 项 · {project.venue.areaSqm ?? "—"}㎡ · {project.venue.plannedCourts ?? "—"} 片场地</p>
            </Link>
          );
        })}
        {projects.length === 0 ? <div className="card empty-state"><h2>还没有项目</h2><p className="muted">创建第一个候选场地并开始尽调。</p></div> : null}
      </div>
    </AppShell>
  );
}
