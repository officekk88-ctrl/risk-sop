"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectDocument } from "@/lib/domain";

export function ReviewLauncher({ projectId, documents }: { projectId: string; documents: ProjectDocument[] }) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documentId || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/ai/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "初审请求失败" }));
        throw new Error(body.error || "初审请求失败");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "初审请求失败");
    } finally {
      setLoading(false);
    }
  }

  return <form className="card review-launcher" onSubmit={submit}>
    <div><h2>发起文件初审</h2><p className="muted">AI 结果先进入待确认区，不会自动创建正式风险。</p></div>
    <label className="field field-grow">已解析材料<select value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={!documents.length}>{documents.length ? documents.map((document) => <option value={document.id} key={document.id}>{document.fileName}</option>) : <option value="">暂无已解析材料</option>}</select></label>
    <button className="button" type="submit" disabled={!documentId || loading}>{loading ? "正在初审…" : "开始 AI 初审"}</button>
    {error ? <p className="error-text review-launcher-error">{error}</p> : null}
  </form>;
}
