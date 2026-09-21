# AI Cache / Agent Handoff Log

> 这个文件给 AI 编程代理和二开维护者使用，用来保存任务计划、执行日志、验证结果、风险点和交接信息。它的目标是防止断网、会话丢失、上下文被压缩后无法继续工作。

## 使用规则

- 开始多文件、架构、安全、发布、迁移类任务前，先新增或更新“当前任务”。
- 开发中按时间追加“执行日志”。
- 结束前必须更新“验证记录”和“交接说明”。
- 不要写入密钥、token、cookie、服务器密码、私有用户数据。
- 如果记录过期，直接标注“已完成/已废弃”，不要让后续 AI 误判。

## 当前任务

- 状态：release-ready（v1.0.10 适配完成；发布状态须以 GitHub PR、Actions 和 Release 实时结果为准）。
- 目标：保留 1.4.3 后台，新增固定来源的 1.5.0-fix1 后台；版本选择与直达入口均验证后端版本，未知版本回退官方后台。
- 范围：后台资产、精确版本选择、入口保护、兼容回归、发布说明；首页、历史统计与服务器配置保持不变。
- 基线：远端 main / v1.0.9 为 `6e40150`，独立分支 `agent/komari-1.5-compat-v1.0.10`；原工作树中的博文、素材及审查记录不纳入发布。
- 授权：用户明确要求“继续适配，弄好上线主题新版本”；验证通过后按分支/PR 流程合并并验证 Release。
- 验证：代码规范、类型检查、生产构建、ZIP、完整浏览器回归，以及可行的隔离真实后端联调；生产 VPS 和 Agent 不在本轮操作范围。

## 执行日志

### 2026-09-21 GlassOps v1.0.10 双版本后台适配收口

- 复核 GitHub：Komari 仍为归档状态，最新正式版仍为 `1.5.0-fix1`；GlassOps 远端 main / v1.0.9 仍为 `6e40150`，上次未发布。
- 固定 Komari Web `3324844cfa347f18c83435f1ccf5634df7e5b768`，新增 `admin-app-1.5`，保留 1.4.3 的 `admin-app`。首页按精确版本选择，两个静态入口均先检查版本再启动应用；不匹配、查询失败或超时回到官方后台。
- 新后台包含终端工作区、会话恢复和远程文件工作台，移除失效的内置流量定时报告入口；不改变首页和历史指标行为，不升级生产后端或 Agent。
- 上次联调失败来自未展开节点菜单。重建官方后端标签源码的隔离测试环境，真实上传、启用、设置保存读回和工作台加载均通过；新增可重复运行的 `scripts/verify-komari-admin.mjs`。
- 上游生成的编辑器和语法资源含模板字符串/样式的原有行尾空白，保留原样；自有源码的 diff 空白检查通过。
- 截图复核发现通用 `aside` 样式影响新版深色编辑器侧栏；将其限制在后台布局内，增加实际颜色断言，保留编辑器自身配色。
- README、CHANGELOG、Release 说明和版本预览同步到 v1.0.10；原工作树未提交博文及素材保持不动。

### 2026-08-27 Metric 历史聚合粒度与日桶时间显示优化

- 已完整读取根目录与 `src/` 作用域规则、AI 开发手册和本文件，并核对实时 Git 状态、现有 Playwright 结构及 Komari 当前后端源码。
- 后端复核确认：`public:queryMetrics` 默认 500 点并按范围选择标准间隔，再由可用 rollup 层提升兼容间隔；响应序列包含 `downsampled`、`interval_seconds`、`max_points`，日桶时间以 UTC 返回。前端 PingChart 和 LoadChart 都保留元数据但未用于解释时间显示。
- 自定义范围使用 `datetime-local`，前端把用户选定的准确开始/结束时刻原样转成 ISO，并按同一闭区间裁剪；没有发现自动漏掉结束日的代码证据，因此不扩大结束边界。
- 新增共享聚合信息解析与 UTC 日桶日期格式化：仅在服务端明确返回 `downsampled=true` 且 `interval_seconds` 有效时显示分钟、小时或日聚合；不重算、不平滑、不替换后端数值。PingChart 与 LoadChart 都显示“每点为该统计区间平均值”的提示；日聚合横轴改为统计桶日期，tooltip 标题为 `YYYY/MM/DD · 日聚合`，不再把 UTC 桶起点渲染为本地 `08:00`。
- LoadChart 将普通负载历史和独立 Ping 序列的聚合上下文分开传递；旧负载记录回退不会被 Ping 的聚合元数据误标。回归夹具可模拟 `interval_seconds=86400` 和 UTC `00:00` 日桶，并同时验证 LoadChart 提示、PingChart 提示、日桶范围与 tooltip 不含 `08:00`。
- 最终验证：全仓 ESLint、`vue-tsc --build`、Vite production build、`git diff --check` 均通过；相关 Chromium 回归先以 6/6 通过，随后完整 Playwright 100/100 通过，覆盖配置矩阵、地球渲染、历史负载回退、普通 Ping tooltip、首次异步 hover、90 天 Metric 范围、新增日聚合场景、主题设置与视觉快照。构建只保留既有 VueUse PURE 注释和大分块非阻断提示；本机无 Bun，使用锁文件完全相同的既有依赖直接执行等价工具，未改 `package.json` 或 `bun.lock`。
- 发布资料已按 GitHub 当前 README 的相同结构更新到 v1.0.9：保留“当前版本”表格和新到旧版本日志格式，同步 `CHANGELOG.md`、`docs/release-v1.0.9.md`、预览源、1600×900 的 `preview.png` 与 `preview-v1.0.9.png`。两份预览 SHA-256 均为 `99f043386077a88ca6bf751844d5b7d782ebc2015303024e9cc04b654c4536ec`。
- v1.0.9 本地测试包：`komari-glassops-v1.0.9-build-add14fa-dirty.zip`，9,349,554 bytes，812 个条目，SHA-256 `95cfd714cb59fdbe7777b14cf30f0abb27b546dcb67bc8d96beaa62a99645d28`。压缩数据完整且无 sourcemap，包内清单为 `1.0.9 / preview-v1.0.9.png`，包含两份字节一致的预览和 `dist/`。本哈希取代本节此前 v1.0.8 本地测试包；合并后 GitHub Actions 会按干净提交 SHA 重新构建正式资产，文件名和哈希将不同。真实 Komari 导入后的 90 天和自定义跨月显示仍需用户验证。

### 2026-08-14 GlassOps v1.0.8 Komari 1.4.3 兼容与数据请求优化

- 使用 Komari Web `1.4.3` 标签源码的锁定依赖完成正式构建，并将完整管理端资源同步进主题；移除旧的 DOM 增强脚本，保留 GlassOps 样式和路由桥接。管理端来源固定到提交 `4a74e8a81e2e4b1c3da8ad795f9523151efb6b56`。
- 后台入口增加精确版本门控：后端仅返回 `1.4.3` 或 `v1.4.3` 时进入主题内嵌后台；未知、请求失败、超时、带后缀或其他版本均回退 Komari 官方 `/admin`，不猜测兼容性。
- 详情负载图在 Metric 返回其他指标但缺少有效 CPU 历史时，保留已有序列并调用兼容记录接口补齐 CPU；所有实时数值增加有限数过滤，避免无效值进入历史图。
- 详情 Ping 卡片按后台任务列表的返回顺序排列；未识别任务稳定置后。首页相同时间范围、点数和可见节点的 Ping Metric 请求以 20 节点为一批合并，缺失或失败时继续逐节点 Metric、再旧记录回退；离开首页后的迟到结果不再触发无效更新。
- 主题清单、README、更新记录、Release 说明和 1600×900 预览图已更新至 `v1.0.8`；发布说明只描述 GlassOps 本次修复与功能。
- 本地验收：源代码和文档 ESLint、`vue-tsc --build`、Vite production build、`git diff --check` 全部通过；Chromium Playwright `99/99` 通过。构建只保留既有 VueUse PURE 注释与 globe 大分块提示。
- 发布前边界：现阶段结论来自虚构固定数据和本地浏览器；真实 Komari 导入启用、Safari、不同 GPU 和长期运行仍需要独立验证。既有未跟踪博文素材与 v1.0.6 交接文件保持未改、不会纳入提交。

### 2026-07-28 GlassOps 地球高度自适应、窄屏控制与原生后台入口收口

- 根因确认：realistic 此前只按宽度在 1440px 以上固定使用 `translateY(-17%) scale(1.12)`，短宽窗口也被大幅上抬；现改为宽高联合断点，1440px 以上且高度不超过 1100px 时使用较低的 `translateY(-8%) scale(1.12)`，高窗口继续保留 `-17%`。cobe 新增统一舞台容器并复用完全相同的移动、缩放和断点，节点国旗、光效与画布同步变换。
- 首页控制区改成左右两端同一网格行；1120px 以下把快捷按钮折叠为带数量的可操作下拉筛选，520px 以下隐藏高级工具图标组，保留分组、筛选、卡片/列表和搜索核心操作。控制条与视图按钮顶部误差回归不超过 2px，控制条到底部首张节点卡间距收紧到 12px 内。
- 主题清单的 redirect 入口改为 `/admin-app/index.html?__komari_route=%2Fadmin%2Ftheme_managed`：先加载主题包内完整 Komari 后台，再由既有桥接恢复官方 `/admin/theme_managed` 路由。设置页因此使用原生后台导航与管理框架，不再默认进入首页外壳中的独立仿后台页面。
- 原生主题管理增强继续保留顶部标题/保存区与分类标签双层吸顶、点击定位、滚动选中和底部重复保存隐藏；七类标题与页签统一使用同一 primary 色，增大标签、标题和说明字号。应用主区域从双轴 `overflow-hidden` 改为仅横向裁切，独立设置页保留为兼容回退时也能正常 sticky。
- 视觉人工复核：1920×900 realistic 与 cobe 的容器宽高、顶部坐标和 CSS 变换矩阵一致；短宽 realistic 地球不再顶到页面顶部；1024px 与 390px 的快捷筛选为单行下拉，节点卡上移且无横向溢出。唯一合理变化的手机首页截图基线已更新。
- 最终验证：全量 ESLint、`vue-tsc --build`、Vite production build、`git diff --check` 全部通过；Chromium 50/50 通过，新增原生后台 redirect 恢复、统一分类颜色、窄屏快捷下拉/对齐/间距以及 realistic/cobe 几何一致性测试。构建仅保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 最终本地测试包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`，8,133,872 bytes，SHA-256 `133dadd9a9df205165b71f67ae0ec8c4d95a5db1335b45ec5180294f5cc4f075`；压缩数据完整，包内版本 `1.0.0`、原生后台 redirect、`preview.png`、`preview-v1.0.0.png` 与 `dist/` 已核对。后台增强 CSS/JS 在源文件、`public/admin-app` 和 `dist/admin-app` 三处 SHA-256 一致。
- 边界：没有提交、推送、打 Tag 或发布；真实 Komari 登录态中的设置保存、实际超宽/分屏浏览器和 iPhone/iPad Safari 仍建议用本测试包做最终实机确认。

### 2026-07-28 GlassOps 真实设置入口、三种地球与 tiled 布局收口

- 复盘确认上一轮标签页只在主题包内的 `admin-app` 增强夹具生效，未覆盖 Komari 强制使用内置默认主题处理 `/admin` 的真实路径；本轮不再把隔离夹具当成端到端结论。
- 主题清单改用 Komari 官方 `redirect` 配置入口 `/?glassops-settings=1`；应用仍严格保留首页和节点详情两条公开路由，由应用壳层切换主题自有设置模式。设置页读取包内 7 类、46 项 schema，顶部保存与分类标签吸顶，分类点击定位、滚动跟随、页面底部最后一类正确激活，保存前读取并合并最新完整设置后再整份提交。
- tiled 模式把总览卡片完整放在地图上方，并按数量平衡每行 1–4 张；6 张固定为 3+3 且两行铺满。地图与右侧地区节点列表采用 3:1 桌面布局，地区多时面板独立滚动，窄屏自动上下堆叠。
- realistic 宽屏使用分段位移/缩放抬升球体，1440px 以上为 `translateY(-17%) scale(1.12)`；在线状态不随画布错位。深色模式增加淡蓝到靛色、由近至远衰减的外缘光晕，保持地理纹理可读。
- cobe 点阵亮度、基础亮度和漫反射继续下调；暖黄、青绿、靛蓝、柔粉以低透明度 color blend 分区染色，减少纯白点刺眼感，节点标记与光轨同步降亮。
- 最终验证：针对性 ESLint、`vue-tsc --build`、Vite production build、`git diff --check` 全部通过；Chromium 47/47 通过，新增真实 redirect 清单契约、设置页 8 标签/单保存/滚动联动/完整合并保存、tiled 六卡片 3+3 与 12 地区密集列表测试。构建只保留上游 VueUse PURE 注释和既有 globe 大分块提示。
- 最终本地测试包仍为 `komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`，SHA-256 `df0daaf197624cbd7df8dd4ec7fc214ffab1311117c12a747e51660233478bd1`；包内版本 `1.0.0`，redirect 入口、7 类/46 项 schema、`preview.png`、`preview-v1.0.0.png` 与 `dist/` 已核对。
- 边界：没有提交、推送、打 Tag 或发布；真实 Komari 登录态的保存写操作、真实节点地理数据与 iPhone/iPad Safari 实机仍需用户导入测试包后复核。

### 2026-07-28 GlassOps 宽屏布局、后台吸顶分类与 v1.0.0 测试包收口

- 管理端入口已切换到当前增强资源哈希：`glass-admin.css?v=c37fcb78af51`、`glass-admin-enhancements.js?v=9ce2661cd0c5`；源文件、`public/admin-app` 与最终 `dist/admin-app` 三份 CSS/JS SHA-256 完全一致。
- 后台隔离夹具实测：仅 1 个保存按钮可见；“全部设置 + 7 个实际分类”共 8 个标签完整生成；点击分类可定位并高亮；滚动回顶部自动切回“全部设置”；标题、保存按钮和分类栏在滚动后保持吸顶。
- 应用外壳、头部和页脚采用 `w-full + 2200px` 可读宽度上限。1920px 的 compact 卡片稳定为首行 5 张、单卡约 365px；1800px 以上按 `mini 330 / compact 350 / comfortable 410 / large 450px` 最小宽度分档，并同步放大标题、国旗、内边距与卡片间距，未扩大普通桌面和移动端。
- 1920px 实际截图人工复核：总览区、在线状态、地球和快捷控制没有互相遮挡；节点卡信息完整、长名称正常省略；宽屏空间得到利用但没有无限拉伸。2560px 继续受 2200px 上限约束。
- 修正视觉测试夹具缺失访客 `ip` 字段导致的假性失败，夹具继续只使用文档保留地址；只更新了两张已人工确认、因 compact 卡片显示 TCPing 区域而合理变化的桌面截图基线。
- 最终验证：针对性 ESLint、`vue-tsc --build`、`git diff --check`、生产构建全部通过；Chromium 40/40 通过，覆盖 320/390/1024/1280/1440/1920/2560、四种卡片尺寸、三种地球、亮暗模式、列表/详情与收藏、搜索、TCPing 等核心交互。构建仅保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 最终本地测试包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`，8,121,956 bytes，SHA-256 `7d8f7cfa3e13d5c0570e412f83da86bf195563cdbf19eaee803c9e724dc44a05`；压缩数据完整，包内版本 `1.0.0`，包含 `komari-theme.json`、`preview.png`、`preview-v1.0.0.png` 与 `dist/`。
- 尚未执行：真实 Komari 导入后的主题保存写操作、真实节点数据下的多浏览器联调、iPhone/iPad Safari 实机检查，以及 Git 提交、GitHub 推送、Tag 和 Release。

### 2026-07-27 GlassOps 选择性同步上游 v3.3.0 与图表外部解锁

- 上游核对：`v3.2.0..v3.3.0` 共 3 个提交，本地基点 `9c9a7ee` 已含前 2 个；仅拆解并选择性移植发布提交 `7d2c7e1`，没有 merge/cherry-pick，也没有覆盖当前 GlassOps 首页和详情布局。
- 已加入本地持久化节点收藏、首页收藏快捷筛选、卡片/列表/详情收藏按钮；详情页增加上一台、下一台和下拉节点切换。增强搜索支持名称、地区、IPv4/IPv6、IPv4 `x/*` 通配、CPU/GPU、UUID、系统、架构、标签、分组与多关键词。
- 已加入最多 4 台节点实时横向对比；超过 30 台的卡片网格使用视口附近优先、空闲回填的延迟渲染；健康工具增加综合异常排行。
- 已同步 Metric `tags > tag > labels` 优先级、稳定 tag key 与 Ping 任务权重顺序；详情 CPU 提供外部 CPU Mark 查询，不展示未经节点实测的绝对跑分。
- 移动端访客条在滚动时暂时隐藏并对长 IPv6 截断；返回顶部按钮延后至滚动 320px 后显示。Ping Tooltip 固定后，单击图表区域外立即解除；图内换点、解除按钮和 Esc 继续保留。
- 上游“7 场景”确认为视觉回归场景而非七套视觉皮肤。已建立 GlassOps 自有虚构数据基准：桌面/手机、亮/暗、卡片/列表、色觉友好、三种地球布局与详情页；同时加入收藏、搜索、详情切换和图表外部解除 4 项功能回归及 GitHub Actions。
- 验证：全量 ESLint、`bun run type-check`、`bun run build`、`git diff --check` 通过；Playwright 11/11 通过（7 个截图 + 4 个交互）。截图人工复核未发现页面级横向溢出、字体不可读或新增错位。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，7,333,762 bytes，SHA-256 `869eb61f6660306393ad304e4ef46e5c54135b7c343a7f7418183ce6c4b52602`；ZIP 完整性通过，包内版本仍为 `0.1.0`，默认主题 `dark`、默认卡片 `compact`。

### 2026-07-27 GlassOps 多任务 Tooltip 固定与滚动交互（M4.2）

- 根因确认：`enterable` 只保证鼠标进入 Tooltip 后可交互，鼠标从图表时间点移向 Tooltip 途中仍会触发 ECharts `mousemove`，导致时间点和 Tooltip 位置连续变化，内部滚动条难以抵达。
- 保留普通悬浮跟随，并新增图表时间点固定：单击图表绘图区后按当前横向位置锁定数据索引，Tooltip、上下联动竖线和丢包/延迟数据保持不变；固定状态下单击其他时间会移动固定点。
- Tooltip 顶部在未固定时显示“单击图表固定后滚动”，固定后显示“已固定 · 解除”按钮；桌面可用按钮或 Esc 解除，触屏可直接点按图表固定并点按钮解除。
- 任务明细滚动区增加稳定滚动条槽和滚轮事件隔离；固定后可以把鼠标移入提示框，用滚轮或拖动滚动条查看后续任务，不会改成另一个时间点。刷新、时间范围或节点数据失效时会主动解除，避免固定到过期索引。
- 浏览器暗色 10 任务实测：普通悬浮出现固定提示；单击后显示固定状态；鼠标移入任务区并滚动到最后一项时，时间仍保持 `23:52:50`，上下联动竖线未漂移。浏览器策略随后阻止继续使用该本地地址，因此解除按钮、亮色与窄屏采用代码路径复核；真实 Komari 和移动 Safari 仍为最终验收边界。
- 代码验证：组件 ESLint、`vue-tsc --build`、Vite production build 与 `git diff --check` 通过。构建仅保留上游 VueUse PURE 注释和既有 globe 大分块提示。

### 2026-07-26 GlassOps Tooltip 对齐、丢包红色阶与毛玻璃预设收口（M4.2/M5.2）

- 延迟详情 Tooltip 的聚合丢包率和逐任务丢包率改用同一套四列 CSS Grid；聚合行补齐延迟占位列，摘要和可滚动任务区使用一致右内边距，滚动条在预留区内覆盖，因此两部分百分比保持同一右边界。
- 丢包色阶按亮暗背景分别定义。暗色从浅玫红逐级过渡到高饱和亮红，100% 不再落入接近黑色的暗红；亮色使用从中等玫红到深酒红的阶梯。0% 继续使用绿色，未知值继续使用中性灰。
- 延迟 / 负载选中态不增加闭合边框，改用更明显但低饱和的语义强调背景、同色阴影和独立前景色。浏览器验证亮色为深色强调文字，暗色为高可读薄荷绿文字；切到“负载”后状态正确转移。
- 保留用户已认可的“翡翠”。“柔和”重做为暖紫灰中性色板，“高对比”重做为石墨黑白色板，“午夜”重做为深海蓝色板；每套分别定义亮暗卡片、控件、标题层、主/次文字、边框与阴影，不使用简单反色。
- 静态对比度检查：三套新预设的亮暗主文字与次文字在合成卡片背景上的组合均高于 4.5:1；浏览器逐套检查桌面亮暗首页，文字、数值、进度条和控制项可辨识。午夜亮色额外在 390×844 视口验证，无页面级横向溢出，节点卡信息保持完整。
- 详情交互验证：亮暗 Tooltip 首次悬浮可见；聚合率与任务率右对齐；高丢包文字和方格在暗色背景清晰；延迟 / 负载选中态明确。测试结束后 3.6 秒观察窗口内无新增 warning/error；此前 mock 端口切换产生的旧 `Poll RPC HTTP 500` 不属于产品异常。
- 代码验证：涉及文件 ESLint、`vue-tsc --build`、Vite production build 和 `git diff --check` 全部通过。构建仅保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，7,326,223 bytes，SHA-256 `3773478d24438b9f491789c33addddef7860e0acde7107fa064929a28252b8c2`；顶层仅含 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `0.1.0`、默认主题 `dark`、默认卡片 `compact`。

### 2026-07-26 GlassOps Ping 悬浮根治与详情时间轴统一（M2.1/M4.2）

- 根因修正：首页普通/mini Ping 条此前依赖卡片级指针委托、父层坐标反算和路由/弹窗后的事件重放；KeepAlive、异步数据替换、页面缩放或卡片尺寸变化后，旧坐标与新 DOM 容易失配。现改为每个真实采样格直接接管 `pointerenter/pointermove`，Tooltip 由该格自身的实时边界定位；数据替换、激活和 resize 只负责恢复当前指针下的真实格，不再合成或重放指针事件。
- 详情图采用上下两个共享时间类目的网格：顶部为丢包率圆角方格，底部为延迟曲线；两条横轴使用同一时间桶、同一轴指针和联动提示。图表数据或弹窗尺寸变化后使用非合并更新并主动 resize，首次打开无需先切换时间范围。
- 丢包轨道显示点目标随范围单调增加：1 小时 60、6 小时 96、12 小时 128、1 天 160，长期按对数增加并在 90 天约为 420；只有后端真实样本超过上限时才按连续时间桶聚合，不插值、不制造缺失点。延迟按有效样本平均，丢包按样本数加权。
- 详情“延迟 / 负载”选中项移除闭合强调边框，改为轻微背景与阴影区分；暗色、亮色均完成浏览器检查。
- 浏览器冷启动回归：默认 compact 刷新后不切 4H/1H 即可悬浮显示时间和值；首次打开延迟详情即可出现联动提示；竖线从顶部丢包方格贯穿到延迟曲线且同列；关闭弹窗后切换另一服务器仍可悬浮；mini 刷新后直接悬浮通过；1/6/12/24 小时与 90 天密度逐级增加。
- 为切换 mock 的 `compact / mini` 配置，本轮中途主动重启了本地模拟接口；这段停机窗口使浏览器日志留下预期的 `Poll RPC HTTP 500 / ECONNREFUSED`，不属于主题运行异常。最终交互未出现 Vue/ECharts 异常。真实 Komari 后端、iPhone/iPad Safari 和用户的大屏/分屏环境仍是最终验收边界。
- 代码验证：ESLint、`vue-tsc --build`、Vite production build、`git diff --check` 和 ZIP 解压测试通过。构建仅保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，7,325,981 bytes，SHA-256 `bc751089e0965b6a316b2cde4ebd3c64191ae2c0c4971c7cd50b1e0c5539c4d3`；顶层仅含 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `0.1.0`、默认主题 `dark`、默认卡片 `compact`。

### 2026-07-26 GlassOps 对齐、三态主题与 Ping 悬浮生命周期收口（M4.2/M5.2/M2.1）

- 详情图的“丢包率 (%)”与“延迟 (ms)”改为同一左边距的独立文字图元；上下两套类目轴统一 `boundaryGap`，顶部丢包方格恢复鼠标事件，因此从方格或下方曲线进入都使用同一个时间桶、同一条竖向十字线和同一份联动提示。
- 提示中的聚合率、延迟和逐任务丢包值采用固定数值列并右对齐。丢包色阶重标定为 0% 纯绿、1/3/10/25/50/75% 分级红；11% 落入中等红而非深红，高于 50% 才增加轻微光晕。首页与详情沿用一致阈值。
- 非 mini 卡片头部改为两行三列：国旗跨两行，名称与在线状态在首行左右对齐，完整系统名/架构在次行，V4/V6 靠右；较长系统名只缩小字号，不再被 V4/V6 挤成省略号。
- 顶部主题按钮恢复 `auto / light / dark` 三态。自动模式使用 `brightness-auto` 图标并跟随后台托管主题；循环顺序根据自动模式当前实际明暗动态决定，首次点击一定产生可见切换，再依次经过另一手动模式并回到自动。
- 普通 TCPing 任务的悬浮状态增加卡片级指针变化监听、KeepAlive `activated/deactivated` 清理与重放、尺寸变化重放以及延迟弹窗关闭后的显式重放。冷加载、详情路由返回、关闭延迟弹窗和分栏尺寸变化不再依赖切换 4H/1H 才恢复。
- mini 延迟/丢包摘要改为整块委托悬浮，数据更新、窗口尺寸变化和延迟弹窗关闭后均按最后有效指针位置重放；继续显示真实采样点的时间和值。
- 方格密度不做视觉插值：每格仍对应后端返回的真实时间桶。采样间隔更短、有效桶更多时会更密集；接口点数上限、历史保留时间和缺失桶仍决定最终数量。
- 浏览器回归：默认暗色 compact 冷加载、延迟弹窗关闭后自动恢复 `16:54:33 / 155 ms` 提示；详情顶部丢包方格可直接悬浮，竖线与方格同列，10 个任务提示可滚动且数值右对齐；三态主题在托管深色与托管浅色下首次点击均立即变色；mini、comfortable、large、亮色列表和详情往返均可正常加载。最终浏览器 console 无 warning/error。
- 手机边界：本轮浏览器环境不能切换真实视口；保留上一轮 390×844 无页面级横向溢出的实测基线，并静态复核本轮头部使用 `minmax(0,1fr)`、字体分档和可换行/横向滚动控制，未新增固定页面宽度。真实 iPhone/iPad Safari 仍需安装包复测。
- 代码验证：ESLint、`vue-tsc --build`、Vite production build 和 `git diff --check` 通过。构建仅保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，7,324,659 bytes，SHA-256 `9787ee1cb5cbc6bda42099304023f976d518a1514291c90c44d24b1aeaea4830`；顶层仅含 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `0.1.0`、默认主题 `dark`、默认卡片 `compact`。

### 2026-07-26 GlassOps 卡片尺寸与专业延迟控制收口（M4/M5）

- 默认 `compact` 卡片的非 mini 正文主要统一为 12px：节点名 15px、TCPing 标题 13px，CPU、内存、硬盘、流量、连接数等标题仅用中等字重区分；百分比、容量和连接数不再跟随标题放大。
- 累计流量与续费信息继续使用两枚并排横向摘要块，并把左侧标题宽度压到 32px，标题、图标、行距、内边距统一收紧；BWG 和 SFO 的上下行累计值、价格周期与剩余天数均可完整显示。`mini` 继续使用原高密度摘要卡，`comfortable / large` 保留完整字段。
- 首页 Ping 历史悬浮改为卡片级指针位置下发、任务整行坐标映射和数据/尺寸更新后的动画帧重放；冷刷新后无需切换时间范围，在任务文字区或历史条上都能显示对应时间点和值。
- 详情延迟工具栏移动到时间范围与全选按钮之间；桌面三段对齐，窄屏将五个控制项放在独立横向滚动行。按钮通过 `aria-pressed`、状态点、底色和边框共同表达选中状态，明暗主题均可辨识。
- 按用户新稿撤销图表下方逐任务丢包状态带，在延迟图顶部增加一条聚合丢包断点线：每个时间桶对应一个测试点，0% 为纯绿色，正丢包按比率使用逐级加深的红色，缺样本为灰色；聚合率按同一时间桶中当前选中任务的有效样本数加权。
- 延迟图悬浮提示同时列出该时间的聚合丢包率，以及每个已选任务的延迟和独立丢包率；首页任务丢包历史格使用相同绿/红强度语义，悬浮继续显示精确时间与丢包率。削峰与断点连线仍只处理延迟曲线。
- 浏览器验证：默认暗色 `compact` 冷刷新后首次悬浮直接显示 `HH:mm:ss + ms`；详情聚合断点线可开关，红色测试点可联动显示聚合率和逐任务延迟/丢包；削峰/断点连线选中与复位正确；主题按钮单击切换；亮色详情、390×844 首页与详情无页面级横向溢出。
- 尺寸验证：`mini / compact / comfortable / large` 桌面均无页面级横向溢出；compact、comfortable、large 的摘要块保持双列且内容完整，mini 保持旧版信息范围。新代码加载后图表交互日志无 warning/error。
- 代码验证：ESLint、`vue-tsc --build`、Vite production build 和 `git diff --check` 通过。构建仅保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，7,311,043 bytes，SHA-256 `89d6be94823a0272294ee53933224da7136b080fde308d54c6715f3e70044341`；顶层仅含 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `0.1.0`，默认主题 `dark`、默认卡片 `compact`。

### 2026-07-26 GlassOps 丢包方格轨道与首页连接数精简（M5.1/M4.1）

- 详情延迟图使用独立的顶部丢包坐标区：标题为“丢包率 (%)”，每个时间桶渲染一个紧凑圆角方格；0% 为纯绿色，正丢包按比率加深红色并给异常点轻微光晕。下方延迟坐标和曲线保持独立，不再用圆点串或图外状态带。
- 提示框的聚合丢包标识由虚线段改为单个同色圆点；时间和聚合率固定在顶部，任务明细最大高度 160px，超过约 7 行后在内部纵向滚动。10 个任务时默认从第一项开始，滚动后可查看后续任务，顶部聚合摘要不移动。
- 两套 ECharts 网格、横轴和纵轴始终保留，只切换丢包方格数据和主图顶部间距；为延迟与聚合序列增加稳定 id，修复连续关闭/打开“显示丢包”时的坐标系合并异常。最终新开页面连续切换后浏览器无 warning/error。
- 首页非 mini 节点卡移除 TCP/UDP 连接数整行。该值表示节点当前会话数而非 TCP Ping 任务数量；首页缺少基线和趋势时诊断价值有限，详情“负载”页的可选连接数趋势和全局可选概览能力继续保留。
- 浏览器验证：暗色桌面 4 项与 10 项任务、红绿方格轨道、单圆点聚合标识、任务列表滚动、开关往返通过；亮色和 390×844 手机详情无页面级横向溢出，手机图表宽 329px，长提示宽 284px 且内部可滚动；默认首页卡片不再显示连接数行。
- 代码验证：ESLint、`vue-tsc --build`、Vite production build 和 `git diff --check` 通过。构建只保留上游 VueUse PURE 注释与既有 globe 大分块提示。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，7,323,781 bytes，SHA-256 `eb856be687f88d98526c883ce96499d3b0296e4757ba0bc913efe1549395d983`；顶层仅含 `komari-theme.json`、`preview.png`、`dist/`。

### 2026-07-24 Komari GlassOps baseline

- 用户已删除旧目录，本轮重新克隆 `sanrokamlan-prog/komari-theme-Glassmorphism`。
- 核对 `v3.2.0..main` 只有 PWA/iPhone 元信息和管理端 PWA 清理策略两处小改，采用当前 `main` `9c9a7ee` 作为可追溯上游基点。
- 原 Git 远端已从 `origin` 改名为 `upstream`；GlassOps 后续由自己的仓库独立管理，上游仅作为选择性同步来源。
- 已核对 Komari 当前源码：Ping 任务是否适用于节点只取决于 `clients` 是否包含节点 UUID；`default_on` 只影响将来新增节点。主题设置保存接口会整份覆盖，GlassOps 必须先读取最新设置再合并专用字段。
- 已完成 GlassOps `0.1.0` 品牌、默认暗色首屏、Naive 信息顺序的 Glass 节点卡和每节点独立 0–3 项首页 Ping 展示；未配置取前三个适用任务，显式空数组隐藏 TCPing。
- 已完成管理员专用“首页延迟监控”弹窗：公开节点筛选、服务器/任务搜索、顺序调整、删除、清空、恢复默认；打开和保存均强制复核登录，保存前读取并合并最新完整主题配置。
- 本地模拟 Komari 验证通过：管理员入口与访客隐藏、隐藏节点不进入公共配置、默认/自定义/清空/恢复默认、全站保存回显、其他配置不被覆盖、会话过期拒绝保存。
- 浏览器验证通过：1280×720 桌面布局；320、360、390、430 px 手机首页无页面级横向溢出，节点卡随视口缩放，手机配置弹窗全屏并适配安全区。真实 Komari 安装和 iPhone/iPad Safari 真机仍等待用户测试。
- 纯函数断言覆盖缺省前三项、显式空选择、无效任务过滤、公开节点过滤、去重和序列化往返；首次断言发现“先截断再过滤”会漏掉后续有效任务，已改为先过滤再限制三项。
- README、实际界面预览图和纯函数修复完成后，`bun run type-check`、`bun run lint`、`bun run build`、`git diff --check` 与 ZIP 完整性检查再次通过。当前改动尚未提交，因此测试包按构建规则标记为 `komari-glassops-build-9c9a7ee-dirty.zip`，大小 7,307,452 bytes，SHA-256 `cf754512e7ee704d61cf4c405909d33139581d825a694359b4e1dc33c437e069`；顶层契约为 `komari-theme.json`、真实 PNG `preview.png`、`dist/`，包内版本 `0.1.0` 且默认主题为 `dark`。构建只保留上游既有 VueUse PURE 注释与 globe 大分块提示。

### 2026-07-24 default UI follow-up

- 节点详情页改为 Naive 式的信息层级：Glass 页头、可配置概览指标、硬件/系统/存储/网络四块清晰分区；继续使用 GlassOps 视觉和现有 Komari 数据/配置，不复制 Naive 源码。
- 首页卡片与列表视图的延迟/丢包历史条统一使用脱离卡片裁剪区域的精确悬浮提示，展示采样时间和值；路由切换、滚动、失焦或外部点击会清理残留提示。
- Ping 统计卡增加“平均延迟 / 丢包率 / 波动率”小标题；任务说明改为桌面悬浮、触屏点击均可用的 portal 浮层，修复原 Tooltip 桌面状态未打开及弹窗层级不足的问题。
- 默认暗色信号色、资源进度条和流量覆盖色统一降低饱和度与不透明度；首页 320 px 窄屏概览从三列改为两列，延迟弹窗启用手机全屏。
- 本地模拟 Komari 浏览器验证：桌面精确延迟提示与任务说明可见；320/390 px 详情页、首页和延迟弹窗无页面级横向溢出；320 px 触屏式点击可展开任务说明。真实 Komari 与 iPhone/iPad Safari 仍等待安装测试。
- 最终 `bun run lint`、`bun run type-check`、`bun run build`、`git diff --check`、浏览器全量重载无新 warning/error、ZIP 解压校验均通过。更新后的未提交测试包仍名为 `komari-glassops-build-9c9a7ee-dirty.zip`，大小 7,309,536 bytes，SHA-256 `f36aac70071ef655d41bd83b4d68d52563a3159517fd40f11051295af4774f99`。

### 2026-07-16 exact Linux integration bundle

- 刷新上游状态：Komari #604 仍为 open，head `f08f47d6a7f5e4cdec28a1e89c2183f1c1b6e1fb`，前端及 Linux/Windows 构建矩阵全部成功；komari-web #82 仍为 open，head `0fee1f123009eca4b5f380549845bed756fa2d0c`。
- 发现旧本地 Komari 快照除默认主题外仍有 23 个换行归一化后的真实源码差异，集中在 Metric Store、迁移和启动流程，因此废弃旧二进制，不作为 PR 精确测试包交付。
- 从 GitHub 下载 `f08f47d` 原始源码，创建干净编译树；逐项比较 `cmd/database/pkg/protocol/utils/web` 共 243 个核心文件，排除有意替换的 `web/public/defaultTheme` 后差异为 0。
- 默认主题替换为已发布的 Glassmorphism `v3.1.8` 资产；包内配置名为“主题设置”，完整管理端来源记录为 komari-web `0fee1f1`，路由桥接覆盖 `/admin`、`/terminal`、`/manage/*` 并加载 `glass-admin.css`。
- 使用 Go `1.26.4`、Zig `0.14.1`、`x86_64-linux-musl`、`CGO_ENABLED=1` 和 `-buildvcs=false` 构建 Linux amd64 ELF；显式版本为 `integration-f08f47d-theme-v3.1.8`，版本哈希为完整 Komari PR head。
- `go test ./database/clients ./web/api/client ./web/rpc/jsonrpc` 在 Windows amd64 CGO + Zig 环境下通过；`go vet ./...` 通过；Linux 目标构建通过。
- 功能存在性清单确认：计费费率/锚点/下月到期/一次性开机费/流量重置保护/非阻塞上报，访客审计默认关闭/RPC/IP-UA 限流/UTF-8 截断/日志索引与 SQL 过滤，主题审计摘要及 JSON/CSV 导出，以及 Glassmorphism 默认前后台均进入交付包。
- 最终目录：`output/integration-test/final/komari-glassmorphism-integration-20260716/`；总包：`output/integration-test/final/komari-glassmorphism-integration-20260716.zip`，32,089,492 bytes，SHA-256 `02f896751dfb87ff1a4a144ca69c3f9bfd83376de54492ba2013918f51c6c873`。
- 二进制 SHA-256 `a966d695e4d3b84496567465ed8bf7a585459656bf756a1e50616ff21b3578ae`；主题 zip SHA-256 `f4dd86ad26a9a55ebfcecc1c76ac07cdcd5fcfd1883cf608ec4e7f491388ea26`；独立后台 zip SHA-256 `e17fa820a4a2d184541f068bc996dea70ffa3bb6502be102dad902b1bd599f6d`。
- 未包含：每日/每周主题更新提醒、自动安装主题、不可篡改账本；实时费用仍是 fork 实验性估算功能。运行态数据库迁移、真实 Agent 上报和登录浏览器联调等待用户在 Linux 测试机部署。

### 2026-07-15 Linux integration test bundle

- 已确认 Komari PR #604 没有修改上游默认主题，但其提交历史已包含 PR #602 的访客审计 RPC、默认关闭开关、限流和日志过滤修复。
- 已确认 Glassmorphism `dist/` 包含由 komari-web `b8fcc4580fe2cd5b715b76c97f4ff4b9ba066581` 构建的完整 `/admin-app/`，入口桥接覆盖 `/admin`、`/terminal`、`/manage/*`。
- 用户指定只需 Linux 测试包；目标收窄为 `linux/amd64`。
- PR #604 复核修复：账单累计写入失败现在只记录日志，不再阻断已保存的 Agent 上报和运行时在线状态；新增回归测试，提交 `b242ee8` 已推送 PR 分支。流量费率明确为每 TiB（`1024^4 bytes`）。
- komari-web #82 本地补强：管理端账单弹窗新增流量、运行时间、首次开机费和总估算，30 秒刷新；费率前后端统一限制为 `0..1e12`；明确锚点可修改但首次上报后不可清空。`npm run lint` 为 0 error / 27 个既有 warning，`npm run build` 通过。
- v3.1.6 空白页已稳定复现：`HomeView` 新增 `PingMonitorDialog` 时把弹窗放在主根节点外，视图变成 Fragment；Vue 报 `Component inside <Transition> renders non-element root node`，`out-in` 离场后主区域为空。修复为把弹窗移入 `.home-view` 单一根容器；浏览器首页 -> 详情 -> 返回首页恢复正常且无新 warning/error。
- 永久约束已写入 `AIAGENTREADME.md` 和 `src/AGENTS.md`：路由视图必须单元素根，新增全局弹窗后必须验证动画开启/关闭两种路由往返。

### 2026-07-15 v3.1.6 release preparation

- 默认主题后台：完整 komari-web 已从 `b8fcc4580fe2cd5b715b76c97f4ff4b9ba066581` 重新构建并同步到 `public/admin-app/`；旧主控不返回 `traffic_rate` 时隐藏且不提交新增计费字段。komari-web PR #82 为 open、clean、mergeable。
- 实时费用上游：Komari PR #604 为 open、clean、mergeable；`build-frontend` 和 Linux/Windows 386、amd64、arm64、riscv64 共 8 个构建任务全部成功。字段覆盖流量单价、小时单价、一次性首次开机费、首次 Agent 上报锚点和持久累计流量。
- 主题功能：节点卡/列表延迟与丢包可打开完整 Ping 图；剩余价值可打开逐节点费用、币种和汇率明细；访客审计增加开关、UTF-8 字节截断及完整 JSON/CSV 导出；默认背景替换为原创青蓝/淡紫/薄荷网格图。
- 背景资产：`public/images/default-background-v2.webp` 与 `output/imagegen/default-background-v2.webp` 均为 2048x1152、32,436 bytes、SHA-256 `42377961822666817def3d3b51b2c236a0f5f631dd1475535d9438a6b7ac551b`；仅使用本地 Lanczos 放大修正画布，未再次调用图像 API。
- 代码复核：修复费用明细把“未设置到期时间”误显示为“今天”的问题；空费率和空开机费按 0，开机费只有存在首次成功上报锚点才计入；汇率保持“1 CNY 对应目标币种”的既有换算方向；旧核心能力检测通过。
- 验证：`bun run lint`、`bun run type-check`、`bun run build` 和产品源码 diff check 全部通过。浏览器验证桌面无横向溢出；价值弹窗 1280x720 下为 1024x525，390x844 下为 358x687 且表格滚动不溢出；`/admin` 恢复原 URL、完整菜单和 `glass-admin.css` 正常加载。
- 本地包：`komari-theme-Glassmorphism-build-e3abeff.zip`，7,606,509 bytes，SHA-256 `7539c1ef6ba8d65391215d04075256e59957e1b3af758832c72841412c17632b`；770 个条目，顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本 3.1.6，`dist/admin-app/` 419 个条目且无 PWA/Service Worker 文件。
- 发布完成：提交 `c368669ec10468a026991e21556ee3e34d5c99a0` 已推送 main；Release On Version Bump run `#29420879366`（#54）成功；annotated tag `v3.1.6`、Release target 与 main 均指向该提交。
- 线上资产：`komari-theme-Glassmorphism-build-c368669.zip`，7,615,774 bytes，GitHub digest / 下载后 SHA-256 均为 `c9495a97e754512103fb0bb38a528ea27a31c3e02888cf18b796fd7a6985f3ae`；下载复核版本 3.1.6、770 个条目、419 个后台条目、顶层契约和无 PWA/Service Worker 文件均正确。
- 发布边界：`.claude/` 和 `output/` 未进入发布提交；版本唯一来源保持 `komari-theme.json` 的 3.1.6。

### 2026-07-15 default-theme integration review follow-up

- 正在复核已有 admin-app 路由桥接、PWA 作用域、同步可重复性，以及 v3.1.5 色觉友好 / 访客审计与 Komari PR #602 合并代码的真实契约。
- 已确认 `/admin`、`/terminal`、`/manage/*` 通过独立静态子应用恢复原 URL 的方案可行；公开主题主包不会加载 React 管理端 chunk。
- 已发现并修复：浏览器禁用 sessionStorage 时入口不跳转；桥接架构下官方 `/admin-app/` Service Worker 无法覆盖恢复后的真实路由却可能保留旧后台资源；同步脚本缺少上游 HTML 结构断言。
- 真实后端联调发现 Vite 代理只改 Host、未改 HTTP Origin，Komari 默认来源校验会拒绝本地 RPC；开发代理现统一把 `/api`、`/themes` Origin 设为 `VITE_API_TARGET`，WebSocket 继续使用 `rewriteWsOrigin`。
- 访客审计补强：详情限额改按 UTF-8 字节计算，超限优先保留会话、站点指纹和 WebRTC 摘要；审计面板增加 `visitor_audit_enabled` 管理员开关，复用 `admin:editSettings` 的部分更新契约。

### 2026-07-15 complete default-theme admin integration

- 已核对 Komari `web/public/public.go`：`/admin` 和 `/terminal` 强制使用 embedded defaultTheme，静态文件会在当前主题缺失时回退 embedded defaultTheme。
- 已从官方 `komari-monitor/komari-web` 提交 `ebfbd3e079f8777a746276fe67429b519024f7c7` 完整构建 415 个 PWA 预缓存文件，并同步到 `public/admin-app/`。
- 已加入根入口路由桥接和 admin-app URL 恢复，BrowserRouter 在 `/admin/...`、`/terminal`、`/manage/*` 下保留原路径语义。
- 已加入 Glassmorphism 亮暗色 CSS 覆盖，不改官方 React 功能代码；后台菜单已在浏览器确认包含站点、主题、登录、通知、XtermJS、监控数据库、远程执行、Ping、会话、账户和日志等完整模块。
- 已新增 `bun run sync:admin -- <komari-web-path>`，可从新的官方 checkout 重建并记录来源提交。
- 已为主题 Vite 开发服务器补 `/api`、`/themes` 代理，默认指向 `http://127.0.0.1:25774`，可用 `VITE_API_TARGET` 覆盖。
- 最终校验：`bun run lint` 和 `bun run build` 均通过；生成 `komari-theme-Glassmorphism-build-e3abeff.zip`（7,573,457 bytes、770 个条目），关键管理模块与来源记录均已核对。浏览器已确认 `/admin` 完整菜单和 Glassmorphism 亮暗色覆盖；本地未启动 Komari 后端，因此未进行登录后的 API 写操作验证。

## 上一任务

- 状态：done
- 目标：新增可选的色觉友好配色，提前适配 Komari PR #602 的访客审计上报与日志查看能力，并发布 `v3.1.5`。
- 里程碑：主类 M5 新功能；色觉友好界面属于 M4，访客审计的数据最小化、权限和隐私边界按 M3 执行。
- 范围：主题托管设置、语义色与图表/Ping 色板；`visitor_audit_enabled` 能力检测；公开访客事件上报、站点隔离安全指纹与操作埋点；AuditLogPanel 的 visitor 过滤、解析和结构化展示；版本/README、构建、推送和 GitHub Release 全流程。
- 计划：色觉友好 token/色板 -> 访客审计 RPC/service/composable -> 安全指纹与页面操作埋点 -> 审计面板 visitor 视图 -> lint/build/浏览器验证 -> v3.1.5 版本/说明 -> zip/Actions/Release/线上资产验证。
- 不做：不记录密码、token、Cookie、query value、完整搜索词、WebSSH/剪贴板内容；不上传原始 WebRTC ICE 地址，不调用第三方 STUN，不采集设备 ID、Canvas 或音频指纹；不在核心 `1.2.6` 缺少能力时发送未知 RPC；不改 `package.json.version`，不提交 `.claude/`。

## 执行日志

### 2026-07-15 color-vision-friendly palette / visitor audit preparation

- 参考结论：色觉友好模式不能只换红绿色；需要拉开明度/饱和度，使用朱红、蓝绿、蓝、橙、紫红等安全色，并让重要状态同时具备文字、图标、形状或线型差异。
- 上游状态：Komari PR #602 已于 2026-07-15 合并，head `0c80f0f`、merge commit `5fa59ab`；PR CI run `29389802493` 成功。当前最新正式 Release 仍为 `1.2.6`（2026-07-12），所以主题只能提前适配并通过公开设置字段做能力检测。
- 上游契约：`public:recordVisitorEvent` 只接收 `event/path/route/target/detail`；IP、User-Agent、登录 UUID 和时间由服务端可信记录；`visitor_audit_enabled` 默认 false；每 IP 30 次/分钟、burst 10；`admin:getLogs` 新增 SQL 级 `msg_type` 精确过滤。
- 指纹决策：在核心开关明确启用后，记录随机 session ID、浏览器/系统能力、时区语言、屏幕/硬件摘要、自动化标记和含当前 origin 的 SHA-256 站点隔离指纹；WebRTC 仅使用本地 ICE gathering，保存候选类型/协议/地址类别和站点隔离哈希，不保存原始候选或地址，不调用第三方 STUN。
- 发布目标：功能完成并确认无明显逻辑漏洞后更新唯一版本源和 README 到 `v3.1.5`，执行 lint/build/zip 检查，推送 main 并核验 GitHub Actions、Release 和线上包。
- 已实现：主题设置新增标准 / 色觉友好模式；语义状态色、Ping 分级纹理和多任务图表虚实线同步切换，亮暗色关键前景组合对比度均高于 4.5:1。
- 已实现：按 PR #602 契约接入 `visitor_audit_enabled`、`public:recordVisitorEvent` 和 `admin:getLogs.msg_type`；旧核心缺少能力字段时不发送新 RPC。
- 已实现：页面、节点、分组、搜索长度、快捷筛选、视图、后台入口、工具、快照与审计导出等事件；首次页面事件附带站点隔离会话、稳定浏览器指纹及语言、时区、屏幕、硬件、自动化、WebGL、WebRTC 哈希摘要。
- 已实现：AuditLogPanel 新增访客视图和结构化 IP / UA / 身份 / 会话 / 指纹展示；JSON / CSV 导出拉取当前服务端筛选的完整分页数据，包含去重/旧核心分页保护，CSV 沿用公式注入防护和 UTF-8 BOM。
- 安全复核：不提交查询值、完整搜索词、密码、Cookie/Token、命令、剪贴板、原始 ICE candidate 或原始局域网地址；WebRTC 不使用第三方 STUN，只保存站点隔离哈希与候选类型摘要。
- 本地验证：`bun run lint` 通过；`bun run build`（含 `vue-tsc --build`）通过；访客消息解析 / Chrome Windows UA 样例通过；色觉语义前景对比度为 5.19-8.21:1；桌面浏览器渲染无新增重叠。移动窄视口自动化被浏览器安全策略阻止，已改做响应式模板与生产 CSS 静态复核。
- 最终本地验证：rebase 到远端 `2183a48` 后，`bun run lint`、`bun run build`、`git diff --check` 再次通过；发布提交 `af32f25`；本地包 `komari-theme-Glassmorphism-build-af32f25.zip` 大小 5,114,116 bytes，SHA-256 `098c3882b5b4b576912e23157f8ca59ddc771f900c152882c651336db2adb28c`，顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `3.1.5`，345 个 dist entries。
- 远端验证：发布提交 `af32f25f90f9e9c5b52e7b8885a2c0787b827f0c` 已推送 `main`；GitHub Actions `Release On Version Bump` run `#29397249147`（#52）成功；tag `v3.1.5` 与正式 Release 均指向该完整提交。
- 线上资产：`komari-theme-Glassmorphism-build-af32f25.zip`，大小 5,129,174 bytes，GitHub digest / 下载后 SHA-256 均为 `45e71e7d82bb6caf8d36625bbee8e069b71270eba5f9f475086560b7c6b41d9d`；下载复核顶层结构、包内 `3.1.5`、预览图和 345 个 dist entries 均符合发布契约。

### 2026-07-14 v3.1.4 Issue #18 per-bucket Ping loss fix

- Issue 判断：应修复。Komari 1.2.6 的 `public:queryMetrics` 已返回 `ping.loss` 分时序列，当前主题只查询 `ping.latency`，再把 `avgLoss` 覆盖到每个历史格，导致所有格子同值同色。
- 修复边界：周期汇总继续采用 `public:getPingMetricStats` 的按样本加权平均；历史时间格改为消费 `ping.loss`，按时间桶与 point `count` 加权，ratio 转百分比；`null` 保持空桶；旧 records 负值丢包逻辑保持不变。
- 已实现：Metric Store 查询同时请求 `ping.latency_ms` / `ping.loss`；按任务与时间桶聚合 loss point，使用 `count` 加权；丢包序列覆盖不完整时回退 legacy records；本地 Ping 缓存版本升到 8，避免旧错误结果继续命中。
- 发布准备：唯一版本源更新为 `3.1.4`，README 当前版本、专项说明与更新日志已同步；`.claude/` 继续排除。`gh` 登录 token 已失效，本次公开 Issue / Actions / Release 核验改用 GitHub REST，git 推送凭据正常。
- 本地验证：`bun run lint`、`bun run build` 和 `git diff --check` 均通过；构建仅有既有 `@vueuse/core` PURE 注释与 `globe` 大 chunk 警告。
- 本地资产：`komari-theme-Glassmorphism-build-4f37416.zip`，大小 5,105,926 bytes，SHA-256 `3b9510345ad79319d70311ed8a3c03a79cf4159cbf5b0ef48c3f04623798df74`；顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.4`。
- 远端验证：发布提交 `91c9b06` 已推送 `main`；GitHub Actions `Release On Version Bump` run `#29312369165`（#49）成功；tag `v3.1.4` 指向完整提交 `91c9b06fc5c4b5ee2636dc18779861186806abd7`；Release 为正式发布（非 draft / prerelease）；Issue #18 已由 `Fixes #18` 自动关闭为 completed。
- 线上资产：`komari-theme-Glassmorphism-build-91c9b06.zip`，大小 5,114,852 bytes，SHA-256 `f8b4c9b6f61cc66d755d7a612357d16d1d2774f9494b9b0c3ce87e572ee5da9b`；下载复核顶层结构为 `komari-theme.json`、`preview.png`、`dist/`（344 个 dist entries），包内版本为 `3.1.4`。

### 2026-07-14 v3.1.3 reduced-motion route transition fix

- 线上复现：`tz.yisaw.com` 开启减弱过渡动画时，点击节点后 URL 已进入详情但 `<main>` 为空；`km.ydao.de` 使用同一构建且未触发配置时，详情和返回首页均正常。
- 根因：路由 `Transition` 在 `css=false` 时仍使用 `mode="out-in"`；同步离场的 `afterLeave` 与 `KeepAlive` 更新重入后，Vue 访问空 DOM 锚点并抛出 `nextSibling` / `parentNode`。
- 修复：减弱动画时路由 Transition 改用默认并行模式；正常动画继续使用 `out-in`，首页缓存策略保持不变。
- 发布准备：唯一版本源更新为 `3.1.3`，README 当前版本、专项说明和更新日志已同步；`.claude/` 继续排除。
- 本地验证：`bun run lint`、`bun run build` 和 `git diff --check` 均通过；构建仅有既有 `@vueuse/core` PURE 注释与 `globe` 大 chunk 警告。
- 本地资产：`komari-theme-Glassmorphism-build-4716f15.zip`，大小 5,105,653 bytes，SHA-256 `e202ce28508a3dc0c9b1a4a1e8c5c7706dd1f281ef72d8f4d73d429b891bac11`；顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.3`。
- 远端验证：提交 `4f37416` 已推送到 `main`；GitHub Actions `Release On Version Bump` run `#29311122789` 成功；tag `v3.1.3` 已生成；Release 为正式发布（非 draft / prerelease）。
- 线上资产：`komari-theme-Glassmorphism-build-4f37416.zip`，大小 5,120,783 bytes，SHA-256 `f4d5f1be0c769ffc5372ab6a9b780042768f82529827b7222a843ef642605bee`；下载后复核顶层结构为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.3`。

### 2026-07-14 post-release README restructure

- 按用户提供的发帖结构重写 README：突出 `v3.1.2` 启动自愈，并重新组织详情指标、自定义、Metric / Ping、首页、高级工具、架构、安全、WebKit / Firefox 兼容和安装说明。
- 事实边界：普通 Load / Ping 历史继续公开；敏感高级工具、Geo、导出和磁盘预测保持登录校验；Safari 15.4 是构建基础边界，Tailwind CSS v4 完整视觉基线仍为 Safari 16.4+。
- 本轮仅计划提交 `README.md` 与 `AICACHE.md`；主题版本继续保持 `3.1.2`。
- 验证：`bun run lint` 通过；`git diff --check` 通过；lint 后差异仍只有两个 Markdown 文件，`komari-theme.json` 和运行时代码均未修改。

### 2026-07-14 startup single-point-of-failure fix

- 已确认根因：`InitManager.init()` 串行等待 `healthCheck()`，首次 Ping 失败会阻止 public settings、用户、节点数据和实时连接启动；`connectionError` 仅在首页渲染，详情路由缺少故障反馈。
- 设计：健康检查使用已有 5 秒配置并增加 3 次递增间隔重试；四个启动请求通过 `Promise.allSettled()` 隔离；节点首拉失败仍启动轮询自动恢复；显式重试复用现有 manager，避免重复定时器和 WebSocket 监听。
- 已实现：RPC Ping 支持 AbortSignal；健康检查超时会取消底层请求；初始化改为独立并行；全局 app shell 显示连接错误和重试状态，首页重复提示已移除。
- 首轮验证：`bun run lint`、`bun run build` 通过，生成 `komari-theme-Glassmorphism-build-bb52e94.zip`；仅有既有 `@vueuse/core` PURE 注释提示和 `globe` chunk 体积警告。
- 浏览器验证：首页和直接进入 `/instance/missing-node` 都显示全局连接错误；1270px 和 390x844 无横向溢出或按钮/文案重叠；重试按钮会进入禁用的“重试中”状态，失败后恢复。
- 快速复查：未发现新的发布阻断 bug；Firefox 毛玻璃回退、列表虚拟化、共享 Ping/负载缓存已存在。后续高收益专项候选为卡片模式 30+ 节点全量挂载，以及约 2.98 MB 地球纹理和 1.98 MB `globe` chunk 的传输/解析成本。
- 发布准备：`komari-theme.json.version` 已更新为 `3.1.2`，README 当前版本与更新日志已同步。
- 最终验证：版本更新后 `bun run lint`、`bun run build` 通过，生成 `komari-theme-Glassmorphism-build-bb52e94.zip`；zip 顶层契约为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.2`。构建仍仅有既有 `@vueuse/core` PURE 注释和 `globe` 大 chunk 警告。
- 已发布：提交 `aed8626` 已推送到 `main`；GitHub Actions `Release On Version Bump` run `#29305550352` 成功；tag `v3.1.2` 指向该提交，Release 为正式发布（非 draft / prerelease）。
- 线上资产：`komari-theme-Glassmorphism-build-aed8626.zip`，大小 5,114,600 bytes，SHA-256 `71155874add7df49ee0cbe14b403f5d959767e754ffbe21b0a8259c6bf7014d9`；下载后复核顶层结构与包内 `3.1.2` 版本均符合契约。

### 2026-07-14 v3.1.1 release preparation

- 已将唯一版本源 `komari-theme.json.version` 更新为 `3.1.1`，README 当前版本与更新日志同步。
- 发布前 `bun run lint`、`bun run build` 和 zip 清单检查通过；本地 zip 内版本为 `3.1.1`，顶层包含 `komari-theme.json`、`preview.png`、`dist/`。
- `.claude/` 为本机配置，继续排除；远端 `91f46ac` 仅修改 README 赞助名单，将在发布提交后 rebase 合入。

### 2026-07-14 v3.1.0 background/list/Ping regression quick fix

- 修复默认背景被 `body` 实色层遮挡：页面可见背景统一由 `Background.vue` 负责，`html` 继续提供无 JS/加载失败时的底色。
- 列表模式小 Ping 条移除每行 40 个绝对定位气泡，改用原生提示，避免气泡压住运行时间，同时降低列表 DOM/hover 合成开销。
- 首页快捷控制计数改为直接计数；月成本、流量、上下行、峰值等只显示数量的入口不再每轮实时更新重复排序全部节点。
- 普通节点 Ping 延迟/丢包恢复公开访问，移除 `historyMetrics` 登录权限；高级工具、Geo、导出、审计和磁盘预测权限保持不变，相关开发文档已同步。
- Ping 详情请求增加序列保护，快速切换时间范围/节点时旧请求不再覆盖新结果；时间锚点合并从遍历全部历史锚点改为只回看最近候选，避免大样本下退化为 O(n²)。
- 验证：`bun run lint` 通过；`bun run build` 通过并生成 `komari-theme-Glassmorphism-build-771c363.zip`。仍有既有 `@vueuse/core` PURE 注释提示和 `globe` chunk 体积警告。
- 暂不扩展：按用户要求放弃全量审查；卡片模式全量挂载、首页小 Ping 按节点请求仍可作为后续性能优化项。

### 2026-07-14 v3.1.0 release

- 已将 `komari-theme.json.version` 更新为 `3.1.0`；README 补齐 25 个 definition、12 个图表族、详情预设、Ping 自定义时间与丢包修复，并新增 v3.1.0 更新日志。
- `.claude/settings.local.json` 为本机配置，明确排除在发布提交之外；其余当前产品代码、适配文档和新增图表组件纳入本次 release。
- 发布前 `bun run lint`、`bun run build` 与 zip 清单检查通过；本地包内版本为 `3.1.0`，顶层包含 `komari-theme.json`、`preview.png`、`dist/`。构建仍只有既有 `@vueuse/core` PURE 注释和 `globe` chunk 体积警告。
- 已提交并推送 `main`：commit `14dac71`。GitHub Actions `Release On Version Bump` run `#42`（ID `29268363931`）成功；tag `v3.1.0` 指向该提交，Release 已发布，资产为 `komari-theme-Glassmorphism-build-14dac71.zip`（5,120,319 bytes，SHA-256 `6ecfccecf9e434da554ccea794123247c48646e9b64ba94910e697888843115c`）。

### 2026-07-14 official detail metric dashboard expansion

- 已实测公开节点详情页 `mt.vpnmiao.com`：官方默认将 CPU+Load、RAM+Swap、实时网络+累计流量、Ping 多任务合并成卡，支持 S/M/L、增删指标和拖拽；新增菜单来自 `public:listMetricDefinitions`。
- 已核对 RPC 文档与 Komari 1.2.6 `c828653`：后端固定创建 25 个定义；GPU 设备序列带 `device_index/device_name`，Ping 序列带 `task_id`；`ping.loss` 写入值为 0/1，聚合后按比例显示；`public:queryMetrics` 的空桶是 `null`。
- 设计决策：主题设置提供 12 个稳定指标族和多套预设，覆盖全部官方指标但避免 25 张单指标碎卡；保留原有独立 PingChart，LoadChart 中的 Ping 卡为可选紧凑总览。
- 已完成 25 个 definition 到 12 个图表族的查询、展示和预设映射；统一图标头部，并校验 Iconify 图标资源。GPU、显存、温度、流量、Ping 延迟和 Ping 丢包按 definition/数据存在性自动显示。
- 按用户反馈将详情概览恢复为宽屏 4 列、中屏 3 列、移动端 2 列，预设调整为 8/12/16 张；独立 Ping 图新增精确起止时间，新 metric API 传 `start/end`，无有效时序点时回落 legacy 并按保留窗口回溯后裁剪，legacy 仍以 `value < 0` 识别丢包。
- 丢包兼容补强：PingChart 只有 latency series 对应任务同时具备非 approximate loss stats 才采用新路径，否则整体回落旧 records；首页 Ping 汇总不再过滤 100% 丢包任务，metric loss 按 `total` 加权，loss stats 缺失/估算时回落 legacy。旧接口的负值哨兵判断保持不变。

### 2026-07-13 Komari 1.2.6 configurable card adaptation

- 已核对官方 `komari-web` `radix` 分支提交 `ebfbd3e` 与 Komari 1.2.6 tag 提交 `c828653`。官方公开页仍为首页与节点详情两页；首页有当前时间、在线节点、地区、总流量、实时网速 5 类状态卡，详情页使用 Metric Store 展示 CPU、内存、硬盘、网络、GPU、连接、进程与 Ping 指标。
- 差集结论：本地主题已覆盖并扩展大部分公开监控能力，但详情概览和图表排序缺少直观配置；本轮以 `/instance/` 为重点，并补齐官方时间卡与新版探针 GPU 总览。
- `InstanceDetail.vue` 已接入 18 类可配置概览卡：价格/月成本/到期/剩余价值、CPU/GPU/内存/Swap/磁盘、负载/温度/进程/连接/运行时间、上下行速率/总流量/流量额度。默认财务预设保持原有视觉行为。
- `app.ts` 已新增详情概览和图表预设及配置兼容。图表提供 all/compact/resource/network/gpu/custom 公开预设，并继续兼容旧独立卡位、advanced 值和 `chartDashboardTemplate` JSON/逗号列表。
- `komari-theme.json` 已把设置重组到 8 个编号区段；后续按用户反馈移除 23 个逐项下拉卡位，收缩为 48 个唯一设置 key，并压短易溢出的 help。主页、详情概览、详情图表分别使用一个英文逗号 keys 字段；打包预览字段为发布契约要求的 `preview.png`。
- `index.html`、`main.css` 和 `vite.config.ts` 已增加旧 WebKit 兼容边界：构建目标 Safari 15.4，缺少 `oklch` / `color-mix` 时切换 sRGB token 并关闭毛玻璃，无 ESM 时显示可读升级提示。Tailwind CSS v4 的正式浏览器基线仍是 Safari 16.4+。
- Ping 诊断结论：legacy `value < 0` 是 Komari 1.2.6 的历史丢包哨兵，不能直接删除；后续应修复 100% 丢包任务被过滤、不同样本量按任务等权平均，以及新接口只有延迟序列但缺少 loss stats 时未整体 fallback 的低报风险。本轮未改 Ping 语义。
- 设置紧凑化 follow-up：5 个 key 列表改为 `richtext` 多行输入，`parseKeyList()` 统一接受英文/中文逗号、分号、空格和换行；help 补全每个英文 key 的中文含义，并用映射间空格保证官方后台可换行。详情概览从桌面 4 列改为 3 列，财务/状态/网络/GPU 预设各 6 卡、资源 9 卡、综合 12 卡；同时修复自定义头部白名单遗漏 `monthlyCost`。
- 安全边界：后台 Metric Store 配置/迁移、数据库维护、通知、Agent 管理、命令执行和终端继续使用 Komari 官方后台，不进入公开主题路由。

### 2026-07-13 light-mode flash and home reveal follow-up

- 开始按用户“亮色模式还是太闪，刷新和显示主页没有过渡”的反馈做第二轮视觉修复：本轮不改启动数据流，重点降低 light mode 首屏/token/loading/默认背景亮度，并软化 loading -> app shell -> HomeView 的显示过渡。
- 已更新 `src/styles/main.css`、`src/utils/glassTheme.ts`、`src/stores/app.ts`、`komari-theme.json`：亮色根背景、卡片/弹层 token、默认毛玻璃 preset、自定义默认色和 Firefox fallback 均从纯白/高白度改成灰蓝雾面，降低浏览器第一帧和 fallback 合成时的亮度。
- 已更新 `src/components/Background.vue`：自定义图片预加载期间继续显示柔和默认背景兜底；默认亮色背景与视频 loading/fallback 改为低亮灰蓝渐变，并降低 emerald/lime spotlight 亮度。
- 已更新 `src/components/LoadingCover.vue`、`src/components/Provider.vue`、`src/App.vue`、`src/views/HomeView.vue`：LoadingCover 亮色普通遮罩改为低亮渐变；body 仅在存在当前背景 URL 时透明；loading/app shell/router 过渡改为更柔和的 200–300ms opacity/微位移，router transition 遵守 `disablePageAnimation`；首页容器增加轻量 reveal 且 reduced-motion 下关闭。

### 2026-07-13 home refresh flash fix

- 开始修复用户反馈的首页强闪屏：参考 vlongx 主题的稳定首屏/非白色加载策略，采用低风险首屏主题预设 + token 化加载遮罩 + 密集节点卡片禁用首轮动画方案。
- 决策：先解决高置信视觉闪屏根因，不引入卡片虚拟滚动或 Ping 聚合重构，避免扩大数据层和布局风险。
- 已更新 `index.html`：在首屏前按本机 `themeMode` 或北京日夜 fallback 预设 `.dark` 和 `colorScheme`，异常时默认暗色，避免夜间白屏。
- 已更新 `src/styles/main.css` 与 `src/components/LoadingCover.vue`：初始文档背景使用 token；加载遮罩使用 `--color-background` + `color-mix` 半透明背景，并保留纯 token fallback。
- 修复用户反馈的自定义背景图片失效：根因是 `#app` 被首屏防闪屏补丁设置为不透明 `background-color: var(--color-background)`，而 `Background.vue` 的 fixed 背景层在 `z-index: -1`，因此被 `#app` 自身背景盖住；已移除 `#app` 背景，仅保留 `body` 初始 token 背景。
- 继续修复刷新时仍能看到白雾 Loading 的反馈：`LoadingCover.vue` 现在读取归一化背景配置，自定义背景启用且当前模式有背景 URL 时，加载覆盖层不再铺 `color-mix(... 82%)` 半透明背景，也不再显示 `Loading...` 文案，只保留轻量圆形指示器，避免把背景洗白。随后进一步移除 `App.vue` LoadingCover 外层 Transition 的 `backdrop-blur-sm` enter/leave class，并去掉自定义背景加载指示器自身的小块 `backdrop-filter`；最新调整将自定义背景加载遮罩改为极低透明深色层、普通加载层改为低对比灰蓝/深色层，并让图片背景预加载阶段不显示纯白 token 占位，避免任何 loading 阶段继续出现高亮白雾。
- 已更新 `src/constants/ui.ts`、`src/views/HomeView.vue`、`src/components/NodeCard.vue`：30+ 卡片节点禁用首轮卡片切换 CSS 动画，60+ 卡片节点禁用在线状态扩散环，普通节点数量仍保留原动画。
- 修复首页延迟/丢包与详情页不一致：`useNodePingStats.ts` 的 metric series 路径此前把 `queryMetrics(fill_empty: true)` 返回的 `null` 点转成 `-1` 并计入丢包，导致首页卡片显示明显丢包；详情页图表会把同类 null 当断点，所以看不到丢包。现改为 metric series 只用于有效延迟点，丢包摘要优先读取 `public:getPingMetricStats` 的非估算 `loss`，`loss_approximate` 时不参与首页平均丢包；详情页 `PingChart.vue` 也同步忽略 metric null 点。
- 首页小卡延迟/丢包采样显示按用户反馈恢复为等高整条颜色分级，不再按高度变化。旧接口 fallback 仍保留：只有 `public:getPingMetricStats` / `public:queryMetrics` 不可用或无数据时，才走 legacy `common:getRecords`，并继续按旧接口的 `value < 0` 记录计算丢包。

### 2026-07-13 chunk/request pressure follow-up

- 开始修复历史详情页加载时请求爆炸放大因素：将 v3 共享服务/工具模块纳入 Vite manual chunk，并让 LoadChart legacy fallback 与详情页 24h 统计使用同一个 `LOAD_RECORD_MAX_COUNT` cache/request 维度。
- 已更新 `vite.config.ts`：新增 `v3-services` manual chunk，合并 history/metrics/request/cache service 与 osImageHelper/metricSeries/useNodePingDisplay 等跨异步组件共享模块，减少 Rollup 自动拆出的零散共享 chunk。
- 已更新 `src/components/LoadChart.vue`：legacy fallback 调用 `loadNodeLoadRecords(props.uuid, hours, LOAD_RECORD_MAX_COUNT)`，与 `InstanceDetail.vue` 的 24h 峰值统计保持同一 `maxCount` 维度以复用 cache/request key。
- 发布前同步 `origin/main`（包含 README 更新提交 `94691f1`），并将 `komari-theme.json.version` 从 `3.0.2` bump 到 `3.0.3`，避免已有 `v3.0.2` tag 导致 release workflow 跳过。

### 2026-07-13 v3.0.0 frontend follow-up

- 开始补完用户复查指出的 4 项：物理核心参与每核成本并展示到 NodeCard、LoadChart 增加 start/end 自定义时间范围、metric definitions 加 TTL 结果缓存、修复 `SharedCache.retain()` 覆盖后 release 引用计数孤儿化。
- 约束：保持 v3.0.0 版本号和发布结构不变；自定义范围在 metric API 可用时精确传 `start` / `end`，旧后端 fallback 只做近 N 小时近似。
- 已实现 AuditLogPanel：`admin:getLogs` RPC 类型和方法、`audit.service.ts` request key 去重、`auditLog` 权限 key、首页第 5 个高级工具入口、只读表格和分页；`limit` / `page` 调用时按官方文档转为 string。
- 已实现磁盘预测体验补充：`prediction.service.ts` 新增 `analyzeDiskPrediction()` 返回不可用原因，NodeCard / HealthSummaryPanel 在样本不足或历史不足 2 天时显示“数据积累中”；NodeCard 调 `useNodeLoadStats` 时显式传 `LOAD_RECORD_MAX_COUNT`，避免未传 `maxCount` 走后端默认配额时体验不稳定。

### 2026-07-13 official metric-store feature port

- 开始实施官方 komari-web 高价值功能移植第一批：新增 metric series 工具、metrics service、Ping metric 优先路径与节点 `message` 提示；保持旧版 `common:getRecords` fallback，不改发布结构和版本。
- 已新增 `src/utils/metricSeries.ts` 与 `src/services/metrics.service.ts`，封装 metric tags/series 拆分、Ping task/stat helper、EWMA 平滑工具，以及 `public:listMetricDefinitions` / `public:queryMetrics` / `public:getPingMetricStats` / `public:getPublicPingTasks` 服务层请求。
- 已改 `src/composables/useNodePingStats.ts` 与 `src/components/PingChart.vue`：优先并发尝试 Ping metric stats 和 metric series；新接口失败或空数据时回退 legacy Ping records；Ping 图表信息卡补充 stddev、valid、loss approximate 等官方统计字段。
- 已改 `src/components/NodeCard.vue` 与 `src/components/NodeList.vue`：节点名旁展示 `message` warning 图标，tooltip 纯文本/换行显示 message 与 `status_updated_at`，不使用 `v-html`。
- 已运行 `bun run lint` 与 `bun run build`，均通过；构建生成 `dist/` 和 `komari-theme-Glassmorphism-build-881385d.zip`。
- 继续按用户“全部上马”要求实施剩余官方功能：LoadChart 历史模式优先 metric store、GPU detail/per-device metric 图表、`chartDashboardTemplate` 托管配置读取与布局排序。
- 已改 `src/components/LoadChart.vue`：非实时历史数据优先通过 `public:listMetricDefinitions` 过滤可用指标，再调用 `public:queryMetrics` 查询 `cpu.usage`、`load.average`、memory/swap/disk/net/connections/process/GPU 等指标并转换为当前 ECharts 数据；无定义、无数据或失败时回退 `loadNodeLoadRecords()` legacy 路径。实时模式仍保留 `common:getNodeRecentStatus`。
- 已补 GPU 兼容：`src/utils/rpc.ts` 增加 live/history GPU detail 类型；LoadChart 支持 `gpu.usage`、`gpu.device.usage`、`gpu.memory.used`、`gpu.memory.total`、`gpu.temperature`，按 `device_name` / `device_index` 汇总 tooltip，并在存在 GPU 数据时显示 GPU 卡片。
- 已接入 `chartDashboardTemplate`：`komari-theme.json` 增加托管配置项；`src/stores/app.ts` 安全解析 JSON / 逗号列表并暴露 `chartDashboardTemplate`；LoadChart 按 cards 顺序渲染 cpu/memory/disk/network/gpu/connections/process，非法配置自动回默认。
- 全量移植验证：第一次 `bun run lint && bun run build` 因 LoadChart `chartData` 在 `hasGpuData` 前置引用触发 `ts/no-use-before-define` 失败；移动 computed 后第二次 build 因 `parseChartDashboardTemplate` 局部变量类型推断为窄类型失败；显式标注 `let value: unknown` 后重跑 `bun run lint && bun run build` 通过。
- 按用户要求压缩主题设置：`glassCustomColors` 合并原 10 个自定义颜色字段，help 文案列出可用 key；`app.ts` 支持新 JSON 配置并兼容旧字段。按用户补充要求增加 `gpuChartEnabled` 开关，默认关闭，LoadChart 只有开关开启且有 GPU 数据才显示 GPU 卡片。

### 2026-07-12 Komari 1.2.x compatibility adaptation

- 已调研官方 `komari.wiki` / `komari-document.pages.dev` 的 RPC、API、theme、agent 文档，以及 `komari-monitor/komari`、`komari-web`、`komari-agent`、`komari-document` 官方仓库/release。
- 决策：主题打包结构保持 `komari-theme.json` + `preview.png` + `dist/` 不变；适配重点放在数据层兼容。
- 开始实施第一批兼容补丁：RPC 参数/类型、历史 records 返回形态、新探针字段、public RPC 方法壳。
- 已完成第一批兼容补丁：`src/utils/rpc.ts` 新增 Komari 1.2.x public RPC/metric 类型与方法壳，并让 `common:getRecords` 同时发送 `maxCount` 与 `max_count`；`src/services/history.service.ts` 兼容 records array/map 返回；`src/utils/api.ts`、`src/stores/nodes.ts`、`src/views/InstanceDetail.vue` 补充新探针字段与物理核心展示。
- 验证中首次 `bun run build` 因 `MetricQueryParams` / `PingMetricStatsParams` 缺少 index signature 导致 type-check 失败；已修复后重跑通过。
- 按用户要求只参考官方 `komari-monitor/komari-web`（radix 分支），不再参考未适配的社区主题；已在临时目录只读查看官方实现。官方主题仍大量使用 `common:getNodes` / `common:getNodesLatestStatus`，但新图表/Ping 已转向 `public:listMetricDefinitions`、`public:queryMetrics`、`public:getPingMetricStats`、`public:getPublicPingTasks`。

### 2026-07-12 v3.0 stability refactor

- 已完成只读探索和计划审批；开始按计划实施网络层、缓存层、组件算法、导出与 CSV 安全重构。
- 已核对当前实现：网络层 timeout / abort 清理、RequestManager `try...finally`、Promise cache 失效清理、Provider metadata 模块级共享缓存、拓扑 Map 索引、虚拟列表固定行高和负载采样 0 条 warn 已基本落地。
- 收尾修复 `src/utils/csv.ts`：公式注入检测正则显式覆盖前导空白、BOM、NBSP 与 `= + - @ |`。
- 收尾修复 `src/services/snapshot.service.ts` 与 `src/components/SnapshotExportPanel.vue`：新增异步 JSON 构建流程，按节点分片序列化并让出主线程，避免导出时一次性 `map + JSON.stringify` 大对象。
- 收尾补充 `src/stores/nodes.ts` 注释：节点对象本身必须保持响应式，复杂静态元数据后续应字段级 `markRaw` 或放入共享缓存，避免破坏实时指标刷新。
- 说明：此前 `AICACHE.md` 只写入任务开始状态，未继续写入实现/验证/交接；它不是自动记忆文件，必须由 agent 显式编辑。

## 验证记录

- 2026-09-21 v1.0.10：ESLint、Vue 类型检查、生产构建、ZIP 结构/CRC、114 项 Chromium 回归及隔离真实 1.5.0-fix1 后端联调通过。后端由官方标签源码构建；联调仅使用临时账号和离线合成节点，未测试真实 Agent 远程命令、文件读写、Safari 或长期运行。

- 2026-07-14 v3.1.4 Issue #18 release：`bun run lint`、`bun run build`、`git diff --check` 通过；发布提交 `91c9b06` 已推送 `main`，Actions run `#29312369165`（#49）成功，tag / Release target 均为完整提交 `91c9b06fc5c4b5ee2636dc18779861186806abd7`，Issue #18 已关闭。线上 zip `komari-theme-Glassmorphism-build-91c9b06.zip` 大小 5,114,852 bytes，SHA-256 `f8b4c9b6f61cc66d755d7a612357d16d1d2774f9494b9b0c3ce87e572ee5da9b`，下载复核顶层结构 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `3.1.4`。构建仍只有既有 `@vueuse/core` PURE 注释与 `globe` 大 chunk 警告。
- 2026-07-14 v3.1.3 release：发布提交 `4f37416` 已推送 `main`；GitHub Actions run `#29311122789` 成功。Release `v3.1.3` 为正式发布（非 draft / prerelease），target 为完整提交 `4f3741692bd81141ed542614d5b31a01ff0dc0fc`，zip 资产 `komari-theme-Glassmorphism-build-4f37416.zip` 上传状态为 `uploaded`。下载复核：大小 5,120,783 bytes，SHA-256 `f4d5f1be0c769ffc5372ab6a9b780042768f82529827b7222a843ef642605bee`，顶层结构 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `3.1.3`。
- 2026-07-14 v3.1.0 release：发布提交 `14dac71` 已推送 `main`；GitHub Actions run `#42` 成功。Release `v3.1.0` 为正式发布（非 draft / prerelease），target 为完整提交 `14dac711d3e1ad1e7963c6dc2609ab6d1921f82d`，zip 资产上传状态为 `uploaded`。
- 2026-07-14 official detail metric dashboard / Ping custom range：`komari-theme.json` 解析通过，共 56 个表单行、48 个唯一 key、无重复；12 个图表族使用的 Tabler 图标均存在。最终 `bun run lint` 与 `bun run build` 通过，生成 `dist/` 和 `komari-theme-Glassmorphism-build-4e9ae53.zip`，zip 顶层保持 `komari-theme.json`、`preview.png`、`dist/`。本地 `http://127.0.0.1:5174/` 页面非空且桌面布局无重叠；本地无 Komari 后端，未完成真实节点数据下的移动端详情页、新旧 Ping 接口和 GPU 多设备实测。构建仍只有既有 `@vueuse/core` PURE 注释与 `globe` chunk 体积警告。
- 2026-07-13 managed settings compact keys follow-up：`komari-theme.json` 经 PowerShell `ConvertFrom-Json` 解析通过，共 56 个表单行、48 个唯一 key、0 个 Slot 字段、5 个 `richtext` 多行 keys 字段。混合分隔样例 `cpu,memory\ndisk process；gpu` 按顺序解析为 5 个 key。`bun run lint` 通过；`bun run build` 内含 `vue-tsc --build` 并通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。构建仍只有既有 `@vueuse/core` PURE 注释和 `globe` 大 chunk 警告。
- 2026-07-13 Komari 1.2.6 detail/settings/iOS adaptation：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。Zip 顶层已核对为 `komari-theme.json`、`preview.png`、`dist/`；清单 71 个设置 key 无重复。390x844 浏览器检查无横向溢出，中文与旧浏览器提示可读。因本地无 Komari 后端，尚未验证真实 1.2.6 数据、后台保存流程和 iOS 15.4 真机；构建仍仅有既有 `@vueuse/core` PURE 注释和 `globe` 大 chunk 警告。
- 2026-07-13 light-mode flash and home reveal follow-up：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。本轮将 light mode 根背景、默认毛玻璃 preset、自定义默认色、Firefox fallback、默认背景和 loading/video fallback 全部压到低亮灰蓝雾面；自定义图片预加载阶段保留默认背景兜底；LoadingCover/app shell/router/HomeView 增加更柔和过渡并遵守 `disablePageAnimation` / reduced-motion。未做真实浏览器硬刷新录屏或真实 Komari 自定义背景验证，需在真实环境中确认视觉效果。
- 2026-07-13 home refresh flash fix / custom background / ping follow-up：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。已修复 `#app` 不透明背景覆盖自定义背景的问题；已调整自定义背景启用时的 `LoadingCover`，刷新加载阶段不再覆盖白雾遮罩/Loading 文案，仅保留轻量圆形指示器，并移除外层 Transition blur；图片背景预加载阶段不再显示纯白 token 占位，普通 loading 改低对比灰蓝/深色。已修复首页 Ping metric null 点误计丢包；首页小卡延迟/丢包采样条按用户反馈恢复为等高整条颜色分级；legacy `common:getRecords` fallback 仍保留按 `value < 0` 计算丢包。未做真实浏览器夜间首屏录屏、真实 Komari 自定义背景验证或新旧后端 Ping 实测，需在真实环境中确认视觉效果与 Ping 摘要。
- 2026-07-13 v3.0.1 release refresh：README 已重写为更短、更有设计感的功能介绍，致谢已收束到文末；`komari-theme.json.version` 已更新为 `3.0.1`，准备按发布契约推送 main 触发新 release。
- `bun run lint`：通过；本脚本带 `--fix`，运行后已继续执行 build 验证。
- `bun run build`：首次失败，原因是 `src/utils/rpc.ts` 的 `MetricQueryParams` / `PingMetricStatsParams` 传给 RPC `call()` 时缺少 `Record<string, unknown>` index signature；已补充 `[key: string]: unknown` 后重跑通过。
- `bun run build`：最终通过；生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建中仍有既有 Rollup 提示：`@vueuse/core` PURE 注释位置警告，以及 `globe` chunk 超过 600 kB 的体积警告。
- CSV 攻击样例检查：通过。对 `"\t=cmd|' /C calc'!\r\nFakeNode,10.0.0.1,Admin"` 调用 `escapeCsvCell()` 输出为单个加引号 CSV cell，内容前置半角单引号并保留 CRLF 在 RFC 4180 引号包裹内。
- 2026-07-13 official metric-store feature port：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建中仍有既有 Rollup 提示：`@vueuse/core` PURE 注释位置警告，以及 `globe` chunk 超过 600 kB 的体积警告。
- 2026-07-13 full official feature port：首次 `bun run lint && bun run build` lint 失败（LoadChart `chartData` 前置引用）；第二次 build 失败（`parseChartDashboardTemplate` 局部变量类型过窄）；均已修复。最终 `bun run lint && bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 settings compaction / GPU switch：`bun run lint && bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 v3.0.0 release prep：README 已删除预览图并重写为实用功能介绍，`komari-theme.json.version` 已更新为 `3.0.0`；`bun run lint && bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- v3.0.0 已提交并推送 main：commit `c50f6ed`；GitHub release workflow #34 已成功；Release `v3.0.0` 已发布，资产为 `komari-theme-Glassmorphism-build-c50f6ed.zip`。
- 2026-07-13 v3.0.0 frontend follow-up / AuditLogPanel：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-6ccc9d7.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 v3.0.2 home card cleanup：按用户反馈移除首页 NodeCard 的物理核心文案和磁盘“数据积累中”提示，HealthSummaryPanel 也不再输出该提示；详情页 LoadChart 磁盘模块继续显示磁盘预测和样本不足原因；`bun run lint && bun run build` 通过，生成 `dist/` 与本地 `komari-theme-Glassmorphism-build-7be6c21.zip`（提交前短 SHA）。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 chunk/request pressure follow-up：同步 `origin/main` 后首次 `bun run lint && bun run build` 因远端 README 标题从 H1 跳到 H3 触发 `markdown/heading-increment` 失败；已将副标题改为 H2 并同步 README 当前版本为 v3.0.3。重跑 `bun run lint && bun run build` 通过；构建输出新增 `assets/v3-services-*.js`（约 54.67 kB / gzip 18.22 kB），用于合并 v3 共享服务/工具模块；生成 `dist/` 与 `komari-theme-Glassmorphism-build-94691f1.zip`（提交前短 SHA）。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。已提交并推送 main：commit `8b40b59`；GitHub release workflow #29231673966 成功；Release `v3.0.3` 已发布，资产为 `komari-theme-Glassmorphism-build-8b40b59.zip`。

## 风险点

- `bun run lint` 当前脚本包含 `--fix`，会自动修改文件；如需运行，应在运行后检查 diff。
- PingChart、首页 Ping 摘要、LoadChart 历史模式已优先尝试 public metric store，并保留 legacy fallback；HealthSummaryPanel 尚未迁移到 metric store。
- PingChart 自定义范围在 metric API 可用时精确传 `start/end`；legacy fallback 会按保留时间扩大回溯后再裁剪，但仍受旧接口最大保留时长与 6000 点上限约束。
- AuditLogPanel 已按 `admin:getLogs` 接入但尚未在真实登录后端手动验证返回形态；若后端字段或分页语义变化，需按真实响应微调。
- 自定义 LoadChart 时间范围在 metric API 可用时精确传 `start` / `end`；旧后端 fallback 仍只能近似为“最近 N 小时”。
- `traffic_up` / `traffic_down` 当前只做字段接收与历史 normalize，不替换现有流量 UI 语义。
- `message` 已在 NodeCard / NodeList 以纯文本 tooltip 展示，禁止 `v-html` 的约束仍需保持。
- JSON 导出已经分片构建节点字符串，但最终字符串拼接和 Blob 创建仍是浏览器同步边界；相比原先整棵大对象 `JSON.stringify` 已降低主线程尖峰。
- 不应对整个 `NodeData` 使用 `markRaw`，否则会破坏实时 CPU、内存、网络和在线状态响应式刷新。

## 交接说明

- v1.0.10 本地适配和验收已完成，按用户已授权的分支/PR 流程提交并等待 CI 后合并，版本提升将触发自动 Release；仅 GitHub 实际生成且下载校验成功的资产可称为正式发布。回退可重新导入 v1.0.9，不会回退后端。

已完成：

- 首页强闪屏修复：首屏前预设暗色 class/color-scheme、文档初始背景 token 化、LoadingCover 去除 `bg-white/80`、密集节点卡片禁用首轮动画与在线状态扩散环。
- 自定义背景图片 follow-up：`src/styles/main.css` 不再给 `#app` 设置不透明背景，避免遮住 `Background.vue` 的 fixed 背景层；仍保留 `html` / `body` token 背景来降低首屏白底闪现。`LoadingCover.vue` 在自定义背景启用且当前模式有背景 URL 时不再铺白雾遮罩/Loading 文案，仅保留轻量圆形指示器。
- 本次未做真实浏览器夜间首屏录屏或真实 Komari 自定义背景验证；建议在真实 Komari 多节点环境中用暗色/auto 模式硬刷新首页，并打开自定义背景图片确认无白屏闪烁且背景可见。
- HTTP/WS timeout 与 abort 清理、RequestManager 队列 `finally` 释放、共享 Promise reject/finally 清理。
- Provider metadata 模块级共享缓存与 `markRaw` 元数据。
- NodeTopologyPanel 拓扑索引与离线上游解析复杂度优化。
- NodeList 虚拟列表固定行高与文本截断防御。
- useNodeLoadStats 对在线节点 0 采样的 DEV warn。
- CSV 公式注入与 RFC 4180 转义收尾修复。
- Snapshot JSON/CSV 导出加载态与异步分片构建。
- `AICACHE.md` 已从旧文档任务交接内容更新为当前 v3.0 任务状态。
- Komari 1.2.x 第一批兼容补丁已完成：RPC/API 类型补新字段、`common:getRecords` `maxCount` 兼容、public RPC/metric 方法壳、历史 records array/map normalize、节点 store 同步新字段、详情页展示物理核心。
- 官方 komari-web 高价值功能移植第一批已完成：metric series 工具、metrics service、PingChart / 首页 Ping 摘要 metric 优先 + legacy fallback、NodeCard / NodeList 探针 `message` 纯文本提示。
- 用户要求“全部上马”后的剩余官方功能已完成：LoadChart 历史模式 metric store 优先 + legacy fallback、GPU detail/per-device metric 图表、`chartDashboardTemplate` 托管配置读取和布局排序。
- 详情页 Metric Store 扩展已完成：25 个官方 definition 归并为 12 个图表族，补齐流量、显存、温度、Ping 延迟/丢包卡片及预设；概览恢复宽屏 4 列和 8/12/16 卡预设；PingChart 支持自定义起止时间并补强新旧丢包 fallback。
- v3.0.0 复查 follow-up 已完成：物理核心 UI / 每核成本、自定义 LoadChart 时间范围、metric definitions TTL 缓存、`SharedCache.retain()` 修复、AuditLogPanel、磁盘预测数据积累提示、NodeCard 显式传 `LOAD_RECORD_MAX_COUNT`。

未完成：

- chunk/request pressure follow-up 已完成：`vite.config.ts` 新增 `v3-services` manual chunk；`LoadChart.vue` legacy fallback 与详情页统计统一使用 `LOAD_RECORD_MAX_COUNT` 维度，降低重复历史请求概率。
- HealthSummaryPanel 尚未接入 metric store。
- 尚未实现后台写入/保存 `chartDashboardTemplate`，当前只读取托管配置。
- 尚未在真实 Komari 1.2.x 后端上手动确认 `public:getPingMetricStats` / `public:queryMetrics` / GPU metric 返回形态；当前只通过类型检查、lint、build 验证。

下一步：

1. 人工查看当前 diff，注意工作区还包含此前 v3.0 稳定性重构和 AI 文档改动，不只有本批 Komari 1.2.x 适配。
2. 在真实新版后端打开 PingChart 和 LoadChart，确认 Network 优先出现 `public:getPingMetricStats` / `public:queryMetrics`，旧后端确认 fallback 到 `common:getRecords` / `loadNodeLoadRecords`。
3. 有 GPU 节点时检查 GPU 卡片、per-device tooltip、显存百分比和温度展示；无 GPU 节点时确认 GPU 卡片自动隐藏。
4. 若不希望提交构建产物，提交前按项目发布流程决定是否保留本次 `dist/` 与 zip 输出。

---

## 上一个任务记录

- 状态：done
- 目标：整理 AI 开发入口文档，新增 AIAGENTREADME 与 AICACHE，让 AI/二开者能理解项目架构、开发路径和交接方式。
- 范围：根目录 AI 文档、Claude/Agent 指引、src 作用域指引、AI 工作缓存模板。
- 不做：不改运行时代码、不改主题版本、不改 release workflow。

## 上一个任务执行日志

### 2026-07-12

- 新增 [AIAGENTREADME.md](AIAGENTREADME.md)：集中说明项目是什么、技术栈、架构分层、服务层职责、开发路径、发布契约、安全/性能规则和 AI 交接要求。
- 重写 [CLAUDE.md](CLAUDE.md)：精简为 Claude Code 入口，指向 AIAGENTREADME、AICACHE 和最近作用域 AGENTS。
- 重写 [AGENTS.md](AGENTS.md)：精简为根作用域 agent 指引，保留 build/release/root map/safeguards。
- 重写 [src/AGENTS.md](src/AGENTS.md)：精简为 src 子树实现规则，强调 v3 分层、store/service/UI/security/validation。
- 新增本文件 [AICACHE.md](AICACHE.md)：提供持久化待办、执行日志、验证和交接模板。

## 新任务模板

复制以下模板到“当前任务”或追加到执行日志：

```markdown
## 当前任务

- 状态：planned | in-progress | blocked | done
- 目标：
- 范围：
- 不做：
- 负责人/代理：

## 执行日志

### YYYY-MM-DD HH:mm

- 做了什么：
- 改了哪些文件：
- 决策原因：

## 验证记录

- 命令：
- 结果：
- 警告：
- 未验证项及原因：

## 风险点

-

## 交接说明

已完成：

-

未完成：

-

下一步：

1.
```

## 2026-07-15 Preview redesign (M4)

- Redesigning `docs/preview.png` because the current marketing-hero composition is too close to Komari Emerald (left title, large globe, three-word slogan).
- New direction: a product-first monitoring dashboard scene with frosted node cards and compact telemetry, no globe, no Emerald logo, no marketing slogan.
- Generated `output/imagegen/komari-glass-dashboard-preview-v2.png` with `gpt-image-2` (high quality) and selected its 1280x720 web derivative after visual inspection. The new composition is a full monitoring workspace with a top status strip, network overview, and six node cards.
- Runtime screenshot/mock work was deferred. `docs/preview.png` was replaced with a pure conceptual settings cover: no version badge and no actual page preview; it emphasizes eight configurable areas over the generated cyan/mint/lilac glass background.
- Shortened the managed configuration menu label from `Glassmorphism 设置` to `主题设置`.
- Release audit found `applyClient()` did not refresh the new billing fields after initial load. v3.1.7 now updates rates, anchor state, cumulative traffic, and startup-fee-applied state during the existing client metadata polling cycle.
- Fixed the misleading `完整` general-card preset: it was hard-coded to six cards even though the responsive renderer supports additional rows. It now expands to every unique `ALL_GENERAL_CARD_KEYS` entry; other presets remain curated six-card layouts.

## 2026-07-15 v3.1.7 release candidate

- `bun run lint`: passed.
- `bun run build`: passed, including `vue-tsc`; only the existing Rollup annotation and large globe chunk warnings remain.
- Local archive contains `komari-theme.json`, `preview.png`, and `dist/index.html`; embedded manifest version is `3.1.7` and configuration name is `主题设置`.
- Home -> detail -> home was browser-verified earlier with no refresh and no Fragment/Transition warning after moving `PingMonitorDialog` inside the single `HomeView` root.
- Komari PR #604 head `f08f47d` is `CLEAN` / `MERGEABLE`; all frontend and cross-platform binary checks succeeded.
- komari-web PR #82 head `0fee1f1` is `CLEAN` / `MERGEABLE`; that exact commit is embedded under `public/admin-app/`.
- Local-only `.claude/`, `output/`, and `tmp/` must remain uncommitted.

## 2026-07-15 v3.1.7 published

- Release commit: `3710532164e6b58433373199321d2977574e9913`.
- GitHub Actions run `29428658864`: success.
- Release: `https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism/releases/tag/v3.1.7`.
- Published asset: `komari-theme-Glassmorphism-build-3710532.zip`, SHA-256 `ac1a203a53a5d31fdc8a148964e1e64f1659dea7beb9745c906a8731686180a4`.
- Downloaded asset verification passed: manifest `3.1.7`, `主题设置`, `preview.png` hash equals repository preview, and `dist/index.html` exists.
- Old preview seen after upgrading is browser cache: komari-web uses `/themes/<short>/<preview>` without a version query. A hard refresh/cleared image cache displays the released image; a durable cache-busting change belongs in komari-web.
- Maintainer feedback indicates the real-time billing PRs do not fit Komari's simple cycle billing model. Treat Komari #604 and komari-web #82 as experimental fork work pending explicit upstream acceptance: wall-clock hourly estimates include offline time, traffic estimates do not reset by billing cycle, and startup fee is a static one-time add-on rather than a cycle item.

## 2026-07-15 v3.1.8 Swap tooltip hotfix

- Root cause: the Swap hover used `DataTooltip`, whose absolutely positioned content remains inside the node-card overflow boundary. The card clipped the tooltip into a thick horizontal bar that overlaid unrelated content.
- Fix: memory metrics now use a native `title` tooltip, which does not participate in card layout or clipping. The text reports `Swap 已用 <size> / 总计 <size>` and falls back to used-only when total is unavailable.
- Guardrail: do not use the current non-portal `DataTooltip` for content that must escape node/list containers with overflow clipping; use a native title or a portal-backed overlay.
- Validation: `bun run lint` and `bun run build` passed. The local archive contains `komari-theme.json`, `preview.png`, and `dist/index.html`; its embedded manifest is version `3.1.8` with configuration name `主题设置`.

## 2026-07-15 v3.1.8 published

- Release commit: `a52572aea7631239e1c35a47283c74a744a9911d`.
- GitHub Actions run `29430366028`: success.
- Release: `https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism/releases/tag/v3.1.8`.
- Published asset: `komari-theme-Glassmorphism-build-a52572a.zip`, SHA-256 `f4dd86ad26a9a55ebfcecc1c76ac07cdcd5fcfd1883cf608ec4e7f491388ea26`.
- Downloaded asset verification passed: manifest `3.1.8`, configuration name `主题设置`, `preview.png`, and `dist/index.html` are present.

## 2026-07-16 v3.1.9 release candidate (M4/M5/M6)

- Removed all theme/runtime dependencies on experimental Komari #604 and komari-web #82 fields. The embedded admin is rebuilt from official komari-web `radix` commit `ebfbd3e079f8777a746276fe67429b519024f7c7`; the integration core is upstream Komari `43547b947ff82b4b899452ead7ba7b1517ba1f84` and does not contain #604.
- Added a per-node frontend usage estimator under `theme:usage-estimator:v1:<node_uuid>`. It uses a frozen cumulative traffic snapshot, manual billable hours, a one-time estimate-only add-on, explicit source/display currencies, TiB units, finite non-negative bounds and a clear non-billing disclaimer.
- Reworked the value dialog into fixed-value, metered-estimate and exchange-rate sections. Rate source/update time is visible; missing exchange rates are not silently treated as 1; local settings can be cleared.
- Synced the complete official admin app and rewrote root-relative flag/OS assets for `/admin-app/`. The sync script injects the route bridge and hash-busts `glass-admin.css`; the CSS applies stronger cyan/mint/lilac glass styling while avoiding per-card backdrop filters on dense tables.
- Fixed the embedded-default identity mismatch that caused Theme Management to request an uninstalled `/themes/Glassmorphism` directory. Integration packages normalize the embedded manifest short name to `default`; the release theme remains `Glassmorphism`.
- Added safe persistent background resolution: `local:path` maps to `/themes/user-assets/<encoded path>` and rejects `.`/`..`. Administrators should store files under Komari `data/theme/user-assets/`, outside replaceable theme packages.
- Added the compact header advanced-tools toggle, removed the monthly-cost quick filter, changed the authenticated visitor label to `尊敬的管理员`, hid the detail visitor card below `2xl`, and retained the bottom IP pill.
- Constrained the standard earth canvas and increased the header band height so the globe no longer overlaps controls or the first node row at 1280px. Ping gaps now say `无采样数据` instead of `N/A`.
- Browser verification on `https://mt.vpnmiao.com/`: 390x844 and 1280x720 had no document overflow; the visitor detail card stayed hidden; globe/list boundaries were visually clean; `/admin`, `/admin/settings/theme`, `/admin/theme_managed` and `/terminal` loaded; Theme Management had no 404; admin images had no broken resources; console had no new warnings/errors.
- Integration validation: `go test ./database/clients ./web/api/client ./web/rpc/jsonrpc` and `go vet ./...` passed. Linux amd64 CGO/static build succeeded and was deployed for live testing. The test host was cleaned to the active binary/data only, with no backups retained per operator request.
- Release guardrail: do not reintroduce #604/#82 into the theme release or new upstream PRs. Komari default-theme work must be a clean branch from upstream main; komari-web asset-path work must be a clean branch from upstream radix.

## 2026-07-16 v3.1.9 published and upstreamed

- Release commit `f17a5eb7c18138fba78d22504e1ed5b19b347284`; workflow `29492624741` succeeded; Release `v3.1.9` points to the same SHA.
- Published asset `komari-theme-Glassmorphism-build-f17a5eb.zip`, SHA-256 `aab1572006c02447461410422962d5c65c569c6429a0191a74e6ee5544eaff9b`. Downloaded verification passed for version, `Glassmorphism` short name, `主题设置`, preview hash, `dist/index.html`, embedded admin index, admin source SHA and absence of #604 fields.
- Komari fork branch `codex/glassmorphism-default-theme`, commit `7b64db3c403f05f6dfbcb603ae4763c8842442a8`, upstream PR `komari-monitor/komari#606`. It pins Glassmorphism `v3.1.9`, builds with Bun, normalizes the embedded manifest to `short: default`, and tests metadata preservation. PR CI run `29493915098` passed frontend plus all seven Linux/Windows binary jobs.
- komari-web fork branch `codex/base-aware-static-assets`, commit `2ff6c2be70ac12a641ac7272cdfed1995439d58a`, upstream PR `komari-monitor/komari-web#83`. It resolves flag and OS images from Vite `BASE_URL`; lint has 0 errors/27 existing warnings, and both root and `/admin-app/` production builds pass.
- The admin sync script accepts both legacy root-relative komari-web assets (rewritten after build) and #83-style native BASE_URL assets (already correct). Do not restore the old requirement that at least one root-relative path must be rewritten.

## 2026-07-16 default-theme updater and globe follow-up (M4/M5/M6)

- In progress: paired clean upstream PRs add writable updates for Komari's embedded `default` theme. Core changes use `data/theme/default` as an atomic overlay and retain the binary-embedded theme as fallback; komari-web exposes the update action and explains the fallback behavior.
- Core regression coverage includes successful default installation, manifest normalization, preservation of the previous overlay after an invalid archive, safe local asset lookup, and rejection of traversal paths.
- Globe regression found in v3.1.9: the normal header was raised from the established `md:h-58` layout to `md:h-72` and the globe column gained forced height/clipping. Those three layout classes are being restored to the v3.1.8 implementation; renderer selection remains configurable and `realistic` remains the default.
- Cross-renderer browser verification found and fixed a tiled-map scoped-CSS regression: `:global(.dark) .child` compiled to bare `.dark` selectors, applying map image opacity/filter rules to the entire document. The selectors now wrap the complete descendant selector in `:global(...)`.
- Browser checks use the real 47-node test dataset. Realistic renders at about 475px desktop / 369px mobile after the original layout restoration; Cobe renders at 448px / 348px; tiled mode keeps its 672px mobile map inside a 356px horizontal scroll container with no document overflow.
- v3.2.0 validation: `bun run lint` and `bun run build` passed; the local archive contains manifest version `3.2.0`, `preview.png`, and `dist/index.html`. Browser checks covered all three earth renderers on desktop/mobile and home -> detail -> home. The only build warnings are the existing VueUse annotation and large globe chunk notices.
- Default-theme updater validation: `go test ./web/api/admin ./web/public` and targeted `go vet` passed. A broader `go test ./web/...` reached unrelated SQLite-backed packages and failed because the local Go binary uses `CGO_ENABLED=0`; do not treat that environment failure as a regression in these packages.
- komari-web updater UI: i18n sync is clean, lint reports 0 errors / 27 existing warnings, and both root-base and `/admin-app/` production builds pass.

## 2026-07-24 GlassOps 首页 Ping、卡片与详情页收口（M2/M4/M5）

- 状态：done
- 修复首页延迟配置保存：Komari 的响应 `data` 使用 `omitempty`，无返回值写接口成功时实际会完全省略 `data`。HTTP 客户端现允许成功 POST 缺少或返回空 `data`，同时继续要求 GET 成功响应必须包含非空 `data`。
- 首页卡片延迟历史新增本机持久化的 `1H / 4H / 6H / 9H / 12H` 范围选择；默认仍为 4 小时，所有节点同步使用当前范围。
- 延迟微型历史条改为由整条容器统一处理指针命中，再按横向位置映射具体小格，消除小格间隙、异步刷新和宽屏居中布局造成的悬浮失效；提示仍使用脱离卡片裁剪的 portal 浮层。
- 节点卡片在硬盘下增加流量进度；流量下、连接数上保留横向拉伸的“累计流量 / 续费信息”两组数据，续费信息按“价格 / 周期、剩余天数”展示；实时上下行速率恢复到卡片底部左侧，与右侧运行时间对齐。
- 亮色模式降低首页总览卡片、节点卡片及控制面的白度，增强次要文字、CPU/内存/硬盘/流量、TCP/UDP 与实时上下行的亮色对比；暗色 token 不变。
- 节点详情页改为 Naive 式信息结构：顶部固定硬件、系统、存储、网络四组信息，下方固定“负载 / 延迟”双标签；继续使用 GlassOps 的暗色玻璃容器与边框。移除了不再生效的详情概览卡片托管配置项。
- 浏览器验证：模拟真实省略 `data` 的成功写响应后配置正常保存且无 `Invalid API response`；2560px 宽屏首次加载与刷新后均无需调整窗口即可显示延迟小格提示；亮色桌面、390px 暗色手机、mini/compact/comfortable/large 均无横向溢出；本轮正确模拟服务启动后没有新增 warning/error。
- 代码验证：ESLint、`vue-tsc --build` 与 Vite production build 通过。仅保留既有 VueUse PURE 注释与 globe 大 chunk 警告。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，SHA-256 `3c9e56495ee8a8d77141e72df4ca853629e7a2de2996de3ea7330b7f287d3036`；顶层仅含 `komari-theme.json`、`preview.png`、`dist/`。

## 2026-07-24 GlassOps 首刷悬浮、IP 能力与日间层级跟进（M4/M5）

- 状态：done，等待真实 Komari 环境复测首刷悬浮。
- 主题按钮双击问题已在本机复现：旧逻辑按 `dark -> auto -> light` 循环，而后台默认同为 dark，第一次点击只变成视觉相同的自动深色。按钮和 store 现按当前实际明暗直接二态切换；`auto` 仅保留为未手动覆盖时的初始状态。
- 节点卡片系统/架构行根据现有 `ipv4`、`ipv6` 接口字段增加 `V4`、`V6` 能力标签，仅显示协议能力，不暴露地址；详情页原有 IP 能力逻辑不变。
- 首页延迟条增加三层首刷兜底：数据首尾 key 或时间范围变化时重建交互组件；小格和整条同时处理 mouse/pointer；任务行级移动事件再按坐标同步两个历史条。该处理不依赖切换 `4H / 1H` 触发布局重算。
- 日间四套内置玻璃预设均提高卡片不透明度并降低表面亮度；顶部总览卡片增加独立加深混色、边框和阴影，节点卡片保持次一级层级。暗色 token 未改。
- 本机旧实现冷刷新时未稳定复现用户真实环境的首刷悬浮失效，但成功复现了主题按钮需要两次点击。修复后的本地浏览器交互复测被浏览器安全策略中止，因此首刷悬浮和单击主题切换仍需在真实 Komari 页面做最终确认。
- 代码验证：ESLint、`vue-tsc --build`、Vite production build 与 `git diff --check` 通过；仅保留既有 VueUse PURE 注释与 globe 大 chunk 警告。
- 构建产物：`komari-glassops-build-9c9a7ee-dirty.zip`，SHA-256 `0f2a5d2e4354eef373e7b6abc79843531bbd6cfc5114bef69d509c216fca8d93`。

## 2026-07-28 GlassOps 宽屏、地球与后台分类收口（M2/M4/M5）

- 状态：done；尚未提交、推送或发布 GitHub Release。
- Komari 当前托管主题契约只负责渲染 `komari-theme.json` 的配置项并保存任意设置 map，主题前端必须自行消费这些值。本轮静态映射审计确认 46 个非标题设置键均能在 `src/` 找到消费入口。
- 修复首页快捷控制丢项：移除对 `monthlyCost` 的强制过滤；后台选择“基础”方案时恢复“收藏 / 月成本 / 峰值 / 离线”四项，其他预设继续按后台配置生效。
- 修复 tiled 模式覆盖配置：平铺地图不再固定替换成六张内置总览卡，统一读取 `generalCardPreset / generalCardKeys`。
- 宽屏节点卡调整：1920px 下 compact 卡改为 4 列，mini/comfortable/large 同步提高最小宽度；顶部总览区压缩到约 13–15rem，高度更多留给节点监控卡。
- realistic/cobe 地球上限放大到 `clamp(32rem, 39vw, 47rem)`；在线/离线状态徽标同步放大。浅色 realistic 增强环境光、半球光、补光和曝光，并降低画布对比，避免海洋大面积发黑；深色仍使用夜景纹理。
- 浅色总览卡由偏脏的灰调混色改为蓝白玻璃层级，同时保留边框、阴影和正文对比度。
- tiled 改为桌面左侧总览、右侧地图的两栏布局；SVG 使用 `xMidYMid meet` 保持 1440:680 比例，并限制地图最大宽度 68rem；移动端仍堆叠显示。
- 后台托管设置页增强脚本改为基于真实 `.rt-Heading.mt-4` 标题和保存按钮定位，不再依赖单一固定父级结构；增加固定标题/保存、分类页签、点击定位、滚动联动、滚动到底选中最后分类、七组可读标题色和底部保存隐藏。
- 后台 CSS/JS 镜像一致；资源指纹更新为 CSS `8d628d5f804f`、JS `121364aa3bd6`，避免继续命中旧缓存。
- 新增回归：后台分类页签与 scrollspy、基础快捷方案月成本、tiled 自定义总览卡、地图比例、1920 宽屏 4 列和地球宽度。
- 验证：ESLint、`vue-tsc --build`、Vite production build、`git diff --check` 均通过；Playwright 完整回归 43/43 通过，覆盖三种地球深浅色、390/1280/1920/2560、四种卡片尺寸、列表、收藏、搜索、mini 首任务 Ping、提示框性能与后台页签。
- 浏览器人工审阅：1920×1080 浅色 realistic、暗色 realistic、浅色 tiled 均无页面横向溢出；节点卡为 4 列；tiled 地图未拉伸；浅色地球海洋和地理轮廓可辨。
- 构建产物：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`，SHA-256 `0845ef0a3e8d2db7558a2e66a06f6375d27370a0f6f5db4a37709855c97fc199`；内含 `komari-theme.json`、`preview.png`、`preview-v1.0.0.png` 和 `dist/`，嵌入后台索引引用最新资源指纹。
- 真实环境复测重点：重新导入最新 zip 后硬刷新后台；确认设置页出现分类页签、基础快捷方案显示“月成本”、浅色 realistic 与 tiled 的实际数据布局。若仍是旧样式，先核对导入包 SHA-256，再排除 Komari/浏览器主题静态资源缓存。

## 2026-07-28 Komari 1.3.1 主题设置、地球高度与 Ping 置顶适配（M2/M4/M5）

- 状态：done；尚未提交、推送或发布 GitHub Release。
- 对照 Komari `1.3.0..1.3.1` 源码确认：主题模型、上传校验、配置保存接口和静态主题路由没有版本差异；1.3.1 发布说明也未声明主题协议变更。设置页打不开的直接原因是 GlassOps 清单把类型声明为 `redirect`，却把目标指向只接受 `managed + configuration.data[]` 的官方 `/admin/theme_managed` 页面；额外的 `schema` 字段不会被 Komari 的 `models.Configuration` 返回给官方管理页。
- 清单继续采用 Komari 正式支持的 `redirect` 类型，但入口改为 `/?glassops-settings=1`。主题自身的 `ThemeSettingsView` 直接读取构建时清单中的 46 项 schema，提供固定顶部标题/保存、统一色页签、点击定位、滚动联动和完整设置保存，不再依赖复制版后台 DOM 或 `/admin/theme_managed` 的实现细节。
- 适配 1.3.1 指标请求：外发请求只保留当前 `hours / max_points` 等正式字段，移除旧的 `downsample* / server_downsample*` 别名；公开 Ping 任务显式按 1.3.1 新增的 `weight`、再按 `id` 排序。
- 首页延迟配置的已选任务行增加置顶按钮；任意后续任务可一步移动到首位，首位按钮置灰、禁用并显示“已是第 1 个任务”。保存仍复用现有整组顺序，因此 mini 卡片会立即使用新的第一个任务。
- realistic 与 cobe 共用同一正方形外壳尺寸约束：移动端直径为 `min(100%, 100svh - 7rem, 32rem)`；桌面为 `min(44vw, 100svh - 8.5rem, 49rem)`。删除渲染器内部额外放大/负位移，避免短而宽窗口只按宽度放大后从顶部截断。
- 验证：ESLint（无自动改写）、`vue-tsc --build`、Vite production build、`git diff --check` 均通过；Playwright 完整回归 52/52 通过。新增用例覆盖清单重定向、主题自有分类页、设置保存、任务置顶与首项禁用、2048×1114 宽屏高度上限，以及 realistic/cobe 短宽屏几何一致性。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`，8,134,022 bytes，SHA-256 `36d3458177787e7ee2aec895cfcba2bd165d1258209a873649bda923e6928d32`；778 个条目，已核对清单、两份预览图、`dist/index.html` 与兼容后台资源均存在。
- 真实环境仍需做一次导入闭环：在 Komari 1.3.1 删除或覆盖旧 GlassOps 后导入上述校验和对应包，硬刷新管理页，从侧栏打开“GlassOps 主题设置”，确认分类页签和保存；本地 fixture 无法替代真实登录态、服务器静态缓存和反向代理验证。

## 2026-07-28 Komari 1.3.1 后台内嵌设置与地球顶部收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 `redirect` 入口、52 项回归和旧 ZIP 校验和的结论。仍未提交、推送或发布 GitHub Release。
- 按 Komari 1.3.1 官方主题配置契约，将 `configuration.type` 改为 `raw`，入口名称统一为“主题设置”。`configuration.data` 是同源轻量跳转文档，在官方 `/admin/theme_raw` 内容 iframe 内打开 `/?glassops-settings=1&embedded=1`，因此管理后台侧栏、顶栏和右侧内容区均保留，不再离开后台外壳。
- 内嵌模式隐藏主题前台 Header、Footer 和背景层；主题设置的品牌、标题、保存按钮与全部分类页签组成一个完整吸顶块。吸顶高度动态参与点击定位和滚动联动，额外保留 28px 安全间距；内嵌吸顶背景提高至 96% 不透明度，避免分类标题透出或遮挡。
- 设置字段按分类合并为单一大卡片，字段之间仅使用分隔线；不再为每一项绘制独立小卡片。右上角只保留一个保存按钮，内嵌模式不显示“返回首页”。
- realistic 地球继续由宽度、可用视口高度和 49rem 上限共同约束外壳直径；相机高度收敛为 `1.58`，1920×900 像素检测确认球体顶部保留非零安全边距且小于外壳高度 5%，不再出现大段空白或顶部裁切。cobe 使用相同外壳几何，视觉比例为 `1.18`。
- cobe 移除原生常驻 route arcs，改为与 realistic 同类的临时三束流星光轨：每 3.4 秒生成一组、三束错峰、2.38 秒淡入飞行后消失；页面不可见、减弱动画或地球停止渲染时会暂停调度。
- 验证：ESLint（无自动改写）、`vue-tsc --build`、Vite production build 与 `git diff --check` 通过；Playwright 完整回归 54/54 通过，新增覆盖官方 raw 后台外壳、内嵌吸顶与保存、分类单卡片、realistic 顶部像素安全边距、cobe 非常驻流星组。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`，8,135,393 bytes，SHA-256 `6420882910fcca1d0c735b783531b3fa9a21ac1343d03365a13c92824d905278`；778 个条目。已核对 `komari-theme.json` 的 `raw / 主题设置`、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`。
- 真实环境仍需完成最终闭环：覆盖导入该 SHA-256 对应包并硬刷新，在 Komari 1.3.1 左侧“主题设置”入口确认右侧内嵌页面、完整吸顶、保存行为和服务器缓存。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-29 Komari 原生托管设置、cobe 对准与状态反馈收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 `raw` iframe、旧 ZIP 校验和及其真实环境复测重点的结论。仍未提交、推送或发布 GitHub Release。
- 对照 Komari 1.3.1 官方主题契约重新评估后，主题入口改为 `configuration.type=managed`，`configuration.data` 直接声明 7 个标题分组和 46 个实际字段。官方后台原生生成控件，因此设置页会随后台顶部的深浅色、强调色、字体和布局切换，不再承担 raw iframe 的主题状态同步、宽度隔离和首次加载失败风险。
- 取舍边界：Komari 的 managed 契约不提供自定义吸顶分类页签或任意布局插槽，因此官方入口保留原生分组标题与单一保存按钮，不再强行注入自制导航。`ThemeSettingsView.vue` 继续兼容 managed `configuration.data[]`，仅作为主题自身直达/故障回退页。
- 管理后台的 `appearance` / `color` 是当前管理员浏览器的本地偏好；公开首页仍使用主题全局保存的 `themeMode` / `glassColorPreset`，避免一名管理员的本地后台配色意外改变所有访客的站点外观。
- cobe 国旗与流星统一采用已安装 COBE 2.0.1 的实际球面投影公式；每帧按当前 `phi / theta / aspect / scale` 重新计算国旗位置和三束流星终点，旋转前后均指向同一节点，不再漂浮或脱靶。
- TCPing 小格改为历史条根级指针委托，按容器几何计算当前小格；异步首批数据替换 DOM 后会使用已记录指针位置主动恢复提示。新增 1.8 秒延迟响应回归，鼠标停住不移动也会由“加载中”更新为真实时间、RTT/Loss。
- tiled 地图在线节点使用 3.15 秒低亮青色呼吸圈，离线节点使用 1.7 秒更醒目的红色呼吸圈；按节点错峰，`prefers-reduced-motion` 或“减弱过渡动画”开启时全部停用。
- realistic 和 cobe 销毁/重建时显式释放 WebGL context，避免多次切换渲染器或长时间运行后旧上下文影响下一次地球初始化。
- 验证：相关 ESLint（无自动改写）、Vue 类型检查、Vite production build、`git diff --check` 均通过；真实截图检查确认 cobe 流星终点与国旗重合、tiled 在线/离线反馈层级克制；Playwright 完整回归 54/54 通过。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,136,204 bytes；778 个条目；SHA-256 `def82733d3f30889ffc49310cdb21ee1c07bda113f123d6f90828573f0552a25`。已核对包内 `managed / 主题设置` 清单、两份预览图和 `dist/index.html`。
- 尚需真实 Komari 1.3.1 导入闭环：覆盖导入上述 SHA-256 对应包并硬刷新，确认官方设置页能生成 7 组 46 项、顶部深浅色和强调色能同步作用于表单，以及真实节点上的三种地球和 TCPing 首刷交互。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-29 tiled、首刷悬浮与总览网格最终收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 54 项回归、旧 ZIP 大小、旧条目数和旧 SHA-256 的结论。仍未提交、推送、打 Tag 或发布 Release。
- tiled 右侧标题由含义不清的 `EARTH MAP 100%` 改为“节点分布 / 在线率”；每个地区条目都明确显示节点数量，包括单节点 `×1`。在线点提高青色实心亮度、描边与双层光晕，离线仍使用更醒目的红色呼吸提示，同时继续遵循减弱动画偏好。
- 首页 TCPing 小格扩大了不侵入相邻区域的有效命中高度，并在异步首批数据更新后重放当前指针位置。详情图表新增文档级捕获与相对坐标回放：首屏加载遮罩、任务摘要异步撑高布局或 ECharts 首帧晚到时，鼠标不必再次移动也能恢复提示。
- 卡片小格提示与图表提示的时间、RTT、Loss 和聚合丢包率均使用固定列、右对齐及等宽数字；图表提示的数值列不会再随内容长度左右漂移。
- cobe 与 realistic 使用同一组流星视觉参数：三束错峰、同一时间间隔、飞行时长、线宽、颜色渐变和衰减节奏。cobe 每帧按 COBE 当前投影更新国旗与流星终点，旋转过程中的落点误差回归不超过 1px。
- 首页总览卡改为按容器实测宽度计算列数：偶数数量优先选择可整除列数并排满每行；奇数数量保持与完整行相同的卡片宽度，最后一行自然留空，不再拉伸少数卡片。测试覆盖 1920px 下 10 张卡片 5×2，以及 1280px 下 7 张卡片 4+3。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 57/57 通过。新增覆盖 tiled 标题与 `×1`、总览偶数/奇数布局、首页小格首刷、详情图表首刷与右对齐、cobe 旋转落点。
- 浏览器人工检查：tiled 在线点可见度提高且未遮住地图标签；全量总览预设最后一行未拉伸；cobe 与 realistic 均为短而渐隐的三束流星；详情图表提示数值列右对齐。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,137,267 bytes；779 个条目；SHA-256 `39f2f09c708d861a4263d8375c5bb0332e87c1c1403afc595433a0785237fae0`。已核对 `managed / 主题设置` 清单（7 个标题分组、46 个字段）、两份预览图、`dist/index.html` 和后台兼容资源。
- 仍需真实 Komari 1.3.1 导入闭环：覆盖导入上述 SHA-256 对应包并硬刷新，检查官方 managed 设置页、真实 TCPing 首刷、三种地球和不同总览卡数量。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-29 tiled 节点提示、全域悬浮与 cobe 实时换肤收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 57 项回归和旧 ZIP 校验和的结论。仍未提交、推送、打 Tag 或发布 Release。
- tiled 地图编号改为高对比黄色圆标与深色粗体数字；地图标记和右侧地区卡均支持整块鼠标/键盘悬浮，浮层列出该地区的服务器名称与在线/离线状态。地区聚合数据现保留节点摘要，单节点也继续明确显示 `×1`。
- 首页总览卡由整张卡片承接悬浮提示，不再要求点击数值；提示层使用 fixed portal，避免被玻璃卡片的 overflow 裁切。
- 首页 TCPing 历史条会保存指针位置并在异步数据到达后重放命中；详情图表同时保存绝对坐标和图表横向比例，任务摘要异步改变图表纵向位置后仍能按原相对位置恢复首次提示。
- cobe 流星 SVG 改为单条连续路径揭示动画，不再显示为分段连线；路径终点仍逐帧跟随国旗投影。
- cobe 深浅色切换不再销毁 WebGL 画布或主动丢失 context，而是通过 COBE `update()` 在同一画布上实时更新颜色、亮度和光照，消除切换瞬间的白块/破图。浅色模式使用独立的浅蓝灰球体、浅色辉光和更高漫反射，不再沿用深色黑球。
- 验证：相关 ESLint、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 60/60 通过。覆盖 tiled 两处悬浮、总览整卡悬浮、首页/详情首刷悬浮、cobe 流星对准，以及单击直接切换深浅色且 cobe 画布未替换。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,139,673 bytes；779 个条目；SHA-256 `c372fcf49d5bfc1ecd08b146a0f416a3fad8b911be1ed7ac65aa043ffafecebc`。包内清单为 `1.0.0 / managed / 主题设置`，含 7 个标题分组、46 个字段、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`。
- 仍需真实 Komari 1.3.1 覆盖导入并硬刷新，重点复核真实 RPC 时序下的首次 TCPing 悬浮及设备实际 WebGL 切换。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-29 cobe 统一配色、完整流星与指标图标收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 cobe 浅色配色、流星飞行边界、60 项回归和旧 ZIP 校验和的结论。仍未提交、推送、打 Tag 或发布 Release。
- cobe 深浅色改为同一套青蓝主色与青绿、金色、蓝紫、洋红点缀；浅色使用中等饱和度蓝青球面、清晰深色点阵和青色外缘，深色使用同色系夜景球面与柔和亮点，二者只改变明度、对比和光照，不再像两套无关主题。
- cobe 流星路径不再依赖可能在球面边缘投影失败的远端经纬度起点。每帧以当前可见国旗投影坐标为终点，在屏幕空间生成放射状起点和弧线；终点始终锁定国旗，因此旋转中不会在半途因起点转到背面而整条消失。
- 三束流星的飞行时长延长到 3.2 秒，完成后短暂保留尾迹再淡出；组间隔延长到 4.4 秒，维持与 realistic 相同的连续渐变线宽和克制节奏。
- 新增 `NodeMetricLabel.vue`，CPU、内存、硬盘、流量和 TCPing 标题统一使用 Iconify 矢量图标。五种指标使用可区分但不过度鲜艳的主题色，浅色与深色分别调整图标前景、底色和描边；mini 与完整卡片均保持原有文字层级和紧凑间距。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 61/61 通过。回归包含 cobe 深浅色复用同一 canvas、流星飞行末段路径持续可见、五类指标图标、三种地球、四种节点卡尺寸、宽屏/手机及首次异步悬浮。
- 人工截图检查：浅色 cobe 已由苍白灰球改为饱和度适中的蓝青球面，深色保持同一配色身份；五类图标在两种模式下均清楚且未挤压数值；流星末段连续指向国旗。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,140,233 bytes；779 个条目；SHA-256 `52b636d20784ab2953b76028dd31978f90302fa7796af10d70acedb38dea680e`。包内清单为 `1.0.0 / managed / 主题设置`，含 7 个标题分组、46 个字段、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`。
- 仍需真实 Komari 1.3.1 覆盖导入并硬刷新，在实际显卡和浏览器中复核 cobe 长时间旋转、深浅色连续切换和真实 RPC 首次悬浮。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-29 cobe 同尺寸光晕、球面切线流星与 tiled 精确悬浮收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 cobe 球面混色、流星方向、tiled 地图命中范围和旧 ZIP 校验和的结论。仍未提交、推送、打 Tag 或发布 Release。
- cobe 浅色球面移除大面积深绿混色，改为中等饱和度蓝色基底、蓝青辉光与深色点阵；深色使用同一蓝青色彩身份的夜景数值，仅调整明度、对比和漫反射。两种模式都保留清楚的大陆点阵，不再因绿色色块覆盖而难以辨认。
- 新增与 COBE 可视球体直径一致的独立大气层：以球体中心向外由深蓝、青蓝过渡至浅青边缘，并在外缘继续柔和衰减。光晕基准采用 `inset: 2.8%` 对齐 `scale=1.18` 的可视球面，不再形成尺寸明显大于地球的外壳。
- cobe 流星不再从目标的径向方向垂直射入。路径以国旗当前投影为终点，按球面切线方向生成三次贝塞尔曲线；三束使用深浅色分别适配的三段渐变，终点仍逐帧追随国旗，兼顾自然绕行感和旋转对准。
- tiled 地图的悬浮命中从闪烁点迁移到国旗与紧贴国旗的黄色编号。呼吸点、实心点和连接线不再弹出服务器清单；国旗、编号和右侧地区卡仍支持鼠标与键盘，浮层继续列出服务器名称及在线/离线状态。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 61/61 通过。新增断言覆盖流星到达方向与球体半径近似正交、三段渐变、同尺寸大气层、闪烁点不触发提示，以及国旗/编号分别触发提示。
- 人工截图检查：浅色 cobe 为蓝青球面、深色为同色系夜景，点阵均清楚；光晕沿球缘渐变；流星沿切线弯向国旗；tiled 编号悬浮浮层未遮挡地图主信息。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,140,444 bytes；779 个条目；SHA-256 `b1f444516404e145ad005ef3ea41537cb2a45cf7d581e29eaeadd612fbd818da`。包内清单为 `1.0.0 / managed / 主题设置`，含 7 个标题分组、46 个字段、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`。
- 仍需真实 Komari 1.3.1 覆盖导入并硬刷新，重点复核真实显卡/Safari 下的 cobe 光晕、切线流星和连续深浅色切换，以及真实节点地理聚合后的 tiled 国旗/编号悬浮。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 cobe 冰青数字地球、环轨星芒与高密度点阵收口（M2/M4/M5）

- 状态：done；本节取代上一节关于 cobe 视觉层级、61 项回归和旧 ZIP 校验和的结论。仍未提交、推送、打 Tag 或发布 Release。
- 对照用户提供的深浅色数字地球参考，保留真实 COBE WebGL 旋转、国旗经纬度定位、拖拽和同画布换肤，不使用静态背景图。球面采样提高到 `22000`，新增 32 个分布式环境光点，并以深海蓝/冰青夜景和玻璃冰蓝/白青日景组成同一色彩体系。
- WebGL 球体外新增 9 条经纬网、3 条环形轨道、3 个沿轨运行的十字星芒粒子、7 个固定星芒和 28 个低亮闪烁微粒。轨道与经纬网使用低透明度渐变；浅色使用更克制的混合模式，避免遮挡白青点阵、国旗和节点卡。
- cobe 三束流星继续复用统一的地球流星计划、线宽、配色、飞行时长和错峰节奏；路径在屏幕空间沿球面切线构造三次贝塞尔曲线，终点每帧追随当前国旗投影，旋转和主题切换期间均保持完整并准确抵达节点。
- 深浅色切换仍通过 COBE `update()` 原位更新颜色、亮度和光照，不会替换 canvas 或重建 WebGL 上下文。减弱动画开启时会隐藏流星、轨道粒子、微粒和星芒。
- 主题清单中的 cobe 说明同步改为“冰青数字点阵、经纬网、环形轨道与星芒”。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；地球定向回归 14/14 通过；Playwright 完整回归 61/61 通过。
- 人工截图检查：深色为深海蓝球面、冰青大陆点阵和明亮但克制的球缘；浅色为玻璃冰蓝球面和高密度白青点阵；经纬网、环轨粒子与星芒可辨，且未遮挡国旗、在线状态和节点卡内容。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,143,648 bytes；780 个条目；SHA-256 `fd4b2d7af6b87af19c4b54dfcb17431a62310dec310c1f3477db2486be1ab5a7`。包内已核对 `komari-theme.json`、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`。
- 仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新，重点复核真实显卡/Safari 的 WebGL 点阵、SMIL 轨道粒子、连续深浅色切换和长时间旋转。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 realistic/Cobe 真共享流星与 tiled 引线避障（M2/M4/M5）

- 状态：done；本节取代上一节关于“流星视觉参数共享”、61 项回归和旧 ZIP 校验和的结论。仍未提交、推送、打 Tag 或发布 Release。
- 用户现场截图确认了旧实现的关键缺陷：`earthMeteor.ts` 只共享了时序和颜色参数，realistic 仍由 globe.gl 原生 arc 渲染，Cobe 则由独立 SVG 渲染，因此两者的路径、笔触和动画不可能真正一致。
- 新增 `EarthMeteorOverlay.vue` 作为唯一流星 DOM/SVG 渲染器。realistic 已删除 globe.gl 的 meteor arcs，Cobe 已删除旧的专用 meteor SVG；两者现在共享相同的三束路径生成、三段渐变、线宽、圆角、虚线节奏、飞行时长、错峰和淡出动画，仅保留各自把节点经纬度换算成屏幕坐标的投影函数。
- Cobe 在每一帧重新读取旋转后的国旗投影，公共流星组件据此更新终点；realistic 同样从当前 globe.gl 屏幕投影读取终点。公共组件以 `data-meteor-renderer="shared-svg"` 标识，回归会直接比对两种模式的计算后笔触和动画契约，避免再次出现“参数相同但实际渲染器不同”。
- tiled 标记布局改为密集节点优先和全局碰撞计分。候选位置同时避让已有国旗/编号、已有引线、其他节点原点和新旧引线交叉；引线在自身国旗边缘终止，不再穿过国旗内部。12 个分布式密集节点回归会把所有连接线和非所属国旗转换为屏幕坐标，断言交叉数量为 0。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 62/62 通过。新增覆盖 realistic/Cobe 同一公共渲染器、同一计算后笔触/动画契约、旋转投影跟随和 tiled 密集节点双向避障。
- 人工截图检查：realistic 与 Cobe 均显示相同的金色/冰青渐变、线宽、圆角和短尾衰减；tiled 12 节点压力场景中未发现引线穿过其他国旗或编号。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,145,016 bytes；781 个条目；SHA-256 `58cfe65f9924e75d364379e95adae013e7c96622d956c0a75875f055c4e939ba`。包内清单为 `1.0.0 / managed / 主题设置`，并已核对两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `fd4b2d7a...` 及更早包均已失效。
- 仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新，重点复核 Safari/实际显卡上的流星动画与真实节点地理聚合。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 realistic/Cobe 共享长弧流星最终收口（M2/M4/M5）

- 状态：done；本节取代上一节关于短尾流星、旧 ZIP 校验和和人工视觉结论的说明。仍未提交、推送、打 Tag 或发布 Release。
- 用户现场截图表明短线段和分散光轨偏离目标效果。本轮将唯一公共组件 `EarthMeteorOverlay.vue` 收敛为每组 3 束、每 5 秒一组、3.2 秒飞行的长圆弧流星；三束随机选择进入方向和青蓝、金色、蓝紫配色，并以轻微错峰形成先后落点。
- 路径不再使用零散短段，而是围绕地球中心按约 106–132 度圆弧构造三次贝塞尔曲线。每束叠加柔光层、3.2px 主线和细亮核心层，使用五段透明度/颜色渐变、圆角端点、完整拖尾和落点淡出。
- realistic 与 Cobe 继续只提供当前国旗的屏幕投影；路径、颜色、粗细、光晕、核心亮线、动画、组间隔和错峰均由同一个 SVG 组件生成。Cobe 旋转时每帧更新目标投影，深浅色切换仅更换公共调色板并重启一组，不会回退到独立渲染。
- 定向视觉检查确认两种模式都呈现连续长弧而非散落短线，且 Cobe 流星持续指向旋转后的国旗。深色使用更亮的冰青/金色高光，浅色使用更深的蓝青/琥珀/紫青以保证背景上的可见性。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；流星定向回归 4/4 通过；Playwright 完整回归 62/62 通过。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,145,632 bytes；781 个条目；SHA-256 `442a865677b4de1199deca2579301a48fba77f23883b7b0eaae8b6744cb998e5`。包内清单为 `1.0.0 / managed / 主题设置`，并已核对 `preview.png`、`preview-v1.0.0.png`、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `58cfe65f...` 及更早校验和均已失效。
- 仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新，重点复核 Safari/实际显卡的 SVG 滤镜性能、长时间旋转后的投影跟随和真实节点聚合时的流星落点。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 下一任务精简交接文档（M6）

- 新增 `docs/handoff-2026-07-30-next-task.md`，把当前 managed 设置、宽屏/卡片、Ping 首刷悬浮、三种地球、唯一公共长弧流星、62/62 回归、最终 ZIP 和未完成的真实 Komari/Safari 检查整理为可直接接管的自包含基线。
- 新文档明确旧 `raw` 配置、旧回归数量、旧 ZIP 校验和和“没有测试套件”的早期说明均已过时；后续任务应以清单文件、该交接和本节为准。
- 文档内提供了工作树保护规则、关键文件地图、推荐验证命令、真实环境验收清单和可直接复制到新任务的接管提示。
- 本轮只修改文档和 AICACHE，没有改动应用源码、预览图或打包输入，因此没有重新构建 ZIP；当前包大小、781 个条目和 SHA-256 `442a865677b4de1199deca2579301a48fba77f23883b7b0eaae8b6744cb998e5` 保持不变。
- 仍未提交、推送、打 Tag 或发布 Release。

## 2026-07-30 realistic/Cobe 紧凑弧线与落点吞入式收尾（M2/M4/M5/M6）

- 状态：done；本节取代上一节关于超长弧线、3.2px 主线、62 项回归和旧 ZIP 校验和的当前结论。仍未提交、推送、打 Tag 或发布 Release。
- 唯一公共组件 `EarthMeteorOverlay.vue` 继续同时服务 realistic 与 Cobe。每组开始前先冻结一个真实服务器目标，再生成三个方向明显分离的进入路径；三束按随机顺序轻微错峰，全部落到同一个目标。只有三束都完成落点收尾并报告消失后，下一组才可能开始，同时继续遵守 5 秒组间基准，避免动画批次重叠。
- 根据用户对测试截图的现场反馈，弧线几何跨度、可见线束长度和主线粗细均相较上一版约减半：主线改为 1.6px，虚线契约改为 `0.5 / 2`。路径仍保留略高于球面的自然曲率、五段渐变、柔光层、亮芯和圆角端点，但不再形成横跨大半个画面的粗大拱桥。
- 单束约在动画 76% 时由头部抵达目标，此后头部固定在落点，尾部从完整长度持续缩短并向目标收拢，直到 100% 被落点完全“吞入”后才报告完成；不再出现光束在半空整体清除，或头部已落地但长尾继续穿过地球的情况。
- 回归新增并锁定：同组目标 ID 一致、三入口方向分离、至少来自球体两侧、飞行中段保持完整、76% 准确抵达、96% 尾部已接近收拢、三束未全部结束前不启动下一组，以及 realistic/Cobe 的 1.6px、`0.5 / 2`、颜色和动画契约完全一致。
- 验证：流星定向回归 5/5 通过；同一随机视觉用例连续重复 5/5 通过；Playwright 完整回归 63/63 通过。ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过。构建仅保留 VueUse PURE 注释和 globe/ECharts 大分块两类既有非阻断提示。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,146,213 bytes；781 个条目；SHA-256 `f662fab38b549354ebb96239b546124e08de2d43f4a9c03d8bc9c3feafed87f0`。压缩数据完整，包内清单为 `1.0.0 / managed / 主题设置`，并含两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `442a8656...` 及更早校验和均已失效。
- 交接文档 `docs/handoff-2026-07-30-next-task.md` 已同步当前动画状态、63/63 回归和最终 ZIP 校验值。仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新，重点复核 Safari/实际显卡下的吞入式尾部收缩、Cobe 长时间旋转投影和深浅色实际观感。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 流星完整落地与上游 3.3.1/3.3.2 修复映射（M2/M3/M4/M5/M6）

- 状态：done；本节取代上一节关于 `0.5 / 2` 可见长度、76% 抵达、63 项回归和旧 ZIP 校验和的当前结论。仍未提交、推送、打 Tag 或发布 GitHub Release。
- 公共流星组件继续同时服务 realistic 与 Cobe。可见线束由 `0.5` 增加三分之一到 `2/3`，主线仍为克制的 1.6px；柔光、主体和亮芯整体提高可见度，但深浅色仍分别使用公共调色板，不拆分两套实现。
- 飞行过程中不再提前降低整束透明度。头部约在 82% 准确抵达当前投影目标，96%—99% 只收缩尾部，100% 才完全消失并报告完成；三束全部完成前不会进入下一组。公共组件每帧读取目标当前投影，Cobe 旋转期间不会因旧的 `visible` 状态提前熄灭。
- 审计上游 3.3.1 提交 `9f13b72442944f9a99c808054fe8a0a18dd710c2` 后，整合 GlassOps 同类问题：首页失活时停止卡片/列表 Ping 摘要订阅；最后订阅者离开时中止 metric/legacy 请求；无订阅者时丢弃迟到结果；首页摘要 `max_points` 固定为 150；剩余价值计算不再最多只计一个账期。
- 审计上游 3.3.2 提交 `2cd56ceaad5eb0e292e2c70f7dc3be9cf4155158` 后确认其主要变化为节点指标图标。GlassOps 现有 `NodeMetricLabel.vue` 已覆盖 CPU、内存、硬盘、流量和 TCPing，并具备深浅色适配，功能范围更完整，因此保留当前设计而未复制上游重复结构。
- 验证：ESLint（直接执行、无 `--fix`）、`vue-tsc --build`、Vite production build、`git diff --check` 全部通过；Playwright 完整回归 66/66 通过。新增覆盖 150 点上限、离开首页后请求中止、多账期价值、指标图标，以及公共流星 82% 抵达、96% 尾收缩、旋转跟随与两种地球视觉契约。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,146,405 bytes；781 个条目；SHA-256 `7e30ede808c4680f3a5492411ee06684d90da7737863e5b4d8fac0db38194977`。压缩数据完整，包内清单为 `1.0.0 / managed / 主题设置`，并含 `preview.png`、`preview-v1.0.0.png`、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `f662fab3...` 及更早校验和均已失效。
- 真实环境仍需在 Komari 1.3.1 覆盖导入并硬刷新，重点观察 Safari/实际显卡下三束流星是否完整进入目标、Cobe 长时间旋转投影、真实 RPC 取消时序和后台 managed 设置。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 realistic/Cobe 流星真实路径“进洞”收口（M2/M4/M5/M6）

- 状态：done；本节取代上一节关于“82% 抵达、96% 尾收缩”、旧流星动画实现、旧 ZIP 校验和及旧回归数量的当前结论。仍未提交、推送、打 Tag 或发布 GitHub Release。
- 现场问题的根因不是亮度或动画时长，而是旧实现仍依赖整条 SVG 路径的虚线偏移、透明度和结束计时器。浏览器只能把它当成一整条线处理，因此视觉上可能在半空淡出或被一次性移除，无法严格表达“进入服务器位置的部分立即消失”。
- `EarthMeteorOverlay.vue` 现改为每帧计算三次贝塞尔曲线的真实可见子路径。完整路径保持不变，实际输出的 `d` 只包含 `[tailProgress, headProgress]` 区间；不再用 CSS `stroke-dashoffset` 假装飞行，也不再用整体透明度模拟落地。
- 单束包含 `waiting → flying → drilling → landed` 四个阶段。飞行阶段头部沿路径前进、尾部保持限定长度跟随；头部抵达服务器后进入 `drilling`，头部固定在实时服务器投影点，尾部继续沿同一路径推进。已越过目标的曲线区间不再渲染，所以看起来像逐段钻入服务器位置的洞口；只有尾端也到达目标后，路径长度才归零并移除。
- 每组开始前仍先冻结一个真实服务器目标，三束从三个明显不同的方向按随机顺序错峰出发，且共享同一目标。下一组同时受“基准组间隔已到”和“上一组三束全部 landed”约束，不会重叠或提前换目标。
- realistic 与 Cobe 继续复用同一个 `EarthMeteorOverlay.vue` 和相同运动状态机、曲线路径、线宽、柔光、亮芯及深浅色调色板；两种地球仅提供各自当前的节点屏幕投影。Cobe 旋转时每帧重算完整路径，头部在钻入阶段仍锁定移动后的国旗位置。
- 自动回归新增实际路径几何断言：钻入开始时头部与目标误差不超过 0.2px 且尾部仍在远处；钻入过程中头部持续固定，`tailProgress` 上升、可见路径长度和尾部到目标距离同时缩短；尾部抵达后头尾误差均不超过 0.2px、路径隐藏。批次测试确认三束未全部完成前不会启动下一组。
- 验证：ESLint、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 66/66 通过。另以顺序截图逐帧检查：第一帧头部已进入目标且保留长尾，第二帧仅剩洞口附近短尾，第三帧尾端进入后才完全消失。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,146,860 bytes；781 个条目；SHA-256 `48bb190bfc54358ebf6bc02d9b9ff7a42b860bc51d1f3013bf1ef4ec45df4aa7`。压缩数据完整，包内清单为 `1.0.0 / managed / 主题设置`，并含两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `7e30ede8...` 及更早校验和均已失效。
- 真实环境仍需在 Komari 1.3.1 覆盖导入并硬刷新，重点观察 Safari/实际显卡下真实路径裁切、Cobe 长时间旋转时的钻入锁点，以及连续深浅色切换。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 Cobe 固定轨道、Komari 1.3.2 审计与主题预览收口（M2/M3/M4/M5/M6）

- 状态：done；本节取代上一节关于随机环境亮点、Komari 1.3.1 目标、66 项回归、旧预览图和旧 ZIP 校验和的当前结论。流星真实路径“进洞”实现保持不变。仍未提交、推送、打 Tag 或发布 GitHub Release。
- Cobe 的两个随机屏幕亮点已替换为 3 条固定在地球三维坐标系中的轨道和对应行星。轨道/行星与国旗使用同一旋转矩阵和投影函数，因此会同步自动旋转与手动拖动；轨道按采样点深度切成可见子路径，只绘制正面半球，行星进入背面后隐藏，转回正面才重新出现。轨道可自然交叉，但不会像屏幕装饰一样漂浮。
- 星芒尺寸、亮度和柔光略微提高，仍保持背景层级，且在减弱动画模式下与轨道行星一起隐藏。深浅色继续沿用同一 Cobe 色彩身份，只调整适配值。
- 已核对 Komari 1.3.2 Release、官方 API 文档、后台 client RPC 和路由源码。该版本变化集中在指标查询性能、内存分配、通知聚合、高 CPU 修复和 RAM/Swap 百分比计算，没有更改主题清单、managed 设置或前端契约，当前主题不需要新增兼容分支。
- 官方后台没有支持累计流量校准的写入 RPC/HTTP 接口；按用户要求不添加一个无法真实保存的首页校准弹窗，等待上游提供正式能力后再接入。
- 导入预览重制为 1600×900。四项正式特色为“主题自适应宽屏显示器、首页卡片自定义监控、三种地球样式优化、服务器详情页重构”；底层使用低干扰深色玻璃地球氛围，功能区全部由项目真实宽屏首页、三种地球、节点卡片和详情页截图组成，并以 `docs/preview-source.html` 的可控蒙层合成。生成式图片不承担中文、数据或界面内容。
- 验证：ESLint（直接执行、无 `--fix`）、`vue-tsc --build`、Vite production build 和 `git diff --check` 全部通过；Playwright 完整回归 67/67 通过。新增回归锁定 3 条固定轨道、正面半球路径、行星背面隐藏、自动运动与手动拖动联动。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；9,152,703 bytes；781 个条目；SHA-256 `e7a74670df7ae73764fdc6343a3a1b3b06d6a3fce33ec76db70d869aba8e5d18`。压缩数据完整；`preview.png`、`preview-v1.0.0.png` 和 `docs/preview.png` 的 SHA-256 均为 `c993b3ff226ac62d91e1167c3beec48968cec662a54686ec426391dd558bd92e`；并已核对 `komari-theme.json`、`dist/index.html` 与 `dist/admin-app/index.html`。
- 真实环境仍需在 Komari 1.3.2 中覆盖导入并硬刷新，重点观察 Safari/实际显卡下 Cobe 固定轨道遮挡、手动拖动、长时间旋转、流星真实路径进洞、连续深浅色切换，以及后台 managed 设置。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-07-30 节点自定义标签、列表即时悬浮与 Ping 90 天完整范围（M2/M3/M5/M6）

- 状态：done；本节取代上一节关于 67 项回归、旧 ZIP 校验和以及节点标签仅在列表显示的当前结论。Cobe 固定轨道、公共流星“进洞”和 Komari 1.3.2 兼容结论保持不变。仍未提交、推送、打 Tag 或发布 GitHub Release。
- “节点显示自定义标签”开关现在同时控制节点卡和列表。新增 `NodeTagChips.vue`，按主题既有标签语法解析颜色；mini/compact/comfortable/large 分别最多直接显示 2/3/4/5 个标签，超出部分收进 `+N` 即时提示，长标签单行截断且无标签时不保留空白区域。
- 列表的厂商、地区、ASN 和自定义标签不再依赖浏览器原生 `title` 延迟提示，统一改为 `DataTooltip`。提示在首次指针进入时立即打开并异步定位，移除了重复 mouse/pointer 事件，既缩短首次悬浮等待，也避免快速移动时重复调度。
- Ping 90 天数据过少的根因是新版 `public:queryMetrics` 已返回完整时间范围，但 `loss_approximate` 被前端误认为整批指标不可用，随后回退到旧 `common:getRecords`；旧接口对所有任务合计最多 6000 条，长时间范围因此被截短。现在只要新版延迟与丢包序列都完整就直接采用，不再因近似统计回退；统计卡继续使用服务端统计，图表仍在前端聚合为最多约 480 个代表点，完整覆盖与页面流畅兼顾。
- 回归新增并锁定：四种卡片尺寸的自定义标签、关闭开关后无空占位、列表元信息首次悬浮在 500ms 内出现、近似丢包统计下 90 天请求仍使用 `public:queryMetrics`、请求参数为 `2160h / 6000 points`、返回时间跨度至少 2159 小时且不调用旧 Ping 记录接口。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 均通过；Playwright 完整回归 74/74 通过。首次全量运行发现两个测试读取时序问题，已分别等待 90 天异步范围真正生效，并在 Cobe 流星仍处于钻入阶段时核对到达切线；复测与第二轮全量均通过。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；9,153,456 bytes；781 个条目；SHA-256 `1eef6487955bc6a1adc4835172a84e5f14d2175c9ae0e7b73402eb82cf0467df`。压缩数据完整，无 `.map` 文件，含 `komari-theme.json`、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `e7a74670...` 及更早校验和均已失效。
- 真实环境仍需在 Komari 1.3.2 中覆盖导入并硬刷新，重点确认真实节点标签内容、列表首次悬浮、90 天真实指标覆盖范围和 Safari 长时间图表交互。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-08-01 标签入口、背面流星遮挡与上游 3.3.3 修复（M2/M3/M5/M6）

- 状态：done；本节取代上一节关于“卡片内直接显示标签”、74 项回归和旧 ZIP 校验和的当前结论。Cobe 固定轨道、公共流星进洞、列表即时悬浮和 Ping 90 天完整范围保持不变。仍未提交、推送、打 Tag 或发布 GitHub Release。
- 卡片标签不再占用指标与账期之间的独立内容块。mini、compact、comfortable 和 large 四种卡片均在服务器名称后显示单一标签图标；仅当开关开启且节点具有自定义标签时出现。鼠标或键盘聚焦图标后，以 `DataTooltip` 一次展示全部标签，长标签自适应换行，深浅色均使用同一语义层级。
- realistic 与 Cobe 继续复用 `EarthMeteorOverlay.vue`。公共流星现在接收当前地球的遮挡圆与目标深度：目标进入背面时，地球圆内的隐藏路径由 SVG mask 遮挡，只保留地球外可见部分并继续执行吞入式收尾；目标节点从数据中消失时立即取消整组，避免用缓存坐标形成“落在不存在位置”的幽灵光束。Cobe 旋转和手动拖动时会主动刷新同一公共覆盖层。
- 已审计上游 Glassmorphism v3.3.3 的免费节点文案修复。当前主题已按自己的卡片、列表、对比、详情与财务架构统一实现：`price = -1` 或标签包含“白嫖中”均识别为免费节点；单节点价格只显示“免费”而不拼接月付/年付等周期；单节点剩余价值显示“无”，汇总计算仍按数字 0 参与；排除免费节点不会漏掉无标签但 `price = -1` 的节点。
- 回归新增并锁定：四种卡片尺寸的名称旁标签入口与完整悬浮清单、关闭开关后入口消失、流星目标位于背面时的圆内遮挡与目标失效清理、上游 3.3.3 免费节点契约。
- 最终验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build、`git diff --check`、ZIP 完整性检查全部通过；Playwright 完整回归 76/76 通过。构建仅保留既有 VueUse PURE 注释与大分块提示。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；9,154,969 bytes；781 个 ZIP 条目；SHA-256 `2546c25f88ba2655c700b62b0d0137964b6dfb7bcb465cdddf71cb63d18c88aa`。压缩数据完整且无 `.map` 文件，包内清单为 `1.0.0 / managed / 主题设置`，并已核对两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `1eef6487...` 及更早校验和均已失效。
- 真实环境仍需在 Komari 1.3.2 中覆盖导入并硬刷新，重点确认真实标签内容、Safari/实际显卡下背面流星遮挡、连续旋转与手动拖动。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-08-01 mini 测试节点、浅色分隔线与绿色在线状态收口（M2/M4/M5/M6）

- 状态：done；本节取代上一节关于 76 项回归和旧 ZIP 校验和的当前结论。标签入口、背面流星遮挡、免费节点文案、Cobe 固定轨道、公共流星进洞、列表即时悬浮和 Ping 90 天范围均保持不变。仍未提交、推送、打 Tag 或发布 GitHub Release。
- mini 卡片的延迟/丢包摘要现在在两项指标上方显示单行“测试节点 + 任务名称”。名称严格读取首页延迟设置中当前节点的第一个已选任务，与 mini 实际统计口径一致；长名称单行截断并保留完整提示，读取中和未配置状态也有明确文案，不额外撑高指标框。
- compact、comfortable 与 large 卡片的 TCPing、流量/续费摘要和底部实时速率三处分隔线统一使用基于主题前景色的混合颜色。浅色模式提高到可辨识但不抢眼的 17% 对比度并补一层轻微内高光；深色模式维持克制的 15% 对比度，避免形成生硬白线。
- mini 与完整卡片的在线状态统一改为绿色语义：在线圆点、文字和 mini 在线时长胶囊使用 emerald 色阶并分别适配深浅色；离线仍保留红色告警语义。在线状态比原蓝灰色更醒目，但不改变卡片其他蓝色交互与指标配色。
- 验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build、`git diff --check` 与 ZIP 完整性检查全部通过；Playwright 完整回归 77/77 通过。新增回归锁定 mini 第一任务名称、三处分隔线和绿色在线语义；另以真实渲染截图检查 mini/compact 浅色卡片，确认名称截断、垂直间距和分隔线层级均无溢出。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；9,155,322 bytes；781 个 ZIP 条目；SHA-256 `552a3262a2fee332d4bdf4918faf89b541b37b4ccc649f3271f13b2d17b75f30`。压缩数据完整，包内清单、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html` 均保留；此前 `2546c25f...` 及更早校验和均已失效。
- 真实环境仍需在 Komari 1.3.2 中覆盖导入并硬刷新，重点确认真实任务长名称、四种卡片尺寸的浅色分隔线和在线/离线状态切换。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-08-01 v1.0.3 首次公开发布候选收口（M2/M5/M6）

- 状态：done；本节取代上一节关于 mini“测试节点”文案、`v1.0.0` 包、77 项回归和旧 ZIP 校验和的当前结论。仍未提交、推送、打 Tag 或发布 GitHub Release。
- mini 卡片延迟摘要已移除固定的“测试节点”四字，只保留首页延迟设置中该服务器第一个已选任务的名称；前置图标统一复用完整卡片 TCPing 标题的 `NodeMetricLabel` Ping 图标，并保持紧凑尺寸。回归直接断言任务名称可见、固定文案不存在且统一图标存在。
- 主题清单版本更新为 `1.0.3`，版本化预览文件名更新为 `preview-v1.0.3.png`。README、`CHANGELOG.md`、GitHub Release 正文 `docs/release-v1.0.3.md` 和论坛发布稿 `docs/forum-release-v1.0.3.md` 已统一说明三阶段节奏：`v1.0.1` 基础成型、`v1.0.2` 监控扩展、`v1.0.3` 首次公开发布；前两项是发布前开发里程碑，不虚构为已经发布的 GitHub Release。
- 导入预览已重生成为 1600×900 的 `v1.0.3` 版本，继续突出“主题自适应宽屏显示器、首页卡片自定义监控、三种地球样式优化、服务器详情页重构”。工作流发布正文改为按当前清单版本读取 `docs/release-v<version>.md`。
- 最终验证：ESLint、Vue 类型检查、Vite production build、GitHub Actions YAML 解析、`git diff --check`、ZIP 完整性和无 sourcemap 检查全部通过；Playwright 完整回归 77/77 通过。全量运行曾遇到一次 WebGL 帧缓冲读取瞬态，保持原几何阈值不变并改为在 5 秒内轮询完整帧后，全量复跑通过。
- 发布候选包：`komari-glassops-v1.0.3-build-9c9a7ee-dirty.zip`；9,155,012 bytes；781 个 ZIP 条目；SHA-256 `0c3453c7288ae7778587575365ab04b6a94ee8f4768a0b501c0984874753ca31`。包内清单为 `Komari GlassOps / 1.0.3 / managed / preview-v1.0.3.png`；`docs/preview.png`、包内 `preview.png` 和 `preview-v1.0.3.png` 的 SHA-256 均为 `a1c0627424f3d3b6d94b38875c53634c5b5c532412fe918a290593ef803fd71f`。
- Git 当前仅配置上游远端 `upstream=https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism.git`，没有目标仓库 `origin`，本机也没有 `gh`。工作树包含本项目累计的大量未提交改动，因此发布前必须先确认 `Schmidttt/komari-glassops` 目标仓库与访问权限，再精确审阅和暂存发布范围。真实 Komari 1.3.2 覆盖导入、设置保存/重开、硬刷新和 Safari/真实 GPU 长时检查仍是正式发布前的外部验收边界。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 2026-08-01 卡片边界自适应标签弹窗与 v1.0.3 再收口（M2/M4/M5/M6）

- 状态：done；本节取代上一节关于固定宽度标签弹窗、77 项回归和旧 ZIP 校验和的当前结论。v1.0.3 清单、发布文档与预览图保持不变。用户已授权继续准备并推送正式版本，但在目标仓库与认证未安全确认前仍不得误推上游。
- `DataTooltip.vue` 新增参考容器定位能力。节点标签入口会寻找所属 `.node-card`，以卡片实际宽度和当前视口共同计算弹窗宽度与水平位置；mini、compact、comfortable、large 以及宽屏/窄屏切换时都会重新测量，不再使用固定 `18rem` 宽度或只围绕小图标居中。
- 弹窗默认紧贴当前卡片上方并保留 8px 呼吸间距；单行标签采用紧凑横向布局，不覆盖卡片内容。仅当视口顶部确实没有容纳空间时才安全翻转到卡片下方。窗口缩放、页面滚动、卡片尺寸变化和弹窗内容变化都会触发重新定位。
- 回归新增并锁定：四种卡片尺寸的弹窗均位于卡片上方、宽度不超过所属卡片且不越过卡片左右边界；同一弹窗在 1920×1080 与 820×900 之间切换后仍重新贴合卡片边界。专项回归 5/5 通过，Playwright 完整回归 78/78 通过。
- 最终验证：ESLint（直接执行、无 `--fix`）、Vue 类型检查、Vite production build、`git diff --check`、ZIP 完整性和无 sourcemap 检查全部通过。构建仅保留既有 VueUse PURE 注释和大分块非阻断提示。
- 当前发布候选包：`komari-glassops-v1.0.3-build-9c9a7ee-dirty.zip`；9,155,538 bytes；781 个 ZIP 条目；SHA-256 `ddd3b86ccb0930544f4fdea6d30b4997f615ad275fd039d8166a60d9221892cb`。包内清单为 `Komari GlassOps / 1.0.3 / managed / preview-v1.0.3.png`，并包含后台应用与两份预览图；此前 `0c3453c7...` 及更早校验和均已失效。

## 2026-08-01 mini TCPing 标题与 v1.0.3 提交前收口（M2/M5/M6）

- 状态：done；本节取代上一节关于 mini 仅显示任务名称、旧回归数量和旧候选包的当前结论。标签弹窗继续依据所属卡片的实时尺寸与视口边界动态定位，默认紧贴卡片上方，窄屏或顶部空间不足时才安全翻转。
- mini 卡片延迟摘要统一为完整卡片的指标语义：保留同款 Ping 图标，文字严格显示为 `TCPing: 节点名称`。冒号使用 ASCII `:`，冒号前无空格、后固定一个空格；任务名称仍可随卡片宽度单行截断，并通过完整标题提示保留可读性。
- 最终验证：ESLint、Vue 类型检查、Vite production build 与 `git diff --check` 全部通过；mini 定向回归 1/1 通过；Cobe 旋转投影瞬态用例独立重复 3/3 通过；Playwright 完整回归复跑 78/78 通过。构建仅保留既有 VueUse PURE 注释和大分块非阻断提示。
- Git 发布目标已由用户明确指定为 `https://github.com/schmidttt/komari-glassops`，提交显示名称为 `Schmidt`、邮箱为 `arronandy@163.com`。提交身份只写入本仓库；上游远端保持只用于追踪社区源项目，不得误推。

## 2026-08-01 v1.0.3 GitHub CI 时序回归收稳（M5/M6）

- 发布提交 `af21bfe` 已推送到目标仓库，`v1.0.3` 标签指向该提交；首次 GitHub Actions 浏览器回归为 76/78，失败仅发生在两处单帧时序采样，未发现应用运行时代码、构建或类型错误。
- 地球批次回归不再读取只持续一个动画帧的单束 `landed` 状态，改为原子等待同一批次进入稳定的 `cooldown / completed=3 / paths=0` 状态，再确认下一批次才启动；测试语义仍严格保证三束全部钻入后才能换组。
- Cobe 旋转投影回归不再在固定 240ms 的任意动画帧同时读取两类投影，改为在短窗口内分别等待流星目标与国旗投影重合；几何阈值仍保持 1px，没有放宽产品视觉契约。
- 本轮 ESLint（无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 全部通过。当前桌面沙箱禁止本地预览服务器监听 `127.0.0.1:4173`，所以本轮浏览器结果必须以新 GitHub Actions 运行作为正式发布门禁，不把端口权限失败误报为测试通过。

## 2026-08-08 v1.0.5 信息摘要层级与标签弹窗发布收口（M2/M4/M5/M6）

- 状态：done；本节取代上一节关于 `v1.0.3` 当前版本、78 项回归和旧候选包的当前结论。用户已明确授权提交、推送并运行 `v1.0.5` 发布流程。
- compact、comfortable、large 与 mini 卡片的“累计流量”和“续费信息”标题改为固定分类色：累计流量使用青色，续费信息使用紫色；数值仍按正常、临期与告警状态使用绿色、琥珀色或红色语义，不再让标题颜色随阈值变化。
- 深浅色摘要面板分别提高边框、背景和正文对比度。深色模式的绿色、紫色和告警数值改用更明亮但克制的色阶，续费价格使用稳定正文色，解决暗色背景下紫色过柔、正文难辨的问题；浅色模式继续保持柔和玻璃层级。
- 节点标签弹窗的桌面起始宽度提高到 360px，同时继续受所属 `.node-card` 实时宽度和视口边界约束。一个标签时不再显得局促；标签较多时按卡片宽度换行，窗口缩放与四种卡片尺寸下仍贴合卡片上方。
- 主题清单、README、CHANGELOG、版本化预览与 Release 正文已统一更新为 `v1.0.5`；`v1.0.4` 作为内部维护节点说明，不虚构为独立公开 Release。预览图为 1600×900，并继续突出宽屏适配、首页卡片自定义监控、三种地球样式与详情页重构。
- 最终本地验证：ESLint（无 `--fix`）、Vue 类型检查、Vite production build 与 `git diff --check` 全部通过；Playwright 完整回归 82/82 通过。新增回归锁定分类标题固定色、状态数值色、mini 深浅色适配，以及桌面标签弹窗起始宽度和响应式边界。
- 推送前候选包为 `komari-glassops-v1.0.5-build-4bae507-dirty.zip`，仅用于本地构建验证；正式发布包必须由提交后的 GitHub Actions 重新构建、创建 `v1.0.5` 标签并发布，最终文件名、SHA-256 与远端回归结果以 Release 资产复核为准。

## 2026-08-09 Komari 1.4.0–1.4.2 审计与首页显示细节收口（M2/M4/M5/M6）

- 状态：done；本节记录 Komari 最近三个版本的兼容审计与当前未发布修复。主题清单继续保持 `1.0.5 / managed / 主题设置`，本轮不创建或移动版本标签，也不发布 GitHub Release。
- 已核对 Komari 官方 `1.4.0`、`1.4.1` 与 `1.4.2` Release。`1.4.0` 的插件系统、后台仪表盘、指标存储与 `km-*`/ARIA 原生后台样式钩子，`1.4.1` 的后台分类页签、仪表盘与查询优化，以及 `1.4.2` 的指标查询、内存、启动和历史记录性能修复，均未声明公共主题清单、managed 设置或公开数据接口的破坏性变化。当前独立 Vue 主题无需复制原生后台的 `km-*` 钩子，也无需新增版本分支；后端性能改进可由现有请求自动受益。
- 已确认 `src/` 与 `komari-theme.json` 不含 Komari `1.3.x`、旧 `raw` 配置或 `/admin/theme_raw` 硬编码。README 中的 `1.3.2` 仍表示已实际确认的最低兼容基线，不因仅阅读 Release 说明而虚报为已完成 `1.4.2` 真实导入验收。
- 本轮修复包括：compact/mini 信息摘要标题与正文的深浅色层级、累计流量/续费状态色和中性无限流量显示；标签弹窗按卡片宽度自适应、单标签起始比例与多标签换行；tiled 浅色地图海洋渐变、网格与纸张纹理可见度。深色 tiled 调色通过独立 CSS 变量保持原值。
- 测试夹具现包含 12 个独立地理节点，tiled 标记断言由过期的 8 个同步为 12 个；组件实际渲染数量与数据一致，不存在重复标记。Cobe 流星时序用例在高并发全量回归中曾出现一次偶发超时，单工作进程连续复测 2/2 通过，未修改流星产品实现。
- 最终本地验证：ESLint（无 `--fix`）、Vue 类型检查、Vite production build、`git diff --check` 全部通过；Playwright 以单工作进程完整回归 84/84 通过。Vite 仅保留既有 VueUse PURE 注释与大分块非阻断提示；降级回归中的 `/api/rpc2` 连接拒绝为预期夹具行为，测试最终退出码为 0。
- 外部验收边界保持明确：尚未在真实 Komari `1.4.2` 后台完成覆盖导入、设置保存/重开、硬刷新及 Safari/真实 GPU 长时验证。本轮用户已授权在无额外兼容修改时提交并推送当前明确范围到目标仓库 `main`；仍未授权创建新标签或 Release。

## 2026-08-10 realistic 透明大气层、Black Marble 城市灯光与动态昼夜（M4/M6）

- 状态：done；本轮只优化 realistic 地球视觉与对应回归，没有修改 cobe/tiled 产品实现、版本号或发布配置；未提交、推送、创建标签或 Release。
- 现场问题与处理：关闭 globe.gl 内置大气层并移除原 CSS 大面积径向雾，改为透明、加色混合且不写入深度的 Fresnel 薄层；日照侧亮边更清晰，夜侧只保留低强度散射。CSS 仅承担非常轻的透明外扩光，流星 SVG 继续位于地球画布之上，地球本体遮挡蒙版保持不变，因此外圈可透光而球体仍能正确遮挡背面流星。
- 城市灯光：同路径夜景资源替换为 NASA Earth Observatory 2016 全球彩色 Black Marble，并在 `NOTICE.md` 记录 Suomi NPP VIIRS 来源。Shader 仅在夜半球显示灯光，通过邻域亮点与暖色 emissive 增强繁华城市、海岸和交通走廊；深色模式强度高于浅色，但两种主题均不会把海洋或整块陆地提亮成光斑。
- 动态昼夜：沿用现有 MeshPhong 凹凸、水面高光、节点、国旗和共享流星架构，通过太阳赤纬、赤经和格林尼治恒星时计算实时太阳直射点，在同一球面混合日/夜贴图并生成柔和晨昏带。太阳方向转换到相机空间，自动旋转和手动拖动都会同步更新；每分钟刷新天文位置，不增加外部网络请求或新依赖。
- 视觉验收：以固定 2026-07-25 夹具在 Chromium/WebGL 中分别核对深浅色完整页与地球局部截图；可见日照面、夜面、东亚城市灯光和窄幅透明亮边，未复现旧的大块灰蓝雾。手动拖动后昼夜方向随视角正确变化，城市灯光仍留在地理夜面。
- 回归新增并锁定：`solar-terminator`、`nasa-black-marble-2016`、`transparent-fresnel` 材质契约，太阳直射点范围，深浅色城市灯光强度，透明 halo 与 globe/meteor 层级，以及停止自动旋转后的手动拖动同步。地球专项 21/21 通过；完整 Playwright 首轮 85/86，仅未改动的 Cobe 流星 1.8 秒对齐窗口偶发超时，独立复跑通过，随后完整复跑 86/86 通过。
- 最终验证：本轮组件和回归定向 ESLint、Vue 类型检查、Vite production build、`git diff --check` 全部通过；全仓 ESLint 唯一额外提示来自本轮开始前已存在且按交接要求不得改动的未跟踪交接文件末尾空行。Vite 仅保留既有 VueUse PURE 注释和大分块非阻断提示。
- 外部边界：本地 Playwright WebGL 不替代真实 Komari `1.4.2` 覆盖导入、设置保存/重开、硬刷新，以及 Safari/真实 GPU 长时旋转和流星叠加验收；这些仍需后续真实环境确认。

## 2026-08-10 realistic 实机反馈后的渐隐大气与夜面可读性重构（M4/M6）

- 状态：done；用户在真实 Komari 测试包中确认上一版仍呈现硬蓝边、灰色实体外环和夜面死黑，本轮已按实机反馈完成第二版重构。本节取代上一节关于 `transparent-fresnel` 已完成视觉验收的结论；不改版本号，不提交、不推送、不创建标签或 Release。
- 已定位硬环不是单纯透明度问题：放大的 Fresnel 球壳在最外轮廓仍有最高 alpha，画布 drop-shadow 又把该硬轮廓扩散成灰环。重构方向是相机朝向的解析渐隐大气：地表附近最明显，向外连续衰减到零，不再由实体球壳或阴影制造边框。
- 流星与大气改为真实叠层语义：WebGL 渐隐大气提供主体色彩；极低透明度的 CSS 径向透射层位于流星 SVG 上方，最外缘 alpha 为零，因此流星经过外圈时仍可透见并略受空气色调影响，地球本体的 SVG 遮挡蒙版保持不变。
- 夜面不再直接使用黑底夜景纹理：以低强度蓝灰月光重新混入日间地貌，保留海洋、陆地与冰盖辨识度；Black Marble 只承担夜景底色与城市灯光。少量高亮城市像素使用独立相位做克制闪烁，动画关闭时固定，避免整片城市同步呼吸。
- 动态昼夜继续按实时太阳直射点每 60 秒刷新，并在页面重新可见、自动旋转和手动拖动时同步相机空间方向。当前本地实时探针为 `solar-terminator / lat 15.5719 / lng 128.5174 / cityTwinkle animated`，符合 2026-08-10 03:xx UTC 的太阳位置范围。
- 最终视觉验收：以临时本地 Komari 接口在 Chromium/WebGL 中核对 1280×720 和 1920×720 深浅色、手动拖动、完整夜面与飞行中流星。硬蓝边和灰色实体环已消除，大气从近地表向外连续渐隐；增强后的柔和光层仍保持半透明，金色流星从其下方经过时可隐约透见。夜面可辨陆地、海洋和冰盖，繁华地区灯光密度与亮度更高但没有整片过曝，白天地貌曝光也已压低。
- 动画实现不额外创建第二套独立逐帧循环：城市闪烁时间由大气层现有渲染回调更新，页面隐藏或关闭动画时固定，避免重复调度和无谓 GPU 消耗。
- 最终验证：全仓跟踪文件 ESLint（排除本轮开始前已存在且不得修改的未跟踪交接文件）、Vue 类型检查、Vite production build、`git diff --check` 与 ZIP 完整性检查全部通过；新增定向回归 2/2，通过最终完整 Playwright 86/86。独立地球批次中未改动的 Cobe 对齐曾单次抖动，原阈值精确复跑通过，随后完整回归一次性全绿。
- 第二版测试包为 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，SHA-256：`5ba9e09e944575c5d61d388961cc9ffd38686e8441b6f85bb9228f09e749404d`。文件名沿用测试构建约定，本哈希取代上一版同名包；包内仍保持 `komari-theme.json`、`preview.png`、`dist/` 契约。
- 外部边界：本地 Chromium/WebGL 与 Playwright 不能替代真实 Komari `1.4.2` 覆盖导入、设置保存/重开、硬刷新，以及 Safari/真实 GPU 长时旋转和流星叠加验收。等待用户用第二版测试包确认后，再另行取得提交、推送、标签或 Release 授权。

## 2026-08-10 realistic 昼夜双色大气与分区曝光二次实机修正（M4/M6）

- 状态：done；用户确认第二版在真实 Komari 中仍有一圈无方向的灰蓝雾，且昼夜地貌都偏暗。本节取代上一节关于第二版大气层和曝光已完成视觉验收的结论；仍不改版本号，不提交、不推送、不创建标签或 Release。
- 根因与大气重构：彻底移除覆盖在流星之上的 CSS 全圆径向雾，只保留 WebGL 解析大气。大气 shader 直接根据实时太阳方向计算昼侧蓝色、晨昏冷青色和夜侧青蓝色，三段平滑混合；近地表最明显并向外连续衰减到完全透明，不再出现与昼夜无关的均匀灰环。流星 SVG 仍在透明 WebGL 大气之上，地球本体遮挡语义不变。
- 球面可读性：白昼纹理强度、太阳高度补偿和低强度环境反射分别提升，避免日照面被传统 Phong 光照二次压暗；夜面使用更明亮但仍偏冷的日间地貌混合、Black Marble 夜景底色和独立夜间环境补偿，陆地、海岸、冰盖与海洋层级均可辨，同时保持繁华地区暖色灯光和克制闪烁。晨昏带宽度略放宽，昼夜仍有明确区别而不会硬切。
- 深浅色与实机视觉验收：在本地 Komari 模拟接口和真实 Chromium/WebGL 中分别核对默认亚洲日照面、北美完整夜面、欧洲—亚洲晨昏交界以及深浅色模式；昼侧地貌清晰但未整体过曝，夜侧可见地理轮廓与城市灯光，昼侧蓝色轮廓和夜侧冷青轮廓可同时组成自然大气层。飞行中流星可见，未恢复实体灰环。
- 回归契约更新为 `solar-dual-tone-gradient`，新增昼夜大气颜色分离、白昼表面强度大于 1、夜面地貌强度至少 0.9，以及移除 CSS 全圆 halo 的断言；手动拖动后太阳相机方向同步的原阈值保持不变。定向回归 2/2、完整 Playwright 86/86 均一次通过。
- 最终验证：全仓跟踪内容 ESLint（无 `--fix`，继续排除本轮开始前已存在且不得修改的未跟踪交接文件）、Vue 类型检查、Vite production build、`git diff --check` 与 ZIP 完整性检查全部通过。Vite 仅保留既有 VueUse PURE 注释和大分块非阻断提示。
- 第三版测试包继续沿用 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，SHA-256：`94f34e26d23e575cd28d36f60d05b2ecba45f6a403d04cc040cef35c65ff65e9`；本哈希取代上一节同名第二版包。真实 Komari 覆盖导入、设置保存/重开、硬刷新及 Safari/真实 GPU 长时验收仍由用户测试确认，确认后再取得 GitHub 提交、推送、标签或 Release 授权。

## 2026-08-10 realistic 深色方向光晕与昼夜对比量化收口（M4/M6）

- 状态：done；用户在真实 Komari 第三版中确认外圈光晕几乎不可见，且昼夜色差过小。本节取代上一节关于第三版光晕和曝光已完成实机验收的结论；版本号和发布权限边界不变。
- 上一轮验证缺口已明确：主要依赖较小本地视口和默认日照视角，未以用户的 1630×574 低高度宽屏构图复核；同时只主观判断地貌“可见”，没有给白昼与夜间建立定量亮度差门槛。移除旧 CSS 雾层后只依赖 WebGL 薄层，真实大尺寸下外扩光能量不足；抬升夜面后又压缩了昼夜差。
- 深色光晕：新增仅在深色模式显示的方向性柔光层，颜色和方向由实时相机空间太阳向量驱动，昼侧为亮蓝、晨昏为冷青、夜侧为深蓝；径向遮罩只覆盖近地外圈并向外衰减至完全透明，配合轻度模糊形成可见外扩光，而不是均匀灰环或硬描边。该层位于 WebGL 地球之上、流星 SVG 之下，浅色模式 opacity 固定为 0，流星透射和地球遮挡语义均保持。
- 昼夜曝光：白昼表面强度提高到深色 1.34 / 浅色 1.28，并提升太阳高度补偿和白昼环境反射；夜间地貌强度收回到深色 0.84 / 浅色 0.88，降低全局环境光和夜景底色，同时保留独立夜面反射与城市灯光。晨昏宽度由 0.22/0.24 收窄为 0.14/0.16，使明暗分区更明确但仍连续过渡。
- 验证补强：新增固定太阳时间的中心球面像素回归，要求白昼平均亮度大于夜间 1.5 倍，夜面平均亮度仍大于 18 且亮度标准差大于 10，防止夜面重新死黑或昼夜再次趋同；新增 1630×574 深色生产构图回归，锁定方向渐变、6px 柔化、径向遮罩和可见 opacity，并保存整页截图供人工核对。实际截图中光晕在深色灰背景上连续可见，日照亚洲与夜间城市灯光同时保有层级。
- 最终验证：全仓跟踪内容 ESLint（无 `--fix`，继续排除本轮开始前已存在且不得修改的未跟踪交接文件）、Vue 类型检查、Vite production build、`git diff --check`、ZIP 完整性检查全部通过；realistic 定向回归 3/3、宽屏回归 1/1，最终完整 Playwright 88/88 一次通过。
- 第四版测试包仍为 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，SHA-256：`834df24568357138ca2a3c296ef9343c9d17cd988650393aa18d959a6b8a45ab`，本哈希取代上一节同名第三版包。尚未提交、推送、创建标签或 Release；真实 Komari 与 Safari/真实 GPU 验收仍等待用户确认。

## 2026-08-10 realistic 贴地双色光晕、无遮挡拖动与夜间星芒收口（M4/M6）

- 状态：done；用户在第四版真实 Komari 截图中确认光晕与地球之间出现断层、夜间星芒仍偏淡，并要求地球未被实际内容遮挡的区域都能手动拖动。本节取代上一节关于第四版光晕、夜面强度、88 项回归和旧包校验和的当前结论；仍未提交、推送、创建标签或 Release。
- 光晕不再按外层容器百分比估算地球边缘，而是根据 Three.js 相机视场角、相机距离和地球半径计算当前屏幕投影轮廓。蒙版从真实轮廓内侧 8px 开始重叠，地表外 2px 达到最高强度，再经过地球投影半径约 10%、最少 26px 的宽幅肩部连续衰减到零，因此地球随宽度或可用高度缩放时也不会重新出现灰色空隙。
- 深色外扩光只使用两种方向色：日照侧浅蓝、夜间侧青色，方向随相机空间太阳向量和手动旋转实时更新；移除第三种晨昏颜色，仅由两端颜色直接平滑插值。整体透明度和饱和度收低、渐隐带加宽；浅色模式继续关闭额外 CSS 外扩光。流星层仍高于半透明光晕，球体遮挡逻辑不变。
- 夜面地貌强度收至深色 0.74，降低夜间底光和月光混合，以恢复更明确的昼夜分区；同时降低城市亮点阈值、扩大邻域暖色发光并增加高亮星核，使繁华地区和交通走廊更醒目。闪烁仍只作用于少量高亮像素，关闭动画时固定，不新增独立帧循环。
- 首页事件层改为内容感知：整个节点区域与卡片网格空白处允许指针穿透到地球，实际节点卡、列表、筛选、搜索和高级面板继续独立接收交互。新增两张卡片的宽屏回归，运行时寻找右下方裸露地球区域完成拖动，并反向确认卡片中心仍由卡片拦截；地球自适应尺寸和不同卡片数量不依赖硬编码点击坐标。
- 最终验证：交互式 Chromium 深色页面、1630×574 宽屏截图、贴边蒙版几何、固定太阳时间昼夜像素、手动太阳方向和无遮挡拖动专项均通过；全仓跟踪内容 ESLint（继续排除开始前已存在且不得修改的未跟踪交接文件）、`vue-tsc --build`、Vite production build、`git diff --check` 和 ZIP 完整性检查通过；Playwright 完整回归 89/89 通过。构建仅保留既有 VueUse PURE 注释和大分块非阻断提示。
- 第五版测试包为 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，SHA-256：`57d0fd76d27ef0b9bda9707448dbde90b5c00276ee3c1d9339dd92dbe893466f`，本哈希取代第四版同名包。真实 Komari 覆盖导入、设置保存/重开、硬刷新及 Safari/真实 GPU 长时验收仍由用户测试确认；确认后再另行取得提交、推送、标签或 Release 授权。

## 2026-08-10 realistic 淡蓝宽幅光晕与聚居密度夜光收口（M4/M6）

- 状态：done；用户要求外圈统一回归蓝色直觉并继续加宽，同时指出上一轮北美和东亚高密度地区出现过亮白团，要求亮度按人口/城市密度形成梯度。本节取代上一节关于第五版光晕、夜间星芒、89 项回归和旧包校验和的当前结论；仍未提交、推送、创建标签或 Release。
- 资源核验：当前 `earth-night.jpg` 为 3600×1800 的 NASA Earth Observatory 2016 Black Marble 夜光图，原图已包含北美、欧洲、印度和东亚的密集聚居灯光；现场“点太少”的主要原因是 shader 对暗弱夜光信号过滤过强，不是源纹理缺少城市。实现继续只在原始夜光信号覆盖区域生成点状增强，不按行政区或屏幕位置均匀撒点，因此无人区仍保持稀疏。
- 深色大气层改为两种同色系淡蓝：日照侧 `#93daff`、夜侧 `#60a5fa`，随太阳在相机空间中的方向自然插值。外扩宽度按可见地球投影半径的 20% 计算并限制在 48–128px；蒙版从球面内侧 10px 接入、贴地处达到峰值，再经宽肩部和 10px 柔化向外完全透明，消除球体与光晕断层并形成克制的蓝光溢出。浅色模式仍关闭额外外扩层，流星继续位于半透明光晕上方。
- 夜间灯光采用 8 邻域保留暗弱聚居信号，并以 960×480 的稳定经纬网格生成受 Black Marble 强度约束的细粒度光点。点位出现概率和亮度都随 `settlementMask` 上升；亮度使用二次曲线拉开稀疏地区、普通城市与大都市圈层级。连续发光层、夜景底色和最高 emissive 均下调，最终北美与东亚截图中不再出现烧白亮团，稀疏区柔和可见，高密度走廊仍更亮。
- 夜面地貌单独回升到 0.84、环境补偿回升到 0.13，不再通过抬高城市峰值解决整体可读性；固定太阳时间测试继续要求白昼平均亮度至少为夜面 1.5 倍、夜面平均亮度大于 18 且保有足够方差。新增北美夜间旋转截图与暖色像素门槛，确认手动拖动后城市灯光仍留在真实地理夜面。
- 验证流程修正：Playwright 配置使用 `vite preview` 读取 `dist/`，每次 shader 视觉参数修改后必须先重新 production build，再运行截图用例；本轮曾因遗漏该顺序看到旧截图，已通过零强度诊断定位并纠正，最终截图和全量测试均基于最新生产构建。
- 最终验证：ESLint（无 `--fix`，排除开始前已存在且不得修改的未跟踪交接文件）、`vue-tsc --build`、Vite production build、`git diff --check` 与 ZIP 完整性检查全部通过；昼夜、北美夜光、宽屏光晕专项 3/3 通过，Playwright 完整回归 90/90 通过。Vite 仅保留既有 VueUse PURE 注释与大分块非阻断提示。
- 第六版测试包为 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，9,243,345 bytes，SHA-256：`6534e503fe4baf6e7a418666be71624a4fd65cc821a7ad71fd50c8fd65de275b`；压缩数据完整，保留 `komari-theme.json`、`preview.png`、版本化预览和 `dist/` 契约，本哈希取代第五版同名包。真实 Komari 覆盖导入、硬刷新、深浅色切换及 Safari/真实 GPU 长时验收仍等待用户确认；通过后再另行取得 GitHub 提交、推送、标签或 Release 授权。

## 2026-08-10 realistic 参考图式细颗粒夜光再平衡（M4/M6）

- 状态：done；用户在第六版真实 Komari 澳洲夜面截图中确认城市光点被压得近乎消失，并澄清目标不是移除闪耀，而是参考北美夜景图实现“数量多、颗粒小、亮度有梯度”。本节取代上一节关于第六版夜光强度、960×480 点阵、90 项回归和旧包校验和的当前结论；光晕、昼夜、无遮挡拖动实现保持不变，仍未提交、推送、创建标签或 Release。
- 光点几何从 960×480 提高到 1440×720 经纬网格，同一实际尺寸下单点更小；每个点由清晰核心和 26% 低强度微光组成，不扩大都市圈轮廓。暗弱聚居信号入选阈值由 0.96 降至 0.90，高密度区阈值为 0.36，因此增加的是受 Black Marble 原始夜光约束的细点和道路/聚居带，不会在海洋、沙漠或无人区均匀造光。
- 点亮度按 `settlementMask` 的 1.55 次曲线从 0.30 过渡到 0.60，深色总强度为 1.80；颜色调整为更接近参考图的暖黄 `1.0 / 0.74 / 0.34`。高密度都市圈通过“更多点 + 更亮核心”表现，普通城市和小型聚居区保持较暗；闪烁幅度反而由 0.22 收至 0.14，避免动画峰值造成忽明忽暗或重新烧白。
- 新增澳洲固定夜面与无遮挡拖动回归，并将像素读取扩展为可指定球面区域。北美截图上半部约 1467 个暖色可见像素、澳洲约 204 个，密度差异符合两地聚居规模；两处回归均要求暖色点达到下限且过曝点少于可见暖点的 30%，防止再次在“大片过亮”和“几乎没有”之间摆动。
- 全量运行中既有 realistic 流星用例连续两次在固定 `drilling + 360ms` 采样时已经进入 `landed`。产品动画未改；测试改为先以 40ms 间隔锁定钻入前半段（`tailProgress < 0.62`），再等待 240ms 验证尾部继续缩短，原有头部锁点、路径递减、最终落地和批次契约均保留。该用例连续复跑 2/2，通过随后完整回归。
- 最终验证：全仓跟踪内容 ESLint（继续排除开始前已存在且不得修改的未跟踪交接文件）、`vue-tsc --build`、Vite production build、`git diff --check` 与 ZIP 完整性检查全部通过；北美/澳洲/昼夜专项 3/3 通过，Playwright 完整回归 91/91 通过。Vite 仅保留既有 VueUse PURE 注释和大分块非阻断提示。
- 第七版测试包仍为 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，9,243,351 bytes，SHA-256：`9fa7de6360424c1a8a1d3eee14568ee2866d27cec01305d721b0fc6b73befdc3`；压缩数据完整，本哈希取代第六版同名包。真实 Komari 覆盖导入、硬刷新、澳洲/北美夜面、深浅色切换及 Safari/真实 GPU 长时验收仍等待用户确认；确认后再另行取得 GitHub 提交、推送、标签或 Release 授权。

## 2026-08-10 realistic 分层聚居夜光与浅色海面高光修正（M4/M6）

- 状态：done；用户在第七版真实 Komari 东亚夜面中确认细点仍偏少，并指出浅色模式海面中央出现宽大的局部亮斑。本节取代上一节关于第七版城市点密度、浅色曝光、91 项回归和旧包校验和的当前结论；版本号、光晕、昼夜和无遮挡拖动契约不变，仍未提交、推送、创建标签或 Release。
- 资源复核继续确认 `earth-night.jpg` 的 Black Marble 原始纹理包含东亚、印度、欧洲、北美沿海及交通走廊的大量弱光信号，现场大面积缺点主要来自 shader 筛选门槛。基础 1440×720 点阵降低弱光入选阈值，高密度区域阈值从 0.36 降到 0.22；另加 1920×960 的更细都市点阵，只在高 `settlementMask` 区域按 1.6 次曲线增加小点。两层取较大值而非相加，避免交叠烧白；单点亮度仍按 1.72 次人口/灯光强度曲线从 0.24 到 0.60 递增，因此沿海发达城市最密最亮、普通城市次之、低密度区域保持星点，无原始灯光信号的区域不均匀造光。
- 浅色中央亮斑确认为 MeshPhong 水面高光与实时方向光叠加形成的宽大镜面反射，并非昼夜 shader 的白昼范围。浅色模式将水面镜面色压至接近黑色、把 shininess 提高以收窄残余反射，并降低方向光强度；同时把白昼表面强度统一到 1.34、浅色白昼环境补偿提高到 0.23，改由地球主体地貌自然提亮，避免移除高光后整体变暗。深色模式的既有水面与方向光参数保持不变。
- 新增东亚固定夜面截图与像素层级回归，要求暖色可见点超过 300、柔和点多于强亮点且过曝点少于暖点 30%；新增浅色固定太阳时间与旋转后的海面截图，并锁定 `data-light-ocean-specular=suppressed`。与既有北美和澳洲定点截图联合检查后，东亚/北美高密度走廊显著多于澳洲稀疏海岸，点仍保持细颗粒且亮度有梯度；浅色海面未再出现中央圆形探照灯亮斑。
- 最终验证：全仓跟踪内容 ESLint（继续排除开始前已存在且不得修改的未跟踪交接文件）、`vue-tsc --build`、Vite production build、`git diff --check` 和 ZIP 完整性检查全部通过；东亚、浅色海面、昼夜、北美、澳洲专项 5/5 通过，Playwright 完整回归 93/93 通过。Vite 仅保留既有 VueUse PURE 注释与大分块非阻断提示。
- 第八版测试包仍为 `komari-glassops-v1.0.6-build-3cf87e4-dirty.zip`，9,243,499 bytes，SHA-256：`ef167dae469a59516e9ccb89113b4fc1d776c6918bc2b64e11f127ae31391828`；压缩数据完整并保留顶层 `komari-theme.json`、`preview.png`、版本化预览和 `dist/` 契约，本哈希取代第七版同名包。真实 Komari 覆盖导入、硬刷新、东亚夜面、浅色白昼及 Safari/真实 GPU 长时验收仍等待用户确认；确认后再另行取得 GitHub 提交、推送、标签或 Release 授权。

## 2026-08-11 v1.0.7 realistic 最终调光与发布前收口（M4/M6）

- 状态：发布前验证完成；用户已明确授权以 `v1.0.7` 提交并推送 GitHub。本节取代上一节关于 `v1.0.6-dirty` 测试包、93 项回归和未取得发布授权的当前结论。开始前既有未跟踪文件 `docs/handoff-2026-08-10-v1.0.6-post-release.md` 继续原样保留并明确排除在本次提交之外。
- 浅色模式刺眼黄白地表已单独压缩：shader 依据日间纹理暖色差与地表亮度识别沙漠等高亮暖色区域，仅在浅色模式把其部分饱和度向中性亮度收敛并压低峰值；同时浅色白昼表面强度由 1.34 收至 1.24、曝光为 1.00，深色模式的昼夜层级和大气参数不受影响。最终北非—中东固定构图中暖色高亮像素为 9,609 / 48,400（19.85%），低于 22% 回归门槛，中心球面平均亮度仍大于 42，地形保持清晰而不再发黄刺眼。
- 夜光继续使用 NASA 2016 Black Marble 原始地理信号驱动的两层细颗粒点阵；密度与亮度随聚居信号增加，高密度沿海和都市圈更密更亮，稀疏地区仅保留柔和星点。宽幅淡蓝大气、实时昼夜、城市闪烁、无遮挡区域拖动和卡片拦截契约均保留。
- 回归新增“浅色日照沙漠舒适度”像素检查与固定截图；既有流星测试中两处依赖单帧瞬态状态的等待改为验证同一稳定语义：批次允许观察到完成冷却或已安全进入下一序列，Cobe 对齐直接比较流星目标与国旗的共享投影坐标并等待完整路径生成。没有修改流星产品实现；两项稳定性用例独立重复 6/6 通过，最终 Playwright 完整回归 94/94 通过。
- 主题清单、README、CHANGELOG、预览源、1600×900 的 `preview.png` / `preview-v1.0.7.png` 和 `docs/release-v1.0.7.md` 已统一到 `1.0.7`。发布工作流继续由 `main` 上版本变化触发，在 GitHub Actions 中重新执行类型、ESLint、Chromium Playwright 与构建，再创建 `v1.0.7` 标签和 Release。
- 发布前最终本地验证：ESLint（无 `--fix`，排除既有未跟踪交接文件）、`vue-tsc --build`、Vite production build、`git diff --check` 和 Playwright 94/94 均通过；预览图两份 SHA-256 一致。正式发布包需在提交后以干净提交 SHA 重新构建并校验，远端标签、Release、资产与 Actions 状态仍须在推送后复核。
- 外部验收边界不变：本地 Chromium/WebGL 与自动化不能替代真实 Komari 覆盖导入、设置保存/重开、硬刷新，以及 Safari/真实 GPU 长时间旋转和流星叠加验证。

## 2026-08-11 v1.0.7 GitHub CI 慢速运行器时序收稳（M6）

- 首个发布提交 `68ccfde` 已推送到 `main`，但独立 Visual Regression（run `31411607031`）与 Release On Version Bump（run `31411610715`）均在 Ubuntu GitHub runner 上失败，未创建 `v1.0.7` 标签或 Release。通过已认证 GitHub 连接读取的日志确认，前者为 92/94、后者为 90/94；共同失败均集中在 realistic 高成本截图和短暂流星动画阶段。
- 三个截图用例的像素与几何断言没有失败，均是在最新 globe/WebGL 渲染较慢的 CI 上耗尽 Playwright 默认 30 秒总时限；为这三项标记 `test.slow()`，只把总预算提高到 Playwright 慢速用例标准，不改变任何视觉阈值。浅色海面与沙漠测试虽在 CI 接近 30 秒但已通过，保持原契约不动。
- 流星失败来自宿主机命令往返期间错过约数百毫秒的 drilling 阶段，且批次在几何读取时可能恰好处于空冷却。测试改为在浏览器页面自身的 `requestAnimationFrame` 循环里原子捕获 drilling 起点、后续收尾和 landed 三态；长弧几何独立等待下一组有效三路径后仍按原比例断言。产品动画时长、路径、遮挡和渲染代码未修改，像素、亮度、几何与交互阈值均未放宽。
- 修正后四个受影响用例各重复 3 次共 12/12 通过，随后完整 Playwright 94/94 通过（2.4 分钟）；ESLint、Vue 类型检查与 `git diff --check` 同步通过。需将本节与测试修正作为补充提交推送，然后等待新 Visual Regression 成功，再从最新 `main` 手动触发仓库既有 `workflow_dispatch` 发布入口，确保标签和正式 ZIP 指向包含 CI 修正的最终提交。
- 补充提交 `2b1ad18` 推送后，普通 Release 检查按设计因版本未再次变化而成功跳过；新 Visual Regression（run `31413627389`）仍为 92/94。日志显示高成本超时已解决；澳洲首轮仅因 43 个暖点的 30% 为 12.9、实际整数强点为 13 而差一个离散像素，重试通过；流星持续失败则因页面循环仍持有被下一批替换的旧 SVG 元素。
- 最终测试修正为：30% 城市强点上限按整数像素向上取整，仍保持同一比例语义；流星逐帧循环每帧从 overlay 查询当前 `launch-order=0` 路径，并只在 `tailProgress`、尾距和实际路径长度同时变化后记录后态。澳洲与流星组合复测前 9/10 暴露一帧数据/几何更新先后差，加入三值原子条件后流星连续 8/8 通过，最终完整 Playwright 再次 94/94 通过（2.4 分钟）。
