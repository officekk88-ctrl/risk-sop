export type UserRole = "ADMIN" | "MEMBER";
export type ProjectRole = "DECISION_MAKER" | "PROJECT_MANAGER" | "MEMBER" | "REVIEWER" | "EXPERT";
export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type ProjectStatus = "DRAFT" | "DUE_DILIGENCE" | "NEGOTIATING" | "SIGNED" | "CONSTRUCTION" | "OPENING_PREP" | "OPEN" | "PAUSED" | "ABANDONED" | "DECISION_PENDING" | "ARCHIVED";
export type ChecklistStatus = "TODO" | "PASSED" | "FAILED" | "VERIFY" | "NOT_APPLICABLE";
export type DocumentCategory = "OWNERSHIP" | "AUTHORIZATION" | "CONTRACT" | "FIRE" | "PLANNING" | "ENGINEERING" | "SITE_PHOTO" | "OTHER";
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
export type RiskStatus = "OPEN" | "ANALYZING" | "EVIDENCE_PENDING" | "MITIGATING" | "REVIEW_PENDING" | "ACCEPTED" | "AVOIDED" | "CLOSED" | "UNRESOLVED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type ReportDecision = "PROCEED" | "CONDITIONAL" | "PAUSE" | "REJECT";
export type KnowledgeCategory =
  | "SITE_PROPERTY"
  | "PLANNING_USE"
  | "FIRE_SAFETY"
  | "CONSTRUCTION"
  | "LEASE_LEGAL"
  | "LICENSE_COMPLIANCE"
  | "SPORTS_OPERATION"
  | "SAFETY_INSURANCE"
  | "FINANCE_TAX"
  | "ENVIRONMENT_NEIGHBOR"
  | "OTHER";
export type KnowledgeStatus = "PENDING" | "PUBLISHED" | "ARCHIVED";

export type Venue = {
  id?: string;
  name?: string;
  isPrimary?: boolean;
  address: string;
  district: string;
  areaSqm: number | null;
  clearHeightM: number | null;
  certificateUsage: string;
  intendedUsage: string;
  monthlyRent: number | null;
  leaseMonths: number | null;
  plannedCourts: number | null;
  trafficScore?: number;
  customerScore?: number;
  visibilityScore?: number;
  parkingScore?: number;
  costScore?: number;
  efficiencyScore?: number;
  complianceRisk?: number;
  engineeringRisk?: number;
  neighborRisk?: number;
  expectedRevenue?: number | null;
  plannedInvestment?: number | null;
  eliminatedReason?: string;
  notes?: string;
};

export type ProjectProfile = {
  buildingType: string;
  floor: string;
  buildingHeightM: number | null;
  plannedOpeningDate: string;
  budget: number | null;
  operationMode: "SELF" | "JOINT" | "FRANCHISE" | "ENTRUSTED";
  propertyOwner: string;
  lessor: string;
  leasingRelation: "DIRECT" | "AGENCY" | "SUBLEASE" | "COOPERATION" | "ASSET_MANAGEMENT" | "UNKNOWN";
  certificateNumber: string;
  landNature: string;
  propertyNature: string;
  remainingYears: number | null;
  encumbrances: string[];
  originalUse: string;
  currentCondition: string;
  fireFacilities: string;
  exits: number | null;
  powerCapacity: string;
  hvac: string;
  waterDrainage: string;
  network: string;
  parking: string;
  sensitiveNeighbors: string;
  nightOperation: boolean;
  noiseRisk: string;
};

export type StageDecision = "PENDING" | "PASSED" | "CONDITIONAL" | "PAUSED" | "REJECTED" | "EXPERT_REVIEW";
export type ProjectStage = {
  id: string;
  code: string;
  name: string;
  order: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  decision: StageDecision;
  requiredMaterials: string[];
  conditions: string;
  approverRole: ProjectRole;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string;
};

export type DecisionGate = {
  id: string;
  code: string;
  name: string;
  stageCode: string;
  decision: StageDecision;
  requiredMaterials: string[];
  blockers: string[];
  rationale: string;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type ChecklistTemplateItem = {
  code: string;
  category: string;
  title: string;
  required: boolean;
  evidence: string;
};

export type ProjectChecklistItem = ChecklistTemplateItem & {
  status: ChecklistStatus;
  note: string;
  updatedAt: string;
  aiAssessment?: ChecklistAIAssessment | null;
};

export type ChecklistAIAssessment = {
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  judgment: "PASSED" | "FAILED" | "VERIFY";
  analysis: string;
  evidence: string;
  recommendation: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  requiresExpertReview: boolean;
  documentId: string;
  promptVersion: string;
  model: string;
  error: string;
  source: "AI" | "MANUAL_EDIT";
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDocument = {
  id: string;
  projectId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: string;
  deletedAt: string | null;
  parseStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  extractedText: string;
  pageCount: number | null;
  parseError: string;
  parsedAt: string | null;
  checklistCodes: string[];
  version?: number;
  versionGroupId?: string;
  source?: string;
  provider?: string;
  evidenceForm?: "ORIGINAL_VERIFIED" | "COPY" | "SCAN" | "ORIGINAL_PENDING";
  expiresAt?: string;
  tags?: string[];
  sensitive?: boolean;
};

export type AIMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
export type AIConversation = { id: string; projectId: string; userEmail: string; title: string; messages: AIMessage[]; createdAt: string; updatedAt: string };

export type KnowledgeEntry = {
  id: string;
  code: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
  sourceName: string;
  sourceUrl: string;
  sourceDocumentId: string | null;
  origin: "MANUAL" | "DOCUMENT_IMPORT" | "AI_CONSULTATION" | "SYSTEM_SEED";
  projectId: string | null;
  conversationId: string | null;
  question: string;
  status: KnowledgeStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSourceDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: "PROCESSING" | "IMPORTED" | "FAILED";
  parseMethod: string;
  extractedText: string;
  aiSummary: string;
  aiModel: string;
  promptVersion: string;
  error: string;
  entryIds: string[];
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AIReviewFinding = AIReviewCandidate & {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  decisionNote: string;
  decidedBy: string | null;
  decidedAt: string | null;
  confirmedRiskId: string | null;
};

export type AIReview = {
  id: string;
  projectId: string;
  documentId: string;
  requestedBy: string;
  status: "PROCESSING" | "REVIEW_REQUIRED" | "CONFIRMED" | "REJECTED" | "FAILED";
  model: string;
  promptVersion: string;
  output: (Omit<AIReviewOutput, "findings"> & { findings: AIReviewFinding[] }) | null;
  error: string;
  resolutionNote: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Risk = {
  id: string;
  projectId: string;
  source: "MANUAL" | "CHECKLIST" | "AI_REVIEW";
  checklistCode: string | null;
  documentId: string | null;
  title: string;
  description: string;
  level: RiskLevel;
  status: RiskStatus;
  evidence: string;
  recommendation: string;
  closeReason: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  stageCode?: string;
  specialty?: string;
  probability?: number;
  impact?: number;
  potentialLoss?: string;
  ownerEmail?: string;
  collaboratorEmails?: string[];
  dueDate?: string;
  requiredEvidence?: string;
  reviewerEmail?: string;
  reviewNote?: string;
};

export type RemediationTask = {
  id: string;
  projectId: string;
  riskId: string | null;
  title: string;
  assigneeEmail: string;
  dueDate: string;
  status: TaskStatus;
  completionNote: string;
  createdAt: string;
  updatedAt: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  collaboratorEmails?: string[];
  dependencyTaskIds?: string[];
  evidenceDocumentIds?: string[];
  reviewNote?: string;
  comments?: Array<{ id: string; authorEmail: string; content: string; createdAt: string }>;
};

export type ExpertAssignment = {
  id: string;
  projectId: string;
  sourceType: "RISK" | "DOCUMENT" | "CHECKLIST" | "AI_CONVERSATION" | "GENERAL";
  sourceId: string | null;
  specialty: "LEGAL" | "POLICY" | "FIRE" | "STRUCTURE" | "ENGINEERING" | "FINANCE" | "OPERATIONS";
  title: string;
  question: string;
  urgency: "NORMAL" | "URGENT";
  dueDate: string;
  expertEmail: string;
  expertName: string;
  qualification: string;
  qualificationExpiresAt: string;
  status: "PENDING" | "ACCEPTED" | "MORE_INFO" | "DELIVERED" | "CONFIRMED" | "RETURNED";
  opinion: string;
  attachmentDocumentIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  projectId: string | null;
  recipientEmail: string;
  type: "TASK" | "RISK" | "DOCUMENT" | "REVIEW" | "DECISION" | "SYSTEM";
  title: string;
  content: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type ExperienceFeedback = {
  id: string;
  email: string;
  score: 1 | 2 | 3 | 4 | 5;
  category: "FLOW" | "CLARITY" | "MOBILE" | "AI" | "OTHER";
  comment: string;
  createdAt: string;
};

export type Organization = { id: string; name: string; departments: string[]; createdAt: string; updatedAt: string };
export type SystemSettings = {
  organizationName: string;
  reminderDays: number;
  riskThreshold: RiskLevel;
  aiPromptVersion: string;
  reportTemplateVersion: string;
  allowedFileTypes: string[];
  decisionGateEnabled: boolean;
  updatedBy: string;
  updatedAt: string;
};

export type ReportSnapshot = {
  templateVersion: string;
  generatedAt: string;
  project: Pick<Project, "id" | "name" | "city" | "status" | "ownerEmail"> & { venue: Venue };
  documents: Array<Pick<ProjectDocument, "id" | "category" | "fileName" | "parseStatus" | "pageCount" | "createdAt">>;
  checklist: ProjectChecklistItem[];
  checklistSummary: Record<ChecklistStatus, number>;
  risks: Risk[];
  tasks: RemediationTask[];
  venues?: Venue[];
  profile?: ProjectProfile;
  stages?: ProjectStage[];
  decisionGates?: DecisionGate[];
  expertAssignments?: ExpertAssignment[];
  decision: { outcome: ReportDecision; rationale: string; decidedBy: string; decidedAt: string };
  conditions: string[];
  disclaimer: string;
};

export type ProjectReport = {
  id: string;
  projectId: string;
  version: number;
  status: "FINAL" | "VOID";
  snapshot: ReportSnapshot;
  createdBy: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  projectId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  city: string;
  status: ProjectStatus;
  ownerEmail: string;
  memberEmails: string[];
  venue: Venue;
  venues?: Venue[];
  profile?: ProjectProfile;
  stages?: ProjectStage[];
  decisionGates?: DecisionGate[];
  memberRoles?: Record<string, ProjectRole>;
  checklist: ProjectChecklistItem[];
  createdAt: string;
  updatedAt: string;
};

export function resolveProjectRole(project: Project, email: string, globalRole: UserRole): ProjectRole {
  if (globalRole === "ADMIN" || project.ownerEmail.toLowerCase() === email.toLowerCase()) return "PROJECT_MANAGER";
  return project.memberRoles?.[email.toLowerCase()] ?? project.memberRoles?.[email] ?? "MEMBER";
}

export type MvpData = {
  version: 1;
  users: AppUser[];
  projects: Project[];
  documents: ProjectDocument[];
  risks: Risk[];
  tasks: RemediationTask[];
  auditLogs: AuditLog[];
  aiConversations: AIConversation[];
  aiReviews: AIReview[];
  reports: ProjectReport[];
  knowledgeEntries: KnowledgeEntry[];
  knowledgeSourceDocuments: KnowledgeSourceDocument[];
  organizations?: Organization[];
  expertAssignments?: ExpertAssignment[];
  notifications?: Notification[];
  notificationReads?: Array<{ id: string; email: string; readAt: string }>;
  experienceFeedback?: ExperienceFeedback[];
  systemSettings?: SystemSettings;
};
import type { AIReviewCandidate, AIReviewOutput } from "@/lib/ai-review-schema";
