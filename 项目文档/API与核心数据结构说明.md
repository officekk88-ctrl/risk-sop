# API 与核心数据结构说明

## API 约定

除健康检查外，所有接口都需要签名会话 Cookie，并在服务端重新检查项目成员权限。未登录返回 401，不可见资源返回 404，业务冲突返回 409。浏览器写请求还会检查 Origin。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 存活检查 |
| POST | `/api/projects/:projectId/ai/chat` | 项目上下文流式咨询 |
| POST/GET | `/api/projects/:projectId/ai/reviews` | 创建或查询材料初审 |
| PATCH | `/api/projects/:projectId/ai/reviews/:reviewId/findings/:findingId` | 修改、确认或驳回候选风险 |
| GET | `/api/projects/:projectId/documents/:documentId` | 预览或下载项目文件 |
| GET | `/api/projects/:projectId/reports/:reportId/pdf` | 生成并下载 PDF 报告 |

## 核心实体

`AppUser` 保存邮箱、显示名、scrypt 哈希、ADMIN/MEMBER 角色和启用状态。`Project` 聚合场地、负责人、成员邮箱和 37 项清单实例。`ProjectDocument` 保存文件元数据、软删除状态和解析结果。`AIReview` 保存模型、提示词版本、结构化输出和人工决策。`Risk` 与 `RemediationTask` 构成风险整改闭环。`ProjectReport` 保存不可变决策快照。`KnowledgeEntry` 保存专业分类、内容、关键词、来源、审核状态、版本和审核轨迹；只有 `PUBLISHED` 条目会参与 AI 检索。`KnowledgeSourceDocument` 保存知识源文件、解析文字、导入状态、AI 摘要、模型与提示词版本以及生成条目关联。`AuditLog` 记录关键变更。

TypeScript 定义以 `src/lib/domain.ts` 为准，PostgreSQL 目标模型以 `db/migrations/` 的顺序迁移为准。当前运行时单实例存储为 `.data/mvp-data.json`，它不是对外稳定 API，禁止在服务运行时手工编辑。
