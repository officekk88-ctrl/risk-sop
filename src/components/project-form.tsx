import type { Project } from "@/lib/domain";

export function ProjectForm({ action, project }: { action: (formData: FormData) => void | Promise<void>; project?: Project }) {
  const venue = project?.venue;
  return (
    <form action={action} className="card form-grid">
      <div className="form-section-title"><h2>项目基本信息</h2><p className="muted">用于生成尽调清单和项目报告。</p></div>
      <label className="field">项目名称<input name="name" defaultValue={project?.name} required /></label>
      <label className="field">城市<input name="city" defaultValue={project?.city ?? "上海市"} required /></label>
      <label className="field">行政区<input name="district" defaultValue={venue?.district} /></label>
      <label className="field field-wide">详细地址<input name="address" defaultValue={venue?.address} required /></label>
      {project ? (
        <label className="field">项目状态
          <select name="status" defaultValue={project.status}>
            <option value="DRAFT">草稿</option><option value="DUE_DILIGENCE">尽调中</option>
            <option value="NEGOTIATING">谈判中</option><option value="SIGNED">已签约</option><option value="CONSTRUCTION">设计施工中</option><option value="OPENING_PREP">开业准备中</option><option value="OPEN">已开业</option><option value="PAUSED">暂停</option><option value="ABANDONED">放弃</option><option value="DECISION_PENDING">待决策</option><option value="ARCHIVED">已归档</option>
          </select>
        </label>
      ) : null}
      <div className="form-section-title"><h2>场地条件</h2><p className="muted">不确定的信息可以暂留空，后续在清单中标记待核实。</p></div>
      <label className="field">面积（㎡）<input name="areaSqm" type="number" min="0" step="0.01" defaultValue={venue?.areaSqm ?? ""} /></label>
      <label className="field">净高（m）<input name="clearHeightM" type="number" min="0" step="0.01" defaultValue={venue?.clearHeightM ?? ""} /></label>
      <label className="field">计划球场数<input name="plannedCourts" type="number" min="0" step="1" defaultValue={venue?.plannedCourts ?? ""} /></label>
      <label className="field">月租金（元）<input name="monthlyRent" type="number" min="0" step="0.01" defaultValue={venue?.monthlyRent ?? ""} /></label>
      <label className="field">租期（月）<input name="leaseMonths" type="number" min="0" step="1" defaultValue={venue?.leaseMonths ?? ""} /></label>
      <label className="field">证载用途<input name="certificateUsage" defaultValue={venue?.certificateUsage} /></label>
      <label className="field field-wide">拟经营用途<input name="intendedUsage" defaultValue={venue?.intendedUsage ?? "匹克球馆"} required /></label>
      <div className="form-actions"><button className="button" type="submit">{project ? "保存修改" : "创建项目并生成清单"}</button></div>
    </form>
  );
}
