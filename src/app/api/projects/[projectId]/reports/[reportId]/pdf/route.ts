import { getSession } from "@/lib/auth";
import { getReport, recordAuditEvent } from "@/lib/mvp-store";
import { generateReportPdf } from "@/lib/report-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; reportId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "请先登录" }, { status: 401 });
  const { projectId, reportId } = await params;
  const report = await getReport(projectId, reportId, session.email, session.role);
  if (!report) return Response.json({ error: "报告不存在或无权访问" }, { status: 404 });
  try {
    const pdf = await generateReportPdf(report.snapshot);
    await recordAuditEvent({ projectId, email: session.email, role: session.role, action: "REPORT_PDF_EXPORTED", entityType: "REPORT", entityId: reportId });
    const fileName = `${report.snapshot.project.name}-综合审核报告-V${report.version}.pdf`;
    return new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-v${report.version}.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: "PDF 生成失败，请检查中文字体配置" }, { status: 500 });
  }
}
