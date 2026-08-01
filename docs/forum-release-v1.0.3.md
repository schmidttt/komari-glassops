# [主题发布] Komari GlassOps v1.0.3

Komari GlassOps 是一款面向 Komari 的社区主题。

它不是从零开始重写的全新主题，也不是 Komari 官方主题。这个版本以 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 等社区开源项目为基础，结合自己的日常节点运维需求，对首页信息层级、监控配置、节点操作和玻璃质感继续做了整理与优化。

项目更关注实际使用：数据是否容易找到、不同卡片密度下是否清楚、手机端是否挤压，以及亮色和暗色模式下文字是否仍然可读。

![Komari GlassOps v1.0.3 主题介绍](https://raw.githubusercontent.com/Schmidttt/komari-glassops/main/docs/preview.png)

---

## 主要功能

### 三阶段迭代

- `v1.0.1`：完成独立主题结构、来源与许可说明、玻璃质感和卡片密度；
- `v1.0.2`：加入 TCPing 自定义监控、收藏检索、节点对比和详情图表；
- `v1.0.3`：收口宽屏适配、三种地球样式、节点标签、交互性能和 Komari 1.3.2 兼容性。

前两个版本是公开发布前的开发里程碑，GitHub 正式发布从 `v1.0.3` 开始。

### 首页 TCPing 节点自定义监控

- 每台公开节点可单独选择 `0–3` 个已有 Ping 任务；
- 不同任务分别展示最新延迟、历史走势和丢包，不把不同城市或任务混成一个平均值；
- 支持搜索、调整顺序、移除、清空和恢复默认；
- 管理员保存后写入当前主题设置，访客只查看结果，不能修改配置。

### 多种卡片和信息组合

- 节点卡片提供 `mini`、`compact`、`comfortable`、`large` 四种密度；
- 首页总览支持官方、基础、运维、资源、财务、流量、GPU、资产、完整和自定义方案；
- 详情图表可按资源、网络、GPU、延迟、运维等场景组合；
- 卡片和列表都兼顾桌面端与移动端，节点较多时会延迟渲染视口外卡片，减轻首屏压力。

### 节点收藏、筛选与增强搜索

- 卡片、列表和详情页均可收藏节点；
- 首页可只查看收藏、离线、高负载、即将到期等节点；
- 搜索覆盖名称、地区、IP、CPU/GPU、系统、架构、标签和分组；
- IPv4 支持 `192.168.x.x`、`192.168.*.*` 一类通配查询；
- 详情页可快速切换上一台、下一台节点。

### 三种地球与地图

- `realistic`：卫星纹理、地形和水面材质，深浅主题使用统一的质感与补光逻辑；
- `cobe`：低亮深蓝点阵，保留克制的节点、连线和局部光点；
- `tiled`：本地国家边界数据绘制的简约平面地图，支持主要版块标注和多节点汇总。

地球动画会遵守主题里的“减弱过渡动画”以及系统的减少动态效果设置。

### 玻璃质感与可读性

- 暗色、亮色和北京时间自动模式；
- 多套毛玻璃配色以及自定义颜色；
- 调整卡片层次、边框、背景透明度和文字对比度；
- 提供色觉辅助配色；
- 对移动端、旧版 WebKit 和不支持完整模糊效果的浏览器保留可读降级。

---

## 安装方法

1. 打开项目的 [Releases 页面](https://github.com/Schmidttt/komari-glassops/releases)；
2. 下载 `komari-glassops-v1.0.3-build-*.zip`；
3. 登录 Komari 后台，进入主题管理；
4. 上传这个 ZIP 并启用 `Komari GlassOps`；
5. 首次使用建议先保持默认暗色与 `compact` 卡片，确认数据正常后再逐项调整。

请下载 Release 附件中的主题包，不要上传 GitHub 自动生成的 Source code 压缩包。

---

## 兼容性与验证说明

v1.0.3 发布前已经使用完全虚构的固定节点数据完成本地构建和浏览器回归，覆盖：

- 深色 / 浅色；
- 桌面 / 手机；
- 四种卡片密度与列表模式；
- realistic / cobe / tiled 三种地球视图；
- 收藏、搜索、详情切换和图表交互；
- 首页 Ping 配置与 mini 卡片提示；
- 玻璃文字对比度、控制台错误和横向溢出检查。

这些自动化结果不能代替所有 Komari 版本、反向代理方案和真实节点规模下的长期验证。升级前建议备份当前主题与设置；如果使用较旧或自行修改过的 Komari，先在非关键环境导入确认。

---

## 项目地址

- GitHub：<https://github.com/Schmidttt/komari-glassops>
- Releases：<https://github.com/Schmidttt/komari-glassops/releases>
- 问题反馈：<https://github.com/Schmidttt/komari-glassops/issues>

---

## 致谢

感谢 [sanrokamlan-prog/komari-theme-Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism) 及其他 Komari 社区开源项目提供的代码基础、设计思路和持续维护。

也感谢 [Komari](https://github.com/komari-monitor/komari) 项目及社区参与者。GlassOps 会保留上游来源与 MIT License 说明，不把社区已有成果描述成完全原创。
