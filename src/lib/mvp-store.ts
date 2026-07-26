import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { checklistTemplate } from "@/lib/checklist-template";
import type {
  AuditLog,
  AppUser,
  AIConversation,
  AIReview,
  ChecklistAIAssessment,
  ChecklistStatus,
  DocumentCategory,
  DecisionGate,
  ExpertAssignment,
  ExperienceFeedback,
  KnowledgeCategory,
  KnowledgeEntry,
  KnowledgeSourceDocument,
  KnowledgeStatus,
  MvpData,
  Project,
  ProjectDocument,
  ProjectProfile,
  ProjectRole,
  ProjectStage,
  ProjectReport,
  ProjectStatus,
  ReportDecision,
  RemediationTask,
  Risk,
  RiskLevel,
  RiskStatus,
  TaskStatus,
  Notification,
  SystemSettings,
  UserRole,
  Venue,
} from "@/lib/domain";
import { buildReportSnapshot } from "@/lib/report-builder";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSeedKnowledgeEntries } from "@/lib/knowledge-seed";

const dataDirectory = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDirectory, "mvp-data.json");
let writeQueue = Promise.resolve();

function emptyVenue(): Venue {
  return {
    address: "",
    district: "",
    areaSqm: null,
    clearHeightM: null,
    certificateUsage: "",
    intendedUsage: "匹克球馆",
    monthlyRent: null,
    leaseMonths: null,
    plannedCourts: null,
  };
}

function defaultProfile(): ProjectProfile {
  return {
    buildingType: "", floor: "", buildingHeightM: null, plannedOpeningDate: "", budget: null, operationMode: "SELF",
    propertyOwner: "", lessor: "", leasingRelation: "UNKNOWN", certificateNumber: "", landNature: "", propertyNature: "",
    remainingYears: null, encumbrances: [], originalUse: "", currentCondition: "", fireFacilities: "", exits: null,
    powerCapacity: "", hvac: "", waterDrainage: "", network: "", parking: "", sensitiveNeighbors: "",
    nightOperation: false, noiseRisk: "",
  };
}

const stageNames = ["项目建档", "候选场地初筛", "产权与出租权尽调", "规划用途及属地政策核验", "消防建筑及工程预审", "商业模型与投资测算", "租赁合同审核与商务谈判", "签约决策", "设计报建施工与变更", "验收证照保险与开业准备", "持续合规管理"];
const gateNames = ["进入实质性谈判", "支付意向金或定金", "签署租赁合同", "支付首期租金", "开始设计和消防咨询", "正式开工", "接受工程交付", "正式开业"];

function defaultStages(projectId = "template"): ProjectStage[] {
  return stageNames.map((name, order) => ({ id: `${projectId}-stage-${String(order + 1).padStart(2, "0")}`, code: `STAGE-${String(order + 1).padStart(2, "0")}`, name, order,
    status: order === 0 ? "IN_PROGRESS" : "NOT_STARTED", decision: "PENDING", requiredMaterials: [], conditions: "",
    approverRole: "DECISION_MAKER", decidedBy: null, decidedAt: null, note: "" }));
}

function defaultGates(stages: ProjectStage[], projectId = "template"): DecisionGate[] {
  return gateNames.map((name, index) => ({ id: `${projectId}-gate-${String(index + 1).padStart(2, "0")}`, code: `GATE-${String(index + 1).padStart(2, "0")}`, name,
    stageCode: stages[Math.min(index + 1, stages.length - 1)].code, decision: "PENDING",
    requiredMaterials: ["对应阶段必需材料", "未关闭重大风险说明"], blockers: [], rationale: "", approvedBy: null, approvedAt: null }));
}

function defaultSettings(): SystemSettings {
  return { organizationName: "匹克球馆项目组", reminderDays: 3, riskThreshold: "HIGH", aiPromptVersion: "v1",
    reportTemplateVersion: "v1", allowedFileTypes: ["pdf", "docx", "xlsx", "jpg", "jpeg", "png", "zip"],
    decisionGateEnabled: true, updatedBy: "SYSTEM", updatedAt: new Date().toISOString() };
}

function checklistInstances() {
  const now = new Date().toISOString();
  return checklistTemplate.map((item) => ({ ...item, status: "TODO" as const, note: "", updatedAt: now }));
}

function seedData(): MvpData {
  const now = new Date().toISOString();
  return {
    version: 1,
    users: [],
    documents: [],
    risks: [],
    tasks: [],
    auditLogs: [],
    aiConversations: [],
    aiReviews: [],
    reports: [],
    knowledgeEntries: createSeedKnowledgeEntries(now),
    knowledgeSourceDocuments: [],
    organizations: [{ id: randomUUID(), name: "匹克球馆项目组", departments: ["投资决策", "项目管理", "审核风控", "外部顾问"], createdAt: now, updatedAt: now }],
    expertAssignments: [],
    notifications: [],
    systemSettings: defaultSettings(),
    projects: [
      {
        id: "demo-shanghai-pudong-a",
        name: "上海浦东候选场地 A",
        city: "上海市",
        status: "DUE_DILIGENCE",
        ownerEmail: process.env.MVP_ADMIN_EMAIL ?? "admin@example.com",
        memberEmails: [],
        venue: {
          ...emptyVenue(),
          district: "浦东新区",
          address: "示例地址（请替换为真实项目地址）",
          areaSqm: 2400,
          clearHeightM: 9,
          certificateUsage: "待核实",
          monthlyRent: 180000,
          leaseMonths: 60,
          plannedCourts: 8,
        },
        profile: defaultProfile(),
        stages: defaultStages("demo-shanghai-pudong-a"),
        decisionGates: defaultGates(defaultStages("demo-shanghai-pudong-a"), "demo-shanghai-pudong-a"),
        venues: [],
        memberRoles: {},
        checklist: checklistInstances().map((item, index) => ({
          ...item,
          status: index < 4 ? "PASSED" : index < 7 ? "VERIFY" : "TODO",
        })),
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

async function readData(): Promise<MvpData> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    const data = JSON.parse(await readFile(dataFile, "utf8")) as MvpData;
    data.users ??= [];
    data.documents ??= [];
    data.risks ??= [];
    data.tasks ??= [];
    data.auditLogs ??= [];
    data.aiConversations ??= [];
    data.aiReviews ??= [];
    data.reports ??= [];
    data.knowledgeEntries ??= [];
    data.knowledgeSourceDocuments ??= [];
    data.organizations ??= [];
    data.expertAssignments ??= [];
    data.notifications ??= [];
    data.notificationReads ??= [];
    data.experienceFeedback ??= [];
    data.systemSettings ??= defaultSettings();
    const seedEntries = createSeedKnowledgeEntries(nowForMigration(data));
    for (const seed of seedEntries) {
      const existing = data.knowledgeEntries.find((entry) => entry.id === seed.id);
      if (existing) Object.assign(existing, seed, { createdAt: existing.createdAt });
      else data.knowledgeEntries.push(seed);
    }
    for (const entry of data.knowledgeEntries) {
      entry.sourceDocumentId ??= null;
      entry.sourceUrl ??= "";
      entry.origin ??= entry.sourceDocumentId ? "DOCUMENT_IMPORT" : "MANUAL";
      entry.projectId ??= null;
      entry.conversationId ??= null;
      entry.question ??= "";
      entry.updatedBy ??= entry.reviewedBy ?? entry.createdBy;
    }
    for (const source of data.knowledgeSourceDocuments) {
      source.aiModel ??= "";
      source.promptVersion ??= "";
    }
    for (const document of data.documents) {
      document.parseStatus ??= "PENDING";
      document.extractedText ??= "";
      document.pageCount ??= null;
      document.parseError ??= "";
      document.parsedAt ??= null;
      document.checklistCodes ??= [];
    }
    for (const project of data.projects) {
      for (const item of project.checklist) item.aiAssessment ??= null;
      project.profile ??= defaultProfile();
      project.stages ??= defaultStages(project.id);
      project.decisionGates ??= defaultGates(project.stages, project.id);
      project.venues ??= [{ ...project.venue, id: `${project.id}-venue-primary`, name: "主候选场地", isPrimary: true }];
      if (!project.stages.length) project.stages = defaultStages(project.id);
      if (!project.decisionGates.length) project.decisionGates = defaultGates(project.stages, project.id);
      if (!project.venues.length) project.venues = [{ ...project.venue, id: `${project.id}-venue-primary`, name: "主候选场地", isPrimary: true }];
      project.memberRoles ??= {};
    }
    for (const review of data.aiReviews) review.resolutionNote ??= "";
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const data = seedData();
    await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
    return data;
  }
}

function nowForMigration(data: MvpData): string {
  return data.projects[0]?.createdAt ?? new Date().toISOString();
}

async function writeData(data: MvpData): Promise<void> {
  const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(data, null, 2), "utf8");
  await rename(temporaryFile, dataFile);
}

async function mutate<T>(operation: (data: MvpData) => T | Promise<T>): Promise<T> {
  let result!: T;
  const current = writeQueue.then(async () => {
    const data = await readData();
    result = await operation(data);
    await writeData(data);
  });
  writeQueue = current.catch(() => undefined);
  await current;
  return result;
}

export function canAccess(project: Project, email: string, role: UserRole): boolean {
  return role === "ADMIN" || project.ownerEmail === email || project.memberEmails.includes(email);
}

function projectRoleOf(project: Project, email: string): ProjectRole {
  return project.ownerEmail.toLowerCase() === email.toLowerCase()
    ? "PROJECT_MANAGER"
    : project.memberRoles?.[email.toLowerCase()] ?? project.memberRoles?.[email] ?? "MEMBER";
}

function canManageProject(project: Project, email: string, role: UserRole): boolean {
  return role === "ADMIN" || ["PROJECT_MANAGER", "REVIEWER"].includes(projectRoleOf(project, email));
}

function audit(data: MvpData, input: Omit<AuditLog, "id" | "createdAt">) {
  data.auditLogs.unshift({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
}

function archiveProjectWhenCompleted(data: MvpData, project: Project, actorEmail: string): boolean {
  if (project.status === "ARCHIVED") return false;
  const applicable = project.checklist.filter((item) => item.status !== "NOT_APPLICABLE");
  const checklistCompleted = applicable.length > 0 && applicable.every((item) => item.status === "PASSED" || item.status === "FAILED");
  const hasFinalReport = data.reports.some((report) => report.projectId === project.id && report.status === "FINAL");
  if (!checklistCompleted || !hasFinalReport) return false;
  project.status = "ARCHIVED";
  project.updatedAt = new Date().toISOString();
  audit(data, { projectId: project.id, actorEmail, action: "PROJECT_AUTO_ARCHIVED", entityType: "PROJECT", entityId: project.id });
  return true;
}

export async function authenticateUser(email: string, password: string): Promise<AppUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = (await readData()).users.find((user) => user.email === normalizedEmail && user.active);
  if (existing) return (await verifyPassword(password, existing.passwordHash)) ? existing : null;

  const adminEmail = (process.env.MVP_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const adminPassword = process.env.MVP_ADMIN_PASSWORD ?? "change-me-before-shared-use";
  if (normalizedEmail !== adminEmail || password !== adminPassword) return null;

  return mutate(async (data) => {
    const concurrent = data.users.find((user) => user.email === normalizedEmail && user.active);
    if (concurrent) return (await verifyPassword(password, concurrent.passwordHash)) ? concurrent : null;
    const now = new Date().toISOString();
    const user: AppUser = {
      id: randomUUID(),
      email: normalizedEmail,
      displayName: "系统管理员",
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    data.users.push(user);
    return user;
  });
}

export async function getSessionUser(email: string): Promise<Pick<AppUser, "email" | "role" | "active"> | null> {
  const user = (await readData()).users.find((item) => item.email === email.trim().toLowerCase());
  return user ? { email: user.email, role: user.role, active: user.active } : null;
}

export type ManagedUser = Omit<AppUser, "passwordHash">;

function requireAdminActor(data: MvpData, actorEmail: string, actorRole: UserRole): AppUser {
  const actor = data.users.find((item) => item.email === actorEmail.trim().toLowerCase());
  if (!actor || !actor.active || actor.role !== "ADMIN" || actorRole !== "ADMIN") throw new Error("仅系统管理员可以管理用户和权限。");
  return actor;
}

function managedUser(user: AppUser): ManagedUser {
  const { passwordHash: _passwordHash, ...result } = user;
  void _passwordHash;
  return result;
}

export async function listManagedUsers(actorEmail: string, actorRole: UserRole): Promise<ManagedUser[]> {
  const data = await readData();
  requireAdminActor(data, actorEmail, actorRole);
  return data.users.map(managedUser).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function createManagedUser(input: {
  actorEmail: string;
  actorRole: UserRole;
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<ManagedUser> {
  return mutate(async (data) => {
    requireAdminActor(data, input.actorEmail, input.actorRole);
    const email = input.email.trim().toLowerCase();
    if (data.users.some((item) => item.email === email)) throw new Error("该邮箱账号已存在。");
    const now = new Date().toISOString();
    const user: AppUser = {
      id: randomUUID(),
      email,
      displayName: input.displayName.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    data.users.push(user);
    audit(data, { projectId: "SYSTEM", actorEmail: input.actorEmail, action: "USER_CREATED", entityType: "USER", entityId: user.id });
    return managedUser(user);
  });
}

export async function updateManagedUser(input: {
  actorEmail: string;
  actorRole: UserRole;
  userId: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  newPassword?: string;
}): Promise<ManagedUser> {
  return mutate(async (data) => {
    const actor = requireAdminActor(data, input.actorEmail, input.actorRole);
    const user = data.users.find((item) => item.id === input.userId);
    if (!user) throw new Error("用户不存在。");
    if (user.id === actor.id && (input.role !== "ADMIN" || !input.active)) throw new Error("不能停用自己或移除自己的管理员角色。");
    const removesActiveAdmin = user.role === "ADMIN" && user.active && (input.role !== "ADMIN" || !input.active);
    if (removesActiveAdmin && data.users.filter((item) => item.role === "ADMIN" && item.active).length <= 1) throw new Error("系统必须至少保留一名启用状态的管理员。");
    user.displayName = input.displayName.trim();
    user.role = input.role;
    user.active = input.active;
    if (input.newPassword) user.passwordHash = await hashPassword(input.newPassword);
    user.updatedAt = new Date().toISOString();
    audit(data, { projectId: "SYSTEM", actorEmail: input.actorEmail, action: "USER_UPDATED", entityType: "USER", entityId: user.id });
    return managedUser(user);
  });
}

export async function deleteManagedUser(input: { actorEmail: string; actorRole: UserRole; userId: string }): Promise<void> {
  await mutate((data) => {
    const actor = requireAdminActor(data, input.actorEmail, input.actorRole);
    const index = data.users.findIndex((item) => item.id === input.userId);
    const user = data.users[index];
    if (!user) throw new Error("用户不存在。");
    if (user.id === actor.id) throw new Error("不能删除当前登录的管理员账号。");
    if (data.projects.some((project) => project.ownerEmail.toLowerCase() === user.email)) throw new Error("该用户仍是项目负责人，请先转移项目负责人后再删除。");
    if (user.role === "ADMIN" && user.active && data.users.filter((item) => item.role === "ADMIN" && item.active).length <= 1) throw new Error("系统必须至少保留一名启用状态的管理员。");
    for (const project of data.projects) {
      const before = project.memberEmails.length;
      project.memberEmails = project.memberEmails.filter((email) => email.toLowerCase() !== user.email);
      if (project.memberEmails.length !== before) project.updatedAt = new Date().toISOString();
    }
    data.users.splice(index, 1);
    audit(data, { projectId: "SYSTEM", actorEmail: input.actorEmail, action: "USER_DELETED", entityType: "USER", entityId: user.id });
  });
}

export async function setManagedUserProjects(input: {
  actorEmail: string;
  actorRole: UserRole;
  userId: string;
  projectIds: string[];
}): Promise<void> {
  await mutate((data) => {
    requireAdminActor(data, input.actorEmail, input.actorRole);
    const user = data.users.find((item) => item.id === input.userId);
    if (!user) throw new Error("用户不存在。");
    const validProjectIds = new Set(data.projects.map((project) => project.id));
    const requested = new Set(input.projectIds.filter((projectId) => validProjectIds.has(projectId)));
    const now = new Date().toISOString();
    for (const project of data.projects) {
      if (project.ownerEmail.toLowerCase() === user.email) continue;
      const wasMember = project.memberEmails.some((email) => email.toLowerCase() === user.email);
      const shouldBeMember = requested.has(project.id);
      if (shouldBeMember && !wasMember) {
        project.memberEmails.push(user.email);
        project.updatedAt = now;
      } else if (!shouldBeMember && wasMember) {
        project.memberEmails = project.memberEmails.filter((email) => email.toLowerCase() !== user.email);
        project.updatedAt = now;
      }
    }
    user.updatedAt = now;
    audit(data, { projectId: "SYSTEM", actorEmail: input.actorEmail, action: "USER_PROJECT_ASSIGNMENTS_UPDATED", entityType: "USER", entityId: user.id });
  });
}

export async function listKnowledgeEntries(input: { email: string; role: UserRole; includeUnpublished?: boolean }): Promise<KnowledgeEntry[]> {
  const entries = (await readData()).knowledgeEntries;
  const visible = input.role === "ADMIN" && input.includeUnpublished
    ? entries
    : entries.filter((entry) => entry.status === "PUBLISHED" || entry.createdBy.toLowerCase() === input.email.toLowerCase());
  return [...visible].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function submitKnowledgeEntry(input: {
  email: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
  sourceName: string;
  sourceUrl: string;
}): Promise<KnowledgeEntry> {
  return mutate((data) => {
    const sequence = data.knowledgeEntries.reduce((largest, entry) => {
      const value = Number(entry.code.replace(/^KB-/, ""));
      return Number.isFinite(value) ? Math.max(largest, value) : largest;
    }, 0) + 1;
    const now = new Date().toISOString();
    const entry: KnowledgeEntry = {
      id: randomUUID(),
      code: `KB-${String(sequence).padStart(4, "0")}`,
      category: input.category,
      title: input.title.trim(),
      summary: input.summary.trim(),
      content: input.content.trim(),
      keywords: Array.from(new Set(input.keywords.map((item) => item.trim()).filter(Boolean))).slice(0, 20),
      sourceName: input.sourceName.trim(),
      sourceUrl: input.sourceUrl.trim(),
      sourceDocumentId: null,
      origin: "MANUAL",
      projectId: null,
      conversationId: null,
      question: "",
      status: "PENDING",
      version: 1,
      createdBy: input.email,
      updatedBy: input.email,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    data.knowledgeEntries.unshift(entry);
    audit(data, { projectId: "SYSTEM", actorEmail: input.email, action: "KNOWLEDGE_SUBMITTED", entityType: "KNOWLEDGE_ENTRY", entityId: entry.id });
    return entry;
  });
}

export async function completeConsultationLearning(input: {
  email: string;
  role: UserRole;
  projectId: string;
  conversationId: string;
  answer: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
  question: string;
}): Promise<KnowledgeEntry> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const conversation = data.aiConversations.find((item) => item.id === input.conversationId && item.projectId === input.projectId);
    if (!project || !conversation || !canAccess(project, input.email, input.role) || (input.role !== "ADMIN" && conversation.userEmail.toLowerCase() !== input.email.toLowerCase())) throw new Error("无法关联 AI 咨询会话。");
    const sequence = data.knowledgeEntries.reduce((largest, entry) => {
      const value = Number(entry.code.replace(/^KB-/, ""));
      return Number.isFinite(value) ? Math.max(largest, value) : largest;
    }, 0) + 1;
    const now = new Date().toISOString();
    const entry: KnowledgeEntry = {
      id: randomUUID(), code: `KB-${String(sequence).padStart(4, "0")}`, category: input.category,
      title: input.title.trim(), summary: input.summary.trim(), content: input.content.trim(),
      keywords: Array.from(new Set(input.keywords.map((item) => item.trim()).filter(Boolean))).slice(0, 20),
      sourceName: "AI 咨询自动学习", sourceUrl: "", sourceDocumentId: null, origin: "AI_CONSULTATION",
      projectId: input.projectId, conversationId: input.conversationId, question: input.question.trim(),
      status: "PENDING", version: 1, createdBy: input.email, updatedBy: input.email, reviewedBy: null, reviewedAt: null, createdAt: now, updatedAt: now,
    };
    conversation.messages.push({ id: randomUUID(), role: "assistant", content: input.answer, createdAt: now });
    conversation.updatedAt = now;
    data.knowledgeEntries.unshift(entry);
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_RESPONSE_STORED", entityType: "AI_CONVERSATION", entityId: conversation.id });
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_CONSULTATION_LEARNED", entityType: "KNOWLEDGE_ENTRY", entityId: entry.id });
    return entry;
  });
}

export async function listKnowledgeSourceDocuments(input: { email: string; role: UserRole }): Promise<KnowledgeSourceDocument[]> {
  const sources = (await readData()).knowledgeSourceDocuments;
  return sources
    .filter((source) => input.role === "ADMIN" || source.uploadedBy === input.email)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createKnowledgeSourceDocument(input: {
  email: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}): Promise<KnowledgeSourceDocument> {
  return mutate((data) => {
    const now = new Date().toISOString();
    const source: KnowledgeSourceDocument = {
      id: randomUUID(), fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, storageKey: input.storageKey,
      status: "PROCESSING", parseMethod: "", extractedText: "", aiSummary: "", aiModel: "", promptVersion: "", error: "", entryIds: [], uploadedBy: input.email,
      createdAt: now, updatedAt: now,
    };
    data.knowledgeSourceDocuments.unshift(source);
    audit(data, { projectId: "SYSTEM", actorEmail: input.email, action: "KNOWLEDGE_DOCUMENT_UPLOADED", entityType: "KNOWLEDGE_SOURCE", entityId: source.id });
    return source;
  });
}

export async function completeKnowledgeSourceImport(input: {
  sourceId: string;
  email: string;
  role: UserRole;
  parseMethod: string;
  extractedText: string;
  aiSummary: string;
  aiModel: string;
  promptVersion: string;
  entries: Array<{ category: KnowledgeCategory; title: string; summary: string; content: string; keywords: string[] }>;
}): Promise<KnowledgeEntry[]> {
  return mutate((data) => {
    const source = data.knowledgeSourceDocuments.find((item) => item.id === input.sourceId);
    if (!source || (input.role !== "ADMIN" && source.uploadedBy !== input.email)) throw new Error("知识源文件不存在或无权操作。");
    let sequence = data.knowledgeEntries.reduce((largest, entry) => {
      const value = Number(entry.code.replace(/^KB-/, ""));
      return Number.isFinite(value) ? Math.max(largest, value) : largest;
    }, 0);
    const now = new Date().toISOString();
    const created = input.entries.map((candidate) => {
      sequence += 1;
      const entry: KnowledgeEntry = {
        id: randomUUID(), code: `KB-${String(sequence).padStart(4, "0")}`, category: candidate.category,
        title: candidate.title.trim(), summary: candidate.summary.trim(), content: candidate.content.trim(),
        keywords: Array.from(new Set(candidate.keywords.map((item) => item.trim()).filter(Boolean))).slice(0, 20),
        sourceName: source.fileName, sourceUrl: "", sourceDocumentId: source.id, origin: "DOCUMENT_IMPORT", projectId: null, conversationId: null, question: "",
        status: "PENDING", version: 1, createdBy: input.email, updatedBy: input.email,
        reviewedBy: null, reviewedAt: null, createdAt: now, updatedAt: now,
      };
      data.knowledgeEntries.unshift(entry);
      return entry;
    });
    source.status = "IMPORTED";
    source.parseMethod = input.parseMethod;
    source.extractedText = input.extractedText;
    source.aiSummary = input.aiSummary;
    source.aiModel = input.aiModel;
    source.promptVersion = input.promptVersion;
    source.error = "";
    source.entryIds = created.map((entry) => entry.id);
    source.updatedAt = now;
    audit(data, { projectId: "SYSTEM", actorEmail: input.email, action: "KNOWLEDGE_DOCUMENT_IMPORTED", entityType: "KNOWLEDGE_SOURCE", entityId: source.id });
    return created;
  });
}

export async function failKnowledgeSourceImport(input: { sourceId: string; email: string; role: UserRole; error: string }): Promise<void> {
  await mutate((data) => {
    const source = data.knowledgeSourceDocuments.find((item) => item.id === input.sourceId);
    if (!source || (input.role !== "ADMIN" && source.uploadedBy !== input.email)) return;
    source.status = "FAILED";
    source.error = input.error.slice(0, 500);
    source.updatedAt = new Date().toISOString();
    audit(data, { projectId: "SYSTEM", actorEmail: input.email, action: "KNOWLEDGE_DOCUMENT_IMPORT_FAILED", entityType: "KNOWLEDGE_SOURCE", entityId: source.id });
  });
}

export async function updateKnowledgeEntry(input: {
  actorEmail: string;
  actorRole: UserRole;
  entryId: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
  sourceName: string;
  sourceUrl: string;
  status: KnowledgeStatus;
}): Promise<KnowledgeEntry> {
  return mutate((data) => {
    requireAdminActor(data, input.actorEmail, input.actorRole);
    const entry = data.knowledgeEntries.find((item) => item.id === input.entryId);
    if (!entry) throw new Error("知识条目不存在。");
    entry.category = input.category;
    entry.title = input.title.trim();
    entry.summary = input.summary.trim();
    entry.content = input.content.trim();
    entry.keywords = Array.from(new Set(input.keywords.map((item) => item.trim()).filter(Boolean))).slice(0, 20);
    entry.sourceName = input.sourceName.trim();
    entry.sourceUrl = input.sourceUrl.trim();
    entry.updatedBy = input.actorEmail;
    entry.status = input.status;
    entry.version += 1;
    entry.reviewedBy = input.actorEmail;
    entry.reviewedAt = new Date().toISOString();
    entry.updatedAt = entry.reviewedAt;
    audit(data, { projectId: "SYSTEM", actorEmail: input.actorEmail, action: `KNOWLEDGE_${input.status}`, entityType: "KNOWLEDGE_ENTRY", entityId: entry.id });
    return entry;
  });
}

export type KnowledgeEntryDetail = {
  entry: KnowledgeEntry;
  createdByLabel: string;
  updatedByLabel: string;
};

function knowledgeActorLabel(data: MvpData, email: string): string {
  if (email === "SYSTEM") return "系统内置知识";
  const user = data.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  return user ? `${user.displayName}（${user.email}）` : email;
}

export async function listKnowledgeEntryDetails(input: { email: string; role: UserRole; includeUnpublished?: boolean }): Promise<KnowledgeEntryDetail[]> {
  const data = await readData();
  const visible = input.role === "ADMIN" && input.includeUnpublished
    ? data.knowledgeEntries
    : data.knowledgeEntries.filter((entry) => entry.status === "PUBLISHED" || entry.createdBy.toLowerCase() === input.email.toLowerCase());
  return [...visible]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((entry) => ({ entry, createdByLabel: knowledgeActorLabel(data, entry.createdBy), updatedByLabel: knowledgeActorLabel(data, entry.updatedBy) }));
}

export async function getKnowledgeEntryDetail(input: { entryId: string; email: string; role: UserRole }): Promise<KnowledgeEntryDetail | null> {
  const data = await readData();
  const entry = data.knowledgeEntries.find((item) => item.id === input.entryId);
  if (!entry || (entry.status !== "PUBLISHED" && input.role !== "ADMIN" && entry.createdBy.toLowerCase() !== input.email.toLowerCase())) return null;
  return { entry, createdByLabel: knowledgeActorLabel(data, entry.createdBy), updatedByLabel: knowledgeActorLabel(data, entry.updatedBy) };
}

export async function listProjectMembers(projectId: string): Promise<AppUser[]> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) return [];
  const emails = new Set([project.ownerEmail.toLowerCase(), ...project.memberEmails.map((email) => email.toLowerCase())]);
  return data.users.filter((user) => emails.has(user.email));
}

export async function assignProjectMember(input: {
  projectId: string;
  displayName: string;
  email: string;
  temporaryPassword: string;
  actorEmail: string;
}): Promise<void> {
  await mutate(async (data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project) throw new Error("项目不存在。");
    const email = input.email.trim().toLowerCase();
    if (email === project.ownerEmail.toLowerCase()) throw new Error("该账号已是项目负责人。");
    const now = new Date().toISOString();
    let user = data.users.find((item) => item.email === email);
    if (!user) {
      user = {
        id: randomUUID(),
        email,
        displayName: input.displayName.trim(),
        passwordHash: await hashPassword(input.temporaryPassword),
        role: "MEMBER",
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      data.users.push(user);
    } else if (!user.active) {
      throw new Error("该账号已被系统管理员停用，项目负责人不能重新启用或重置其密码。");
    }
    if (!project.memberEmails.includes(email)) project.memberEmails.push(email);
    project.updatedAt = now;
    audit(data, { projectId: project.id, actorEmail: input.actorEmail, action: "MEMBER_ASSIGNED", entityType: "USER", entityId: user.id });
  });
}

export async function removeProjectMember(input: { projectId: string; email: string; actorEmail: string }): Promise<void> {
  await mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project) throw new Error("项目不存在。");
    const email = input.email.trim().toLowerCase();
    project.memberEmails = project.memberEmails.filter((item) => item.toLowerCase() !== email);
    project.updatedAt = new Date().toISOString();
    const user = data.users.find((item) => item.email === email);
    audit(data, { projectId: project.id, actorEmail: input.actorEmail, action: "MEMBER_REMOVED", entityType: "USER", entityId: user?.id ?? email });
  });
}

export async function listProjects(email: string, role: UserRole): Promise<Project[]> {
  return (await readData()).projects.filter((project) => canAccess(project, email, role));
}

export async function getProject(id: string, email: string, role: UserRole): Promise<Project | null> {
  const project = (await readData()).projects.find((item) => item.id === id);
  return project && canAccess(project, email, role) ? project : null;
}

export async function createProject(input: {
  name: string;
  city: string;
  ownerEmail: string;
  venue: Venue;
}): Promise<Project> {
  return mutate((data) => {
    const now = new Date().toISOString();
    const projectId = randomUUID();
    const project: Project = {
      id: projectId,
      name: input.name,
      city: input.city,
      status: "DRAFT",
      ownerEmail: input.ownerEmail,
      memberEmails: [],
      venue: input.venue,
      venues: [{ ...input.venue, id: `${projectId}-venue-primary`, name: "主候选场地", isPrimary: true }],
      profile: defaultProfile(),
      stages: defaultStages(projectId),
      decisionGates: [],
      memberRoles: {},
      checklist: checklistInstances(),
      createdAt: now,
      updatedAt: now,
    };
    data.projects.unshift(project);
    project.decisionGates = defaultGates(project.stages ?? [], projectId);
    audit(data, { projectId: project.id, actorEmail: input.ownerEmail, action: "PROJECT_CREATED", entityType: "PROJECT", entityId: project.id });
    return project;
  });
}

export async function cloneProject(input: { projectId: string; email: string; role: UserRole }): Promise<Project | null> {
  return mutate((data) => { const source = data.projects.find((item) => item.id === input.projectId); if (!source || !canAccess(source,input.email,input.role)) return null;
    const id=randomUUID(),now=new Date().toISOString(),stages=defaultStages(id); const project:Project={...structuredClone(source),id,name:`${source.name}（副本）`,status:"DRAFT",ownerEmail:input.email,memberEmails:[],memberRoles:{},
      venues:(source.venues??[source.venue]).map((venue,index)=>({...venue,id:`${id}-venue-${index+1}`})),profile:structuredClone(source.profile??defaultProfile()),stages,decisionGates:defaultGates(stages,id),
      checklist:checklistInstances(),createdAt:now,updatedAt:now}; const primary=project.venues?.find((venue)=>venue.isPrimary)??project.venues?.[0]; if(primary){primary.isPrimary=true;project.venue={...primary};}
    data.projects.unshift(project);audit(data,{projectId:id,actorEmail:input.email,action:"PROJECT_CLONED",entityType:"PROJECT",entityId:id});return project; });
}

export async function updateProject(input: {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  city: string;
  status: ProjectStatus;
  venue: Venue;
}): Promise<Project | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.id);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    project.name = input.name;
    project.city = input.city;
    project.status = input.status;
    project.venue = input.venue;
    const primary = project.venues?.find((venue) => venue.isPrimary);
    if (primary) Object.assign(primary, input.venue);
    project.updatedAt = new Date().toISOString();
    return project;
  });
}

export async function updateChecklistItem(input: {
  projectId: string;
  code: string;
  email: string;
  role: UserRole;
  status: ChecklistStatus;
  note: string;
}): Promise<boolean> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return false;
    const item = project.checklist.find((candidate) => candidate.code === input.code);
    if (!item) return false;
    item.status = input.status;
    item.note = input.note;
    item.updatedAt = new Date().toISOString();
    project.updatedAt = item.updatedAt;
    archiveProjectWhenCompleted(data, project, input.email);
    return true;
  });
}

export function projectProgress(project: Project): { completed: number; total: number; percent: number } {
  const applicable = project.checklist.filter((item) => item.status !== "NOT_APPLICABLE");
  const completed = applicable.filter((item) => item.status === "PASSED" || item.status === "FAILED").length;
  return { completed, total: applicable.length, percent: applicable.length ? Math.round((completed / applicable.length) * 100) : 0 };
}

export async function addDocument(input: {
  projectId: string;
  email: string;
  role: UserRole;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  checklistCodes?: string[];
  source?: string; provider?: string; evidenceForm?: NonNullable<ProjectDocument["evidenceForm"]>; expiresAt?: string; tags?: string[]; sensitive?: boolean;
}): Promise<ProjectDocument | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    const priorVersions = data.documents.filter((item) => item.projectId === input.projectId && item.fileName === input.fileName && item.category === input.category);
    const document: ProjectDocument = {
      id: randomUUID(), projectId: input.projectId, category: input.category, fileName: input.fileName,
      mimeType: input.mimeType, sizeBytes: input.sizeBytes, storageKey: input.storageKey,
      uploadedBy: input.email, createdAt: new Date().toISOString(), deletedAt: null,
      parseStatus: "PENDING", extractedText: "", pageCount: null, parseError: "", parsedAt: null,
      checklistCodes: input.checklistCodes ?? [],
      version: Math.max(0, ...priorVersions.map((item) => item.version ?? 1)) + 1,
      versionGroupId: priorVersions[0]?.versionGroupId ?? priorVersions[0]?.id ?? randomUUID(), source: input.source ?? "", provider: input.provider ?? "",
      evidenceForm: input.evidenceForm ?? "SCAN", expiresAt: input.expiresAt ?? "", tags: input.tags ?? [], sensitive: input.sensitive ?? false,
    };
    data.documents.unshift(document);
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "DOCUMENT_UPLOADED", entityType: "DOCUMENT", entityId: document.id });
    return document;
  });
}

export async function setChecklistAIAssessment(input: {
  projectId: string;
  checklistCode: string;
  email: string;
  role: UserRole;
  assessment: ChecklistAIAssessment;
}): Promise<boolean> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const checklistItem = project?.checklist.find((item) => item.code === input.checklistCode);
    if (!project || !checklistItem || !canAccess(project, input.email, input.role)) return false;
    checklistItem.aiAssessment = input.assessment;
    checklistItem.updatedAt = input.assessment.updatedAt;
    project.updatedAt = input.assessment.updatedAt;
    audit(data, { projectId: project.id, actorEmail: input.email, action: `CHECKLIST_AI_${input.assessment.status}`, entityType: "CHECKLIST_ITEM", entityId: input.checklistCode });
    return true;
  });
}

export async function updateChecklistAIAssessment(input: {
  projectId: string;
  checklistCode: string;
  email: string;
  role: UserRole;
  judgment: ChecklistAIAssessment["judgment"];
  analysis: string;
  evidence: string;
  recommendation: string;
  confidence: ChecklistAIAssessment["confidence"];
  requiresExpertReview: boolean;
}): Promise<boolean> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const checklistItem = project?.checklist.find((item) => item.code === input.checklistCode);
    if (!project || !checklistItem?.aiAssessment || !canAccess(project, input.email, input.role)) return false;
    const now = new Date().toISOString();
    checklistItem.aiAssessment = {
      ...checklistItem.aiAssessment,
      status: "COMPLETED",
      judgment: input.judgment,
      analysis: input.analysis,
      evidence: input.evidence,
      recommendation: input.recommendation,
      confidence: input.confidence,
      requiresExpertReview: input.requiresExpertReview,
      error: "",
      source: "MANUAL_EDIT",
      updatedBy: input.email,
      updatedAt: now,
    };
    checklistItem.updatedAt = now;
    project.updatedAt = now;
    audit(data, { projectId: project.id, actorEmail: input.email, action: "CHECKLIST_AI_MANUALLY_EDITED", entityType: "CHECKLIST_ITEM", entityId: input.checklistCode });
    return true;
  });
}

export async function setDocumentParseResult(input: {
  projectId: string; documentId: string; email: string; role: UserRole; status: "PROCESSING" | "COMPLETED" | "FAILED";
  extractedText?: string; pageCount?: number | null; error?: string;
}): Promise<ProjectDocument | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const document = data.documents.find((item) => item.id === input.documentId && item.projectId === input.projectId && !item.deletedAt);
    if (!project || !document || !canAccess(project, input.email, input.role)) return null;
    document.parseStatus = input.status;
    document.extractedText = input.extractedText ?? document.extractedText;
    document.pageCount = input.pageCount ?? document.pageCount;
    document.parseError = input.error ?? "";
    document.parsedAt = input.status === "PROCESSING" ? null : new Date().toISOString();
    if (input.status !== "PROCESSING") audit(data, { projectId: input.projectId, actorEmail: input.email, action: `DOCUMENT_PARSE_${input.status}`, entityType: "DOCUMENT", entityId: input.documentId });
    return document;
  });
}

export async function getConversation(projectId: string, conversationId: string, email: string, role: UserRole): Promise<AIConversation | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.aiConversations.find((item) => item.id === conversationId && item.projectId === projectId && (role === "ADMIN" || item.userEmail === email)) ?? null;
}

export async function listConversations(projectId: string, email: string, role: UserRole): Promise<AIConversation[] | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.aiConversations.filter((item) => item.projectId === projectId && (role === "ADMIN" || item.userEmail === email));
}

export async function createConversation(projectId: string, email: string, role: UserRole, title: string): Promise<AIConversation | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === projectId);
    if (!project || !canAccess(project, email, role)) return null;
    const now = new Date().toISOString();
    const conversation: AIConversation = { id: randomUUID(), projectId, userEmail: email, title: title.slice(0, 80), messages: [], createdAt: now, updatedAt: now };
    data.aiConversations.unshift(conversation);
    return conversation;
  });
}

export async function addConversationMessage(projectId: string, conversationId: string, email: string, role: UserRole, messageRole: "user" | "assistant", content: string): Promise<boolean> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === projectId);
    const conversation = data.aiConversations.find((item) => item.id === conversationId && item.projectId === projectId);
    if (!project || !conversation || !canAccess(project, email, role) || (role !== "ADMIN" && conversation.userEmail !== email)) return false;
    conversation.messages.push({ id: randomUUID(), role: messageRole, content, createdAt: new Date().toISOString() });
    conversation.updatedAt = new Date().toISOString();
    if (messageRole === "assistant") audit(data, { projectId, actorEmail: email, action: "AI_RESPONSE_STORED", entityType: "AI_CONVERSATION", entityId: conversationId });
    return true;
  });
}

export async function recordAuditEvent(input: { projectId: string; email: string; role: UserRole; action: string; entityType: string; entityId: string }): Promise<boolean> {
  return mutate((data) => { const project = data.projects.find((item) => item.id === input.projectId); if (!project || !canAccess(project,input.email,input.role)) return false;
    audit(data,{projectId:input.projectId,actorEmail:input.email,action:input.action,entityType:input.entityType,entityId:input.entityId}); return true; });
}

export async function listAIReviews(projectId: string, email: string, role: UserRole): Promise<AIReview[] | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.aiReviews.filter((review) => review.projectId === projectId);
}

export async function getAIReview(projectId: string, reviewId: string, email: string, role: UserRole): Promise<AIReview | null> {
  const reviews = await listAIReviews(projectId, email, role);
  return reviews?.find((review) => review.id === reviewId) ?? null;
}

export async function createAIReview(input: { projectId: string; documentId: string; email: string; role: UserRole; model: string; promptVersion: string }): Promise<AIReview | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const document = data.documents.find((item) => item.id === input.documentId && item.projectId === input.projectId && !item.deletedAt);
    if (!project || !document || !canAccess(project, input.email, input.role)) return null;
    const now = new Date().toISOString();
    const review: AIReview = {
      id: randomUUID(), projectId: input.projectId, documentId: input.documentId, requestedBy: input.email,
      status: "PROCESSING", model: input.model, promptVersion: input.promptVersion, output: null, error: "", resolutionNote: "",
      confirmedBy: null, confirmedAt: null, createdAt: now, updatedAt: now,
    };
    data.aiReviews.unshift(review);
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_REVIEW_REQUESTED", entityType: "AI_REVIEW", entityId: review.id });
    return review;
  });
}

export async function completeAIReview(input: { projectId: string; reviewId: string; email: string; role: UserRole; output: AIReview["output"] }): Promise<AIReview | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const review = data.aiReviews.find((item) => item.id === input.reviewId && item.projectId === input.projectId);
    if (!project || !review || !canAccess(project, input.email, input.role) || review.status !== "PROCESSING") return null;
    review.output = input.output;
    review.status = "REVIEW_REQUIRED";
    review.error = "";
    review.updatedAt = new Date().toISOString();
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_REVIEW_COMPLETED", entityType: "AI_REVIEW", entityId: review.id });
    return review;
  });
}

export async function failAIReview(input: { projectId: string; reviewId: string; email: string; role: UserRole; error: string }): Promise<AIReview | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const review = data.aiReviews.find((item) => item.id === input.reviewId && item.projectId === input.projectId);
    if (!project || !review || !canAccess(project, input.email, input.role)) return null;
    review.status = "FAILED";
    review.error = input.error.slice(0, 500);
    review.updatedAt = new Date().toISOString();
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_REVIEW_FAILED", entityType: "AI_REVIEW", entityId: review.id });
    return review;
  });
}

export async function finalizeAIReviewWithoutFindings(input: { projectId: string; reviewId: string; email: string; role: UserRole; note: string }): Promise<AIReview | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const review = data.aiReviews.find((item) => item.id === input.reviewId && item.projectId === input.projectId);
    if (!project || !review || !canAccess(project, input.email, input.role) || review.status !== "REVIEW_REQUIRED" || !review.output || review.output.findings.length !== 0) return null;
    const now = new Date().toISOString();
    review.status = "REJECTED";
    review.resolutionNote = input.note;
    review.confirmedBy = input.email;
    review.confirmedAt = now;
    review.updatedAt = now;
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_REVIEW_NO_RISK_CONFIRMED", entityType: "AI_REVIEW", entityId: review.id });
    return review;
  });
}

export async function decideAIReviewFinding(input: {
  projectId: string; reviewId: string; findingId: string; email: string; role: UserRole; decision: "CONFIRM" | "REJECT";
  decisionNote: string; title: string; description: string; level: RiskLevel; evidence: string; recommendation: string;
}): Promise<{ review: AIReview; risk: Risk | null } | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const review = data.aiReviews.find((item) => item.id === input.reviewId && item.projectId === input.projectId);
    const output = review?.output;
    const finding = output?.findings.find((item) => item.id === input.findingId);
    if (!project || !review || !output || !finding || !canAccess(project, input.email, input.role) || review.status !== "REVIEW_REQUIRED" || finding.status !== "PENDING") return null;
    const now = new Date().toISOString();
    let risk: Risk | null = null;
    if (input.decision === "CONFIRM") {
      risk = {
        id: randomUUID(), projectId: input.projectId, source: "AI_REVIEW", checklistCode: null, documentId: review.documentId,
        title: input.title, description: input.description, level: input.level, status: "OPEN", evidence: input.evidence,
        recommendation: input.recommendation, closeReason: "", createdBy: input.email, createdAt: now, updatedAt: now, closedAt: null,
      };
      data.risks.unshift(risk);
      finding.title = input.title;
      finding.description = input.description;
      finding.level = input.level;
      finding.evidence = input.evidence;
      finding.recommendation = input.recommendation;
      finding.status = "CONFIRMED";
      finding.confirmedRiskId = risk.id;
      audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_FINDING_CONFIRMED_TO_RISK", entityType: "RISK", entityId: risk.id });
    } else {
      finding.status = "REJECTED";
      audit(data, { projectId: input.projectId, actorEmail: input.email, action: "AI_FINDING_REJECTED", entityType: "AI_REVIEW_FINDING", entityId: finding.id });
    }
    finding.decisionNote = input.decisionNote;
    finding.decidedBy = input.email;
    finding.decidedAt = now;
    const pending = output.findings.some((item) => item.status === "PENDING");
    if (!pending) {
      review.status = output.findings.some((item) => item.status === "CONFIRMED") ? "CONFIRMED" : "REJECTED";
      review.confirmedBy = input.email;
      review.confirmedAt = now;
    }
    review.updatedAt = now;
    return { review, risk };
  });
}

export async function listDocuments(projectId: string, email: string, role: UserRole): Promise<ProjectDocument[] | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.documents.filter((item) => item.projectId === projectId && !item.deletedAt);
}

export async function getDocument(projectId: string, documentId: string, email: string, role: UserRole): Promise<ProjectDocument | null> {
  const documents = await listDocuments(projectId, email, role);
  return documents?.find((item) => item.id === documentId) ?? null;
}

export async function listReports(projectId: string, email: string, role: UserRole): Promise<ProjectReport[] | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.reports.filter((report) => report.projectId === projectId).sort((left, right) => right.version - left.version);
}

export async function getReport(projectId: string, reportId: string, email: string, role: UserRole): Promise<ProjectReport | null> {
  const reports = await listReports(projectId, email, role);
  return reports?.find((report) => report.id === reportId) ?? null;
}

export async function createReport(input: { projectId: string; email: string; role: UserRole; outcome: ReportDecision; rationale: string }): Promise<ProjectReport | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    const documents = data.documents.filter((item) => item.projectId === input.projectId && !item.deletedAt);
    const risks = data.risks.filter((item) => item.projectId === input.projectId);
    const tasks = data.tasks.filter((item) => item.projectId === input.projectId);
    const now = new Date().toISOString();
    const version = Math.max(0, ...data.reports.filter((report) => report.projectId === input.projectId).map((report) => report.version)) + 1;
    const report: ProjectReport = {
      id: randomUUID(), projectId: input.projectId, version, status: "FINAL",
      snapshot: buildReportSnapshot({ project, documents, risks, tasks, expertAssignments: data.expertAssignments?.filter((item) => item.projectId === input.projectId && (item.status === "DELIVERED" || item.status === "CONFIRMED")) ?? [], outcome: input.outcome, rationale: input.rationale, decidedBy: input.email, generatedAt: now }),
      createdBy: input.email, createdAt: now,
    };
    data.reports.unshift(report);
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "REPORT_GENERATED", entityType: "REPORT", entityId: report.id });
    archiveProjectWhenCompleted(data, project, input.email);
    return report;
  });
}

export async function voidReport(input: { projectId: string; reportId: string; email: string; role: UserRole }): Promise<ProjectReport | null> {
  return mutate((data) => { const project = data.projects.find((item) => item.id === input.projectId); const report = data.reports.find((item) => item.id === input.reportId && item.projectId === input.projectId);
    if (!project || !report || !canAccess(project,input.email,input.role) || (input.role !== "ADMIN" && project.ownerEmail !== input.email)) return null;
    report.status = "VOID"; audit(data,{projectId:project.id,actorEmail:input.email,action:"REPORT_VOIDED",entityType:"REPORT",entityId:report.id}); return report; });
}

export async function softDeleteDocument(projectId: string, documentId: string, email: string, role: UserRole): Promise<ProjectDocument | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === projectId);
    const document = data.documents.find((item) => item.id === documentId && item.projectId === projectId && !item.deletedAt);
    if (!project || !document || !canAccess(project, email, role)) return null;
    document.deletedAt = new Date().toISOString();
    audit(data, { projectId, actorEmail: email, action: "DOCUMENT_DELETED", entityType: "DOCUMENT", entityId: documentId });
    return document;
  });
}

export async function listRisks(projectId: string, email: string, role: UserRole): Promise<Risk[] | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.risks.filter((item) => item.projectId === projectId);
}

export async function createRisk(input: {
  projectId: string; email: string; role: UserRole; title: string; description: string; level: RiskLevel;
  evidence: string; recommendation: string; checklistCode: string | null; documentId: string | null;
  stageCode?: string; specialty?: string; probability?: number; impact?: number; potentialLoss?: string; ownerEmail?: string; dueDate?: string; requiredEvidence?: string;
}): Promise<Risk | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role) || ["DECISION_MAKER", "EXPERT"].includes(projectRoleOf(project, input.email))) return null;
    const now = new Date().toISOString();
    const risk: Risk = {
      id: randomUUID(), projectId: input.projectId, source: "MANUAL", checklistCode: input.checklistCode,
      documentId: input.documentId, title: input.title, description: input.description, level: input.level,
      status: "OPEN", evidence: input.evidence, recommendation: input.recommendation, closeReason: "",
      createdBy: input.email, createdAt: now, updatedAt: now, closedAt: null,
      stageCode: input.stageCode ?? "", specialty: input.specialty ?? "", probability: input.probability ?? 3, impact: input.impact ?? 3,
      potentialLoss: input.potentialLoss ?? "", ownerEmail: input.ownerEmail ?? input.email, collaboratorEmails: [], dueDate: input.dueDate ?? "",
      requiredEvidence: input.requiredEvidence ?? "", reviewerEmail: "", reviewNote: "",
    };
    data.risks.unshift(risk);
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "RISK_CREATED", entityType: "RISK", entityId: risk.id });
    return risk;
  });
}

export async function updateRisk(input: {
  projectId: string; riskId: string; email: string; role: UserRole; status: RiskStatus; closeReason: string;
}): Promise<Risk | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const risk = data.risks.find((item) => item.id === input.riskId && item.projectId === input.projectId);
    if (!project || !risk || !canAccess(project, input.email, input.role) || (!canManageProject(project, input.email, input.role) && risk.ownerEmail !== input.email)) return null;
    if (input.status === "CLOSED" && input.closeReason.trim().length < 3) throw new Error("关闭风险必须填写关闭依据");
    risk.status = input.status;
    risk.closeReason = input.closeReason;
    risk.updatedAt = new Date().toISOString();
    risk.closedAt = input.status === "CLOSED" ? risk.updatedAt : null;
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "RISK_STATUS_UPDATED", entityType: "RISK", entityId: risk.id });
    return risk;
  });
}

export async function listTasks(projectId: string, email: string, role: UserRole): Promise<RemediationTask[] | null> {
  const data = await readData();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.tasks.filter((item) => item.projectId === projectId);
}

export async function createTask(input: {
  projectId: string; riskId: string; email: string; role: UserRole; title: string; assigneeEmail: string; dueDate: string;
}): Promise<RemediationTask | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const risk = data.risks.find((item) => item.id === input.riskId && item.projectId === input.projectId);
    if (!project || !risk || !canAccess(project, input.email, input.role) || !canManageProject(project, input.email, input.role)) return null;
    const now = new Date().toISOString();
    const task: RemediationTask = { id: randomUUID(), projectId: input.projectId, riskId: input.riskId, title: input.title, assigneeEmail: input.assigneeEmail, dueDate: input.dueDate, status: "TODO", completionNote: "", createdAt: now, updatedAt: now };
    data.tasks.unshift(task);
    if (risk.status === "OPEN") risk.status = "MITIGATING";
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "TASK_CREATED", entityType: "TASK", entityId: task.id });
    return task;
  });
}

export async function updateTask(input: {
  projectId: string; taskId: string; email: string; role: UserRole; status: TaskStatus; completionNote: string;
}): Promise<RemediationTask | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const task = data.tasks.find((item) => item.id === input.taskId && item.projectId === input.projectId);
    if (!project || !task || !canAccess(project, input.email, input.role) || (!canManageProject(project, input.email, input.role) && task.assigneeEmail !== input.email)) return null;
    if (input.status === "DONE" && input.completionNote.trim().length < 3) throw new Error("完成任务必须填写处理说明");
    task.status = input.status;
    task.completionNote = input.completionNote;
    task.updatedAt = new Date().toISOString();
    audit(data, { projectId: input.projectId, actorEmail: input.email, action: "TASK_STATUS_UPDATED", entityType: "TASK", entityId: task.id });
    return task;
  });
}

export async function updateProjectProfile(input: { projectId: string; email: string; role: UserRole; profile: ProjectProfile }): Promise<Project | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    project.profile = input.profile;
    project.updatedAt = new Date().toISOString();
    audit(data, { projectId: project.id, actorEmail: input.email, action: "PROJECT_PROFILE_UPDATED", entityType: "PROJECT", entityId: project.id });
    return project;
  });
}

export async function saveCandidateVenue(input: { projectId: string; email: string; role: UserRole; venue: Venue }): Promise<Venue | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    project.venues ??= [];
    const nowVenue = { ...input.venue, id: input.venue.id || randomUUID(), name: input.venue.name || "候选场地", isPrimary: input.venue.isPrimary ?? false };
    const index = project.venues.findIndex((item) => item.id === nowVenue.id);
    if (nowVenue.isPrimary) project.venues.forEach((item) => { item.isPrimary = false; });
    if (index >= 0) project.venues[index] = nowVenue; else project.venues.push(nowVenue);
    if (nowVenue.isPrimary) project.venue = { ...nowVenue };
    project.updatedAt = new Date().toISOString();
    audit(data, { projectId: project.id, actorEmail: input.email, action: index >= 0 ? "VENUE_UPDATED" : "VENUE_CREATED", entityType: "VENUE", entityId: nowVenue.id! });
    return nowVenue;
  });
}

export async function deleteCandidateVenue(input: { projectId: string; venueId: string; email: string; role: UserRole }): Promise<boolean> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const venue = project?.venues?.find((item) => item.id === input.venueId);
    if (!project || !venue || !canAccess(project, input.email, input.role) || venue.isPrimary) return false;
    project.venues = project.venues?.filter((item) => item.id !== input.venueId);
    project.updatedAt = new Date().toISOString();
    audit(data, { projectId: project.id, actorEmail: input.email, action: "VENUE_DELETED", entityType: "VENUE", entityId: input.venueId });
    return true;
  });
}

export async function updateStageDecision(input: { projectId: string; stageId: string; email: string; role: UserRole; status: ProjectStage["status"]; decision: ProjectStage["decision"]; conditions: string; note: string }): Promise<ProjectStage | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const stage = project?.stages?.find((item) => item.id === input.stageId);
    if (!project || !stage || !canAccess(project, input.email, input.role)) return null;
    stage.status = input.status; stage.decision = input.decision; stage.conditions = input.conditions; stage.note = input.note;
    stage.decidedBy = input.decision === "PENDING" ? null : input.email;
    stage.decidedAt = input.decision === "PENDING" ? null : new Date().toISOString();
    project.updatedAt = new Date().toISOString();
    audit(data, { projectId: project.id, actorEmail: input.email, action: "STAGE_DECISION_UPDATED", entityType: "PROJECT_STAGE", entityId: stage.id });
    return stage;
  });
}

export async function updateDecisionGate(input: { projectId: string; gateId: string; email: string; role: UserRole; decision: DecisionGate["decision"]; rationale: string }): Promise<DecisionGate | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const gate = project?.decisionGates?.find((item) => item.id === input.gateId);
    if (!project || !gate || !canAccess(project, input.email, input.role)) return null;
    const projectRole = project.memberRoles?.[input.email];
    const canApprove = input.role === "ADMIN" || project.ownerEmail === input.email || projectRole === "DECISION_MAKER" || projectRole === "REVIEWER" || projectRole === "PROJECT_MANAGER";
    if (input.decision !== "PENDING" && !canApprove) throw new Error("当前项目角色无权审批关键决策门。");
    const critical = data.risks.filter((risk) => risk.projectId === project.id && risk.level === "CRITICAL" && risk.status !== "CLOSED" && risk.status !== "AVOIDED");
    gate.blockers = critical.map((risk) => risk.title);
    if (input.decision === "PASSED" && critical.length) throw new Error("存在未关闭重大风险，决策门不能直接通过。");
    gate.decision = input.decision; gate.rationale = input.rationale;
    gate.approvedBy = input.decision === "PENDING" ? null : input.email;
    gate.approvedAt = input.decision === "PENDING" ? null : new Date().toISOString();
    audit(data, { projectId: project.id, actorEmail: input.email, action: "DECISION_GATE_UPDATED", entityType: "DECISION_GATE", entityId: gate.id });
    return gate;
  });
}

export async function createGeneralTask(input: { projectId: string; email: string; role: UserRole; title: string; assigneeEmail: string; dueDate: string; priority: NonNullable<RemediationTask["priority"]> }): Promise<RemediationTask | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    const now = new Date().toISOString();
    const task: RemediationTask = { id: randomUUID(), projectId: project.id, riskId: null, title: input.title, assigneeEmail: input.assigneeEmail,
      dueDate: input.dueDate, status: "TODO", completionNote: "", priority: input.priority, collaboratorEmails: [], dependencyTaskIds: [], evidenceDocumentIds: [], comments: [], createdAt: now, updatedAt: now };
    data.tasks.unshift(task);
    data.notifications?.unshift({ id: randomUUID(), projectId: project.id, recipientEmail: task.assigneeEmail, type: "TASK", title: "新的项目任务", content: task.title, href: `/projects/${project.id}/operations`, readAt: null, createdAt: now });
    audit(data, { projectId: project.id, actorEmail: input.email, action: "GENERAL_TASK_CREATED", entityType: "TASK", entityId: task.id });
    return task;
  });
}

export async function listExpertAssignments(projectId: string, email: string, role: UserRole): Promise<ExpertAssignment[] | null> {
  const data = await readData(); const project = data.projects.find((item) => item.id === projectId);
  if (!project || !canAccess(project, email, role)) return null;
  return data.expertAssignments!.filter((item) => item.projectId === projectId);
}

export async function createExpertAssignment(input: Omit<ExpertAssignment, "id" | "createdAt" | "updatedAt" | "status" | "opinion" | "attachmentDocumentIds" | "createdBy"> & { email: string; role: UserRole }): Promise<ExpertAssignment | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    if (!project || !canAccess(project, input.email, input.role)) return null;
    const now = new Date().toISOString();
    const assignment: ExpertAssignment = { id: randomUUID(), projectId: input.projectId, sourceType: input.sourceType, sourceId: input.sourceId,
      specialty: input.specialty, title: input.title, question: input.question, urgency: input.urgency, dueDate: input.dueDate,
      expertEmail: input.expertEmail, expertName: input.expertName, qualification: input.qualification, qualificationExpiresAt: input.qualificationExpiresAt,
      status: "PENDING", opinion: "", attachmentDocumentIds: [], createdBy: input.email, createdAt: now, updatedAt: now };
    data.expertAssignments!.unshift(assignment);
    data.notifications!.unshift({ id: randomUUID(), projectId: project.id, recipientEmail: input.expertEmail, type: "REVIEW", title: "新的专家复核委托", content: input.title, href: `/projects/${project.id}/experts`, readAt: null, createdAt: now });
    audit(data, { projectId: project.id, actorEmail: input.email, action: "EXPERT_ASSIGNMENT_CREATED", entityType: "EXPERT_ASSIGNMENT", entityId: assignment.id });
    return assignment;
  });
}

export async function updateExpertAssignment(input: { projectId: string; assignmentId: string; email: string; role: UserRole; status: ExpertAssignment["status"]; opinion: string }): Promise<ExpertAssignment | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.id === input.projectId);
    const assignment = data.expertAssignments?.find((item) => item.id === input.assignmentId && item.projectId === input.projectId);
    if (!project || !assignment || !canAccess(project, input.email, input.role)) return null;
    if ((input.status === "DELIVERED" || input.status === "CONFIRMED") && input.opinion.trim().length < 3) throw new Error("交付或确认专家复核时必须填写专业意见。");
    assignment.status = input.status; assignment.opinion = input.opinion; assignment.updatedAt = new Date().toISOString();
    audit(data, { projectId: project.id, actorEmail: input.email, action: "EXPERT_ASSIGNMENT_UPDATED", entityType: "EXPERT_ASSIGNMENT", entityId: assignment.id });
    return assignment;
  });
}

export async function listNotifications(email: string, role: UserRole): Promise<Notification[]> {
  const data = await readData();
  const accessible = new Set(data.projects.filter((project) => canAccess(project, email, role)).map((project) => project.id));
  const stored = data.notifications!.filter((item) => item.recipientEmail === email || (role === "ADMIN" && item.recipientEmail === "ADMIN"));
  const now = Date.now();
  const taskAlerts: Notification[] = data.tasks.filter((task) => accessible.has(task.projectId) && task.assigneeEmail === email && task.status !== "DONE" && new Date(task.dueDate).getTime() < now + 3 * 86400000)
    .map((task) => ({ id: `task-${task.id}`, projectId: task.projectId, recipientEmail: email, type: "TASK", title: new Date(task.dueDate).getTime() < now ? "任务已逾期" : "任务即将到期", content: task.title, href: `/projects/${task.projectId}/operations`, readAt: null, createdAt: task.updatedAt }));
  const documentAlerts: Notification[] = data.documents.filter((document) => accessible.has(document.projectId) && !document.deletedAt && document.expiresAt && new Date(document.expiresAt).getTime() < now + (data.systemSettings?.reminderDays ?? 3) * 86400000)
    .map((document) => ({ id: `document-${document.id}`, projectId: document.projectId, recipientEmail: email, type: "DOCUMENT", title: new Date(document.expiresAt!).getTime() < now ? "材料已过期" : "材料即将到期", content: document.fileName, href: `/projects/${document.projectId}/documents`, readAt: null, createdAt: document.createdAt }));
  const riskAlerts: Notification[] = data.risks.filter((risk) => accessible.has(risk.projectId) && risk.level === "CRITICAL" && !["CLOSED","AVOIDED"].includes(risk.status))
    .map((risk) => ({ id: `risk-${risk.id}`, projectId: risk.projectId, recipientEmail: email, type: "RISK", title: "重大风险待处理", content: risk.title, href: `/projects/${risk.projectId}/risks`, readAt: null, createdAt: risk.updatedAt }));
  const readById = new Map((data.notificationReads ?? []).filter((item) => item.email === email).map((item) => [item.id, item.readAt]));
  return [...riskAlerts, ...documentAlerts, ...taskAlerts, ...stored]
    .map((item) => item.readAt ? item : { ...item, readAt: readById.get(item.id) ?? null })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(input: { id: string; email: string }): Promise<boolean> {
  return mutate((data) => {
    const readAt = new Date().toISOString();
    if (/^(task|document|risk)-/.test(input.id)) {
      data.notificationReads ??= [];
      const existing = data.notificationReads.find((item) => item.id === input.id && item.email === input.email);
      if (existing) existing.readAt = readAt;
      else data.notificationReads.push({ id: input.id, email: input.email, readAt });
      return true;
    }
    const item = data.notifications?.find((candidate) => candidate.id === input.id && candidate.recipientEmail === input.email);
    if (!item) return false;
    item.readAt = readAt;
    return true;
  });
}

export async function submitExperienceFeedback(input: { email: string; score: ExperienceFeedback["score"]; category: ExperienceFeedback["category"]; comment: string }): Promise<ExperienceFeedback> {
  return mutate((data) => {
    data.experienceFeedback ??= [];
    const feedback: ExperienceFeedback = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    data.experienceFeedback.unshift(feedback);
    audit(data, { projectId: "SYSTEM", actorEmail: input.email, action: "EXPERIENCE_FEEDBACK_SUBMITTED", entityType: "EXPERIENCE_FEEDBACK", entityId: feedback.id });
    return feedback;
  });
}

export async function listExperienceFeedback(email: string, role: UserRole): Promise<ExperienceFeedback[]> {
  const data = await readData();
  requireAdminActor(data, email, role);
  return data.experienceFeedback ?? [];
}

export async function listAuditLogs(input: { email: string; role: UserRole; projectId?: string }): Promise<AuditLog[]> {
  const data = await readData();
  if (input.role === "ADMIN") return data.auditLogs.filter((item) => !input.projectId || item.projectId === input.projectId).slice(0, 500);
  const accessible = new Set(data.projects.filter((project) => canAccess(project, input.email, input.role)).map((project) => project.id));
  return data.auditLogs.filter((item) => accessible.has(item.projectId) && (!input.projectId || item.projectId === input.projectId)).slice(0, 200);
}

export async function getSystemSettings(email: string, role: UserRole): Promise<SystemSettings | null> {
  const data = await readData(); if (role !== "ADMIN") return null; requireAdminActor(data, email, role); return data.systemSettings!;
}

export async function updateSystemSettings(input: { email: string; role: UserRole; settings: Omit<SystemSettings, "updatedBy" | "updatedAt"> }): Promise<SystemSettings> {
  return mutate((data) => { requireAdminActor(data, input.email, input.role); data.systemSettings = { ...input.settings, updatedBy: input.email, updatedAt: new Date().toISOString() };
    audit(data, { projectId: "SYSTEM", actorEmail: input.email, action: "SYSTEM_SETTINGS_UPDATED", entityType: "SYSTEM_SETTINGS", entityId: "default" }); return data.systemSettings; });
}

export async function updateProjectMemberRole(input: { projectId: string; memberEmail: string; projectRole: ProjectRole; actorEmail: string; actorRole: UserRole }): Promise<boolean> {
  return mutate((data) => { const project = data.projects.find((item) => item.id === input.projectId); if (!project || !canAccess(project, input.actorEmail, input.actorRole)) return false;
    project.memberRoles ??= {}; project.memberRoles[input.memberEmail] = input.projectRole; audit(data, { projectId: project.id, actorEmail: input.actorEmail, action: "PROJECT_ROLE_UPDATED", entityType: "USER", entityId: input.memberEmail }); return true; });
}
