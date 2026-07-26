"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "project" | "check" | "file" | "book";

const iconPaths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5M9 21v-6h6v6"/></>,
  project: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M8 5V3h8v2M3 10h18M9 14h6"/></>,
  check: <><path d="M9 5h10v16H5V5h4"/><path d="M9 3h6v4H9zM8 12l2 2 4-4M8 18h7"/></>,
  file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  book: <><path d="M4 4h6a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H4zM20 4h-6a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h5z"/></>,
};

function NavIcon({ name }: { name: IconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

const primaryItems: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "工作台", icon: "home" },
  { href: "/projects", label: "项目", icon: "project" },
  { href: "/tasks", label: "任务", icon: "check" },
  { href: "/resources", label: "资源", icon: "book" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroup({ label, items }: { label: string; items: typeof primaryItems }) {
  const pathname = usePathname();
  return (
    <div className="nav-group nav-group-primary">
      <span className="nav-group-label">{label}</span>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} key={item.href}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
            {active ? <i aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </div>
  );
}

export function AppNavigation() {
  return (
    <nav className="nav" aria-label="主导航">
      <NavGroup label="工作空间" items={primaryItems} />
    </nav>
  );
}
