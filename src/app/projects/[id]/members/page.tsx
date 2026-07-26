import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { getProject, listProjectMembers } from "@/lib/mvp-store";
import { assignMemberAction, removeMemberAction, updateMemberRoleAction } from "./actions";

const projectRoleLabel = { DECISION_MAKER: "投资人/决策人", PROJECT_MANAGER: "项目负责人", MEMBER: "项目成员", REVIEWER: "内部审核人员", EXPERT: "外部专业顾问" };

export default async function ProjectMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const project = await getProject(id, session.email, session.role);
  if (!project || (session.role !== "ADMIN" && project.ownerEmail !== session.email)) notFound();
  const users = await listProjectMembers(id);
  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const assign = assignMemberAction.bind(null, id);

  return (
    <AppShell email={session.email}>
      <header className="page-header">
        <p className="eyebrow">项目权限</p>
        <h1>成员管理</h1>
        <p className="muted">{project.name} · 只有系统管理员或项目负责人可以变更成员。</p>
      </header>

      <section className="card form-card">
        <div className="section-heading"><div><h2>分配项目成员</h2><p className="muted">新账号将使用临时密码创建；已有账号保留原密码。</p></div></div>
        <form action={assign} className="form-grid">
          <label><span>姓名</span><input name="displayName" minLength={2} maxLength={50} required /></label>
          <label><span>邮箱</span><input name="email" type="email" required /></label>
          <label><span>临时密码</span><input name="temporaryPassword" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label>
          <label><span>项目角色</span><select name="projectRole" defaultValue="MEMBER">{Object.entries(projectRoleLabel).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
          <div className="form-actions"><button className="button" type="submit">分配成员</button><Link className="button secondary" href={`/projects/${id}`}>返回项目</Link></div>
        </form>
      </section>

      <section className="card table-card">
        <div className="section-heading"><div><h2>当前成员</h2><p className="muted">{project.memberEmails.length + 1} 人</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>姓名</th><th>邮箱</th><th>角色</th><th>操作</th></tr></thead><tbody>
          <tr><td>{userByEmail.get(project.ownerEmail.toLowerCase())?.displayName ?? "项目负责人"}</td><td>{project.ownerEmail}</td><td>负责人</td><td>—</td></tr>
          {project.memberEmails.map((email) => {
            const user = userByEmail.get(email.toLowerCase());
            const remove = removeMemberAction.bind(null, id, email);
            const updateRole = updateMemberRoleAction.bind(null,id,email);
            return <tr key={email}><td>{user?.displayName ?? "成员"}</td><td>{email}</td><td><form action={updateRole} className="inline-form"><select name="projectRole" defaultValue={project.memberRoles?.[email] ?? "MEMBER"}>{Object.entries(projectRoleLabel).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><button className="button mini" type="submit">保存</button></form></td><td><form action={remove}><button className="danger-button bordered" type="submit">移除</button></form></td></tr>;
          })}
        </tbody></table></div>
      </section>
    </AppShell>
  );
}
