import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import PDFDocument from "pdfkit";
import checklistModule from "../src/lib/checklist-template.ts";
import reportBuilderModule from "../src/lib/report-builder.ts";

const { checklistTemplate } = checklistModule;
const { buildReportSnapshot } = reportBuilderModule;

nextEnv.loadEnvConfig(process.cwd());

const dataDirectory = path.resolve(".data");
const uploadDirectory = path.join(dataDirectory, "uploads");
const dataFile = path.join(dataDirectory, "mvp-data.json");
const passedProjectId = "simulation-passed-pudong-2026";
const blockedProjectId = "simulation-land-noncompliant-2026";
const projectIds = new Set([passedProjectId, blockedProjectId]);
const ownerEmail = (process.env.MVP_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
const now = new Date().toISOString();

const fontCandidates = [
  process.env.PDF_FONT_PATH,
  "C:\\Windows\\Fonts\\simhei.ttf",
  "/mnt/c/Windows/Fonts/simhei.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
].filter(Boolean);
const fontPath = fontCandidates.find((candidate) => existsSync(candidate));
if (!fontPath) throw new Error("未找到中文字体，无法生成可读的模拟 PDF 材料。请配置 PDF_FONT_PATH。");

function fixedUuid(group, index) {
  return `${group}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function checklist(statusFor, noteFor) {
  return checklistTemplate.map((item) => ({
    ...item,
    status: statusFor(item),
    note: noteFor(item),
    aiAssessment: null,
    updatedAt: now,
  }));
}

async function createPdf(filePath, title, sections) {
  await new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margins: { top: 54, bottom: 54, left: 56, right: 56 }, info: { Title: title, Author: "MVP simulation seed" } });
    const output = createWriteStream(filePath);
    document.pipe(output);
    if (fontPath) document.font(fontPath);
    document.fontSize(10).fillColor("#b42318").text("模拟材料 · 仅供系统演示 · 不具任何法律效力", { align: "center" });
    document.moveDown(1.2).fontSize(20).fillColor("#172b4d").text(title, { align: "center" });
    document.moveDown(0.5).fontSize(9).fillColor("#6b778c").text(`模拟文件编制时间：${now}`, { align: "center" });
    document.moveDown(1.5);
    for (const section of sections) {
      document.fontSize(13).fillColor("#172b4d").text(section.heading);
      document.moveDown(0.35);
      for (const line of section.lines) {
        document.fontSize(10.5).fillColor("#253858").text(`• ${line}`, { lineGap: 4 });
      }
      document.moveDown(0.9);
    }
    document.moveDown(1).fontSize(9).fillColor("#b42318").text("重要：本文件中的主体、地址、编号、意见和数值均为虚构，不得用于签约、报审、验收、融资或投资决策。");
    document.end();
    output.on("finish", resolve);
    output.on("error", reject);
  });
}

const passedMaterials = [
  ["OWNERSHIP", "模拟-不动产权属及权利限制核验摘要.pdf", "不动产权属及权利限制核验摘要", ["模拟权利人：上海演示产业园有限公司", "模拟证载用途：商业/体育配套用房", "模拟面积：2,680平方米，地址、楼层与现场测绘记录一致", "未发现模拟抵押、查封、共有争议或其他出租限制"]],
  ["AUTHORIZATION", "模拟-出租授权与主体一致性确认.pdf", "出租授权与主体一致性确认", ["产权人、出租人和拟签约主体一致", "模拟授权范围包含出租、改造配合和审批材料提供", "主体证照、授权文件和签约印鉴已模拟核对"]],
  ["PLANNING", "模拟-规划用途与体育场馆适用性核验记录.pdf", "规划用途与体育场馆适用性核验记录", ["模拟证载用途与拟经营室内体育场馆具有适用性", "模拟咨询口径：装修、改造和招牌按一般流程申报", "未发现模拟违建、擅自加层、拆迁或更新计划冲突"]],
  ["FIRE", "模拟-原建筑消防验收及现状一致性记录.pdf", "原建筑消防验收及现状一致性记录", ["已模拟取得原建筑消防验收/备案资料", "建筑面积、楼层、疏散楼梯和现状平面基本一致", "喷淋、报警、排烟、应急照明设施状态模拟检查正常"]],
  ["FIRE", "模拟-匹克球馆改造消防可行性预审.pdf", "匹克球馆改造消防可行性预审", ["模拟设计方案不减少安全出口和有效疏散宽度", "场地功能分区、人员容量和疏散距离已模拟预审", "合同中已明确消防设计、施工、检测、验收的责任和费用"]],
  ["ENGINEERING", "模拟-结构地面净高与球场布局评估.pdf", "结构、地面、净高与球场布局评估", ["模拟实测净高：9.2米，可布置8片标准训练场", "柱网不进入模拟球场安全缓冲区", "地面平整度、承载和运动地材铺装条件模拟评估通过", "屋面和防水未发现模拟渗漏缺陷"]],
  ["ENGINEERING", "模拟-供配电照明暖通与给排水评估.pdf", "供配电、照明、暖通与给排水评估", ["模拟可用电力容量满足照明、空调、办公及配套设备负荷", "球场照度、眩光控制和应急照明已纳入模拟方案", "新风、排风、温湿度及给排水方案模拟可行"]],
  ["ENGINEERING", "模拟-声学振动灯光与邻里影响评估.pdf", "声学、振动、灯光与邻里影响评估", ["模拟周边为商业/产业办公，与最近住宅保持演示安全距离", "墙体吸声、减振和运营时段控制已纳入方案", "室外招牌和灯光方向模拟符合物业约束"]],
  ["AUTHORIZATION", "模拟-物业施工进场与时段确认.pdf", "物业施工进场与时段确认", ["模拟物业已确认施工报审、人员车辆进场和成品保护要求", "模拟施工时段、噪声作业时段和建筑垃圾清运路径已确认"]],
  ["CONTRACT", "模拟-租赁合同及审批失败退出条款.pdf", "租赁合同及审批失败退出条款", ["租赁标的、面积、用途、交付标准和租期模拟约定清晰", "租金、押金、免租期、递增、物业和能耗费用已列明", "模拟条款明确出租方审批配合义务及无法审批/验收时的解除退款机制", "装修归属、恢复原状、出售不破租赁和重大违约责任已模拟约定"]],
  ["OTHER", "模拟-投资成本收入情景与风险准备金.pdf", "投资成本、收入情景与风险准备金", ["已模拟测算租金、物业、能耗、人员、营销和税费", "已建立球场利用率、客单价和会员转化的保守/基准/乐观情景", "消防、隔音、暖通及不可预见改造费已设置模拟预备金"]],
  ["OTHER", "模拟-停车交通客群与竞品调研.pdf", "停车、交通、客群与竞品调研", ["模拟记录公交/地铁可达性、机动车和非机动车停车条件", "模拟客群覆盖产业园职员、周边社区和体育培训用户", "已模拟调研同类场馆数量、价格、营业时段和差异化"]],
  ["OTHER", "模拟-运营许可安全制度保险与会员规则.pdf", "运营许可、安全制度、保险与会员规则", ["已模拟梳理营业执照、经营范围和属地咨询事项", "已模拟编制安全巡检、人员疏散、意外伤害和极端天气应急预案", "已模拟评估公众责任、财产和雇主责任保险", "会员协议、退款规则、消费者告知和隐私条款已模拟复核"]],
  ["SITE_PHOTO", "模拟-现场踏勘照片索引与测量记录.pdf", "现场踏勘照片索引与测量记录", ["模拟照片点位：建筑外立面、各安全出口、疏散通道、球场区、机房、卫生间和屋面", "模拟测量：建筑面积2,680平方米，有效净高9.2米，拟布置8片球场", "未发现模拟通道占用、明显渗漏、结构损伤或设施缺失"]],
];

const blockedMaterials = [
  ["OWNERSHIP", "模拟-工业用地厂房权属摘要.pdf", "工业用地厂房权属摘要", ["模拟土地性质：工业用地", "模拟房屋用途：工业厂房/仓储", "模拟面积：3,200平方米", "权属主体与出租主体模拟一致，但权属材料不支持将用途直接表述为商业体育场馆"]],
  ["AUTHORIZATION", "模拟-工业厂房出租授权.pdf", "工业厂房出租授权", ["模拟出租授权文件存在", "授权文件仅证明出租权限，不证明拟经营用途合规", "出租方尚未提供取得用途调整/经营适用意见的书面承诺"]],
  ["PLANNING", "模拟-土地及房屋用途不符合核验记录.pdf", "土地及房屋用途不符合核验记录", ["模拟核验结论：工业用地及工业厂房/仓储用途与拟对公众经营的室内体育场馆存在实质不匹配", "尚未取得模拟主管部门书面适用意见、用途调整或其他合法路径", "在取得属地主管部门书面结论前，不建议签约、付款或进场施工"]],
  ["FIRE", "模拟-工业厂房原消防资料摘要.pdf", "工业厂房原消防资料摘要", ["模拟原消防资料对应工业厂房/仓储使用情景", "拟对公众开放后的人员密度、功能分区和疏散需求与原设计不同", "尚未完成模拟改造消防可行性预审"]],
  ["ENGINEERING", "模拟-工业厂房改造工程初评.pdf", "工业厂房改造工程初评", ["模拟净高和柱网可初步布置10片球场", "供电、暖通、卫生间和应急设施需进一步改造", "工程条件可行不等于规划用途和经营许可合规"]],
  ["CONTRACT", "模拟-工业厂房租赁合同草案-缺退出条款.pdf", "工业厂房租赁合同草案（缺退出条款）", ["模拟合同将拟经营用途描述为匹克球馆，但未附用途合规依据", "未明确无法审批、消防验收或取得经营条件时的无责解除和款项退还", "模拟押金和首期租金在签约后即支付，对承租方存在高额沉没成本风险"]],
  ["SITE_PHOTO", "模拟-工业厂房现场踏勘记录.pdf", "工业厂房现场踏勘记录", ["模拟现状为工业仓储空间，存在原货架基础和物流装卸区", "周边以工业和物流用户为主，公众交通和停车条件需复核", "现场条件不能消除证载用途不匹配风险"]],
];

function materialText(title, lines, projectName) {
  return ["【模拟材料—仅供系统演示—不具法律效力】", `项目：${projectName}`, `材料：${title}`, ...lines, "本文件所有主体、地址、编号、意见和数值均为虚构。"].join("\n");
}

const passedMaterialChecklistCodes = [
  ["OWN-01", "OWN-02", "OWN-03", "OWN-04", "OWN-05"],
  ["OWN-02", "OWN-03"],
  ["USE-01", "USE-02", "USE-03", "USE-04", "USE-05"],
  ["FIR-01", "FIR-02", "FIR-03", "FIR-04"],
  ["FIR-03", "FIR-04", "FIR-05", "FIR-06"],
  ["ENG-01", "ENG-02", "ENG-03"],
  ["ENG-04"],
  ["ENG-05"],
  ["ENG-06"],
  ["CTR-01", "CTR-02", "CTR-03", "CTR-04", "CTR-05", "CTR-06", "CTR-07"],
  ["BUS-01", "BUS-02", "BUS-03"],
  ["BUS-04"],
  ["OPS-01", "OPS-02", "OPS-03", "OPS-04"],
  ["OWN-05", "USE-03", "FIR-02", "FIR-03", "FIR-04", "ENG-01", "ENG-02", "ENG-03", "ENG-04", "ENG-05"],
];

const blockedMaterialChecklistCodes = [
  ["OWN-01", "OWN-02", "OWN-03", "OWN-04", "OWN-05", "USE-01"],
  ["OWN-02", "OWN-03"],
  ["USE-01", "USE-02", "USE-03", "USE-04", "USE-05"],
  ["FIR-01", "FIR-02", "FIR-03", "FIR-04", "FIR-05", "FIR-06"],
  ["ENG-01", "ENG-02", "ENG-03", "ENG-04", "ENG-05", "ENG-06"],
  ["CTR-01", "CTR-02", "CTR-03", "CTR-04", "CTR-05", "CTR-06", "CTR-07"],
  ["OWN-05", "USE-03", "ENG-01", "ENG-02", "ENG-03", "ENG-04", "ENG-05"],
];

async function createDocuments(projectId, projectName, group, materials) {
  const documents = [];
  const checklistCodeMap = group === "1" ? passedMaterialChecklistCodes : blockedMaterialChecklistCodes;
  for (let index = 0; index < materials.length; index += 1) {
    const [category, fileName, title, lines] = materials[index];
    const documentId = fixedUuid(group, index + 1);
    const storageKey = `${fixedUuid(String(Number(group) + 1), index + 1)}.pdf`;
    const filePath = path.join(uploadDirectory, storageKey);
    await createPdf(filePath, title, [{ heading: "模拟核验内容", lines }]);
    const fileStat = await stat(filePath);
    documents.push({
      id: documentId, projectId, category, fileName, mimeType: "application/pdf", sizeBytes: fileStat.size,
      storageKey, uploadedBy: ownerEmail, createdAt: now, deletedAt: null, parseStatus: "COMPLETED",
      extractedText: materialText(title, lines, projectName), pageCount: 1, parseError: "", parsedAt: now,
      checklistCodes: checklistCodeMap[index] ?? [],
    });
  }
  return documents;
}

await mkdir(uploadDirectory, { recursive: true });
const data = JSON.parse(await readFile(dataFile, "utf8"));
for (const key of ["users", "projects", "documents", "risks", "tasks", "auditLogs", "aiConversations", "aiReviews", "reports"]) data[key] ??= [];

data.projects = data.projects.filter((item) => !projectIds.has(item.id));
data.documents = data.documents.filter((item) => !projectIds.has(item.projectId));
data.risks = data.risks.filter((item) => !projectIds.has(item.projectId));
data.tasks = data.tasks.filter((item) => !projectIds.has(item.projectId));
data.auditLogs = data.auditLogs.filter((item) => !projectIds.has(item.projectId));
data.reports = data.reports.filter((item) => !projectIds.has(item.projectId));

const passedName = "模拟项目｜上海浦东金桥匹克球中心（全项通过）";
const passedChecklist = checklist(() => "PASSED", (item) => `模拟核验通过；对应证据已归档（${item.evidence}）。`);
const passedProject = {
  id: passedProjectId, name: passedName, city: "上海市", status: "ARCHIVED", ownerEmail, memberEmails: [],
  venue: { address: "模拟地址：浦东新区金桥产业园演示路88号", district: "浦东新区", areaSqm: 2680, clearHeightM: 9.2, certificateUsage: "商业/体育配套用房（模拟）", intendedUsage: "室内匹克球馆", monthlyRent: 196000, leaseMonths: 72, plannedCourts: 8 },
  checklist: passedChecklist, createdAt: now, updatedAt: now,
};
const passedDocuments = await createDocuments(passedProjectId, passedName, "1", passedMaterials);

const blockedName = "模拟项目｜上海闵行工业厂房改造馆（土地性质不合规）";
const passedBlockedCodes = new Set(["OWN-01", "OWN-02", "OWN-03", "OWN-04", "OWN-05", "USE-01", "USE-03", "FIR-01", "ENG-01", "CTR-01", "CTR-02", "CTR-03", "CTR-04"]);
const failedCodes = new Set(["USE-02", "CTR-05"]);
const todoPrefixes = new Set(["BUS", "OPS"]);
const blockedChecklist = checklist(
  (item) => failedCodes.has(item.code) ? "FAILED" : passedBlockedCodes.has(item.code) ? "PASSED" : todoPrefixes.has(item.code.split("-")[0]) ? "TODO" : "VERIFY",
  (item) => item.code === "USE-02"
    ? "模拟核验：证载工业用地/工业厂房与拟对公众经营的体育场馆用途存在实质不匹配。"
    : item.code === "CTR-05"
      ? "模拟合同缺少无法审批/验收时的无责解除和退款机制。"
      : passedBlockedCodes.has(item.code)
        ? `已完成模拟核查；注意：通过该项不消除 USE-02 重大用途风险。`
        : "待用途合规路径明确后继续核验。",
);
const blockedProject = {
  id: blockedProjectId, name: blockedName, city: "上海市", status: "DECISION_PENDING", ownerEmail, memberEmails: [],
  venue: { address: "模拟地址：闵行区工业园演示路166号", district: "闵行区", areaSqm: 3200, clearHeightM: 10.5, certificateUsage: "工业用地·工业厂房/仓储（模拟）", intendedUsage: "对公众经营的室内匹克球馆", monthlyRent: 128000, leaseMonths: 60, plannedCourts: 10 },
  checklist: blockedChecklist, createdAt: now, updatedAt: now,
};
const blockedDocuments = await createDocuments(blockedProjectId, blockedName, "2", blockedMaterials);

const blockedRisks = [
  { id: fixedUuid("3", 1), projectId: blockedProjectId, source: "CHECKLIST", checklistCode: "USE-02", documentId: blockedDocuments[2].id, title: "土地及房屋证载用途与拟经营体育场馆不匹配", description: "模拟权属材料记载工业用地和工业厂房/仓储，尚无属地主管部门书面意见支持对公众经营的体育场馆用途。", level: "CRITICAL", status: "OPEN", evidence: "模拟-工业用地厂房权属摘要.pdf；模拟-土地及房屋用途不符合核验记录.pdf", recommendation: "立即暂停签约、付款和施工；由属地规划、住建、商务/市场监管等有权部门根据具体地址和方案出具可追溯书面意见。", closeReason: "", createdBy: ownerEmail, createdAt: now, updatedAt: now, closedAt: null },
  { id: fixedUuid("3", 2), projectId: blockedProjectId, source: "CHECKLIST", checklistCode: "CTR-05", documentId: blockedDocuments[5].id, title: "租赁合同缺少审批失败退出和退款机制", description: "模拟合同要求签约后立即支付押金和首期租金，但对用途、消防或经营条件无法实现时的解除、退款和责任未做保护。", level: "HIGH", status: "OPEN", evidence: "模拟-工业厂房租赁合同草案-缺退出条款.pdf", recommendation: "在任何付款前完成律师审核，加入审批/验收失败的无责解除、全额退款、出租方配合及损失承担条款。", closeReason: "", createdBy: ownerEmail, createdAt: now, updatedAt: now, closedAt: null },
  { id: fixedUuid("3", 3), projectId: blockedProjectId, source: "MANUAL", checklistCode: "FIR-05", documentId: blockedDocuments[3].id, title: "原工业消防资料不能直接证明公众体育场馆改造可行", description: "原消防资料对应工业厂房/仓储情景，拟经营后人员密度和功能改变，尚未完成专业预审。", level: "HIGH", status: "OPEN", evidence: "模拟-工业厂房原消防资料摘要.pdf", recommendation: "在用途合规路径明确后，由有资质消防设计/顾问单位根据实际方案出具预审意见。", closeReason: "", createdBy: ownerEmail, createdAt: now, updatedAt: now, closedAt: null },
];
const blockedTasks = [
  { id: fixedUuid("4", 1), projectId: blockedProjectId, riskId: blockedRisks[0].id, title: "取得属地主管部门对拟经营用途的书面意见", assigneeEmail: ownerEmail, dueDate: "2026-08-05", status: "TODO", completionNote: "", createdAt: now, updatedAt: now },
  { id: fixedUuid("4", 2), projectId: blockedProjectId, riskId: blockedRisks[1].id, title: "重谈审批失败解除和全额退款条款", assigneeEmail: ownerEmail, dueDate: "2026-08-08", status: "TODO", completionNote: "", createdAt: now, updatedAt: now },
  { id: fixedUuid("4", 3), projectId: blockedProjectId, riskId: blockedRisks[2].id, title: "完成改造消防可行性专业预审", assigneeEmail: ownerEmail, dueDate: "2026-08-12", status: "TODO", completionNote: "", createdAt: now, updatedAt: now },
];

const passedReport = {
  id: fixedUuid("5", 1), projectId: passedProjectId, version: 1, status: "FINAL",
  snapshot: buildReportSnapshot({ project: passedProject, documents: passedDocuments, risks: [], tasks: [], outcome: "PROCEED", rationale: "模拟项目37项初筛清单均已完成并通过，权属、用途、消防、工程、合同、商业和运营模拟证据齐全，建议进入下一阶段。该结论仅供系统演示。", decidedBy: ownerEmail, generatedAt: now }),
  createdBy: ownerEmail, createdAt: now,
};
const blockedReport = {
  id: fixedUuid("5", 2), projectId: blockedProjectId, version: 1, status: "FINAL",
  snapshot: buildReportSnapshot({ project: blockedProject, documents: blockedDocuments, risks: blockedRisks, tasks: blockedTasks, outcome: "REJECT", rationale: "模拟项目的工业用地及工业厂房/仓储证载用途与拟对公众经营的室内体育场馆存在实质不匹配，且合同缺少审批失败退出保护。在取得主管部门书面意见并完成合同保护前，不建议推进。", decidedBy: ownerEmail, generatedAt: now }),
  createdBy: ownerEmail, createdAt: now,
};

data.projects.unshift(blockedProject);
data.projects.unshift(passedProject);
data.documents.unshift(...blockedDocuments);
data.documents.unshift(...passedDocuments);
data.risks.unshift(...blockedRisks);
data.tasks.unshift(...blockedTasks);
data.reports.unshift(blockedReport);
data.reports.unshift(passedReport);
for (const project of [passedProject, blockedProject]) {
  data.auditLogs.unshift({ id: randomUUID(), projectId: project.id, actorEmail: ownerEmail, action: "SIMULATION_PROJECT_SEEDED", entityType: "PROJECT", entityId: project.id, createdAt: now });
}

const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
await writeFile(temporaryFile, JSON.stringify(data, null, 2), "utf8");
await rename(temporaryFile, dataFile);

console.log(JSON.stringify({
  projects: [
    { id: passedProjectId, name: passedName, checklist: passedChecklist.length, documents: passedDocuments.length, risks: 0, tasks: 0, decision: "PROCEED" },
    { id: blockedProjectId, name: blockedName, checklist: blockedChecklist.length, documents: blockedDocuments.length, risks: blockedRisks.length, tasks: blockedTasks.length, decision: "REJECT" },
  ],
  notice: "All generated materials are simulations without legal effect.",
}, null, 2));
