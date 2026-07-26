import type { ChecklistTemplateItem } from "@/lib/domain";

export const CHECKLIST_TEMPLATE_VERSION = "上海试点初筛清单 V0.1（待领域专家核验）";

export const CHECKLIST_DISCLAIMER =
  "本清单用于 MVP 流程验证和场地初筛，不构成完整法定要求。签约、消防、结构及许可事项须由属地主管部门或持证专业人员确认。";

export const checklistTemplate: ChecklistTemplateItem[] = [
  { code: "OWN-01", category: "产权与出租权", title: "取得清晰、完整且在有效状态的不动产权属材料", required: true, evidence: "不动产权证或权属查询材料" },
  { code: "OWN-02", category: "产权与出租权", title: "核对产权人、出租人和合同签约主体是否一致", required: true, evidence: "主体证照、授权文件、租赁合同" },
  { code: "OWN-03", category: "产权与出租权", title: "出租人非产权人时取得完整授权或转租依据", required: true, evidence: "授权委托书、上游合同、转租同意" },
  { code: "OWN-04", category: "产权与出租权", title: "核查共有、抵押、查封或其他权利限制", required: true, evidence: "权属查询及权利人说明" },
  { code: "OWN-05", category: "产权与出租权", title: "核对场地地址、面积、楼层和四至范围", required: true, evidence: "权属材料、测绘图、现场记录" },
  { code: "USE-01", category: "规划用途", title: "确认权属材料记载的房屋和土地用途", required: true, evidence: "权属材料、规划文件" },
  { code: "USE-02", category: "规划用途", title: "核实拟经营体育场馆与证载用途的适用性", required: true, evidence: "属地咨询记录或书面意见" },
  { code: "USE-03", category: "规划用途", title: "核查是否存在违建、擅自加层或改变结构", required: true, evidence: "竣工图、现场踏勘、业主说明" },
  { code: "USE-04", category: "规划用途", title: "确认装修、改造和招牌设置所需报批事项", required: true, evidence: "办事指南、物业要求、咨询记录" },
  { code: "USE-05", category: "规划用途", title: "核查场地是否处于拆迁、更新或用途调整范围", required: false, evidence: "出租人承诺、公开规划信息" },
  { code: "FIR-01", category: "消防安全", title: "取得原建筑消防设计、验收或备案资料", required: true, evidence: "消防验收、备案或历史批文" },
  { code: "FIR-02", category: "消防安全", title: "核对建筑面积、楼层和现状与消防资料是否一致", required: true, evidence: "消防资料、平面图、现场照片" },
  { code: "FIR-03", category: "消防安全", title: "初核安全出口数量、疏散距离和通道条件", required: true, evidence: "现场踏勘、消防顾问意见" },
  { code: "FIR-04", category: "消防安全", title: "确认喷淋、报警、排烟、应急照明等设施现状", required: true, evidence: "设施清单、检测记录、现场照片" },
  { code: "FIR-05", category: "消防安全", title: "取得拟改造方案的消防可行性预审意见", required: true, evidence: "消防顾问或设计单位意见" },
  { code: "FIR-06", category: "消防安全", title: "明确消防设计、施工、检测和验收责任及费用", required: true, evidence: "租赁合同、工程界面表" },
  { code: "ENG-01", category: "建筑与工程", title: "确认净高、柱网和可布置球场数量", required: true, evidence: "测量记录、平面方案" },
  { code: "ENG-02", category: "建筑与工程", title: "评估地面平整度、承载和运动地材施工条件", required: true, evidence: "现场检测、工程顾问意见" },
  { code: "ENG-03", category: "建筑与工程", title: "核查屋面、防水及历史渗漏情况", required: true, evidence: "现场记录、维修记录、出租人说明" },
  { code: "ENG-04", category: "建筑与工程", title: "核查供电容量、照明、暖通和给排水条件", required: true, evidence: "设备参数、物业资料、工程测算" },
  { code: "ENG-05", category: "建筑与工程", title: "评估噪声、振动、灯光及邻里投诉风险", required: true, evidence: "周边踏勘、声学建议" },
  { code: "ENG-06", category: "建筑与工程", title: "明确物业施工限制、进场条件和施工时间", required: false, evidence: "物业装修手册或书面确认" },
  { code: "CTR-01", category: "租赁合同", title: "租赁标的、用途、面积和交付标准描述明确", required: true, evidence: "租赁合同及附件" },
  { code: "CTR-02", category: "租赁合同", title: "租期不超过出租人可合法支配的期限", required: true, evidence: "租赁合同、上游合同" },
  { code: "CTR-03", category: "租赁合同", title: "明确免租期、租金、押金、递增和其他费用", required: true, evidence: "商务条件表、租赁合同" },
  { code: "CTR-04", category: "租赁合同", title: "明确出租人配合审批、办证和提供材料的义务", required: true, evidence: "租赁合同" },
  { code: "CTR-05", category: "租赁合同", title: "设置无法审批、验收或经营时的解除和退款机制", required: true, evidence: "租赁合同、补充协议" },
  { code: "CTR-06", category: "租赁合同", title: "明确装修归属、恢复原状和装修残值处理", required: true, evidence: "租赁合同" },
  { code: "CTR-07", category: "租赁合同", title: "明确提前解约、房屋出售及重大违约责任", required: true, evidence: "租赁合同" },
  { code: "BUS-01", category: "商业测算", title: "完成租金、物业、能耗、人员和营销成本测算", required: true, evidence: "投资测算表" },
  { code: "BUS-02", category: "商业测算", title: "完成球场利用率、客单价和收入情景测算", required: true, evidence: "收入模型" },
  { code: "BUS-03", category: "商业测算", title: "预留消防、隔音、暖通和不可预见改造预算", required: true, evidence: "工程估算、风险准备金" },
  { code: "BUS-04", category: "商业测算", title: "评估停车、交通、周边客群和竞品情况", required: false, evidence: "选址调研记录" },
  { code: "OPS-01", category: "运营与许可", title: "梳理营业执照、经营范围及属地许可咨询事项", required: true, evidence: "办事指南、咨询记录" },
  { code: "OPS-02", category: "运营与许可", title: "制定安全制度、应急预案和现场责任分工", required: true, evidence: "制度和预案草案" },
  { code: "OPS-03", category: "运营与许可", title: "评估公众责任、财产和雇主责任保险方案", required: false, evidence: "保险方案或报价" },
  { code: "OPS-04", category: "运营与许可", title: "检查会员协议、退款规则和消费者告知内容", required: false, evidence: "会员协议和公示规则" },
];
