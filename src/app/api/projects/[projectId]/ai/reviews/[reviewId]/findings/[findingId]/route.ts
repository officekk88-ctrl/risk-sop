import { z } from "zod";
import { getSession } from "@/lib/auth";
import type { RiskLevel } from "@/lib/domain";
import { decideAIReviewFinding } from "@/lib/mvp-store";
import { isSameOriginWrite } from "@/lib/request-security";

const decisionSchema = z.object({
  decision: z.enum(["CONFIRM", "REJECT"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "INFO"]),
  evidence: z.string().trim().max(2000),
  recommendation: z.string().trim().max(2000),
  decisionNote: z.string().trim().min(3).max(1000),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; reviewId: string; findingId: string }> }) {
  if (!isSameOriginWrite(request)) return jsonError("跨站请求已拒绝", 403);
  const session = await getSession();
  if (!session) return jsonError("请先登录", 401);
  const identifiers = await params;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("确认内容不合法", 400);
  const result = await decideAIReviewFinding({
    ...identifiers, email: session.email, role: session.role,
    ...parsed.data, level: parsed.data.level as RiskLevel,
  });
  if (!result) return jsonError("候选风险已处理、记录不存在或无权操作", 409);
  return Response.json({ review: result.review, risk: result.risk });
}
