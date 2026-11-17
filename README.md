# new-api 前端源码评审与修改

本仓库提供 EVA 前端的可编辑 React、TypeScript、Next.js 源码，供协作者评审页面、提出建议及提交修改。项目基于 **new-api / QuantumNous**，保留原有版权及署名。

## 仓库内容

源码统一放在 `frontend/src/`，没有编译混淆后的 HTML。图片、字体、`public/`、`assets/`、`.next/`、依赖目录和 `bun.lock` 不在本仓库中。

| 修改内容 | 目录 |
| --- | --- |
| 模型广场和模型详情 | `frontend/src/features/catalog/` |
| 使用日志和任务日志 | `frontend/src/features/logs/`、`frontend/src/features/tasks/` |
| 审计日志 | `frontend/src/features/audit/` |
| 渠道列表、模型管理 | `frontend/src/features/admin/` |
| 性能页面 | `frontend/src/features/performance/` |
| 公共控件和导航布局 | `frontend/src/components/` |
| 样式与响应式布局 | `frontend/src/styles/` |
| 页面路由 | `frontend/src/app/` |
| 国际化工具 | `frontend/src/i18n/` |

## 如何参与

- **提出建议**：在 Issues 中注明页面、当前问题、期望效果及相关源码路径。可附截图说明。
- **修改代码**：Fork 本仓库，修改 `frontend/src/` 下的文件，再提交 Pull Request。说明改了什么、原因和影响范围。
- 页面调整请优先复用现有组件，保留业务功能、翻译和移动端适配。不要提交密钥、真实用户数据、依赖或构建产物。

这是源码评审仓库，不是可独立运行的完整工程。直接克隆后不能运行 `bun run dev`；部分源码引用的配置、语言包、字体和图片保留在完整本地工程。需要运行验证时由项目维护者将修改合并到完整工程。

当前源码对应的主工程使用 **Next.js 16.4.6**，已从 16.4.3 升级，以修复 [CVE-2026-119790 / GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h)。将本仓库源码用于其他工程时，也需安装已修复的 Next.js 版本；仅复制 `src/` 不会升级依赖。依赖声明及 Bun 锁文件由主项目维护。

主工程同时将安全依赖更新为 **diff 8.0.3、KaTeX 0.19.1、happy-dom 21.0.4**。`package.json` 使用 `overrides: { "katex": "0.19.1" }` 统一 Markdown 插件的间接依赖，避免继续安装存在告警的旧版本。集成源码时需同步这些依赖设置并重新安装；本仓库不包含依赖声明或锁文件。

`frontend/src/` 直接同步自主项目 `E:/back/newapi/web-next/src/`，对应当前 EVA 的真实前端实现；旧独立预览版本的 Mock 适配已移除。协作者的修改经维护者评审后合并，不会自动部署线上。

## 许可证与来源

基于 new-api，原作者与组织为 QuantumNous；保留各文件版权声明，许可证见 [LICENSE](LICENSE)。源码提取与整理使用了 AI 辅助。

## EVA 客户端 Skill

[skills/eva-models/SKILL.md](skills/eva-models/SKILL.md) 同步自主项目，供客户端接入与价格展示规则评审。在线入口：[EVA 模型接入 Skill](https://api.eveapis.com/api/skills/eva-models/SKILL.md)。其中不包含密钥或固定售价。
