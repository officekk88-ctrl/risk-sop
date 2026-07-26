import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "开馆风控台｜匹克球馆开馆风险管理与 AI 咨询",
  description: "用37项尽调、材料AI初判、风险整改和决策报告，降低匹克球馆选址与开馆风险。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
