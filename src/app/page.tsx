import Link from "next/link";

const capabilities = [
  ["01", "37项专业尽调", "将权属、用途、消防、工程、合同、商业和运营风险放进同一套执行流程。"],
  ["02", "材料即时AI初判", "材料上传到对应清单项后自动解析，给出依据、判断、置信度和待补建议。"],
  ["03", "风险整改闭环", "从问题识别、专家复核到整改任务和决策报告，全程保留人工确认与审计记录。"],
];

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand" href="/">
          <div className="brand-mark">P</div>
          <div><strong>开馆风控台</strong><span>Pickleball Risk OS</span></div>
        </Link>
        <nav aria-label="官网导航"><a href="#capabilities">产品能力</a><a href="#workflow">尽调流程</a><a href="#safety">安全边界</a></nav>
        <div className="landing-nav-actions"><Link href="/login">登录</Link><Link className="button mini" href="/dashboard">进入工作台</Link></div>
      </header>

      <section className="landing-hero">
        <div className="landing-glow" />
        <p className="landing-pill"><span />匹克球馆开馆风险管理与 AI 咨询</p>
        <h1>开馆决策，<span>建立在清晰依据之上。</span></h1>
        <p className="landing-lead">把场地材料、37项尽调、专业风险和整改任务组织成一条可追溯流程，在签约、付款和施工前看清关键问题。</p>
        <div className="landing-cta"><Link className="button" href="/dashboard">开始项目尽调 <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/login">登录已有账号</Link></div>
        <p className="landing-caption">AI仅提供辅助初审 · 最终结论由人工及属地专家确认</p>

        <div className="landing-product-scene" aria-label="产品能力预览">
          <article className="floating-card floating-left"><span>尽调进度</span><strong>37项清单</strong><div className="mini-progress"><i /></div><small>材料、判断和责任人统一关联</small></article>
          <article className="floating-center"><div><span>项目风险态势</span><strong>签约前完成关键核验</strong></div><div className="landing-mini-stats"><span><b>7</b> 专业领域</span><span><b>AI</b> 即时初判</span><span><b>1</b> 决策报告</span></div></article>
          <article className="floating-card floating-right"><span>AI材料分析</span><strong>待核实 · 需专家复核</strong><small>明确材料依据与下一步建议</small></article>
        </div>
      </section>

      <section className="landing-capabilities" id="capabilities">
        <div className="landing-section-heading"><p className="eyebrow">CALM, STRUCTURED, TRACEABLE</p><h2>复杂开馆事项，变成清晰的执行路径</h2></div>
        <div className="landing-feature-grid">
          {capabilities.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div><p className="eyebrow">专业流程</p><h2>从新建项目到归档，一条链路完成</h2><p>建立项目和候选场地，逐项上传证据材料，结合AI初判形成正式人工结论，登记风险与整改任务，最终生成版本化报告并归档。</p></div>
        <ol><li><span>1</span>建立项目与场地档案</li><li><span>2</span>执行37项尽调并上传材料</li><li><span>3</span>AI初判、人工复核和风险整改</li><li><span>4</span>形成决策报告并归档</li></ol>
      </section>

      <section className="landing-safety" id="safety"><span className="landing-pill"><span />人机协同边界</span><h2>AI负责提效，专业人员负责结论。</h2><p>系统不会自动把AI初判写成正式通过结论。产权、规划、消防、结构、合同和许可等重大事项，必须保留专家或主管部门复核。</p><Link className="button" href="/dashboard">进入开馆风控台</Link></section>
      <footer className="landing-footer"><span>开馆风控台 · 内部试用版</span><span>匹克球馆开馆风险管理与 AI 咨询系统</span></footer>
    </main>
  );
}
