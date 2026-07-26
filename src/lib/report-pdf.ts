import "server-only";

import { access } from "node:fs/promises";
import PDFDocument from "pdfkit";
import type { ReportSnapshot } from "@/lib/domain";

const decisionLabel = { PROCEED: "建议推进", CONDITIONAL: "附条件推进", PAUSE: "暂缓推进", REJECT: "不建议推进" };
const checklistLabel = { TODO: "待处理", PASSED: "通过", FAILED: "不通过", VERIFY: "待核实", NOT_APPLICABLE: "不适用" };
const riskLevelLabel = { CRITICAL: "重大", HIGH: "较高", MEDIUM: "一般", INFO: "提示" };
const riskStatusLabel = { OPEN: "新发现", ANALYZING: "待分析", EVIDENCE_PENDING: "待补材料", MITIGATING: "整改中", REVIEW_PENDING: "待复核", ACCEPTED: "已接受", AVOIDED: "已规避", CLOSED: "已关闭", UNRESOLVED: "无法关闭" };

type FontCandidate = { path: string; family?: string };

async function resolveChineseFont(): Promise<FontCandidate> {
  const candidates: FontCandidate[] = [
    ...(process.env.PDF_FONT_PATH ? [{ path: process.env.PDF_FONT_PATH, family: process.env.PDF_FONT_FAMILY || undefined }] : []),
    { path: "C:\\Windows\\Fonts\\simhei.ttf" },
    { path: "/mnt/c/Windows/Fonts/simhei.ttf" },
    { path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", family: "Noto Sans CJK SC" },
    { path: "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", family: "Noto Sans CJK SC" },
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate.path);
      return candidate;
    } catch {
      // Try the next deployment-specific font location.
    }
  }
  throw new Error("未找到中文 PDF 字体，请配置 PDF_FONT_PATH");
}

function addHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8).fontSize(15).fillColor("#17442a").text(title, { continued: false });
  doc.moveDown(0.3).strokeColor("#dce4da").moveTo(doc.x, doc.y).lineTo(535, doc.y).stroke().moveDown(0.4);
}

function addBullet(doc: PDFKit.PDFDocument, text: string) {
  doc.fontSize(9.5).fillColor("#17201a").text(`• ${text}`, { indent: 8, lineGap: 3 });
}

function addKeyValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(9.5).fillColor("#667069").text(`${label}：`, { continued: true }).fillColor("#17201a").text(value || "—", { lineGap: 3 });
}

export async function generateReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  const font = await resolveChineseFont();
  const doc = new PDFDocument({ size: "A4", margins: { top: 52, right: 60, bottom: 58, left: 60 }, bufferPages: true, info: { Title: `${snapshot.project.name}综合审核报告`, Author: "开馆风控台" } });
  doc.registerFont("ReportCJK", font.path, font.family);
  doc.font("ReportCJK");
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(24).fillColor("#17442a").text("匹克球馆开馆综合审核报告", { align: "center" });
  doc.moveDown(0.5).fontSize(14).fillColor("#17201a").text(snapshot.project.name, { align: "center" });
  doc.moveDown(0.8).fontSize(9).fillColor("#667069").text(`${snapshot.templateVersion}  |  生成时间：${new Date(snapshot.generatedAt).toLocaleString("zh-CN")}`, { align: "center" });

  addHeading(doc, "一、审核范围");
  addBullet(doc, `当前候选场地：${snapshot.project.venue.address || "地址待补充"}`);
  addBullet(doc, `本次快照包含 ${snapshot.documents.length} 份材料、${snapshot.checklist.length} 项清单、${snapshot.risks.length} 条正式风险和 ${snapshot.tasks.length} 项整改任务。`);
  addBullet(doc, "报告只使用生成时已经进入正式业务台账的数据，不包含待人工确认的 AI 候选风险。");

  addHeading(doc, "二、项目与场地概况");
  addKeyValue(doc, "城市/区域", `${snapshot.project.city} / ${snapshot.project.venue.district || "待补充"}`);
  addKeyValue(doc, "场地地址", snapshot.project.venue.address);
  addKeyValue(doc, "面积/净高", `${snapshot.project.venue.areaSqm ?? "未知"} 平方米 / ${snapshot.project.venue.clearHeightM ?? "未知"} 米`);
  addKeyValue(doc, "证载用途/拟经营用途", `${snapshot.project.venue.certificateUsage || "待核实"} / ${snapshot.project.venue.intendedUsage || "匹克球馆"}`);
  addKeyValue(doc, "租金/租期", `${snapshot.project.venue.monthlyRent ?? "未知"} 元/月 / ${snapshot.project.venue.leaseMonths ?? "未知"} 个月`);

  addHeading(doc, "三、已取得及缺失材料");
  if (snapshot.documents.length) snapshot.documents.forEach((item) => addBullet(doc, `${item.fileName}｜${item.category}｜${item.parseStatus}${item.pageCount ? `｜${item.pageCount} 页` : ""}`));
  else addBullet(doc, "当前快照未登记有效材料。");

  addHeading(doc, "四、尽调检查结果");
  addBullet(doc, Object.entries(snapshot.checklistSummary).map(([status, count]) => `${checklistLabel[status as keyof typeof checklistLabel]} ${count}`).join("；"));
  snapshot.checklist.filter((item) => item.status === "FAILED" || item.status === "VERIFY").forEach((item) => addBullet(doc, `${item.code} ${item.title}｜${checklistLabel[item.status]}｜${item.note || "无核实备注"}`));

  addHeading(doc, "五、主要风险");
  if (snapshot.risks.length) snapshot.risks.forEach((risk) => {
    addBullet(doc, `[${riskLevelLabel[risk.level]}/${riskStatusLabel[risk.status]}] ${risk.title}`);
    addKeyValue(doc, "事实与依据", risk.evidence || risk.description);
    addKeyValue(doc, "建议措施", risk.recommendation || "待制定");
  });
  else addBullet(doc, "当前没有已确认的正式风险；这不代表项目不存在风险。");

  addHeading(doc, "六、整改与待办");
  if (snapshot.tasks.length) snapshot.tasks.forEach((task) => addBullet(doc, `${task.title}｜${task.assigneeEmail}｜截止 ${task.dueDate}｜${task.status}${task.completionNote ? `｜${task.completionNote}` : ""}`));
  else addBullet(doc, "当前没有已登记整改任务。");

  addHeading(doc, "七、阶段决策与专家意见");
  snapshot.decisionGates?.filter((gate) => gate.decision !== "PENDING").forEach((gate) => addBullet(doc, `${gate.name}｜${gate.decision}｜${gate.rationale}`));
  snapshot.expertAssignments?.forEach((item) => { addBullet(doc, `${item.title}｜${item.expertName}｜${item.status}`); addKeyValue(doc, "专家意见", item.opinion); });

  addHeading(doc, "八、综合决策建议");
  addKeyValue(doc, "人工选择", decisionLabel[snapshot.decision.outcome]);
  addKeyValue(doc, "决策说明", snapshot.decision.rationale);
  addKeyValue(doc, "决策人", `${snapshot.decision.decidedBy}｜${new Date(snapshot.decision.decidedAt).toLocaleString("zh-CN")}`);

  addHeading(doc, "九、推进前置条件");
  snapshot.conditions.forEach((condition) => addBullet(doc, condition));

  addHeading(doc, "九、适用边界与声明");
  doc.fontSize(9.5).fillColor("#17201a").text(snapshot.disclaimer, { lineGap: 4 });
  addBullet(doc, "政策和主管部门口径可能变化，涉及属地要求的事项应在关键决策前再次核验。");
  addBullet(doc, "本报告是项目内部风险管理文件，不是行政许可、验收证明、法律意见或专业鉴定报告。");

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const oldX = doc.x;
    const oldY = doc.y;
    doc.save().opacity(0.07).fillColor("#245c3a").fontSize(46).rotate(-32, { origin: [300, 400] }).text("内部初审", 110, 365, { width: 380, align: "center" }).restore();
    doc.x = oldX;
    doc.y = oldY;
    doc.fontSize(8).fillColor("#667069").text(`开馆风控台 · 第 ${index - range.start + 1} / ${range.count} 页`, 60, 800, { width: 475, align: "center" });
  }
  doc.end();
  return completed;
}
