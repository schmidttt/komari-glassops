# Komari GlassOps v1.0.5

`v1.0.5` 是 `v1.0.3` 首次公开发布后的视觉维护版本，重点优化首页节点卡片中的标签、累计流量和续费信息。

Komari GlassOps 不是 Komari 官方主题，也不是从零开始重写的全新项目。本主题以 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 等社区开源项目为基础，结合日常节点运维需求继续整理和优化。

## 本次更新

- **分类标题固定配色**：累计流量与续费信息不再随状态变色，mini 与完整卡片保持一致。
- **状态提醒更清楚**：价格、剩余天数等数值继续按正常、临期和告警使用语义色，但降低背景刺激度。
- **深浅色可读性**：提高深色模式下紫色、绿色与次级文字的对比度，同时保持浅色模式轻盈。
- **标签弹窗更协调**：默认宽度加宽，始终受所属卡片和视口边界约束，标签较多时自动换行。
- **回归保护**：覆盖四种卡片密度、深浅色、状态配色及宽屏/窄屏标签定位。

`v1.0.4` 未单独发布，本次维护内容统一随 `v1.0.5` 提供。

## 延续特色

- 主题自适应宽屏显示器
- 首页卡片自定义监控
- `realistic`、`cobe`、`tiled` 三种地球样式
- 服务器详情页与 TCPing 图表重构
- 节点收藏、增强搜索、标签提示和常用快捷筛选

## 安装

1. 下载 Release 附件中的 `komari-glassops-v1.0.5-build-*.zip`。
2. 登录 Komari 后台，进入主题管理并导入 ZIP。
3. 启用 `Komari GlassOps`，建议首次先使用默认暗色和 `compact` 卡片验证数据。

请勿上传 GitHub 自动生成的 Source code 压缩包；它不是 Komari 可直接导入的主题包。

## 验证边界

发布包使用完全虚构的固定节点数据完成类型检查、代码规范、生产构建、ZIP 结构和浏览器组合回归。真实 Komari 1.3.2 环境仍建议执行覆盖导入、保存设置、硬刷新和实际显卡长时间运行检查。

## 致谢

感谢 [sanrokamlan-prog/komari-theme-Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)、[komari-monitor/komari](https://github.com/komari-monitor/komari) 及其他社区参与者提供的代码基础、设计思路和持续维护。本项目保留上游来源与 MIT License 说明，不把社区已有成果描述成完全原创。
