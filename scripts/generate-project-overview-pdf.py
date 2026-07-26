#!/usr/bin/env python3
"""Render the project overview Markdown document as a print-ready PDF file."""

from __future__ import annotations

import html
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "项目文档" / "匹克球馆开馆风险管理与AI咨询系统-项目介绍及功能框架.md"
OUTPUT = ROOT / "项目文档" / "匹克球馆开馆风险管理与AI咨询系统-项目介绍、功能详细说明与框架结构.pdf"


def inline(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    return escaped


def slug(text: str, used: set[str]) -> str:
    base = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", text).strip("-").lower() or "section"
    value = base
    index = 2
    while value in used:
        value = f"{base}-{index}"
        index += 1
    used.add(value)
    return value


def is_separator(row: str) -> bool:
    cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def row_cells(row: str) -> list[str]:
    return [cell.strip() for cell in row.strip().strip("|").split("|")]


def render_markdown(markdown: str) -> tuple[str, str]:
    lines = markdown.splitlines()
    output: list[str] = []
    toc: list[tuple[int, str, str]] = []
    used_ids: set[str] = set()
    paragraph: list[str] = []
    list_kind: str | None = None
    in_code = False
    code_lines: list[str] = []
    index = 0

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            output.append(f"<p>{inline(' '.join(part.strip() for part in paragraph))}</p>")
            paragraph = []

    def close_list() -> None:
        nonlocal list_kind
        if list_kind:
            output.append(f"</{list_kind}>")
            list_kind = None

    while index < len(lines):
        line = lines[index]

        if in_code:
            if line.startswith("```"):
                output.append(f"<pre>{html.escape(chr(10).join(code_lines))}</pre>")
                code_lines = []
                in_code = False
            else:
                code_lines.append(line)
            index += 1
            continue

        if line.startswith("```"):
            flush_paragraph()
            close_list()
            in_code = True
            index += 1
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            close_list()
            level = len(heading.group(1))
            title = heading.group(2).strip()
            anchor = slug(title, used_ids)
            output.append(f'<h{level} id="{anchor}">{inline(title)}</h{level}>')
            if level in (2, 3):
                toc.append((level, title, anchor))
            index += 1
            continue

        if line.startswith("|") and index + 1 < len(lines) and is_separator(lines[index + 1]):
            flush_paragraph()
            close_list()
            headers = row_cells(line)
            index += 2
            rows: list[list[str]] = []
            while index < len(lines) and lines[index].startswith("|"):
                rows.append(row_cells(lines[index]))
                index += 1
            output.append("<table><thead><tr>" + "".join(f"<th>{inline(cell)}</th>" for cell in headers) + "</tr></thead><tbody>")
            for row in rows:
                output.append("<tr>" + "".join(f"<td>{inline(cell)}</td>" for cell in row) + "</tr>")
            output.append("</tbody></table>")
            continue

        item = re.match(r"^\s*([-*]|\d+\.)\s+(.+)$", line)
        if item:
            flush_paragraph()
            kind = "ol" if item.group(1)[0].isdigit() else "ul"
            if list_kind != kind:
                close_list()
                output.append(f"<{kind}>")
                list_kind = kind
            output.append(f"<li>{inline(item.group(2))}</li>")
            index += 1
            continue

        if line.startswith("> "):
            flush_paragraph()
            close_list()
            output.append(f"<blockquote>{inline(line[2:].strip())}</blockquote>")
            index += 1
            continue

        if re.fullmatch(r"-{3,}", line.strip()):
            flush_paragraph()
            close_list()
            output.append("<hr>")
            index += 1
            continue

        if not line.strip():
            flush_paragraph()
            close_list()
        else:
            paragraph.append(line)
        index += 1

    flush_paragraph()
    close_list()
    if in_code:
        output.append(f"<pre>{html.escape(chr(10).join(code_lines))}</pre>")

    toc_html = ['<nav class="toc"><h2>目录</h2><ol>']
    for level, title, anchor in toc:
        css_class = "toc-sub" if level == 3 else "toc-main"
        toc_html.append(f'<li class="{css_class}"><a href="#{anchor}">{inline(title)}</a></li>')
    toc_html.append("</ol></nav>")
    return "\n".join(output), "\n".join(toc_html)


def build_html(body: str, toc: str) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>匹克球馆开馆风险管理与 AI 咨询系统</title>
<style>
  @page {{
    size: A4;
    margin: 19mm 17mm 20mm;
    @bottom-left {{ content: "匹克球馆开馆风险管理与 AI 咨询系统"; color: #64748b; font-size: 8pt; }}
    @bottom-right {{ content: "第 " counter(page) " 页"; color: #64748b; font-size: 8pt; }}
  }}
  * {{ box-sizing: border-box; }}
  html {{ font-size: 10.5pt; }}
  body {{
    margin: 0;
    color: #172033;
    font-family: "Alibaba PuHuiTi 2.0", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
    line-height: 1.72;
  }}
  .cover {{
    min-height: 250mm;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 24mm 18mm;
    color: white;
    background: linear-gradient(145deg, #083344 0%, #075985 52%, #0f766e 100%);
  }}
  .cover::before {{
    content: "";
    position: absolute;
    width: 125mm;
    height: 125mm;
    border: 1.5mm solid rgba(255,255,255,.11);
    border-radius: 50%;
    right: -45mm;
    top: -35mm;
  }}
  .cover::after {{
    content: "";
    position: absolute;
    width: 70mm;
    height: 70mm;
    border-radius: 50%;
    left: -31mm;
    bottom: -18mm;
    background: rgba(45,212,191,.16);
  }}
  .cover-kicker {{ color: #99f6e4; font-size: 11pt; letter-spacing: 0.18em; margin-bottom: 9mm; }}
  .cover h1 {{ color: white; font-size: 29pt; line-height: 1.28; margin: 0 0 8mm; border: 0; }}
  .cover-subtitle {{ font-size: 17pt; font-weight: 500; line-height: 1.5; max-width: 140mm; }}
  .cover-rule {{ width: 34mm; height: 1.2mm; background: #5eead4; margin: 13mm 0 11mm; }}
  .cover-meta {{ color: #dbeafe; font-size: 10.5pt; line-height: 2; }}
  .toc {{ page-break-after: always; }}
  .toc h2 {{ margin-top: 0; }}
  .toc ol {{ list-style: none; padding: 0; columns: 2; column-gap: 14mm; }}
  .toc li {{ break-inside: avoid; margin: 0 0 2.1mm; line-height: 1.36; }}
  .toc-main {{ font-weight: 600; }}
  .toc-sub {{ padding-left: 5mm; font-size: 9pt; color: #475569; }}
  .toc a {{ color: inherit; text-decoration: none; }}
  main > h1:first-child, main > h2:nth-child(2) {{ display: none; }}
  h1, h2, h3, h4 {{ color: #0f3d52; line-height: 1.35; page-break-after: avoid; }}
  h1 {{ font-size: 24pt; border-bottom: 1mm solid #14b8a6; padding-bottom: 4mm; }}
  h2 {{ font-size: 17pt; margin: 10mm 0 4mm; padding: 3mm 4mm; border-left: 1.5mm solid #0f766e; background: #ecfeff; }}
  h3 {{ font-size: 13pt; margin: 7mm 0 2.5mm; color: #075985; }}
  h4 {{ font-size: 10.8pt; margin: 4.5mm 0 1mm; color: #334155; }}
  p {{ margin: 0 0 3mm; text-align: justify; orphans: 3; widows: 3; }}
  ul, ol {{ margin: 1.5mm 0 4mm; padding-left: 7mm; }}
  li {{ margin: 0.7mm 0; padding-left: 1mm; }}
  li::marker {{ color: #0f766e; font-weight: 700; }}
  strong {{ color: #0f3d52; }}
  code {{ font-family: Consolas, "Microsoft YaHei", monospace; background: #f1f5f9; padding: .2mm 1mm; border-radius: 1mm; }}
  pre {{
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    page-break-inside: avoid;
    font-family: Consolas, "Microsoft YaHei", monospace;
    font-size: 8.6pt;
    line-height: 1.48;
    color: #dbeafe;
    background: #0f2940;
    border-radius: 2mm;
    padding: 4mm 5mm;
    margin: 3mm 0 5mm;
  }}
  blockquote {{
    margin: 4mm 0 6mm;
    padding: 4mm 6mm;
    color: #164e63;
    font-size: 12pt;
    font-weight: 600;
    background: #ecfeff;
    border-left: 1.5mm solid #14b8a6;
  }}
  table {{ width: 100%; border-collapse: collapse; margin: 3mm 0 6mm; font-size: 8.8pt; line-height: 1.48; }}
  thead {{ display: table-header-group; }}
  tr {{ break-inside: avoid; page-break-inside: avoid; }}
  th {{ color: white; background: #0f5b70; font-weight: 600; }}
  th, td {{ border: .25mm solid #cbd5e1; padding: 2.2mm 2.5mm; vertical-align: top; text-align: left; }}
  tbody tr:nth-child(even) {{ background: #f8fafc; }}
  hr {{ border: 0; border-top: .3mm solid #cbd5e1; margin: 7mm 0; }}
  a {{ color: #0369a1; }}
</style>
</head>
<body>
  <section class="cover">
    <div class="cover-kicker">PROJECT OVERVIEW · V1.0</div>
    <h1>匹克球馆开馆风险管理<br>与 AI 咨询系统</h1>
    <div class="cover-subtitle">项目介绍、功能详细说明与框架结构</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">Web 端 SaaS / 企业内部管理系统<br>面向投资人、项目团队、审核人员与专业顾问<br>2026 年 7 月</div>
  </section>
  {toc}
  <main>{body}</main>
</body>
</html>
"""


def find_browser() -> Path:
    candidates = [
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
        "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise RuntimeError("未找到 Chrome、Chromium 或 Microsoft Edge，无法生成 PDF")


def browser_path(path: Path, browser: Path) -> str:
    if browser.suffix.lower() == ".exe" and shutil.which("wslpath"):
        return subprocess.check_output(["wslpath", "-w", str(path)], text=True).strip()
    return path.as_uri()


def main() -> None:
    source = SOURCE
    output = OUTPUT
    if len(sys.argv) > 1:
        source = Path(sys.argv[1]).resolve()
    if len(sys.argv) > 2:
        output = Path(sys.argv[2]).resolve()
    body, toc = render_markdown(source.read_text(encoding="utf-8"))
    output.parent.mkdir(parents=True, exist_ok=True)
    print_html = output.with_name(f".{output.stem}.print.html")
    print_html.write_text(build_html(body, toc), encoding="utf-8")
    browser = find_browser()
    command = [
        str(browser),
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={browser_path(output, browser)}",
        browser_path(print_html, browser),
    ]
    try:
        subprocess.run(command, check=True)
    finally:
        print_html.unlink(missing_ok=True)
    print(output)


if __name__ == "__main__":
    main()
