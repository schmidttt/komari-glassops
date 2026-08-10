# Komari GlassOps v1.0.7

`v1.0.7` 重点升级 realistic 地球的实时昼夜、城市夜光、大气层、拖动范围和浅色模式观感。

Komari GlassOps 不是 Komari 官方主题，也不是从零开始重写的全新项目。本主题以 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 等社区开源项目为基础，结合日常节点运维需求继续整理和优化。

## 本次更新

- **实时昼夜**：根据实时太阳位置区分白昼与夜晚半球，自动旋转、手动拖动和定时刷新时同步更新光照方向。
- **分层城市夜光**：使用 NASA Earth Observatory 2016 Black Marble 夜光纹理；繁华沿海和都市圈光点更多、更亮，普通城市和低密度区域依次减弱。
- **透明蓝色大气层**：深色模式下光晕贴合地表，并以宽幅淡蓝色向外自然渐隐；流星经过透明外圈时仍可见。
- **扩大拖动范围**：节点内容没有遮挡的地球区域均可手动拖动，卡片、筛选和功能控件保持原有交互。
- **浅色模式收口**：移除海面中央的不自然镜面亮斑，并降低北非、中东等暖色地貌的高光和饱和度，使白昼清晰但不刺眼。
- **回归保护**：浏览器回归扩展至 94 项，覆盖固定昼夜、东亚/北美/澳洲灯光层级、浅色沙漠曝光、宽屏光晕、无遮挡拖动及既有页面功能。

## 延续特色

- 主题自适应宽屏显示器
- 首页卡片自定义监控
- `realistic`、`cobe`、`tiled` 三种地球样式
- 服务器详情页与 TCPing 图表重构
- 节点收藏、增强搜索、标签提示和常用快捷筛选

## 安装

1. 下载 Release 附件中的 `komari-glassops-v1.0.7-build-*.zip`。
2. 登录 Komari 后台，进入主题管理并导入 ZIP。
3. 启用 `Komari GlassOps`，建议首次分别检查深色和浅色 realistic 地球。

请勿上传 GitHub 自动生成的 Source code 压缩包；它不是 Komari 可直接导入的主题包。

## 验证边界

发布包使用完全虚构的固定节点数据完成类型检查、代码规范、生产构建、ZIP 结构和 94 项浏览器组合回归。真实 Komari、Safari、不同 GPU 和长时间动画运行仍建议独立验证。

## 致谢

感谢 [sanrokamlan-prog/komari-theme-Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)、[komari-monitor/komari](https://github.com/komari-monitor/komari)、NASA Earth Observatory 及其他社区参与者提供的代码、数据与设计基础。本项目保留上游来源与 MIT License 说明，不把社区已有成果描述成完全原创。
