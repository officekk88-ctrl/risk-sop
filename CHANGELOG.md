# 更新日志

本项目的重要变化将记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 建立开源仓库治理文件、贡献流程、安全政策和 GitHub 模板。
- 配置持续集成和依赖更新检查。
- 使用开馆风控台实际首页截图作为 README 产品预览。

### Changed

- AI 不再使用默认模型；部署者必须自行配置 API Key 和可调用的模型 ID。
- 补充 `.env.local` 必填项、AI 配置和安全边界说明。

### Removed

- 从公开仓库移除内部项目文档、模拟项目生成器及其专用测试入口。

### Security

- 生产依赖审计无已知漏洞；开发期 ESLint 工具链仍受上游 `minimatch`/`brace-expansion` 告警影响，待兼容的主版本升级方案发布后处理。

## [0.1.0] - 2026-07-26

### Added

- 匹克球馆项目建档、场地比较、阶段和决策门。
- 37 项尽调清单、材料解析、AI 初判与人工确认。
- 风险台账、整改任务、专家复核和版本化综合报告。
- 可审核知识库、AI 咨询、账号权限和操作审计。

[Unreleased]: https://github.com/officekk88-ctrl/risk-sop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/officekk88-ctrl/risk-sop/releases/tag/v0.1.0
