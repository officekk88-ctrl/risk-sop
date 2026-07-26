"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="login-form">
      <p className="eyebrow">MVP 工作台</p>
      <h2>登录系统</h2>
      <p className="muted">进入项目尽调、风险审核和 AI 咨询工作区。</p>

      <label className="field">
        邮箱
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label className="field">
        密码
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "正在登录…" : "进入工作台"}
      </button>
    </form>
  );
}
