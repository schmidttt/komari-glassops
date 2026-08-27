# Komari GlassOps

面向 [Komari Monitor](https://github.com/komari-monitor/komari) 的社区维护型毛玻璃运维主题，重点优化宽屏信息密度、节点监控效率、地球视图和深浅色体验。

[![Release](https://img.shields.io/github/v/release/Schmidttt/komari-glassops?style=flat-square&label=Release)](https://github.com/Schmidttt/komari-glassops/releases/latest)
[![Komari](https://img.shields.io/badge/Komari-1.4.3-2f81f7?style=flat-square)](https://github.com/komari-monitor/komari/releases/tag/1.4.3)
[![License](https://img.shields.io/github/license/Schmidttt/komari-glassops?style=flat-square)](LICENSE)

[下载最新版](https://github.com/Schmidttt/komari-glassops/releases/latest) · [查看特色](#核心特色) · [安装主题](#安装与更新) · [版本日志](#版本日志)

![Komari GlassOps v1.0.9 暗色首页预览](docs/preview-v1.0.9.png)

## 当前版本

| 项目     | 说明                                                                                                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 最新版本 | `v1.0.9`                                                                                                                                                                                                                                                                                        |
| 重点适配 | Komari `1.4.3`                                                                                                                                                                                                                                                                                  |
| 默认外观 | 暗色毛玻璃                                                                                                                                                                                                                                                                                      |
| 安装方式 | 在 Komari 后台导入主题 ZIP                                                                                                                                                                                                                                                                      |
| 版本概要 | - 长时间范围会根据服务端元数据明确显示分钟、小时或日聚合粒度。<br>- 日聚合横轴和提示使用统计桶日期，不再显示误导性的本地 `08:00`。<br>- 负载图与 Ping 图分别解释各自数据源的聚合状态，兼容旧记录回退。<br>- 保持后端数值、聚合算法和自定义区间边界不变。<br>- 完整说明见[版本日志](#版本日志)。 |

GlassOps 适合希望在保留 Komari 简洁体验的同时，进一步强化首页信息密度、节点检索和日常运维能力的用户。

## 核心特色

### 自适应首页与节点卡片

- 首页会按屏幕宽度调整总览区、地球和节点卡片布局，兼顾宽屏、常规桌面和移动端。
- 提供 `mini`、`compact`、`comfortable`、`large` 四种卡片密度，默认使用信息完整且紧凑的 `compact`。
- 总览卡片、快捷筛选和列表元信息均可按使用习惯组合，减少不必要的信息堆叠。
- 节点卡片集中展示在线状态、系统、资源占用、实时速率、累计流量、续费信息和运行时间。

### 首页 TCPing 与监控工具

- 管理员可为每台公开节点单独选择、排序或清空 `0–3` 个 TCPing 任务。
- 首页按任务分别展示最新延迟、近期走势和丢包，不把不同线路的数据混成平均值。
- 支持节点收藏、增强搜索、常用状态筛选、离线置底和最多四台节点横向比较。
- 登录后可使用拓扑、性价比、健康摘要、数据快照和审计日志等运维工具；不受当前 Komari 核心支持的能力会自动提示或降级。

### 三种地球与地图

- `realistic`：实时太阳位置昼夜、分层城市夜光、透明蓝色大气层、节点光轨和无遮挡区域拖动。
- `cobe`：克制的数字点阵球体，以节点、连线和轨道突出监控关系。
- `tiled`：使用主题内置边界数据绘制的单色分区地图，支持主要区域标注和多节点汇总，不依赖在线地图瓦片。

三种视图均适配深浅色；动效会尊重主题中的“减弱过渡动画”和操作系统的减少动态效果设置。

### 详情、外观与隐私

- 节点详情支持快速切换、可组合负载图表、TCPing 延迟与丢包历史，以及缺失指标的兼容回退。
- 支持暗色、亮色和北京时间自动模式，并提供多套玻璃配色、自定义颜色及图片/视频背景。
- 提供色觉友好配色，并用线型、纹理、文字或图标辅助区分图表与状态。
- 可按需隐藏访客信息、未登录价格和后台入口；需要登录的操作会在执行前重新验证权限。

## 安装与更新

1. 打开 [Releases](https://github.com/Schmidttt/komari-glassops/releases/latest)，下载最新的 `komari-glassops-v*-build-*.zip`。
2. 进入 Komari 管理后台的主题管理页面并上传 ZIP。
3. 启用 `Komari GlassOps`。首次使用建议先保留默认暗色和 `compact` 卡片配置。
4. 更新前建议保留当前主题包和配置；上传新版后先检查首页、节点详情和管理员配置入口。

请直接上传 Release 中的 ZIP，不要解压后重新打包。标准主题包结构为：

```text
komari-theme.json
preview.png
preview-v<version>.png
dist/
```

## 版本日志

版本日志按新到旧排列，记录每个版本对实际使用有影响的变化。更细的技术记录见 [CHANGELOG.md](CHANGELOG.md)。

### [v1.0.9](https://github.com/Schmidttt/komari-glassops/releases/tag/v1.0.9) — 长时间范围聚合显示优化

- 长时间范围使用降采样数据时，根据服务端返回信息显示分钟、小时或日聚合粒度，并说明每个点代表对应统计区间的平均值。
- 日聚合横轴改为显示统计桶日期，tooltip 标题明确标注“日聚合”，避免 UTC 日桶起点在北京时间被误读为每天 `08:00` 采样一次。
- 同步修复负载历史图的聚合信息展示，并将普通负载记录与独立 Ping 序列的聚合状态分开处理，避免回退数据被错误标记。
- 保持后端返回数值、聚合算法、请求点数和自定义区间边界不变；没有证据时不自动扩展结束日期。
- 浏览器完整回归扩展到 100 项，覆盖 90 天范围、UTC 日桶、负载历史回退、各类详情交互和视觉快照。

### [v1.0.8](https://github.com/Schmidttt/komari-glassops/releases/tag/v1.0.8) — Komari 1.4.3 兼容与数据请求优化

- 更新内嵌管理后台以适配 Komari 1.4.3。只有后端版本精确匹配时才进入内嵌后台，其他版本自动使用 Komari 官方后台，避免误用不兼容页面。
- 修复新版指标缺少 CPU 历史序列时负载图为空的问题：保留现有数据，并通过兼容接口补齐 CPU 历史。
- 统一详情页 Ping 卡片与后台任务的显示顺序，无法识别的任务也会保持稳定排列。
- 首页改为按可见节点批量读取 Ping 历史，减少大量节点场景下的重复请求；批量结果缺失或失败时仍会逐节点回退。
- 浏览器回归扩展到 99 项，覆盖版本门控、CPU 回退、Ping 排序、批量请求及页面离开后的迟到结果处理。

### [v1.0.7](https://github.com/Schmidttt/komari-glassops/releases/tag/v1.0.7) — realistic 地球视觉升级

- 根据实时太阳位置区分白昼和夜晚半球，自动旋转、手动拖动和定时刷新时会同步更新光照方向。
- 引入 Black Marble 夜光纹理，城市灯光按原始信号呈现密度和亮度梯度，使都市圈、沿海区域与低密度地区形成自然层次。
- 重做深色模式大气层：淡蓝色光晕紧贴地球轮廓并向外渐隐，流星经过透明外圈时仍然可见。
- 扩大地球可拖动区域，未被卡片、列表或功能面板遮挡的位置都可直接旋转地球。
- 调整浅色模式的海面高光和暖色地貌曝光，减少不自然的亮斑与刺眼区域。

### [v1.0.6](https://github.com/Schmidttt/komari-glassops/releases/tag/v1.0.6) — 卡片状态与地图对比度维护

- 统一 `compact` 与 `mini` 卡片中实时速率、累计流量和续费信息的层级，状态色保持清晰但不过度抢眼。
- 无流量配额节点改用中性样式，避免把“无限流量”误显示为正常绿色状态。
- 节点标签弹窗会按卡片宽度和标签数量自适应，单标签不过宽，多标签可自然换行。
- 提升 `tiled` 浅色地图的海洋渐变、网格和纸张纹理可见度，同时保持深色配色不变。

### [v1.0.5](https://github.com/Schmidttt/komari-glassops/releases/tag/v1.0.5) — 卡片信息与标签体验优化

- 为累计流量和续费信息建立稳定的分类色与状态色，`mini` 和完整卡片保持一致。
- 提升深色模式中流量、价格和剩余天数的文字对比度，并调整摘要背景与边框。
- 加宽节点标签弹窗的默认空间，同时保留随卡片和视口收缩、超宽自动换行的能力。

`v1.0.4` 未单独发布，相关维护内容合并到 `v1.0.5`。

### [v1.0.3](https://github.com/Schmidttt/komari-glassops/releases/tag/v1.0.3) — 首次公开发布

- 完成首页、节点网格和详情页在宽屏、常规桌面、窄屏及移动端的布局适配。
- 建立 `realistic`、`cobe`、`tiled` 三种地球视图，并统一节点定位和深浅色表现。
- 加入围绕真实节点运行的分组光轨动效，并完善减少动态效果支持。
- 完成节点收藏、增强搜索、快捷筛选、列表元信息、详情快速切换和 TCPing 图表体验。
- 适配 Komari 1.3.2 的主题管理及公开指标接口，并补齐自动构建、主题包校验和浏览器回归。

### v1.0.2 — 监控扩展里程碑

- 为每台公开服务器加入 `0–3` 个独立 TCPing 任务的选择、排序和保存能力。
- 增加节点收藏、增强搜索、常用筛选、节点比较和详情快速切换。
- 扩展首页总览组合、详情图表和四种节点卡片密度。
- 优化图表固定提示、历史范围、丢包统计和首次数据加载。

### v1.0.1 — 基础成型里程碑

- 完成 Komari GlassOps 的主题清单、预览图、独立仓库和基础品牌信息。
- 整理暗色、亮色和北京时间自动模式的玻璃层级、文字对比度及响应式布局。
- 建立主题设置、构建、验证和发布前检查的基础流程。

`v1.0.1`、`v1.0.2` 是首次公开发布前的开发里程碑，GitHub Release 从 `v1.0.3` 开始。

## 兼容与验证

- 当前版本重点适配 Komari `1.4.3`；遇到不匹配的内嵌后台版本时会回到官方后台。
- 发布前会检查代码规范、Vue 类型、生产构建、主题包结构和浏览器交互，并通过 GitHub Actions 复核构建与视觉回归。
- 自动化使用固定虚构数据，不连接真实节点或账号；不同反向代理、浏览器/GPU 和大规模真实节点环境仍建议自行验证。

## 本地开发

环境要求：Bun `>= 1.2`，Node.js `^20.19.0 || >=22.12.0`。

```bash
bun install --frozen-lockfile
bun run dev
bun run lint
bun run build
bun run test:visual
```

`bun run build` 会生成 `dist/` 和 `komari-glassops-v<version>-build-<short-sha>.zip`。版本号只维护在 `komari-theme.json`；工作区存在未提交修改时，构建标识会追加 `-dirty`。

应用代码遵循以下分层：

```text
Component -> Composable -> Service -> RequestManager / CacheService -> API / RPC
```

详细开发约束见 [AIAGENTREADME.md](AIAGENTREADME.md)，来源和设计参考见 [NOTICE.md](NOTICE.md)。

## 维护与反馈

本项目会持续维护，并根据 Komari 核心变化修复兼容问题。符合 GlassOps 视觉方向、通用运维场景且能够稳定实现的建议，会结合影响范围和维护成本逐步评估。

提交问题或建议前，请先查看 [Issues](https://github.com/Schmidttt/komari-glassops/issues) 是否已有相同内容，并尽量提供 Komari 版本、主题版本、浏览器和可脱敏的复现信息。

## 来源与许可

Komari GlassOps 基于 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 的 MIT 代码基础继续开发，并参考了其他社区主题的信息组织方式。具体来源、基线与说明见 [NOTICE.md](NOTICE.md)。

本项目采用 [MIT License](LICENSE)。
