import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><strong>开馆风控台</strong><span>Pickleball Venue Risk OS</span></div>
        </div>
        <div>
          <p className="eyebrow">从选址到开业</p>
          <h1>让每一次决策，都有依据。</h1>
          <p>统一管理尽调材料、专业风险、整改任务与决策报告，在重大投入发生前发现问题。</p>
        </div>
        <p>内部试用版 V1.0</p>
      </section>
      <section className="login-panel">
        <LoginForm />
      </section>
    </main>
  );
}
