# Komari GlassOps 当前任务交接备份

> 导出时间：2026-07-28（Asia/Shanghai）
> 用途：结束当前 Codex 任务后，在新任务中继续开发、验证和打包。
> 状态：本轮主体实现已落盘，但最终回归、资源版本号收口和正式构建尚未完成。

## 1. 工作区快照

- 项目目录：`/Users/williamm/.codex/.chatgpt-projects/g-p-6a5dc7f64dc48191a1a5d54905dc0164/komari-glassops`
- 当前分支：`main`
- 当前 HEAD：`9c9a7ee`（上游基线提交）
- Git 状态：大量已修改和新增文件，全部尚未提交。
- 远端：目前只有 `upstream`，指向 `https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism.git`。
- 尚未创建或配置 GlassOps 自有 `origin`，尚未提交、推送、打 Tag 或创建 GitHub Release。
- 主题名称：`Komari GlassOps`
- 主题短名称：`GlassOps`
- 当前版本：`1.0.0`
- 作者：`Schmidt`
- 计划仓库：`https://github.com/Schmidttt/komari-glassops`
- 主题清单预览文件：`preview-v1.0.0.png`
- 上游许可证：MIT；`LICENSE` 保留，`NOTICE.md` 记录上游来源和致谢。

重要：当前工作树包含从最初 GlassOps 二开到现在的全部改动，不能用 `git reset --hard`、整仓 `git checkout -- .` 等方式粗暴回退，否则会丢失大量尚未提交的成果。

## 2. 用户本轮最新需求

本轮正在处理以下五类改动：

1. 管理后台主题设置页：
   - 顶部主题标题和“保存”按钮固定不动。
   - 删除页面最底部重复的“保存”按钮。
   - 顶部增加“全部设置”和各设置分类标签。
   - 点击标签快速定位到对应设置项。
   - 页面滚动时自动高亮当前分类。
   - 分类名称按实际标题显示，不保留 `01、02……` 编号。
2. 首页总览卡片：
   - “系统分布”等长系统名只显示简洁摘要，例如 `Debian…`、`Ubuntu…`。
   - 悬浮提示继续显示完整分布内容。
3. 首页快捷控制条：
   - 不得侵入或遮挡地球区域。
   - 宽度自适应收缩。
   - 较窄桌面隐藏按钮图标，仅保留文字与数量。
4. 首页宽屏适配：
   - 应用外壳不再固定在旧的 1280px。
   - 兼容 1920、2560 等主流宽屏，同时保持移动端和普通桌面布局。
5. 地球区域：
   - 在线数量状态与左侧总览卡片顶部对齐。
   - 地球与左侧卡片间距自适应。
   - 宽屏适当放大地球。
   - realistic 深色模式略微提亮，但仍保留昼夜区别和地理信息可读性。

## 3. 本轮已经完成的实现

### 3.1 管理后台主题设置吸顶导航

采用“外部增强脚本 + 样式”的方式扩展 Komari 官方编译后的管理端，没有直接修改压缩后的 React chunk。

已实现：

- 仅在 `/admin/theme_managed` 路由启用。
- 自动识别主题设置页、顶部标题区、保存按钮、设置标题和底部重复保存按钮。
- 顶部标题/保存区吸顶。
- 生成“全部设置 + 7 个实际分类”的横向导航。
- 点击分类平滑滚动；启用减少动画时使用即时滚动。
- 滚动时执行 scrollspy，自动更新选中分类。
- 横向标签过多时只滚动标签容器，不触发整个页面跳动。
- 隐藏页面底部重复保存区域。
- 使用 `MutationObserver` 适配 React 页面重渲染。
- 使用 `ResizeObserver` 同步顶部吸顶高度。
- 支持文档滚动和内部滚动容器两种情况。

核心文件：

- `scripts/assets/glass-admin-enhancements.js`：可维护的源脚本。
- `public/admin-app/glass-admin-enhancements.js`：管理端实际镜像。
- `scripts/assets/glass-admin.css`：可维护的管理端样式源。
- `public/admin-app/glass-admin.css`：管理端实际镜像。
- `scripts/sync-komari-admin.ts`：同步官方管理端时自动复制、注入并哈希上述 CSS/JS。
- `public/admin-app/index.html`：管理端入口。

当前两个镜像已经完全一致：

- CSS 源与镜像 SHA-256：`c37fcb78af51d07d7f540d78373aa6ab029040ce33532e1ed4e0125c1cd848dd`
- JS 源与镜像 SHA-256：`9ce2661cd0c5aa8042c1d5ddf6b6c0c6e097ac86ae84262dda9904b7116d71f9`

尚未收口的问题：

`public/admin-app/index.html` 仍引用旧查询版本：

```text
glass-admin.css?v=7dc1382b30f4
glass-admin-enhancements.js?v=ea4a9643b0f8
```

下一步应更新为当前哈希前 12 位：

```text
glass-admin.css?v=c37fcb78af51
glass-admin-enhancements.js?v=9ce2661cd0c5
```

### 3.2 设置分类正式命名

`komari-theme.json` 已移除标题编号，当前分类为：

1. 基础与外观
2. 首页布局
3. 首页总览卡片
4. 高级工具与隐私
5. 节点卡片、列表与快捷控制
6. 节点详情图表
7. 自定义背景

### 3.3 首页宽屏架构

以下应用外壳已从旧的 1280px 上限调整为 2200px，并保持 `w-full`：

- `src/App.vue`
- `src/components/Header.vue`
- `src/components/Footer.vue`

目标效果：

- 1440/1920/2560 宽屏能利用更多横向空间。
- 超宽屏仍有 2200px 内容上限，避免无限拉伸。
- 现有移动端与中等桌面断点继续保留。

### 3.4 总览卡片与系统分布

`src/components/NodeGeneralCards.vue` 已完成：

- 增加 `formatDistributionSummary`。
- 系统分布主值只显示简洁系统族，例如 `Ubuntu…`、`Debian…`。
- 完整系统版本和各自数量继续保留在 Tooltip 中。
- 增加布局测试锚点：
  - `overview-summary`
  - `overview-card-grid`
  - `overview-earth`
- 桌面总览区高度分档提升：
  - `md`：64
  - `xl`：72
  - `2xl`：80
- 1800px 以上采用左侧 5/12、右侧地球 7/12 的比例。

### 3.5 快捷控制条

`src/views/HomeView.vue` 已完成：

- 快捷控制图标增加 `quick-control-icon` 类。
- 1536px 以下隐藏快捷控制图标，只保留文字与数量。
- 1280px 以上控制条宽度限制为约 50%。
- 1800px 以上控制条宽度限制为约 41.67%。
- 保留横向滚动兜底，避免按钮挤压或进入地球区域。

### 3.6 地球尺寸、位置和亮度

`src/components/NodeGeneralCards.vue` 给地球区域注入：

```text
--earth-max-size: clamp(30rem, 36vw, 43rem)
```

`src/components/NodeEarthRealisticGlobe.vue`：

- 使用自适应最大尺寸，不再固定 `max-w-md`。
- 去除桌面负向位移。
- 在线数量状态放到容器左上角，并增加玻璃背景和细描边。
- 深色滤镜亮度提高到 `brightness(1.26)`。
- 亮色和深色仍使用不同滤镜，保留昼夜感。

`src/components/NodeEarthCobeGlobe.vue`：

- 同步使用自适应最大尺寸。
- 去除大幅负向位移。
- 在线数量状态放到左上角，与左侧卡片顶部对齐。

## 4. 本轮新增或调整的测试

主要文件：

- `tests/visual/fixtures/komari.ts`
- `tests/visual/config-matrix.spec.ts`
- `tests/visual/earth-renderers.spec.ts`
- `playwright.config.ts`

新增配置覆盖：

- 1920px 全高清、暗色、compact、realistic。
- 2560px 超宽屏、亮色、mini、realistic。
- 宽屏内容实际宽度大于 1280px。
- 2200px 最大内容宽度。
- 地球宽度大于旧版约 448px 上限。
- 快捷控制条不越过左侧卡片区域。
- 在线状态顶部与左侧卡片顶部接近对齐。
- 页面无横向溢出。

## 5. 当前验证结果

### 已通过或已观察到的结果

- 本轮早期版本的针对性 ESLint、`vue-tsc --build`、Vite production build 和 `git diff --check` 曾通过。
- 在最后一次 scrollspy 阈值和“全部设置”判断修改之前，Playwright 配置矩阵与地球渲染测试运行结果为 `20/21`。
- 唯一失败是测试预期写成 `Debian…`，而当前模拟数据实际显示 `Ubuntu…`；页面本身显示正确，测试断言已改成 `Ubuntu…`，但尚未重新运行。
- 1920px 失败截图实际显示：
  - 页面已使用宽屏空间。
  - 总览区和地球比例正常。
  - 地球明显放大。
  - 在线状态与左侧卡片顶部基本对齐。
  - 快捷控制没有覆盖地球。
  - 6 列节点卡正常排列。
- 管理端隔离 fixture 已确认：
  - 顶部只保留一个可见保存按钮。
  - 8 个导航标签均生成。
  - 顶部吸顶和分类导航基本生效。

### 尚未重新验证的部分

最后又调整了以下管理端逻辑，因此旧的通过结果不能当作最终结果：

- 文档滚动事件改为绑定 `window`。
- scrollspy 阈值改为 `header.bottom + nav.height + 96`。
- “全部设置”改为依据主题页面相对滚动视口的位置判断。
- 点击标签后立即设置选中态。
- 标签自动滚动只影响导航条自身。
- 顶部导航与标题区间距进一步收紧。

必须重新执行：

1. 最新 CSS/JS 引用哈希修正。
2. ESLint。
3. TypeScript/Vue 类型检查。
4. `git diff --check`。
5. Playwright 配置矩阵与地球测试。
6. 管理端 fixture 的点击、滚动和吸顶复测。
7. 生产构建与 ZIP 结构检查。

## 6. 当前构建包状态

现有中间包：

```text
komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip
```

- 当前文件 SHA-256：`84a80a0e97a63af35a9b70dfa7498a8c629d4eb2b0cecf7d5ad033c0e49d453b`
- ZIP 内版本：`1.0.0`
- ZIP 顶层包含：
  - `komari-theme.json`
  - `preview.png`
  - `preview-v1.0.0.png`
  - `dist/`

注意：这个 ZIP 生成于最后几次管理端脚本和样式微调之前，且入口仍可能带旧资源哈希。因此它只是中间测试包，不应作为 v1.0.0 正式发布资产。

## 7. 整个 GlassOps 当前已有的重要功能

以下是此前轮次已经完成并保留在当前工作树中的核心成果，继续开发时不要误删：

- 基于 Glassmorphism 社区主题继续开发的 GlassOps 品牌、README、NOTICE 和发布工作流。
- 首页每节点自定义 0–3 个 TCPing 任务。
- mini 卡片仅展示所选第一个 TCPing 任务的延迟和丢包。
- TCPing 历史范围切换、真实采样格和统一双行 Tooltip：
  - `HH:mm:ss`
  - `RTT: 5 ms`
  - `Loss: 0.0%`
- 详情延迟图的聚合丢包轨道、多任务 Tooltip、单击固定、图外单击解除和 Esc 解除。
- 节点收藏、收藏筛选。
- 增强节点搜索。
- 节点详情前后切换。
- 最多 4 台节点实时对比。
- 30 台以上节点的延迟渲染。
- 多种总览卡片、快捷控制、列表字段和详情图表预设。
- `mini / compact / comfortable / large` 四种节点卡尺寸。
- realistic / cobe / tiled 三种地球模式。
- realistic 昼夜主题差异、节点旗帜和舒缓光轨。
- cobe 低亮点阵与局部光点。
- tiled 本地简约国家分区、多节点聚合和明暗适配。
- 多套玻璃配色、色觉辅助、亮暗模式可读性优化。
- 新版主题预览图和论坛发布文章：
  - `preview.png`
  - `preview-v1.0.0.png`
  - `docs/preview.png`
  - `docs/forum-release-v1.0.0.md`

## 8. 新任务建议的继续顺序

### 第一步：阅读项目约束

先完整阅读：

- 根目录 `AGENTS.md`
- `src/AGENTS.md`
- `AIAGENTREADME.md`
- `AICACHE.md`
- 本交接文件

### 第二步：只修正管理端入口资源哈希

把 `public/admin-app/index.html` 中的查询版本改为：

```text
glass-admin.css?v=c37fcb78af51
glass-admin-enhancements.js?v=9ce2661cd0c5
```

不要直接修改 `public/admin-app/assets/` 中的压缩 React chunk。

### 第三步：运行静态检查

在项目根目录执行项目现有依赖环境下的：

```bash
pnpm exec eslint \
  src/App.vue \
  src/components/Header.vue \
  src/components/Footer.vue \
  src/views/HomeView.vue \
  src/components/NodeGeneralCards.vue \
  src/components/NodeEarthRealisticGlobe.vue \
  src/components/NodeEarthCobeGlobe.vue \
  scripts/sync-komari-admin.ts \
  scripts/assets/glass-admin-enhancements.js \
  tests/visual/config-matrix.spec.ts \
  tests/visual/fixtures/komari.ts

pnpm exec vue-tsc --build
git diff --check
```

如果本机 Bun 可用，也可以遵循仓库脚本使用 `bun run lint`、`bun run type-check`；不要因为工具差异修改锁文件或依赖版本。

### 第四步：重新验证管理端交互

至少验证：

- 初始状态选中“全部设置”。
- 页面顶部标题、分类导航和保存按钮吸顶。
- 页面只显示一个“保存”按钮。
- 点击“节点详情图表”后正确滚动并立即高亮该分类。
- 手动滚动到其他分类时，选中态自动切换。
- 点击“全部设置”返回顶部后仍选中“全部设置”。
- 标签过多时仅导航条内部横向滚动。
- 浅色、深色和窄屏均无文字重叠。

### 第五步：运行视觉回归

```bash
pnpm exec playwright test \
  tests/visual/config-matrix.spec.ts \
  tests/visual/earth-renderers.spec.ts \
  --project=chromium
```

通过后再运行完整视觉测试：

```bash
pnpm exec playwright test --project=chromium
```

重点人工查看：

- 320、390、1024、1280、1440、1920、2560 宽度。
- mini、compact、comfortable、large。
- realistic、cobe、tiled。
- 深色和浅色。
- 快捷控制条是否进入地球区域。
- 在线状态是否与左侧卡片顶部对齐。
- 系统分布摘要是否为 `Ubuntu…` 或实际系统族。
- 地球是否放大但不遮挡节点卡。

### 第六步：最终构建和包结构检查

完成所有回归后再运行正式构建：

```bash
pnpm run build
```

然后检查：

- ZIP 可正常解压。
- 包内清单版本为 `1.0.0`。
- `preview.png` 与 `preview-v1.0.0.png` 均存在。
- `dist/index.html` 存在。
- `dist/admin-app/glass-admin.css` 存在。
- `dist/admin-app/glass-admin-enhancements.js` 存在。
- `dist/admin-app/index.html` 引用的是最新哈希。
- 记录最终文件大小和 SHA-256。

### 第七步：更新交接日志

在 `AICACHE.md` 中追加：

- 本轮最终实现。
- 全部验证命令和结果。
- 最终 ZIP 文件名、大小和 SHA-256。
- 真实 Komari 环境仍未验证的边界。

## 9. 发布前仍需完成的独立门槛

即使本地测试全部通过，正式发布 v1.0.0 前仍应：

1. 在真实 Komari 中导入最终 ZIP。
2. 确认主题管理卡片显示新版预览图；如果仍显示旧图，先排除浏览器图片缓存。
3. 在真实管理端验证吸顶设置导航和保存行为。
4. 在真实首页验证公开访客与管理员两种状态。
5. 使用真实节点验证三种地球、旗帜、多节点聚合和 TCPing。
6. 在 iPhone/iPad Safari 至少做一次实际检查。
7. 创建 GlassOps 自有 GitHub 仓库并设置 `origin`。
8. 只在用户明确授权后再提交、推送、打 Tag 和发布 Release。
9. 下载 GitHub Release 资产，再重新导入 Komari 做最终闭环验证。

## 10. 已知风险和边界

- 当前改动尚未形成提交，继续工作前建议先复制整个项目目录作为文件级备份；不要在未确认差异的情况下清理工作树。
- 管理端增强依赖官方编译后页面的 DOM 结构和 Radix 类名，未来同步新版 komari-web 后必须复测。
- 当前管理端增强只在隔离 fixture 中做过阶段性检查，最后一次 scrollspy 修改后尚未完整复测。
- 真实 Komari 安装、真实后台保存、iPhone/iPad Safari 和正式 Release 下载回装仍不是已完成事实。
- realistic 地球使用较大的纹理和 globe chunk，构建可能继续出现既有的大分块提示；这不是当前功能错误，但属于后续性能优化候选。
- 上游未来升级应继续采用选择性同步，不能直接覆盖 GlassOps 当前首页、详情、TCPing 和管理端增强。

## 11. 可直接用于新任务的开场说明

```text
请继续开发本地项目：
/Users/williamm/.codex/.chatgpt-projects/g-p-6a5dc7f64dc48191a1a5d54905dc0164/komari-glassops

先完整阅读：
1. AGENTS.md
2. src/AGENTS.md
3. AIAGENTREADME.md
4. AICACHE.md
5. docs/handoff-2026-07-28-wide-admin-round.md

当前任务是继续收口“主题设置页吸顶分类导航 + 首页宽屏适配 + 总览摘要/快捷控制 + 地球自适应放大和深色补光”。主体代码已写入，但请先核对工作树，修正 public/admin-app/index.html 的 CSS/JS 查询哈希，然后完成静态检查、管理端交互回归、Playwright 全矩阵、最终构建和 ZIP 结构验证。

不要重置或清理当前未提交改动，不要提交、推送或发布，除非我随后明确授权。
```

## 12. 2026-07-28 Komari 1.3.1 追加收口

- 已确认 Komari 1.3.1 未修改主题模型、主题配置保存接口或主题静态路由。旧设置入口失败是主题清单同时混用了 `redirect` 和仅由本地前端认识的 `schema`：官方 managed 页面只读取 `configuration.data[]`，因此不会显示 GlassOps 自定义页签。
- `komari-theme.json` 当前使用 `configuration.type=redirect`、`configuration.data=/?glassops-settings=1`。分类设置页由 `src/views/ThemeSettingsView.vue` 自己渲染并调用官方主题设置接口；不要再把入口改回 `/admin/theme_managed`。
- 1.3.1 指标请求兼容位于 `src/services/metrics.service.ts`；公开 Ping 任务的 `weight -> id` 稳定顺序位于 `src/utils/homePingConfig.ts`。
- 延迟任务置顶按钮位于 `src/components/HomePingSettingsDialog.vue`；首项禁用，后续项单击后直接成为第 1 项。
- realistic/cobe 共用的直径约束位于 `src/components/NodeGeneralCards.vue` 的 `--earth-max-size`。渲染器内部不得重新使用 `scale()` 或负向 `translateY()`，否则会重新造成短宽屏顶部裁切。
- 最终验证：ESLint、Vue 类型检查、生产构建和 `git diff --check` 通过，Playwright 52/52 通过。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,134,022 bytes；SHA-256 `36d3458177787e7ee2aec895cfcba2bd165d1258209a873649bda923e6928d32`。
- 下一步只剩真实 Komari 1.3.1 导入回装验证；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 13. 2026-07-28 后台右侧内嵌与最终视觉收口

> 本节取代第 12 节关于 `redirect` 入口、52/52 回归和旧 ZIP 校验和的结论。

- 设置入口现为 Komari 1.3.1 正式支持的 `configuration.type=raw`，显示名为“主题设置”。官方 `/admin/theme_raw` 保留管理后台侧栏和顶栏，并在右侧 iframe 内加载 `/?glassops-settings=1&embedded=1`；没有修改 Komari 核心代码。
- 内嵌设置页隐藏主题前台 Header/Footer/Background；标题、保存按钮和八个分类页签组成完整吸顶块。分类定位使用实时吸顶高度加 28px 安全距离，设置标题不会再被遮挡。
- 每个分类只使用一个设置卡片，内部字段以分隔线组织；内嵌页面只保留顶部一个保存按钮。
- realistic 相机高度为 `1.58`，球体在 1920×900 外壳内贴近顶部但保留非零像素边距；cobe 与 realistic 使用相同外壳尺寸和顶部定位。
- cobe 已移除常驻弧线，改为每 3.4 秒一组、三束错峰、完成后消失的临时流星光轨。
- 最终验证：ESLint、Vue 类型检查、Vite production build、`git diff --check` 通过；Playwright 54/54 通过。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,135,393 bytes；778 个条目；SHA-256 `6420882910fcca1d0c735b783531b3fa9a21ac1343d03365a13c92824d905278`。
- 后续仅剩真实 Komari 1.3.1 覆盖导入、硬刷新和后台右侧内容区闭环验证。未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 14. 2026-07-29 原生设置契约与本轮四项修复

> 本节是当前最新结论，取代第 13 节关于 `raw` iframe、54 项旧回归和旧 ZIP 校验和的说明。

### 14.1 主题设置最终架构

- `komari-theme.json` 现在使用 Komari 1.3.1 正式支持的 `configuration.type=managed`，入口名称仍为“主题设置”。
- `configuration.data` 是官方实际读取的数组，包含 7 个标题分组与 46 个设置字段；不存在另一个仅主题前端识别的 `schema`。
- 这是目前最稳妥且唯一能真正继承 Komari 后台顶部深浅色、强调色、字体、原生控件状态和内容区宽度的方案。此前 raw iframe 必须自行监听并仿制父页面状态，而且天然隔离于父级 CSS/React 主题上下文，容易出现用户截图中的配色不一致、宽边距和偶发加载失败。
- managed 的正式契约不能承载自定义吸顶分类页签或完全自定义卡片布局。不要为了恢复这些视觉增强再改回 raw 或向官方编译产物注入 DOM；官方入口应优先稳定、原生和可升级。
- `src/views/ThemeSettingsView.vue` 已兼容从 `configuration.data[]` 读取字段，保留为主题自身直达/故障回退页，不是官方侧栏入口的默认实现。
- 后台 appearance/color 是当前管理员浏览器的本地偏好；主题首页的 `themeMode/glassColorPreset` 是面向所有访客的全局主题设置，两者继续分开。

### 14.2 cobe、TCPing 与 tiled

- cobe 覆盖层改为 COBE 2.0.1 的实际投影：球面向量、`phi`、`theta`、aspect 和 `1.18` 视觉比例与底层 marker 共用同一计算。
- 国旗与三束临时流星每一帧都重新投影；流星 SVG 终点直接使用目标国旗的同一投影坐标。自动旋转 700ms 前后回归的 marker/meteor 最大误差均不超过 1px。
- TCPing 历史条由根容器统一处理 pointer enter/move，按横向几何命中小格；异步数据抵达后会在鼠标不移动的情况下恢复当前提示。新增 1.8 秒延迟 RPC 的首刷回归。
- tiled 在线 marker 为 3.15 秒低强度青色呼吸圈，离线为 1.7 秒红色提示；节点间错峰，系统减少动态效果或主题“减弱过渡动画”都会关闭动画。
- realistic/cobe 销毁时显式释放 WebGL context，避免连续切换造成浏览器上下文残留。

### 14.3 验证与产物

- ESLint（直接执行，无 `--fix`）：通过。
- `vue-tsc --noEmit` / 构建内 `vue-tsc --build`：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- Playwright 完整回归：54/54 通过，覆盖 managed 清单、cobe 旋转对准、TCPing 静止指针首批数据、tiled 在线/离线动画、三种地球深浅色、宽屏/窄屏与卡片矩阵。
- 浏览器截图人工检查：cobe 三束流星落点与国旗一致；tiled 光圈没有遮盖旗帜和地图文字。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,136,204 bytes；条目数：778。
- SHA-256：`def82733d3f30889ffc49310cdb21ee1c07bda113f123d6f90828573f0552a25`。
- 包内已确认：`komari-theme.json`、`preview.png`、`preview-v1.0.0.png`、`dist/index.html`；清单为 `managed / 主题设置`。

### 14.4 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入上述校验和对应包并硬刷新。
- 必查：官方设置页生成 7 组 46 项；顶部深浅色/强调色对 managed 表单生效；保存后公开首页读取相应全局主题设置；真实数据下首次 TCPing 悬浮、cobe 旋转和 tiled 离线红色提示正常。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 15. 2026-07-29 tiled、首刷悬浮与总览网格最终收口

> 本节是当前最新结论，取代第 14 节关于 54/54 回归、旧 ZIP 大小、旧条目数和旧 SHA-256 的说明；第 14.1 节的 managed 设置架构结论继续有效。

### 15.1 tiled 地图

- `src/components/NodeEarthTiledMap.vue` 的侧栏标题改为“节点分布”，状态显示“在线率”；不再使用含义不明的 `EARTH MAP 100%`。
- 地区列表的数量始终显示，单节点也明确标记 `×1`。
- 在线点提高填充、描边、双层阴影与呼吸圈亮度；离线继续使用更明显的红色状态。`prefers-reduced-motion` 和主题减弱动画设置仍会停止呼吸动画。

### 15.2 TCPing 首次悬浮与数值对齐

- `src/components/PingHistoryStrip.vue` 的交互根节点增加小幅纵向命中空间；首批异步样本到达后会按已保存指针坐标重新计算当前格，覆盖首页卡片首次加载和刷新。
- `src/components/PingChart.vue` 记录图表相对坐标与客户端坐标，并在文档捕获阶段持续校验当前图表区域。加载遮罩消失、任务摘要撑高页面、ECharts 首帧完成后都会尝试重放提示；当布局改变使旧客户端坐标失效时，回退到原图表相对坐标。
- 首页小格提示、首页卡片弹窗和详情图表提示中的时间、RTT、Loss、聚合丢包率统一为固定列、右对齐与等宽数字。

### 15.3 cobe 流星与总览卡网格

- cobe 与 realistic 使用一致的三束流星节奏、时长、线宽、渐变和淡出方案；cobe 仍按当前球面投影逐帧更新国旗和终点，旋转时二者误差不超过 1px。
- `src/components/NodeGeneralCards.vue` 通过 `useElementSize` 读取真实容器宽度并计算列数。偶数卡片优先选择可整除的列数排满每行；奇数最后一行不拉伸，卡片宽度与上一行一致。
- 自动化覆盖 1920px 下 10 张卡片为 5×2，以及 1280px 下 7 张卡片为 4+3；窄屏继续按断点降为 3、2 或 1 列。

### 15.4 验证与最终产物

- ESLint（直接执行，无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅保留既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- Playwright 完整回归：57/57 通过。
- 人工截图检查：tiled 光点更清晰且不压地图文字；总览奇数尾行未拉伸；cobe/realistic 流星视觉一致；图表提示数值右对齐。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,137,267 bytes；条目数：779。
- SHA-256：`39f2f09c708d861a4263d8375c5bb0332e87c1c1403afc595433a0785237fae0`。
- 包内已确认：`komari-theme.json` 为 `managed / 主题设置`，共 53 个声明项（7 个标题分组、46 个字段）；`preview.png`、`preview-v1.0.0.png`、`dist/index.html` 与 `dist/admin-app/` 均存在。

### 15.5 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入该 SHA-256 对应包并硬刷新，验证官方设置页与真实数据首刷。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 16. 2026-07-29 tiled 节点提示、全域悬浮与 cobe 实时换肤收口

> 本节是当前最新结论，取代第 15 节关于 57/57 回归、旧 ZIP 大小和旧 SHA-256 的说明；第 14.1 节的 managed 设置架构结论继续有效。

### 16.1 tiled 地图交互

- 地图上的地区序号改为黄色实心圆、深色粗体数字和轻微投影，提高小尺寸地图中的辨识度。
- `useNodeGeoClusters` 的地区聚合项保留 `uuid / name / online` 节点摘要。
- 地图标记组和右侧地区列表卡都支持 pointer 与键盘 focus；统一的 fixed portal 浮层展示当前地区下的服务器名称与在线/离线状态，不受地图容器裁切。
- 地区列表继续明确显示节点数量，单节点显示 `×1`；侧栏标题为“节点分布”，状态为在线率。

### 16.2 首页与详情页悬浮

- `DataTooltip` 改为 fixed Teleport 浮层，整张首页总览卡都是悬浮命中区域；系统分布、虚拟化等卡片无需点击即可查看完整详情。
- `PingHistoryStrip` 扩展了不侵入相邻布局的纵向命中区，并保存最后指针坐标；异步数据首批到达后会自动恢复当前小格提示。
- `PingChart` 同时保存文档坐标和图表横向比例。加载遮罩、摘要卡异步增高或 ECharts 首帧改变图表纵向位置时，仍可使用横向比例重放首次提示。
- 首页提示和详情图表提示的时间、RTT、Loss 与聚合丢包率均维持固定列、右对齐和等宽数字。

### 16.3 cobe 连续流星与实时换肤

- cobe 流星改用整条 SVG 路径的连续揭示动画，`stroke-dasharray / stroke-dashoffset` 基于归一化路径长度，不再出现多段断线。
- 三束流星仍按当前 COBE 投影逐帧更新路径，终点和国旗共享同一坐标；旋转时自动化回归误差不超过 1px。
- 主题切换不再销毁 globe、移除包装层或调用 `WEBGL_lose_context`。同一 canvas 通过 COBE `update()` 实时更新 `dark / diffuse / mapBrightness / baseColor / markerColor / glowColor`，因此不会在切换过程中出现白块或破图。
- 浅色 cobe 使用独立的 `dark=0` 浅蓝灰球体、更高漫反射与浅色辉光；画布滤镜同步平滑过渡，和深色模式形成明确层级。
- WebGL context 仅在组件真正卸载时释放，避免主题切换期间的上下文空窗。

### 16.4 验证与产物

- 相关 ESLint（直接执行、无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- Playwright 完整回归：60/60 通过，包含单击直接切换深浅色、cobe 复用同一画布且不会切换为空白的覆盖。
- 关键回归包含：tiled 地图/侧栏两处节点提示、总览整卡悬浮、首页 TCPing 刷新后首次悬浮、详情图表异步首帧悬浮、cobe 连续流星与旋转对准、同一 canvas 的实时深浅色切换。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,139,673 bytes；条目数：779。
- SHA-256：`c372fcf49d5bfc1ecd08b146a0f416a3fad8b911be1ed7ac65aa043ffafecebc`。
- 包内已确认：`komari-theme.json` 为 `1.0.0 / managed / 主题设置`，共 53 个声明项（7 个标题分组、46 个字段）；`preview.png`、`preview-v1.0.0.png`、`dist/index.html` 和 `dist/admin-app/index.html` 均存在。

### 16.5 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入该 SHA-256 对应包并硬刷新。
- 必查：真实 RPC 返回较慢时首页/详情首次悬浮、主题按钮连续切换时 cobe 无白块、不同显卡和 Safari 的浅色 cobe 显示，以及官方 managed 设置页保存。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 17. 2026-07-29 cobe 统一配色、完整流星与指标图标收口

> 本节是当前最新结论，取代第 16 节关于 cobe 浅色配色、流星飞行边界、60/60 回归和旧 ZIP 校验和的说明；第 14.1 节的 managed 设置架构结论继续有效。

### 17.1 cobe 深浅色体系

- 深浅色共用青蓝主色以及青绿、暖金、蓝紫和洋红点缀，只分别调整明度、对比度、漫反射和辉光。
- 浅色不再使用几乎无色的灰白球：点阵保持足够深度，球面为中等饱和度蓝青，外缘为清晰但克制的青色辉光。
- 深色继续保持夜景层级，但球面和点阵不再趋近纯黑；与浅色切换时能看出是同一套视觉语言。
- 主题切换仍在同一 COBE canvas 上通过 `update()` 实时完成，不销毁 WebGL 上下文。

### 17.2 cobe 流星完整飞行

- 旧实现把流星起点也作为经纬度投影；起点随地球旋转到不可见半球时，整条路径会返回空值，表现为飞到一半突然消失。
- 新实现只要求目标国旗可见：终点逐帧读取国旗的当前投影坐标，起点和弧线在屏幕空间相对目标生成，因此飞行末段始终存在并锁定目标。
- 三束流星使用相同线宽、渐变和节奏，飞行 3.2 秒后短暂保留尾迹再淡出；每组间隔为 4.4 秒。

### 17.3 节点指标图标

- 新增 `src/components/NodeMetricLabel.vue`，统一承载 CPU、内存、硬盘、流量和 TCPing 的 Iconify 矢量图标及文字。
- 五类图标分别使用靛蓝、青绿、暖橙、蓝紫和青色；浅色、深色分别设置前景、半透明底色和描边。
- `NodeCard.vue` 的 mini 与完整卡片复用同一标签组件，未改变指标数值、进度条或 TCPing 任务布局。

### 17.4 验证与最终产物

- ESLint（直接执行、无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- Playwright 完整回归：61/61 通过；覆盖 cobe 深浅色实时切换、流星飞行末段、指标图标、三种地球、四种卡片尺寸、宽屏/手机与异步首次悬浮。
- 人工截图检查：浅色 cobe 已有稳定蓝青层次，深色保持相同色彩身份；图标在两种模式下均清楚且未破坏对齐。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,140,233 bytes；条目数：779。
- SHA-256：`52b636d20784ab2953b76028dd31978f90302fa7796af10d70acedb38dea680e`。
- 包内已确认：`komari-theme.json` 为 `1.0.0 / managed / 主题设置`，共 53 个声明项（7 个标题分组、46 个字段）；`preview.png`、`preview-v1.0.0.png`、`dist/index.html` 和 `dist/admin-app/index.html` 均存在。

### 17.5 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入该 SHA-256 对应包并硬刷新。
- 必查：实际显卡/Safari 下 cobe 长时间旋转和连续深浅色切换、真实 RPC 时序下首页/详情首次悬浮，以及官方 managed 设置页保存。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 18. 2026-07-29 cobe 同尺寸光晕、球面切线流星与 tiled 精确悬浮收口

> 本节是当前最新结论，取代第 17 节关于 cobe 球面混色、流星方向、tiled 地图命中范围和旧 ZIP 校验和的说明；第 14.1 节的 managed 设置架构结论继续有效。

### 18.1 cobe 球面与大气层

- 浅色球面删除覆盖点阵的大面积深绿色洗色，使用中等饱和度蓝色基底、蓝青辉光和深色点阵；深色沿用同一蓝青色彩身份，只降低明度并收紧漫反射。
- 新增 `.cobe-atmosphere` 独立大气层，径向颜色从中心的深蓝、青蓝过渡至球缘浅青，再柔和衰减。
- 大气层采用 `inset: 2.8%` 对齐 `COBE_VISUAL_SCALE=1.18` 的可视球体直径；基础尺寸与地球一致，仅 box-shadow 提供克制的外缘扩散。
- 深浅色切换仍复用同一 WebGL canvas，通过 `globe.update()` 更新颜色和光照，不销毁上下文。

### 18.2 cobe 球面切线流星

- 路径继续以当前可见国旗投影为终点，但起点不再沿球心到国旗的径向生成。
- 新路径根据“球心到国旗”的径向向量计算正交切线，沿切线布置起点，并用向外抬升量生成三次贝塞尔弧线；视觉上沿球面绕行后进入目标，而不是垂直扎向国旗。
- 三束流星使用三段渐变；浅色采用更深的蓝、紫橙、青绿保证白底可见，深色采用蓝青、紫金、青绿亮尾。飞行时长、错峰和 4.4 秒组间隔保持不变。
- 自动化检查三项：终点与国旗误差不超过 1px；到达切向量与球面径向的归一化点积绝对值小于 0.35；飞行末段三条路径仍存在且可见。

### 18.3 tiled 精确悬浮命中

- 地图标记的呼吸圈、实心点和连接线统一 `pointer-events: none`，不再承担服务器清单预览。
- 只有国旗与紧贴国旗上方的黄色编号组成可聚焦命中组；两者分别支持 pointer 和键盘 focus，显示当前位置的服务器名称与在线/离线状态。
- 右侧地区卡的整卡悬浮继续保留，单节点仍显示 `×1`。

### 18.4 验证与最终产物

- ESLint（直接执行、无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- Playwright 完整回归：61/61 通过；包含三种地球深浅色、cobe 同 canvas 切换、同尺寸大气层、球面切线流星、tiled 精确悬浮、四种节点卡尺寸、宽屏/手机与异步首次悬浮。
- 人工截图检查：浅色 cobe 已无大面积深绿遮盖；深浅色点阵均清楚；光晕贴合球缘；流星自然弯向国旗；tiled 国旗和编号均能弹出清单，闪烁点不能。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,140,444 bytes；条目数：779。
- SHA-256：`b1f444516404e145ad005ef3ea41537cb2a45cf7d581e29eaeadd612fbd818da`。
- 包内已确认：`komari-theme.json` 为 `1.0.0 / managed / 主题设置`，共 53 个声明项（7 个标题分组、46 个字段）；`preview.png`、`preview-v1.0.0.png`、`dist/index.html` 和 `dist/admin-app/index.html` 均存在。

### 18.5 下一步边界

- 仍需在真实 Komari 1.3.1 覆盖导入该 SHA-256 对应包并硬刷新。
- 必查：实际显卡/Safari 下 cobe 光晕、长时间旋转、切线流星和连续深浅色切换；真实节点聚合后的 tiled 国旗/编号命中；真实 RPC 时序下首页/详情首次悬浮。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 19. 2026-07-30 cobe 冰青数字地球、环轨星芒与高密度点阵收口

> 本节是当前最新结论，取代第 18 节关于 cobe 视觉层级、61/61 回归和旧 ZIP 校验和的说明；第 14.1 节的 managed 设置架构结论继续有效。

### 19.1 实现边界

- 参考图是静态合成视觉，本轮未直接复制图片或引入新的 3D 框架；继续使用项目已有 COBE 2.0.1，保留真实旋转、拖拽、节点经纬度投影、国旗定位和响应式几何。
- COBE 球面采样提高到 `22000`。32 个分布式环境光点使用冰青、青绿、暖金、蓝紫、洋红和白色低亮点缀，避免重新退化为单色蓝球。
- 深色为深海蓝基底、冰青高亮点阵和夜景光晕；浅色为玻璃冰蓝基底、白青高密度点阵和更轻的球缘辉光。两者保留同一色彩身份，仅调整明度、漫反射和对比度。

### 19.2 经纬网、轨道与星芒

- WebGL 画布外叠加 9 条裁切到球面的经纬网；线条使用渐变、短虚线和亚像素宽度，提供参考图的数字网格质感但不压过真实大陆点阵。
- 新增 3 条不同角度的环形轨道。每条轨道都有独立运行粒子；粒子由中心光点和十字星芒组成，分别使用冰青或暖金色辉光。
- 新增 7 个固定十字星芒和 28 个低亮微粒；动画错峰，且在 `prefers-reduced-motion` 或主题“减弱过渡动画”开启时隐藏动态装饰。
- 大气层继续与可视球体直径对齐，中心到球缘由深蓝、青蓝向浅青过渡，只有阴影向外自然衰减，不形成独立外壳。

### 19.3 流星、国旗与主题切换

- 三束流星沿当前国旗投影的球面切线生成三次贝塞尔曲线，终点每帧重算；旋转期间不会漂离节点，也不会因为经纬度起点转入背面而半途消失。
- 流星继续复用统一地球流星计划的线宽、三段配色、飞行时长、组间隔和错峰节奏；与 realistic 的交互语义一致，但按 COBE 当前投影实时更新。
- 深浅色仍在同一 canvas 上通过 `globe.update()` 原位换肤，不销毁或重建 WebGL context，因此连续切换不会出现白块或破图。

### 19.4 验证与最终产物

- ESLint（直接执行、无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- 地球定向 Playwright 回归：14/14 通过，覆盖三种地球深浅色、cobe 同 canvas 换肤、9 条经纬网、3 条轨道、3 个轨道星芒粒子、7 个固定星芒、三束流星及顶部几何。
- Playwright 完整回归：61/61 通过，覆盖后台 managed 设置、宽屏/窄屏、四种节点卡、首次异步悬浮、图表提示、三种地球和指标图标。
- 人工截图检查：深色点阵和冰青球缘层级明确；浅色使用白青大陆点阵和玻璃冰蓝球面；经纬网、轨道和星芒可见但不遮挡国旗及卡片文字。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,143,648 bytes；条目数：780。
- SHA-256：`fd4b2d7af6b87af19c4b54dfcb17431a62310dec310c1f3477db2486be1ab5a7`。
- 包内已确认：`komari-theme.json` 为 `1.0.0 / managed / 主题设置`，包含更新后的 cobe 说明、两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`。

### 19.5 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入该 SHA-256 对应包并硬刷新。
- 必查：Safari 与实际显卡下的高密度点阵、SVG/SMIL 轨道粒子、连续深浅色切换、长时间旋转和真实节点国旗定位。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 20. 2026-07-30 realistic/Cobe 真共享流星与 tiled 引线全局避障

> 本节是当前最新结论，取代第 19 节关于“统一流星参数”、61/61 回归和旧 ZIP 校验和的说明；第 14.1 节的 managed 设置架构结论继续有效。

### 20.1 流星差异的真实根因

- 用户现场截图证明旧版没有实现真正共享：`src/utils/earthMeteor.ts` 只集中保存了数量、时序和颜色，realistic 仍调用 globe.gl 的 arc 材质，Cobe 则自行绘制 SVG path。
- 两套底层渲染器对曲线采样、虚线、尾迹、透明度和动画的解释不同，所以即使参数同名，实际视觉仍明显不同。
- 本轮新增 `src/components/EarthMeteorOverlay.vue`，它现在是两种 3D 地球唯一的流星渲染器。realistic 的原生 meteor arcs 和 Cobe 旧 meteor SVG 均已删除。

### 20.2 公共流星组件

- 公共组件统一生成三束三次贝塞尔路径，统一三段渐变、线宽、`round` 端点、归一化虚线长度、飞行时长、错峰和淡出动画。
- realistic 仅负责用 globe.gl 当前相机把目标节点换算为屏幕坐标；Cobe 仅负责用当前 `phi / theta / aspect / scale` 把节点换算为屏幕坐标。投影结果之外的渲染代码完全相同。
- Cobe 旋转期间每帧重算公共路径终点，继续锁定当前国旗；两种模式都以 `data-meteor-renderer="shared-svg"` 暴露可验证契约。
- Playwright 会比较两种模式的实际计算样式，包括动画名称与时长、虚线、线宽、端点和路径长度，避免以后只改参数文件却没有切换真实渲染器。

### 20.3 tiled 密集节点避障

- 标记候选位置由原来的局部国旗碰撞，升级为全局布局计分：优先处理密集位置，再从 21 个候选偏移中选择代价最低的位置。
- 代价同时包含国旗/编号重叠、新引线穿过已有国旗、已有引线穿过新国旗、引线靠近其他节点原点、引线互相交叉和候选偏移距离。
- 引线终点裁切到所属国旗边框，不再穿过自己的国旗内容。
- 12 个分布式密集节点测试把引线与所有非所属国旗转换为屏幕坐标，要求交叉计数为 0；人工截图同时检查了编号、地图文字和悬浮区域。

### 20.4 验证与最终产物

- ESLint（直接执行、无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- Playwright 定向回归：4/4 通过。
- Playwright 完整回归：62/62 通过；覆盖 managed 设置、宽屏/窄屏、首次异步悬浮、指标图标、三种地球深浅色、公共流星契约和 tiled 密集节点避障。
- 人工截图检查：realistic 与 Cobe 使用同样的金色/冰青渐变、线宽、圆角和短尾衰减；tiled 12 节点压力场景未出现引线穿过其他国旗或编号。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,145,016 bytes；条目数：781。
- SHA-256：`58cfe65f9924e75d364379e95adae013e7c96622d956c0a75875f055c4e939ba`。
- 包内已确认：`komari-theme.json` 为 `1.0.0 / managed / 主题设置`；`preview.png`、`preview-v1.0.0.png`、`dist/index.html` 与 `dist/admin-app/index.html` 均存在。旧包 `fd4b2d7a...` 及更早校验和均已失效。

### 20.5 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新。
- 必查：Safari 与实际显卡下两种 3D 地球的公共 SVG 流星、长时间旋转后的投影跟随，以及真实节点经纬度高度聚合时的 tiled 标记布局。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 21. 2026-07-30 realistic/Cobe 共享长弧流星最终收口

> 本节是当前最新结论，取代第 20 节关于短尾流星、62 项旧截图结论和旧 ZIP 校验和的说明；第 14.1 节的 managed 设置架构与第 20.3 节的 tiled 全局避障结论继续有效。

### 21.1 现场问题与视觉目标

- 用户现场截图显示上一轮公共 SVG 虽然解决了两套渲染器不一致的问题，但流星仍表现为散落短线，缺少上一版 realistic 的长弧、远近运动、连续拖尾和落点渐变。
- 本轮以“每隔一段时间出现一组三束、随机方向与颜色、线束略粗、长弧由远及近、拖尾和颜色/粗细向服务器落点渐变”为验收目标，不再追加独立装饰轨迹。

### 21.2 唯一公共长弧组件

- `EarthMeteorOverlay.vue` 仍是 realistic 与 Cobe 唯一流星渲染器；两种地球只提供当前可见国旗的屏幕投影，不包含任何独立流星路径或材质实现。
- 每组固定 3 束，每 5 秒生成一组，单束飞行 3.2 秒并以约 115ms 错峰；目标服务器、左右进入方向和三套调色板起始位置均按组随机。
- 每条路径以地球中心和当前目标投影为基准，沿约 106–132 度圆弧建立三次贝塞尔曲线。起点保持在地球可视半径附近，终点控制线按球面切线进入国旗，使光束呈自然绕行而不是垂直刺入。
- 每束由柔光层、3.2px 主线和细亮核心层叠加；五段线性渐变从透明尾端经过主色过渡至亮色落点，统一使用圆角端点、完整路径推进和抵达后淡出。
- 深色使用冰青、金色和蓝紫高光；浅色使用更深的蓝青、琥珀和紫青组合。主题切换时只重新生成公共调色板，不会替换 canvas 或落回两套视觉。

### 21.3 可验证契约

- 两种地球继续暴露 `data-meteor-renderer="shared-svg"`，并声明同一 `5000ms / 3200ms` 时序。
- Playwright 同时检查 3 条柔光、3 条主线、3 条核心线、五段渐变、3.2px 主线、长弧最低路径长度和至少两个进入方向。
- realistic 与 Cobe 的计算后动画名称、飞行时长、虚线、线宽、端点和三层结构必须完全一致；Cobe 旋转期间每帧更新路径终点，换肤后 canvas 身份保持不变且三束使用新的浅色调色板。

### 21.4 验证与最终产物

- ESLint（直接执行、无 `--fix`）：通过。
- Vue 类型检查：通过。
- Vite production build：通过；仅有既有 VueUse PURE 注释和大 globe chunk 提示。
- `git diff --check`：通过。
- 流星定向回归：4/4 通过。
- Playwright 完整回归：62/62 通过；覆盖后台设置、宽屏/窄屏、首次异步悬浮、指标图标、三种地球深浅色、共享长弧流星契约、Cobe 换肤/旋转跟随和 tiled 密集节点避障。
- 人工截图检查：realistic 与 Cobe 均呈连续长圆弧、柔光拖尾和清楚落点，不再出现现场截图中的散落短线；两种模式的粗细、圆角、颜色层级和飞行节奏一致。
- 最终包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`。
- 文件大小：8,145,632 bytes；条目数：781。
- SHA-256：`442a865677b4de1199deca2579301a48fba77f23883b7b0eaae8b6744cb998e5`。
- 包内已确认：`komari-theme.json` 为 `1.0.0 / managed / 主题设置`；`preview.png`、`preview-v1.0.0.png`、`dist/index.html` 与 `dist/admin-app/index.html` 均存在。旧包 `58cfe65f...` 及更早校验和均已失效。

### 21.5 下一步边界

- 仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新。
- 必查：Safari 与实际显卡上的 SVG 模糊/投影性能、真实经纬度节点聚合时的随机目标与落点、连续深浅色切换，以及长时间旋转后的 Cobe 投影跟随。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。

## 22. 2026-07-30 realistic/Cobe 流星真实路径“进洞”收口

> 本节是当前最新流星结论，取代第 21 节及其后旧记录中的 CSS 虚线推进、整体淡出、百分比落地和旧 ZIP 校验和；第 14.1 节 managed 设置架构、第 20.3 节 tiled 全局避障及上游 3.3.1/3.3.2 修复映射继续有效。

### 22.1 最终交互语义

- 每批开始时先锁定一个真实服务器目标，三束光从三个明显不同的方向按随机顺序错峰出发，三束共享同一个目标。
- 单束头部必须沿完整弧线抵达服务器位置，不能在半空降低整束透明度或被计时器清理。
- 头部到达后固定在服务器投影点。此后不是“整束淡出”，而是进入目标的曲线片段立即不再绘制，尾部继续向目标推进；视觉上等同于光束逐段钻进服务器位置的洞口。
- 只有尾端也进入目标后，该束才变为完成并移除。上一组三束全部完成且基准组间隔已满足后，才允许生成下一组。

### 22.2 实现方式

- 唯一公共组件仍是 `src/components/EarthMeteorOverlay.vue`，realistic 与 Cobe 均不再拥有独立流星渲染逻辑。
- 每束保留完整三次贝塞尔曲线，并在每个动画帧通过曲线分割计算实际可见子路径 `[tailProgress, headProgress]`。
- 状态机为 `waiting → flying → drilling → landed`：`flying` 中头尾共同推进并维持限定长度；`drilling` 中 `headProgress=1`，`tailProgress` 从尾部起点持续推进到 1；`landed` 时头尾均为 1，路径长度归零。
- SVG 渐变根据当前真实尾端和头端重算，柔光、主体和亮芯三层都使用同一条可见子路径，因此不会出现主体已入洞但光晕仍在半空残留。
- Cobe 每帧用当前旋转后的节点投影重建完整路径，钻入阶段的固定头部仍跟随国旗；realistic 使用当前 globe.gl 投影。运动状态机、曲线裁切、时序、线宽和主题配色完全共享。

### 22.3 验证

- ESLint：通过。
- Vue 类型检查：通过。
- Vite production build：通过。
- `git diff --check`：通过。
- Playwright 完整回归：66/66 通过。
- 定向几何测试覆盖：头部抵达误差不超过 0.2px、钻入中头部固定、尾部距离和可见路径长度逐帧缩短、尾端抵达后才隐藏、三束未全部完成前不启动下一组，以及 Cobe 旋转中的目标锁定。
- 临时视觉证明按顺序截取钻入起始、中段和结束三帧：起始帧头部已经在服务器目标且保留长尾；中段只剩洞口附近的短尾；结束帧尾端进入后路径才完全消失。

### 22.4 产物与边界

- 最终导入包：`komari-glassops-v1.0.0-build-9c9a7ee-dirty.zip`；8,146,860 bytes；781 个条目；SHA-256 `48bb190bfc54358ebf6bc02d9b9ff7a42b860bc51d1f3013bf1ef4ec45df4aa7`。压缩数据完整，包内清单为 `1.0.0 / managed / 主题设置`，并含两份预览图、`dist/index.html` 与 `dist/admin-app/index.html`；此前 `7e30ede8...` 及更早包均已失效。
- 仍需在真实 Komari 1.3.1 中覆盖导入并硬刷新，重点复核 Safari/实际显卡下的真实曲线裁切、Cobe 长时间旋转时的钻入锁点及连续深浅色切换。
- 当前工作树仍有大量未提交改动。禁止 reset、清理或覆盖无关文件；未经用户明确授权，不提交、不推送、不打 Tag、不发布 Release。
