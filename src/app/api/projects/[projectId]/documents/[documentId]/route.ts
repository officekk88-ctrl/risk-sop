import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readStoredFile } from "@/lib/file-storage";
import { getDocument, getProject, recordAuditEvent } from "@/lib/mvp-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string; documentId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { projectId, documentId } = await params;
  const document = await getDocument(projectId, documentId, session.email, session.role);
  if (!document) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  try {
    const body = await readStoredFile(document.storageKey);
    const download = request.nextUrl.searchParams.get("download") === "1";
    if (download && document.sensitive && session.role !== "ADMIN") {
      const project = await getProject(projectId, session.email, session.role);
      if (project?.ownerEmail !== session.email) return NextResponse.json({ error: "敏感文件仅项目负责人或管理员可下载" }, { status: 403 });
    }
    await recordAuditEvent({ projectId, email: session.email, role: session.role, action: download ? "DOCUMENT_DOWNLOADED" : "DOCUMENT_PREVIEWED", entityType: "DOCUMENT", entityId: documentId });
    const safeName = document.fileName.replace(/[\r\n"]/g, "_");
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": document.mimeType, "Content-Length": String(body.length), "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(safeName)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "文件内容不可用" }, { status: 410 });
  }
}
