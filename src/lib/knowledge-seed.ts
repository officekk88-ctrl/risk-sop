import type { KnowledgeCategory, KnowledgeEntry } from "@/lib/domain";

type SeedItem = {
  category: KnowledgeCategory;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
};

const SOURCES: Record<KnowledgeCategory, { name: string; url: string }> = {
  SITE_PROPERTY: { name: "《中华人民共和国民法典》租赁合同章（国家信访局政府网站转载）", url: "https://www.gjxfj.gov.cn/2020-05/28/c_139952976.htm" },
  PLANNING_USE: { name: "《中华人民共和国城乡规划法》（中国人大网）", url: "https://www.npc.gov.cn/c2/c183/c198/201905/t20190524_27676.html" },
  FIRE_SAFETY: { name: "《建设工程消防设计审查验收管理暂行规定》（司法部）", url: "https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202401/t20240109_493139.html" },
  CONSTRUCTION: { name: "《中华人民共和国城乡规划法》（中国人大网）", url: "https://www.npc.gov.cn/c2/c183/c198/201905/t20190524_27676.html" },
  LEASE_LEGAL: { name: "《中华人民共和国民法典》租赁合同章（国家信访局政府网站转载）", url: "https://www.gjxfj.gov.cn/2020-05/28/c_139952976.htm" },
  LICENSE_COMPLIANCE: { name: "《中华人民共和国市场主体登记管理条例》（市场监管总局）", url: "https://www.samr.gov.cn/djzcj/zyfb/zjfb/art/2023/art_2a71fe3f890947e4860918946cb60386.html" },
  SPORTS_OPERATION: { name: "《体育场馆公共安全通用要求》（国家体育总局）", url: "https://www.sport.gov.cn/zbzx/n5639/c28850196/part/28850227.pdf" },
  SAFETY_INSURANCE: { name: "《中华人民共和国安全生产法》（市场监管总局法规库）", url: "https://sjfg.samr.gov.cn/law/js/legacy-pdfjs/web/viewer.html?file=https%3A%2F%2Fsjfg.samr.gov.cn%2Flaw%2Ffile%2F%2Fpdf%2F3235243%2F1663325003916.pdf&keyword=null" },
  FINANCE_TAX: { name: "《体育行业相关产业税费优惠政策汇编》（广州税务局）", url: "https://guangdong.chinatax.gov.cn/gdsw/gzsw_sfzchb/2025-02/08/content_7839b795da2944978d6ab010897767a8.shtml" },
  ENVIRONMENT_NEIGHBOR: { name: "《噪声污染防治法》社会生活噪声解读（中国人大网）", url: "https://www.npc.gov.cn/c2/c30834/202201/t20220104_315716.html" },
  OTHER: { name: "《中华人民共和国安全生产法》（市场监管总局法规库）", url: "https://sjfg.samr.gov.cn/law/js/legacy-pdfjs/web/viewer.html?file=https%3A%2F%2Fsjfg.samr.gov.cn%2Flaw%2Ffile%2F%2Fpdf%2F3235243%2F1663325003916.pdf&keyword=null" },
};

const EVIDENCE: Record<KnowledgeCategory, string> = {
  SITE_PROPERTY: "不动产权证、登记簿查询结果、出租主体资格文件、历次租赁合同、产权人转租同意、抵押权人或共有人意见。",
  PLANNING_USE: "产权证载用途、建设工程规划许可证、规划条件、竣工图、属地主管部门可留痕咨询或书面意见。",
  FIRE_SAFETY: "原消防审验或备案文书、消防设计文件、竣工图、现场检测记录、改造方案、属地住建部门办理口径。",
  CONSTRUCTION: "竣工图与结构图、荷载复核报告、机电容量资料、设计单位意见、施工图审查及施工许可材料。",
  LEASE_LEGAL: "权属及授权文件、合同全本与附件、交付清单、审批条件、付款节点、退出和退款机制、维修责任划分。",
  LICENSE_COMPLIANCE: "主体登记信息、实际经营项目清单、住所使用材料、许可事项清单、属地窗口答复及办理回执。",
  SPORTS_OPERATION: "开放规则、岗位职责、巡检表、器材台账、人员资质、客流方案、急救配置、事件和培训记录。",
  SAFETY_INSURANCE: "风险清单、全员责任制、应急预案与演练记录、保单条款、批单、除外责任、免赔额和责任限额。",
  FINANCE_TAX: "投资预算、报价与合同、租金阶梯、收入假设、利用率数据、税费口径、月度现金流和压力测试。",
  ENVIRONMENT_NEIGHBOR: "敏感点调查、分时段噪声测试、隔声减振方案、停车与人流方案、物业规则、投诉历史和沟通记录。",
  OTHER: "各决策节点的必备材料清单、责任人、截止时间、专业复核意见、未关闭风险及批准记录。",
};

const BOUNDARY = "本条为基于公开权威资料整理的尽调工作知识，不直接等同于行政许可结论或专业法律、设计意见；项目应结合所在地最新规定、建筑实际和主管部门口径复核。";
const RESEARCH_UPDATED_AT = "2026-07-23T00:00:00.000+08:00";

const ITEMS: SeedItem[] = [
  { category: "SITE_PROPERTY", title: "场地权属与出租权核验", summary: "签约前应形成产权人、出租人和完整转租授权链的证据闭环。", content: "问：如何确认场地出租主体有权出租？\n\n答：核对不动产权证或其他权属证明中的权利人、坐落、面积和用途；出租人非权利人时，逐级核验租赁关系、转租条款和产权人书面同意；同步查询抵押、查封、共有等限制。名称或范围不一致时暂停付款和签约，并由律师及登记机构复核。", keywords: ["产权", "出租权", "转租", "抵押", "查封"] },
  { category: "PLANNING_USE", title: "规划用途与拟经营业态适配核验", summary: "证载用途、规划条件、现状用途与匹克球馆经营需求应逐项比对。", content: "问：证载用途不明确时能否直接改造成球馆？\n\n答：不能仅凭出租方承诺判断。应收集产权证明、规划许可及竣工资料，向属地自然资源规划、住建或街镇窗口核实体育健身用途的适配性以及是否涉及用途变更。取得可留痕的书面或窗口核验记录前，将其作为签约和开工门禁。", keywords: ["规划用途", "用途变更", "业态", "属地核验"] },
  { category: "FIRE_SAFETY", title: "消防合规资料与现场条件核验", summary: "消防判断须同时核查历史手续、改造影响、疏散条件和投入使用前要求。", content: "问：球馆消防尽调至少要核验什么？\n\n答：核验原建筑消防设计审查、验收或备案资料及其覆盖范围；检查防火分区、安全出口、疏散距离、应急照明、喷淋报警和消防车道现状；评估装修、夹层、功能调整和人员容量是否触发新增程序。结论应由有资质的消防或设计专业人员结合现场和属地要求复核。", keywords: ["消防", "验收", "疏散", "防火分区", "改造"] },
  { category: "CONSTRUCTION", title: "结构荷载与改造工程前置评估", summary: "大型设备、看台、夹层和吊挂设施施工前应取得结构与机电专业意见。", content: "问：球馆改造开工前需要哪些工程核验？\n\n答：取得竣工图、结构图和机电资料，核验楼板荷载、屋面或梁体吊挂点、净高、供配电、空调通风及给排水能力。涉及结构、外立面、夹层或主要消防设施变化时，应先确认设计、审图和施工许可要求，未经书面确认不得以经验施工。", keywords: ["结构荷载", "净高", "机电", "施工许可", "改造"] },
  { category: "LEASE_LEGAL", title: "租赁合同中的尽调保护条款", summary: "将用途、消防和审批结果设置为生效、付款、解约或退款条件。", content: "问：如何用合同控制场地合规不确定性？\n\n答：明确出租权和场地资料真实性保证；把用途适配、消防可实施性、必要审批和交付条件写成条件先决条款；约定核验不通过时无责退出、已付款返还和损失承担；清晰划分报建、改造、维修、停业及提前解约责任。最终文本由律师结合交易结构审查。", keywords: ["租赁合同", "条件先决", "解约", "退款", "违约责任"] },
  { category: "LICENSE_COMPLIANCE", title: "开业证照与属地事项清单化核验", summary: "证照要求取决于经营内容、配套服务、场地属性和属地口径。", content: "问：匹克球馆开业前如何梳理证照？\n\n答：先拆分实际经营内容，如场地服务、培训、赛事、零售、餐饮和广告，再逐项核验市场主体登记、消防、公共场所、食品经营、招牌及其他属地要求。记录咨询部门、时间、经办窗口、答复和依据；口头意见应尽量转化为可留痕材料，并设置到期复核。", keywords: ["证照", "行政许可", "经营范围", "属地政策"] },
  { category: "SPORTS_OPERATION", title: "匹克球馆运营安全基础控制", summary: "通过场地规则、人员能力、巡检和事件记录降低日常运营风险。", content: "问：球馆日常运营需要建立哪些基础制度？\n\n答：建立开闭馆巡检、场地与器材检查、客流和未成年人管理、教练及赛事人员管理、异常天气处置、急救和事故报告制度；明确岗位责任与留痕表单；根据场地布局设置缓冲区、警示和动线。培训、赛事等专项活动还应另行评估人员资质和组织责任。", keywords: ["场馆运营", "巡检", "教练", "赛事", "安全制度"] },
  { category: "SAFETY_INSURANCE", title: "应急预案与保险配置联动", summary: "风险清单、应急能力和保险责任范围应相互校验。", content: "问：球馆应急和保险怎样配套？\n\n答：基于火灾、运动伤害、拥挤踩踏、设备故障、极端天气等情景编制预案，明确报警、疏散、急救、停业和报告责任并定期演练；同时核验公众责任、雇主责任、财产及营业中断等保障的责任范围、除外责任、免赔额和限额，避免仅凭保单名称判断已覆盖。", keywords: ["应急预案", "公众责任险", "雇主责任", "事故处置"] },
  { category: "FINANCE_TAX", title: "球馆投资测算的现金流压力测试", summary: "投资决策应覆盖爬坡期、淡旺季、超支和退出情景。", content: "问：球馆商业测算不能漏掉哪些变量？\n\n答：除租金和装修外，纳入物业能耗、人工、营销、维护、保险、税费、平台抽成和更新改造；分别设置客单价、利用率、营业时段、课程及赛事收入假设；对开业延期、利用率不足、租金递增和工程超支做敏感性及现金流压力测试，并与合同付款节点联动。", keywords: ["投资测算", "现金流", "利用率", "租金", "敏感性分析"] },
  { category: "ENVIRONMENT_NEIGHBOR", title: "噪声停车与相邻关系风险预控", summary: "运动撞击声、夜间营业、灯光与停车是投诉和运营限制的高频来源。", content: "问：选址阶段如何评估相邻关系风险？\n\n答：调查住宅、学校、医院等敏感点及历史投诉，分别在拟营业时段测试背景噪声和撞击声传播；核验隔声、减振、灯光外溢、停车和人流组织条件；向物业、业委会及属地部门确认管理限制。将整改成本、营业时间限制和投诉处置责任计入决策。", keywords: ["噪声", "夜间营业", "停车", "相邻关系", "投诉"] },
  { category: "OTHER", title: "跨专业结论的决策门禁规则", summary: "重大付款、签约、开工和开业节点应以证据充分性为条件。", content: "问：怎样避免项目在信息不足时过早推进？\n\n答：为意向金、签约、首期租金、设计、开工、验收和开业分别设置门禁，列明必备材料、责任人、截止时间和未关闭风险。专业意见冲突时记录差异并升级复核；不得用口头承诺替代关键证据，也不得把 AI 初审作为合规批准或专业签字。", keywords: ["决策门禁", "证据", "签约", "开工", "开业"] },
];

export function createSeedKnowledgeEntries(createdAt: string): KnowledgeEntry[] {
  return ITEMS.map((item, index) => ({
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    code: `KB-BASE-${String(index + 1).padStart(2, "0")}`,
    ...item,
    content: `${item.content}\n\n建议留存的核验证据：\n${EVIDENCE[item.category]}\n\n适用边界：\n${BOUNDARY}`,
    sourceName: SOURCES[item.category].name,
    sourceUrl: SOURCES[item.category].url,
    sourceDocumentId: null,
    origin: "SYSTEM_SEED",
    projectId: null,
    conversationId: null,
    question: "",
    status: "PUBLISHED",
    version: 2,
    createdBy: "SYSTEM",
    updatedBy: "SYSTEM",
    reviewedBy: "SYSTEM",
    reviewedAt: RESEARCH_UPDATED_AT,
    createdAt,
    updatedAt: RESEARCH_UPDATED_AT,
  }));
}
