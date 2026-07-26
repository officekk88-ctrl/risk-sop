import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { listManagedUsers, listProjects } from "@/lib/mvp-store";
import { createUserAction, deleteUserAction, updateUserAction, updateUserProjectsAction } from "./actions";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") notFound();
  const [users, projects, messages] = await Promise.all([
    listManagedUsers(session.email, session.role),
    listProjects(session.email, session.role),
    searchParams,
  ]);
  const activeUsers = users.filter((user) => user.active).length;
  const activeAdmins = users.filter((user) => user.active && user.role === "ADMIN").length;

  return (
    <AppShell email={session.email}>
      <header className="topbar page-header">
        <div><p className="eyebrow">系统管理</p><h1>用户与权限</h1><p className="muted">管理全部账号、登录状态和系统角色。高风险操作会进行服务端约束。</p></div>
      </header>

      {messages.notice ? <div className="notice admin-success"><strong>操作成功</strong><span>{messages.notice}</span></div> : null}
      {messages.error ? <div className="form-error admin-page-error"><strong>操作未完成：</strong>{messages.error}</div> : null}

      <div className="stats compact-stats admin-user-stats">
        <article className="card"><span className="stat-label">全部用户</span><strong className="stat-value">{users.length}</strong><span className="stat-foot">账号总数</span></article>
        <article className="card"><span className="stat-label">启用用户</span><strong className="stat-value">{activeUsers}</strong><span className="stat-foot">可登录系统</span></article>
        <article className="card"><span className="stat-label">启用管理员</span><strong className="stat-value">{activeAdmins}</strong><span className="stat-foot">拥有全局权限</span></article>
        <article className="card"><span className="stat-label">普通成员</span><strong className="stat-value">{users.filter((user) => user.role === "MEMBER").length}</strong><span className="stat-foot">按项目授权</span></article>
      </div>

      <section className="card admin-permissions">
        <div className="section-heading"><div><h2>角色权限模型</h2><p className="muted">角色修改会在用户下一次请求时立即生效，旧登录会话不会保留原权限。</p></div></div>
        <div className="permission-grid">
          <article><span className="tag">ADMIN</span><h3>系统管理员</h3><p>访问全部项目；管理用户、角色和项目成员；执行所有尽调、风险、AI和报告操作。</p></article>
          <article><span className="tag">MEMBER</span><h3>普通成员</h3><p>只能访问被分配的项目；不能进入系统用户管理；项目成员变更仅限项目负责人或管理员。</p></article>
        </div>
      </section>

      <section className="card admin-create-user">
        <div className="section-heading"><div><h2>新增用户</h2><p className="muted">创建后账号立即启用；临时密码至少12位，应通过安全渠道交付。</p></div></div>
        <form action={createUserAction} className="admin-create-grid">
          <label className="field"><span>姓名</span><input name="displayName" minLength={2} maxLength={50} required /></label>
          <label className="field"><span>邮箱</span><input name="email" type="email" required /></label>
          <label className="field"><span>临时密码</span><input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
          <label className="field"><span>系统角色</span><select name="role" defaultValue="MEMBER"><option value="MEMBER">普通成员</option><option value="ADMIN">系统管理员</option></select></label>
          <button className="button" type="submit">创建用户</button>
        </form>
      </section>

      <section className="admin-user-list">
        <div className="section-heading"><div><h2>全部用户</h2><p className="muted">可修改姓名、角色、登录状态或重置密码。邮箱作为账号标识不可修改。</p></div></div>
        {users.map((user) => {
          const owned = projects.filter((project) => project.ownerEmail.toLowerCase() === user.email).length;
          const assigned = projects.filter((project) => project.memberEmails.includes(user.email)).length;
          const update = updateUserAction.bind(null, user.id);
          const updateProjects = updateUserProjectsAction.bind(null, user.id);
          const remove = deleteUserAction.bind(null, user.id);
          const isSelf = user.email === session.email;
          return (
            <article className={`card admin-user-card ${user.active ? "" : "inactive"}`} key={user.id}>
              <div className="admin-user-identity">
                <div><span className={`tag ${user.active ? "" : "warning-tag"}`}>{user.active ? "已启用" : "已停用"}</span><h3>{user.displayName}</h3><p className="muted">{user.email}</p></div>
                <div className="admin-user-meta"><span>负责项目 {owned}</span><span>参与项目 {assigned}</span><span>创建于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}</span></div>
              </div>
              <form action={update} className="admin-user-edit">
                <label className="field"><span>姓名</span><input name="displayName" defaultValue={user.displayName} minLength={2} maxLength={50} required /></label>
                <label className="field"><span>角色</span><select name="role" defaultValue={user.role} disabled={isSelf}><option value="MEMBER">普通成员</option><option value="ADMIN">系统管理员</option></select>{isSelf ? <input name="role" type="hidden" value="ADMIN" /> : null}</label>
                <label className="field"><span>登录状态</span><select name="active" defaultValue={String(user.active)} disabled={isSelf}><option value="true">启用</option><option value="false">停用</option></select>{isSelf ? <input name="active" type="hidden" value="true" /> : null}</label>
                <label className="field"><span>重置密码（可选）</span><input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="留空则不修改" /></label>
                <button className="button mini" type="submit">保存用户和权限</button>
              </form>
              <form action={updateProjects} className="admin-project-assignment">
                <div className="admin-assignment-heading"><div><strong>项目指定与修改</strong><p className="muted">勾选该用户可参与的项目；负责人项目固定保留。管理员角色即使不勾选也拥有全局访问权。</p></div><button className="button secondary mini" type="submit">保存项目指定</button></div>
                <div className="admin-project-options">
                  {projects.map((project) => {
                    const isOwner = project.ownerEmail.toLowerCase() === user.email;
                    const isAssigned = project.memberEmails.includes(user.email);
                    return (
                      <label className={`admin-project-option ${isOwner ? "owner" : ""}`} key={project.id}>
                        <input name="projectIds" type="checkbox" value={project.id} defaultChecked={isOwner || isAssigned} disabled={isOwner} />
                        <span><strong>{project.name}</strong><small>{isOwner ? "项目负责人 · 不可取消" : isAssigned ? "已指定" : "未指定"}</small></span>
                      </label>
                    );
                  })}
                  {!projects.length ? <span className="muted">当前没有可指定项目。</span> : null}
                </div>
              </form>
              <form action={remove} className="admin-user-delete">
                <div><strong>删除账号</strong><p className="muted">删除后移除其项目成员权限；历史业务与审计记录保留。项目负责人不能直接删除。</p></div>
                <input name="confirmEmail" type="email" placeholder="输入该用户邮箱确认" disabled={isSelf || owned > 0} required />
                <button className="danger-button bordered" type="submit" disabled={isSelf || owned > 0}>{isSelf ? "不能删除自己" : owned > 0 ? "请先转移负责项目" : "删除账号"}</button>
              </form>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
