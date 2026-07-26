"use client";

import { ChangeEvent, ClipboardEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import type { AIMessage, ProjectDocument, RemediationTask, Risk } from "@/lib/domain";

type ChatMessage = Pick<AIMessage, "id" | "role" | "content">;

const MAX_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(pdf|docx|xlsx|md|txt|png|jpe?g|webp)$/i;
const QUICK_QUESTIONS = [
  "签约前最需要补齐哪三项证据？",
  "当前有哪些风险可能阻塞下一决策门？",
  "请整理本项目本周最优先的行动清单。",
];

function clientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AIChat({ projectId, documents, risks, tasks, initialConversationId, initialMessages }: {
  projectId: string;
  documents: ProjectDocument[];
  risks: Risk[];
  tasks: RemediationTask[];
  initialConversationId?: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [message, setMessage] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [riskId, setRiskId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [mode, setMode] = useState("GENERAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [learned, setLearned] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addAttachments(incoming: File[]) {
    setError("");
    const invalid = incoming.find((file) => !ACCEPTED_EXTENSIONS.test(file.name));
    if (invalid) return setError(`不支持“${invalid.name}”，请选择 PDF、DOCX、XLSX、MD、TXT 或图片`);
    const oversized = incoming.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) return setError(`“${oversized.name}”超过 10MB，无法添加`);
    setAttachments((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          setError(`单次最多添加 ${MAX_FILES} 个附件`);
          break;
        }
        const duplicate = next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!duplicate) next.push(file);
      }
      return next;
    });
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    addAttachments(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function pasteIntoQuestion(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const source = item.getAsFile();
        if (!source) return null;
        const extension = source.type === "image/jpeg" ? "jpg" : source.type === "image/webp" ? "webp" : "png";
        return new File([source], `粘贴图片-${Date.now()}-${index + 1}.${extension}`, { type: source.type, lastModified: Date.now() });
      })
      .filter((file): file is File => Boolean(file));
    if (pastedImages.length) addAttachments(pastedImages);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = message.trim() || (attachments.length ? "请分析我上传的附件，并指出关键信息、风险和待核验事项。" : "");
    if (!question || loading) {
      setError("请输入咨询问题，或先添加需要分析的文件/图片");
      return;
    }
    const attachmentNames = attachments.map((file) => file.name);
    const shownQuestion = `${question}${attachmentNames.length ? `\n\n附件：${attachmentNames.join("、")}` : ""}`;
    const userMessage: ChatMessage = { id: clientId(), role: "user", content: shownQuestion };
    const assistantId = clientId();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setMessage("");
    setError("");
    setLearned(false);
    setLoading(true);
    try {
      const body = new FormData();
      body.set("message", question);
      body.set("mode", mode);
      if (conversationId) body.set("conversationId", conversationId);
      if (documentId) body.set("documentId", documentId);
      if (riskId) body.set("riskId", riskId);
      if (taskId) body.set("taskId", taskId);
      attachments.forEach((file) => body.append("attachments", file, file.name));
      const response = await fetch(`/api/projects/${projectId}/ai/chat`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "AI 服务请求失败" }));
        throw new Error(body.error || "AI 服务请求失败");
      }
      setConversationId(response.headers.get("X-Conversation-Id") || conversationId);
      if (!response.body) throw new Error("浏览器未收到流式响应");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const visibleAnswer = answer;
        setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: visibleAnswer } : item));
      }
      if (!answer.trim()) throw new Error("AI 未返回有效内容，请稍后重试");
      setAttachments([]);
      setLearned(true);
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setError(caught instanceof Error ? caught.message : "AI 服务请求失败");
    } finally {
      setLoading(false);
    }
  }

  return <div className="ai-layout">
    <section className="card chat-panel">
      <div className="chat-messages" aria-live="polite">
        {!messages.length ? <div className="ai-welcome"><span className="ai-welcome-mark">✦</span><h2>今天想分析什么？</h2><p className="muted">AI会读取已确认的项目上下文，但不会代替人工决策。</p><div className="quick-question-list">{QUICK_QUESTIONS.map((question) => <button type="button" onClick={() => setMessage(question)} key={question}>{question}<span>→</span></button>)}</div></div> : null}
        {messages.map((item) => <article className={`chat-message ${item.role}`} key={item.id}><strong>{item.role === "user" ? "你" : "AI 风险助手"}</strong><div>{item.content || (loading ? "正在分析…" : "")}</div></article>)}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <details className="chat-context"><summary>设置专业模式和关联上下文</summary><div className="form-grid compact-form"><label className="field">咨询模式<select value={mode} onChange={(event)=>setMode(event.target.value)}><option value="GENERAL">综合项目总顾问</option><option value="SITE">选址与商业</option><option value="LEGAL">法律与租赁合同</option><option value="POLICY">政策与行政许可</option><option value="FIRE">消防与建筑</option><option value="ENGINEERING">结构设计与工程</option><option value="FINANCE">财务与投资</option><option value="OPERATIONS">运营安全与保险</option></select></label><label className="field">关联已解析材料<select value={documentId} onChange={(event) => setDocumentId(event.target.value)}><option value="">不关联材料</option>{documents.map((document) => <option value={document.id} key={document.id}>{document.fileName}</option>)}</select></label><label className="field">关联正式风险<select value={riskId} onChange={(event)=>setRiskId(event.target.value)}><option value="">不关联风险</option>{risks.map((risk)=><option value={risk.id} key={risk.id}>{risk.title}</option>)}</select></label><label className="field">关联任务<select value={taskId} onChange={(event)=>setTaskId(event.target.value)}><option value="">不关联任务</option>{tasks.map((task)=><option value={task.id} key={task.id}>{task.title}</option>)}</select></label></div></details>
        <div className="chat-composer">
          <textarea aria-label="咨询问题" value={message} onChange={(event) => setMessage(event.target.value)} onPaste={pasteIntoQuestion} placeholder="描述问题；也可以直接粘贴截图，或添加文件/图片……" maxLength={4000} rows={4} />
          {attachments.length ? <div className="chat-attachments" aria-label="待发送附件">{attachments.map((file, index) => <span className="attachment-chip" key={`${file.name}-${file.lastModified}-${index}`}><span aria-hidden="true">{file.type.startsWith("image/") ? "▧" : "▤"}</span><span title={file.name}>{file.name}</span><small>{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))}KB` : `${(file.size / 1024 / 1024).toFixed(1)}MB`}</small><button type="button" aria-label={`移除 ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div> : null}
          <div className="composer-tools">
            <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept=".pdf,.docx,.xlsx,.md,.txt,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={chooseFiles} />
            <button className="attachment-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || attachments.length >= MAX_FILES}><span aria-hidden="true">＋</span> 添加文件或图片</button>
            <span className="muted">支持粘贴截图；最多 4 个，单个 10MB</span>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {learned ? <p className="knowledge-learned-note">本轮问答已自动整理为待审核知识。<Link href="/knowledge?origin=AI_CONSULTATION">查看学习记录</Link></p> : null}
        <div className="chat-actions"><span className="muted">AI 结论仅供初审，关键事项须人工复核。</span><button className="button" disabled={loading} type="submit">{loading ? "正在上传并分析…" : "发送咨询"}</button></div>
      </form>
    </section>
  </div>;
}
