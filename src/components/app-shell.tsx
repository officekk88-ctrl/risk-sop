import Link from "next/link";
import { logout } from "@/app/login/actions";
import { getSession } from "@/lib/auth";
import { AppNavigation } from "@/components/app-navigation";
import { listNotifications } from "@/lib/mvp-store";
import { submitFeedbackAction } from "@/app/feedback/actions";

export async function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const session = await getSession();
  const notifications = session ? await listNotifications(session.email, session.role) : [];
  const unread = notifications.filter((item) => !item.readAt).length;
  return (
    <main className="shell">
      <header className="sidebar">
        <Link className="brand" href="/dashboard">
          <div className="brand-mark"><span>P</span></div>
          <div><strong>开馆风控台</strong><span>Pickleball Risk OS</span></div>
        </Link>
        <AppNavigation />
        <div className="sidebar-note">
          <details className="user-menu">
            <summary><div className="user-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</div><span><strong className="sidebar-user">{email}</strong><small>{session?.role === "ADMIN" ? "系统管理员" : "项目成员"}</small></span><i aria-hidden="true">⌃</i></summary>
            <div className="user-menu-panel">
              {session?.role === "ADMIN" ? <><span>系统管理</span><Link href="/admin/users">用户与权限</Link><Link href="/admin/system">系统配置</Link><Link href="/admin/audit">审计日志</Link></> : null}
              <Link href="/messages">通知中心</Link>
              <form action={logout}><button type="submit">退出登录</button></form>
            </div>
          </details>
        </div>
      </header>
      <section className="content">
        <div className="content-utilities" aria-label="全局工具">
          <Link className="utility-link" href="/messages" aria-label={`${unread} 条待处理提醒`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
            {unread ? <b>{unread > 99 ? "99+" : unread}</b> : null}
          </Link>
          <Link className="ai-utility" href="/ai"><span aria-hidden="true">✦</span> 问 AI</Link>
        </div>
        <details className="feedback-widget">
          <summary>体验反馈</summary>
          <form action={submitFeedbackAction}>
            <strong>这个页面是否容易使用？</strong>
            <div className="feedback-scores">{[1, 2, 3, 4, 5].map((score) => <label key={score}><input type="radio" name="score" value={score} required /><span>{score}</span></label>)}</div>
            <div className="feedback-scale"><span>很困难</span><span>很顺畅</span></div>
            <select name="category" defaultValue="FLOW"><option value="FLOW">操作流程</option><option value="CLARITY">界面清晰度</option><option value="MOBILE">移动端体验</option><option value="AI">AI助手</option><option value="OTHER">其他</option></select>
            <textarea name="comment" maxLength={1000} placeholder="哪里还可以更简单？（可选）" />
            <button className="button mini" type="submit">提交反馈</button>
          </form>
        </details>
        {children}
      </section>
    </main>
  );
}
