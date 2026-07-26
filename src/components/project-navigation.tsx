"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProjectRole } from "@/lib/domain";

const tabs = [
  { key: "overview", label: "总览", suffix: "" },
  { key: "checklist", label: "尽调", suffix: "/checklist" },
  { key: "risks", label: "风险", suffix: "/risks" },
  { key: "decisions", label: "决策", suffix: "/operations" },
  { key: "reports", label: "报告", suffix: "/reports" },
];

export function ProjectNavigation({ projectId, role = "PROJECT_MANAGER" }: { projectId: string; role?: ProjectRole }) {
  const pathname = usePathname();
  const visibleTabs = tabs.filter((tab) => {
    if (role === "DECISION_MAKER") return ["overview", "risks", "decisions", "reports"].includes(tab.key);
    if (role === "EXPERT") return ["overview", "checklist", "risks", "reports"].includes(tab.key);
    if (role === "MEMBER") return ["overview", "checklist", "risks"].includes(tab.key);
    return true;
  });
  return (
    <nav className="project-nav" aria-label="项目工作区">
      {visibleTabs.map((tab) => {
        const href = `/projects/${projectId}${tab.suffix}`;
        const active = tab.suffix ? pathname.startsWith(href) : pathname === href;
        return <Link className={active ? "active" : undefined} href={href} aria-current={active ? "page" : undefined} key={tab.key}>{tab.label}</Link>;
      })}
    </nav>
  );
}
