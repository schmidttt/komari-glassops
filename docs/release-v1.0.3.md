# Komari GlassOps v1.0.3

`v1.0.3` 是 Komari GlassOps 计划发布到 GitHub 的首个公开版本。

它不是 Komari 官方主题，也不是从零开始重写的全新项目。本主题以 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 等社区开源项目为基础，结合日常节点运维需求继续整理和优化。

## 本次重点

- **自适应宽屏显示**：首页总览、地球区域和节点卡片会根据浏览器宽度调整列数、尺寸与间距。
- **首页卡片自定义监控**：每台公开服务器可选择 `0–3` 个独立 TCPing 任务，并分别查看延迟、走势和丢包。
- **三种地球样式优化**：`realistic`、`cobe`、`tiled` 均适配深浅色、节点定位和不同节点规模。
- **服务器详情页重构**：重新组织实时数据、历史负载、TCPing 图表和节点切换操作。
- **节点操作完善**：支持收藏、增强搜索、快捷筛选、标签提示、节点对比和列表信息栏。
- **兼容与稳定性**：面向 Komari 1.3.2 完成接口审计，并通过本地类型、代码、构建和浏览器回归。

## 三阶段迭代

| 版本     | 阶段         | 说明                                             |
| -------- | ------------ | ------------------------------------------------ |
| `v1.0.1` | 基础成型     | 独立主题结构、来源许可、玻璃质感和卡片密度。     |
| `v1.0.2` | 监控扩展     | TCPing 自定义、收藏检索、节点对比和详情图表。    |
| `v1.0.3` | 首次公开发布 | 宽屏适配、三种地球、标签交互、性能与兼容性收口。 |

前两个版本是首次公开发布前的开发里程碑，正式 GitHub Release 从 `v1.0.3` 开始。

## 安装

1. 下载 Release 附件中的 `komari-glassops-v1.0.3-build-*.zip`。
2. 登录 Komari 后台，进入主题管理并导入 ZIP。
3. 启用 `Komari GlassOps`，建议首次先使用默认暗色和 `compact` 卡片验证数据。

请勿上传 GitHub 自动生成的 Source code 压缩包；它不是 Komari 可直接导入的主题包。

## 验证边界

发布候选使用完全虚构的固定节点数据完成本地类型检查、代码规范、生产构建、ZIP 结构和浏览器组合回归。真实 Komari 1.3.2 环境仍应在发布前执行覆盖导入、保存设置、硬刷新和实际显卡长时间运行检查。

## 致谢

感谢 [sanrokamlan-prog/komari-theme-Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)、[komari-monitor/komari](https://github.com/komari-monitor/komari) 及其他社区参与者提供的代码基础、设计思路和持续维护。本项目保留上游来源与 MIT License 说明，不把社区已有成果描述成完全原创。
