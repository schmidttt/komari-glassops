# Komari GlassOps 下一任务交接说明

更新时间：2026-07-30（Asia/Shanghai）

适用目录：

`/Users/williamm/.codex/.chatgpt-projects/g-p-6a5dc7f64dc48191a1a5d54905dc0164/komari-glassops`

## 1. 接管前必须阅读

新任务开始后，按顺序完整阅读：

1. `AGENTS.md`
2. `AIAGENTREADME.md`
3. `src/AGENTS.md`（涉及 `src/` 时）
4. `AICACHE.md` 最后一节
5. 本交接文档
6. 如需追溯设计过程，再读 `docs/handoff-2026-07-28-wide-admin-round.md` 第 21 节

本交接是当前精简基线。旧文档中的 `configuration.type=raw`、`/admin/theme_raw`、54/54、61/61、66/66、旧 ZIP 大小和旧 SHA-256 均已失效。

## 2. 当前项目状态

- 项目：Komari GlassOps
- 仓库定位：基于 `sanrokamlan-prog/komari-theme-Glassmorphism` 等社区开源项目，结合节点运维和监控需求继续开发的 Komari 主题。
- 当前主题版本：`1.0.0`
- 当前分支：`main`
- 当前工作树基线标识：`9c9a7ee-dirty`
- Komari 目标版本：`1.3.2`
- 主题设置协议：`komari-theme.json` 中为 `configuration.type=managed`
- 后台入口名称：`主题设置`
- 当前工作树存在大量已修改和未跟踪文件，这些都是持续开发成果，不是可清理垃圾。
- 当前没有提交、推送、打 Tag 或发布 GitHub Release。

强制边界：

- 禁止 `git reset`、`git clean`、`git checkout --` 或覆盖无关文件。
- 未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。
- 外层项目的 `sources/` 目录是只读参考，禁止编辑、移动或删除。
- 修改前先检查 `git status --short` 和相关文件 diff。

## 3. 当前最终导入包

文件：

`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`

当前已验证信息：

- 文件大小：9,154,969 bytes
- ZIP 条目：781
- SHA-256：`2546c25f88ba2655c700b62b0d0137964b6dfb7bcb465cdddf71cb63d18c88aa`
- 包内清单：`1.0.0 / managed / 主题设置`
- 包内存在：
  - `komari-theme.json`
  - `preview.png`
  - `preview-v1.0.0.png`
  - `dist/index.html`
  - `dist/admin-app/index.html`
- `preview.png` 与 `preview-v1.0.0.png` 均和 `docs/preview.png` 完全一致，SHA-256 为 `c993b3ff226ac62d91e1167c3beec48968cec662a54686ec426391dd558bd92e`。

注意：后续任何源码或预览图改动并重新构建后，以上大小和 SHA 都会失效，必须重新计算并更新本交接。

## 4. 已完成的主要能力

### 4.1 Komari 后台与主题设置

- 已适配 Komari 1.3.2 沿用的 `managed` 配置入口。
- 入口名称统一为“主题设置”。
- 设置项按基础与外观、首页布局、首页总览卡片、高级工具与隐私、节点卡片/列表与快捷控制、节点详情图表、自定义背景分组。
- 设置页具备吸顶标题/分类导航、滚动定位和唯一保存入口。
- 主题配置的读取、合并和完整保存已有 Playwright 覆盖。

关键文件：

- `komari-theme.json`
- `src/views/ThemeSettingsView.vue`
- `src/services/theme-settings.service.ts`
- `public/admin-app/`
- `scripts/sync-komari-admin.ts`
- `tests/visual/theme-settings.spec.ts`
- `tests/visual/admin-enhancement.spec.ts`

### 4.2 首页、宽屏和卡片布局

- 首页已适配桌面、宽屏、超宽屏、窄屏和移动端。
- 总览卡片会根据数量和可用宽度排列；偶数优先排满，奇数最后一行保持与上方同宽，不强行拉伸填满。
- 节点卡片支持 `mini / compact / comfortable / large`。
- CPU、内存、硬盘、流量和 TCPing 已使用深浅色适配的 Iconify 矢量图标。
- 快捷控制在窄屏下会收纳为下拉交互。
- 收藏、搜索、列表信息、离线置底、费用/隐私等配置已接入现有前端。

关键文件：

- `src/views/HomeView.vue`
- `src/components/NodeGeneralCards.vue`
- `src/components/NodeCard.vue`
- `src/components/NodeMetricLabel.vue`
- `src/components/NodeList.vue`
- `src/styles/main.css`
- `tests/visual/config-matrix.spec.ts`

### 4.3 TCPing 与悬浮预览

- 首页节点卡、mini 卡、列表、详情页和 Ping 弹窗使用统一的历史条带/图表悬浮逻辑。
- 首次加载或刷新后，即使鼠标没有再次移动，异步 Ping 数据到达时也会重放当前指针位置并显示预览。
- Tooltip 数值已按列右对齐。
- 图表固定后点击图表外可解除固定。
- 首页延迟任务支持选择、排序和一键置顶；mini 卡只读取配置中的第一个任务。

关键文件：

- `src/components/PingHistoryStrip.vue`
- `src/components/NodePingTaskRow.vue`
- `src/components/NodePingListCell.vue`
- `src/components/PingChart.vue`
- `src/components/PingMonitorDialog.vue`
- `src/components/HomePingSettingsDialog.vue`
- `src/composables/useHomePingTasks.ts`
- `src/composables/useNodePingDisplay.ts`
- `src/composables/useNodePingStats.ts`
- `tests/visual/features.spec.ts`

### 4.4 三种地球

#### realistic

- 使用卫星贴图、深浅色补光、国旗节点和公共流星组件。
- 地球尺寸同时受浏览器宽度和可用高度限制，尽量贴近顶部但不能裁切。

#### Cobe

- 使用真实 COBE WebGL 旋转地球，不是静态图片。
- 已实现同色系深浅色、点阵、经纬网、固定三维环形轨道、轨道行星、星芒、微粒和大气光晕。
- 三条轨道固定在地球三维坐标系，跟随自动旋转和手动拖动；只绘制正面半球路径，行星运行到背面后自然隐藏，转回正面后重新出现。
- 深浅色切换原位更新，不替换 canvas，避免短暂空白。

#### tiled

- 本地平铺世界地图，支持深浅色、国家/版块标注、地区聚合、在线/离线呼吸点、国旗/编号悬浮服务器清单和右侧地区列表。
- 密集节点使用全局候选位置计分，避让其他国旗、编号、节点原点和连接线。

关键文件：

- `src/components/NodeEarthRealisticGlobe.vue`
- `src/components/NodeEarthCobeGlobe.vue`
- `src/components/NodeEarthTiledMap.vue`
- `src/composables/useNodeGeoClusters.ts`
- `tests/visual/earth-renderers.spec.ts`

## 5. 当前公共紧凑弧线流星基线

这是当前最新且必须保留的实现结论：

- `src/components/EarthMeteorOverlay.vue` 是 realistic 与 Cobe 唯一流星渲染器。
- 两种地球只负责返回国旗当前屏幕投影，不得重新增加独立流星路径或 globe.gl 原生 meteor arc。
- 每组开始前冻结一个真实服务器目标；三束从三个明显不同的方向依次出发，并共同落到该目标。
- 每组最多 3 束，按随机顺序轻微错峰；单束飞行 3.2 秒。只有三束全部抵达并完全消失后，才允许进入下一组。
- 下一组开始时间同时受“上一组全部完成”和 5 秒组间基准约束，避免批次重叠。
- 路径是围绕地球的连续紧凑圆弧，不是散落短线；相较上一版超长弧，几何跨度和可见线束长度均已约减半。
- 每束由柔光层、1.6px 主线和细亮核心层叠加；主线虚线契约为 `0.6667 / 2`，相较上一版可见长度精确增加三分之一。
- 五段渐变从透明尾端过渡到服务器落点亮色。
- 飞行前段保持完整渐变头部、亮芯和柔和拖尾，透明度在抵达前不衰减。组件不再依赖 CSS 虚线偏移或整体淡出，而是逐帧输出三次贝塞尔曲线的真实可见区间 `[tailProgress, headProgress]`；头部到达后固定在目标，已进入目标的部分立即不再绘制，尾端继续向目标推进，到尾端也进入后才完全消失并报告完成。
- Cobe 旋转期间逐帧更新落点投影；目标即使在旋转中暂时离开正面可见区，只要投影仍有效，公共组件也不会提前清除该束流星。
- 深色与浅色只使用不同公共调色板，结构、粗细、时序和动画必须相同。

关键文件：

- `src/components/EarthMeteorOverlay.vue`
- `src/utils/earthMeteor.ts`
- `tests/visual/earth-renderers.spec.ts`

回归契约：

- `data-meteor-renderer="shared-svg"`
- 3 条 aura、3 条 main、3 条 core
- `5000ms / 3200ms`
- 同组 3 条路径共用一个冻结目标，进入方向保持明显分离
- 主线 `1.6px`，虚线 `0.6667 / 2`
- 五段渐变
- 82% 抵达目标，随后缩短尾部并在 100% 完全消失
- realistic/Cobe 计算后动画和笔触契约一致
- Cobe 换肤不替换 canvas，旋转后仍指向当前国旗

## 5.1 上游 3.3.1 / 3.3.2 修复映射

- 已逐提交审计上游 3.3.1 热修复。GlassOps 存在同类风险的部分已按当前架构整合：离开首页后停用卡片/列表 Ping 摘要订阅、最后一个订阅者离开时终止仍在飞行的指标请求、忽略无订阅者时迟到的返回值，并把首页摘要历史上限统一为 150 点。
- 上游多账期剩余价值被错误限制为最多一个周期的问题也已修复；GlassOps 现在保留全部完整剩余账期的价值计算。
- 上游 3.3.2 的主要变更是节点 CPU、内存、硬盘和流量图标。GlassOps 已有覆盖 CPU、内存、硬盘、流量和 TCPing 的 `NodeMetricLabel.vue`，且包含深浅色适配，因此保留当前更完整的设计，不移植上游重复标记。
- 新增浏览器回归覆盖首页请求 `max_points=150`、离开首页后请求中止、跨多个账期的剩余价值，以及五类指标图标。

## 5.2 Komari 1.3.2、流量校准与主题预览

- 已核对 Komari 1.3.2 Release、官方 API 文档、后台 client RPC 和路由源码。1.3.2 的变更集中在指标查询性能、内存分配、通知聚合、高 CPU 修复，以及 RAM/Swap 百分比计算，没有改变主题清单、managed 设置入口或前端读取契约；当前主题不需要追加兼容分支。
- 官方后台 client RPC 和路由中没有支持“校准累计流量”的写入方法或公开接口，因此按用户要求不制作一个无法真实保存的校准弹窗。若未来 Komari 增加正式接口，再在首页流量卡中接入。
- `docs/preview.png` 已重新设计为 1600×900 的导入预览：精确突出“主题自适应宽屏显示器、首页卡片自定义监控、三种地球样式优化、服务器详情页重构”四项特色。
- 预览图的底层氛围图只提供低干扰深色玻璃和地球光影；宽屏首页、三种地球、节点卡片和详情页均使用项目真实截图，并由 `docs/preview-source.html` 以可控蒙层、标签和真实中文合成，避免生成式文字或监控数据失真。
- Vite 打包会把该图同时写为 ZIP 根目录的 `preview.png` 和 `preview-v1.0.0.png`，两份文件已做字节级哈希核对。

## 5.3 节点标签、列表即时悬浮与 Ping 90 天范围

- “节点显示自定义标签”已从列表扩展到所有节点卡模式。当前方案不再把标签作为卡片中部独立内容块：`NodeTagChips.vue` 在服务器名称后提供单一标签图标，鼠标悬浮或键盘聚焦后一次显示全部标签。mini/compact/comfortable/large 和深浅色均使用同一交互；关闭开关或节点无标签时不保留图标或空占位。
- 列表信息栏的厂商、地区、ASN 和自定义标签已由浏览器原生 `title` 切换为项目内 `DataTooltip`。首次悬浮即时显示完整值，并移除了重复指针/鼠标事件。
- Ping 90 天异常的根因是前端因 `loss_approximate` 回退到旧 `common:getRecords`，而旧接口的 6000 条总上限会截短多任务长时间范围。现在只要新版指标同时具备延迟和丢包序列就使用 `public:queryMetrics` 的完整范围；图表仍聚合到最多约 480 个代表点，不会因为完整 90 天数据而直接绘制数千点。
- 新增回归验证 2160 小时请求、至少 2159 小时时间跨度、不调用旧 Ping 记录接口，以及上述四种标签和首次悬浮行为。

## 5.4 背面流星遮挡与上游 3.3.3

- realistic 与 Cobe 仍只使用一个公共 `EarthMeteorOverlay.vue`。覆盖层现在接收各自地球的遮挡圆和当前目标深度；目标进入背面时，地球圆内不可见的光束由 SVG mask 隐藏，地球外仍可见的部分继续运行并逐步完成落点吞入。目标节点从列表移除时整批立即作废，不再使用缓存屏幕坐标产生幽灵落点。
- Cobe 自动旋转、手动拖动和换肤时均刷新公共覆盖层；没有为两种地球分叉第二套流星动画。
- 上游 Glassmorphism v3.3.3 的免费节点文案问题已按 GlassOps 现有设计整合：`price = -1` 或“白嫖中”标签识别为免费；单节点只显示“免费”且不拼账期；单节点剩余价值显示“无”；总览汇总仍将其按数值 0 安全计算；卡片、列表、对比、详情和财务明细使用同一判断。
- 新增回归锁定名称旁标签图标、完整标签提示、背面遮挡、失效目标清理和免费节点文案契约。

## 6. 最近一次验证证据

最近一次源码状态已通过：

- ESLint（直接执行，无 `--fix`）
- Vue 类型检查
- Vite production build
- `git diff --check`
- Playwright 完整回归：76/76
- ZIP 完整性检查

最终导入包对应本轮源码与 76/76 回归：9,154,969 bytes、781 个 ZIP 条目，SHA-256 为 `2546c25f88ba2655c700b62b0d0137964b6dfb7bcb465cdddf71cb63d18c88aa`；包内无 `.map` 文件，并已复核两份预览图、前台入口和内嵌后台入口。

完整回归覆盖：

- managed 主题设置
- 桌面、宽屏、超宽屏、窄屏、移动端
- 四种节点卡尺寸
- 四种节点卡尺寸的名称旁标签图标、完整悬浮清单与关闭开关
- 列表信息栏首次即时悬浮
- 首次异步 Ping 悬浮
- Ping 90 天完整指标范围
- 总览卡整卡悬浮
- 指标图标
- realistic/Cobe/tiled 深浅色
- 公共紧凑弧线流星及落点吞入式收尾
- 流星目标位于背面时的地球遮挡与失效目标清理
- Cobe 换肤、旋转跟随、固定三维轨道和正反面遮挡
- tiled 密集节点避障

测试期间 `/api/rpc2` 的 `ECONNREFUSED` 日志来自“后端暂不可用、异步数据随后到达”的首刷悬浮测试场景；对应测试通过，不应单独视为产品故障。

生产构建仍会出现两类已知非阻断提示：

- VueUse 的 PURE 注释位置提示
- globe / ECharts 大 chunk 提示

## 7. 推荐验证命令

先通过 Codex 工作区依赖工具取得 Node 和 pnpm 路径。当前桌面环境如果没有自动配置 Node，直接执行 `pnpm` 会出现 `env: node: No such file or directory`，这不是项目代码错误。

在仓库根目录运行：

```bash
pnpm exec eslint .
pnpm exec vue-tsc --noEmit
pnpm run build
pnpm exec playwright test
git diff --check
```

注意：

- 不要用带 `--fix` 的 lint 做只读验证。
- Playwright 会在 `127.0.0.1:4173` 启动本地预览，沙箱环境可能需要授权监听本机端口。
- 仓库部分早期说明仍写着“没有测试套件”，该描述已经过时；当前 `tests/visual/` 和 `playwright.config.ts` 是有效回归基线。

产物复核：

```bash
unzip -tq komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip
stat -f '%z bytes' komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip
shasum -a 256 komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip
unzip -Z1 komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip | wc -l
```

## 8. 仍未完成或必须在真实环境确认

本地自动化通过不等于真实 Komari 环境已验收。下一轮优先检查：

1. 在真实 Komari 1.3.2 中覆盖导入当前 ZIP，并执行硬刷新。
2. 确认后台“主题设置”在 Komari 原生右侧内容区稳定加载、保存和重新打开。
3. 验证 Komari 顶部深浅色、颜色风格和语言切换对 managed 设置表单的真实影响。
4. 在 Chrome、Safari 和实际显卡下观察 realistic/Cobe 流星：
   - 是否始终三束成组
   - 是否从三个不同方向依次射向同一个冻结目标
   - 是否为连续、克制的弧线而非超长粗线或散落短线
   - 头部抵达后尾巴是否逐步缩短并被落点吞入
   - 上一组三束全部消失前是否不会开始下一组
   - 是否准确抵达国旗
   - Cobe 长时间旋转后是否仍跟随
   - 深浅色下是否都清楚且不刺眼
5. 使用真实节点经纬度检查 tiled 密集区域：
   - 国旗/编号不遮挡节点位置
   - 引线不穿过其他国旗
   - 国旗、编号和右侧地区卡悬浮清单正确
6. 观察真实 RPC 首次加载和刷新后的 Ping 悬浮反馈。
7. 用户确认视觉和真实环境均通过后，才进入正式提交、Tag 和 Release 阶段。

## 9. 后续修改原则

- 先复现用户截图对应的视口、主题、地球模式和卡片尺寸，再修改。
- 视觉问题要同时验证深色、浅色和至少一个宽屏/窄屏组合。
- 地球改动必须同时检查节点卡遮挡、控制按钮、在线状态和页面纵向空间。
- 流星修改只改公共组件或公共参数，不允许在 realistic/Cobe 内分别实现。
- Ping 悬浮问题必须覆盖“首刷鼠标不移动、数据异步到达”的场景。
- 后台设置新增字段必须同时更新：
  - `komari-theme.json`
  - 主题设置归一化/默认值
  - 设置服务和 UI
  - Playwright 配置保存测试
- 任何重新构建都会覆盖现有 ZIP；构建后重新记录大小、条目数和 SHA。

## 10. 新任务可直接使用的接管提示

```text
请继续接管同目录的 Komari GlassOps 工作树：
/Users/williamm/.codex/.chatgpt-projects/g-p-6a5dc7f64dc48191a1a5d54905dc0164/komari-glassops

开始前完整阅读 AGENTS.md、AIAGENTREADME.md、src/AGENTS.md、AICACHE.md 最后一节和 docs/handoff-2026-07-30-next-task.md。以该交接为最新基线；旧的 raw 配置、旧回归数量和旧 ZIP 校验和均已失效。

当前清单为 1.0.0 / managed / 主题设置；当前包为 komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip，9,154,969 bytes、781 个 ZIP 条目，SHA-256 2546c25f88ba2655c700b62b0d0137964b6dfb7bcb465cdddf71cb63d18c88aa；最近完整回归 76/76 通过。

工作树包含大量未提交改动：禁止 reset、clean 或覆盖无关文件；未经我明确授权，不提交、不推送、不打 Tag、不发布 Release。先建立上下文并等待我发送下一轮实际问题，不要主动修改文件。
```
