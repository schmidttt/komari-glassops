# Komari GlassOps v1.0.6

`v1.0.6` 是一次显示细节维护更新，重点收口节点卡片的状态层级、标签弹窗宽度和 tiled 浅色地图对比度。

Komari GlassOps 不是 Komari 官方主题，也不是从零开始重写的全新项目。本主题以 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 等社区开源项目为基础，结合日常节点运维需求继续整理和优化。

## 本次更新

- **卡片层级统一**：compact 与 mini 卡片中的实时速率、累计流量、续费信息采用一致标题层级，状态正文保持清晰但克制的提醒色。
- **无限流量更准确**：无流量配额节点的累计上下行使用中性样式，不再误显示为正常绿色状态。
- **标签弹窗自适应**：单标签保持协调起始宽度，多标签换行后按所属卡片宽度扩展，同时受视口边界约束。
- **浅色地图更清楚**：增强 tiled 浅色模式海洋区域的渐变、网格和纸张纹理，不影响深色模式。
- **近期版本审查**：已审查 Komari `1.4.0–1.4.2` 的近期变化，未发现当前主题必须新增兼容分支的破坏性变化。
- **回归保护**：本地浏览器组合回归扩展至 84 项，覆盖深浅色、四种卡片密度、状态语义、标签宽度及 tiled 地图。

## 延续特色

- 主题自适应宽屏显示器
- 首页卡片自定义监控
- `realistic`、`cobe`、`tiled` 三种地球样式
- 服务器详情页与 TCPing 图表重构
- 节点收藏、增强搜索、标签提示和常用快捷筛选

## 安装

1. 下载 Release 附件中的 `komari-glassops-v1.0.6-build-*.zip`。
2. 登录 Komari 后台，进入主题管理并导入 ZIP。
3. 启用 `Komari GlassOps`，建议首次先使用默认暗色和 `compact` 卡片验证数据。

请勿上传 GitHub 自动生成的 Source code 压缩包；它不是 Komari 可直接导入的主题包。

## 验证边界

发布包使用完全虚构的固定节点数据完成类型检查、代码规范、生产构建、ZIP 结构和 84 项浏览器组合回归。Komari `1.4.0–1.4.2` 已完成代码与发行说明审查，但真实环境仍建议执行覆盖导入、保存设置、硬刷新和实际显卡长时间运行检查。

## 致谢

感谢 [sanrokamlan-prog/komari-theme-Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)、[komari-monitor/komari](https://github.com/komari-monitor/komari) 及其他社区参与者提供的代码基础、设计思路和持续维护。本项目保留上游来源与 MIT License 说明，不把社区已有成果描述成完全原创。
