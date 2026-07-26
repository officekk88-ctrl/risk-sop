import { z } from "zod";
import { getSession } from "@/lib/auth";
import { AI_REVIEW_PROMPT_VERSION, runDocumentReview } from "@/lib/ai-document-review";
import { aiModel, isAIConfigured } from "@/lib/openai-client";
import { completeAIReview, createAIReview, failAIReview, getDocument, getProject } from "@/lib/mvp-store";
import { isSameOriginWrite } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({ documentId: z.string().uuid() });

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!isSameOriginWrite(request)) return jsonError("跨站请求已拒绝", 403);
  const session = await getSession();
  if (!session) return jsonError("请先登录", 401);
  const { projectId } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("请选择有效材料", 400);
  const [project, document] = await Promise.all([
    getProject(projectId, session.email, session.role),
    getDocument(projectId, parsed.data.documentId, session.email, session.role),
  ]);
  if (!project || !document) return jsonError("项目或材料不存在，或无权访问", 404);
  if (document.parseStatus !== "COMPLETED" || !document.extractedText) return jsonError("材料尚未完成文字解析", 409);
  if (!isAIConfigured()) return jsonError("AI 服务尚未配置", 503);

  const review = await createAIReview({ projectId, documentId: document.id, email: session.email, role: session.role, model: aiModel, promptVersion: AI_REVIEW_PROMPT_VERSION });
  if (!review) return jsonError("无法创建初审任务", 403);
  try {
    const output = await runDocumentReview(project, document);
    const completed = await completeAIReview({ projectId, reviewId: review.id, email: session.email, role: session.role, output });
    if (!completed) return jsonError("无法保存初审结果", 500);
    return Response.json({ review: completed }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "AI 文件初审失败";
    await failAIReview({ projectId, reviewId: review.id, email: session.email, role: session.role, error: message });
    return jsonError("AI 文件初审失败，请稍后重试", 502);
  }
}
