export const REPORT_TEMPLATE_VERSION = "综合审核报告 V0.1";

export const reportSections = [
  { key: "scope", title: "一、审核范围", description: "说明本次审核覆盖的场地、资料、专业领域和截止时间。" },
  { key: "project", title: "二、项目与场地概况", description: "汇总项目主体、地址、面积、用途、租赁条件及拟经营方案。" },
  { key: "documents", title: "三、已取得及缺失材料", description: "分别列示已核验、待核原件、缺失和失效材料。" },
  { key: "checklist", title: "四、尽调检查结果", description: "按产权、用途、消防、工程、合同、商业和运营领域汇总。" },
  { key: "risks", title: "五、主要风险", description: "列示等级、事实、依据、影响、整改措施及人工复核要求。" },
  { key: "tasks", title: "六、整改与待办", description: "列示责任人、期限、证明材料、状态和复核结论。" },
  { key: "decision", title: "七、综合决策建议", description: "由有权限人员选择推进、附条件推进、暂缓或不建议推进。" },
  { key: "conditions", title: "八、推进前置条件", description: "列示支付定金、签约或开工前必须完成的条件。" },
  { key: "limitations", title: "九、适用边界与声明", description: "说明资料真实性、政策时效、AI 辅助性质及专业复核边界。" },
] as const;

export const reportDisclaimer =
  "本报告基于项目截至生成时间已提交并经确认的资料形成。AI 内容仅作为辅助初审，不替代律师、消防、结构、工程等持证人员或主管部门的正式意见。";
