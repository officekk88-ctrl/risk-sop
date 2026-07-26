import type { KnowledgeCategory, KnowledgeEntry } from "@/lib/domain";

export const KNOWLEDGE_CATEGORIES: ReadonlyArray<{ value: KnowledgeCategory; label: string; description: string }> = [
  { value: "SITE_PROPERTY", label: "场地权属与产权", description: "权属证明、转租授权、抵押查封和出租主体" },
  { value: "PLANNING_USE", label: "规划与用途合规", description: "规划用途、土地性质、业态适配和用途变更" },
  { value: "FIRE_SAFETY", label: "消防安全", description: "消防设计、验收备案、疏散和日常消防管理" },
  { value: "CONSTRUCTION", label: "工程与建筑安全", description: "结构荷载、净高、机电、施工许可和改造工程" },
  { value: "LEASE_LEGAL", label: "租赁合同与法务", description: "租期、解约、免租、违约责任和条件先决条款" },
  { value: "LICENSE_COMPLIANCE", label: "证照与行政合规", description: "主体登记、经营许可、公共场所及属地要求" },
  { value: "SPORTS_OPERATION", label: "体育运营", description: "场馆配置、赛事培训、人员资质和运营规范" },
  { value: "SAFETY_INSURANCE", label: "安全生产与保险", description: "应急预案、人员责任、公众责任险和事故处置" },
  { value: "FINANCE_TAX", label: "投资财税与商业测算", description: "租金成本、税务、投资预算和经营敏感性" },
  { value: "ENVIRONMENT_NEIGHBOR", label: "环保与相邻关系", description: "噪声、照明、停车、投诉和周边影响" },
  { value: "OTHER", label: "其他专业事项", description: "不属于以上领域的补充知识" },
];

export const knowledgeCategoryLabel = (category: KnowledgeCategory): string =>
  KNOWLEDGE_CATEGORIES.find((item) => item.value === category)?.label ?? category;

const MODE_CATEGORIES: Record<string, KnowledgeCategory> = {
  SITE: "SITE_PROPERTY", LEGAL: "LEASE_LEGAL", POLICY: "LICENSE_COMPLIANCE", FIRE: "FIRE_SAFETY",
  ENGINEERING: "CONSTRUCTION", FINANCE: "FINANCE_TAX", OPERATIONS: "SPORTS_OPERATION",
};

const CATEGORY_KEYWORDS: Array<[KnowledgeCategory, string[]]> = [
  ["FIRE_SAFETY", ["消防", "疏散", "防火", "验收"]], ["LEASE_LEGAL", ["合同", "租赁", "违约", "解约"]],
  ["SITE_PROPERTY", ["产权", "权属", "出租", "转租", "抵押", "查封"]], ["PLANNING_USE", ["规划", "用途", "用地", "业态"]],
  ["CONSTRUCTION", ["结构", "荷载", "施工", "改造", "机电", "净高"]], ["LICENSE_COMPLIANCE", ["证照", "许可", "审批", "备案", "政策"]],
  ["FINANCE_TAX", ["财务", "投资", "租金", "税", "现金流", "回报"]], ["ENVIRONMENT_NEIGHBOR", ["噪声", "停车", "邻居", "投诉", "灯光"]],
  ["SAFETY_INSURANCE", ["保险", "应急", "事故", "急救", "安全生产"]], ["SPORTS_OPERATION", ["运营", "赛事", "培训", "教练", "客流"]],
];

export function categorizeConsultation(question: string, mode: string): KnowledgeCategory {
  if (mode !== "GENERAL" && MODE_CATEGORIES[mode]) return MODE_CATEGORIES[mode];
  return CATEGORY_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => question.includes(keyword)))?.[0] ?? "OTHER";
}

export function buildConsultationKnowledge(question: string, answer: string, mode: string) {
  const cleanQuestion = question.replace(/\s+/g, " ").trim();
  const cleanAnswer = answer.trim();
  const category = categorizeConsultation(cleanQuestion, mode);
  const matchedKeywords = CATEGORY_KEYWORDS.find(([item]) => item === category)?.[1].filter((keyword) => `${cleanQuestion}${cleanAnswer}`.includes(keyword)) ?? [];
  const plainAnswer = cleanAnswer.replace(/[#>*_`\[\]]/g, "").replace(/\s+/g, " ");
  return {
    category,
    title: `咨询问答：${cleanQuestion}`.slice(0, 100),
    summary: plainAnswer.slice(0, 240) || "本轮 AI 咨询回答",
    content: `问题：${cleanQuestion}\n\n回答：${cleanAnswer}`.slice(0, 12000),
    keywords: Array.from(new Set([...matchedKeywords, ...terms(cleanQuestion).slice(0, 8)])).slice(0, 20),
  };
}

function terms(value: string): string[] {
  return Array.from(new Set(value.toLowerCase().split(/[\s,，。；;：:、/|()（）\[\]【】]+/).map((item) => item.trim()).filter((item) => item.length >= 2)));
}

function chineseBigrams(value: string): Set<string> {
  const characters = value.match(/[\u3400-\u9fff]/g) ?? [];
  return new Set(characters.slice(0, -1).map((character, index) => character + characters[index + 1]));
}

export function selectRelevantKnowledge(entries: KnowledgeEntry[], query: string, limit = 6): KnowledgeEntry[] {
  const queryTerms = terms(query);
  const normalizedQuery = query.toLowerCase();
  const queryBigrams = chineseBigrams(query);
  return entries
    .filter((entry) => entry.status === "PUBLISHED")
    .map((entry) => {
      const title = entry.title.toLowerCase();
      const keywords = entry.keywords.join(" ").toLowerCase();
      const body = `${entry.summary} ${entry.content}`.toLowerCase();
      const keywordMatches = entry.keywords.reduce((sum, keyword) => sum + (keyword.length >= 2 && normalizedQuery.includes(keyword.toLowerCase()) ? 10 : 0), 0);
      const titleMatches = terms(entry.title).reduce((sum, term) => sum + (normalizedQuery.includes(term) ? 6 : 0), 0);
      const matchingBigrams = [...chineseBigrams(`${entry.title}${entry.summary}${entry.keywords.join("")}`)].reduce((sum, fragment) => sum + (queryBigrams.has(fragment) ? 1 : 0), 0);
      const bigramScore = matchingBigrams >= 2 ? matchingBigrams : 0;
      const score = keywordMatches + titleMatches + bigramScore + queryTerms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0) + (keywords.includes(term) ? 5 : 0) + (body.includes(term) ? 2 : 0), 0);
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.entry.updatedAt.localeCompare(left.entry.updatedAt))
    .slice(0, limit)
    .map((item) => item.entry);
}
