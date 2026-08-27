import type { Page, Route } from '@playwright/test'

const FIXED_NOW = '2026-07-25T12:00:00.000Z'
const GIB = 1024 ** 3
const TIB = 1024 ** 4
const FIXTURE_IPV4_REGEX = /192\.0\.2\.(\d+)/
const FIXTURE_IPV6_REGEX = /2001:db8:abcd:(\d+)/

const REGION_FIXTURES = [
  { code: 'US', name: '主控-洛杉矶', cpu: 'Intel Xeon Gold 6152 CPU @ 2.10GHz' },
  { code: 'HK', name: '香港边缘节点-超长名称布局测试', cpu: 'AMD EPYC 7551 32-Core Processor' },
  { code: 'JP', name: '东京-高负载', cpu: 'AMD EPYC 7B13 64-Core Processor' },
  { code: 'SG', name: '新加坡-A100', cpu: 'AMD EPYC 9654 96-Core Processor' },
  { code: 'DE', name: '法兰克福-2680', cpu: 'Intel Xeon CPU E5-2680 v4 @ 2.40GHz' },
  { code: 'GB', name: '伦敦-离线归档', cpu: 'Intel N100' },
  { code: 'TW', name: '台北-流量预警', cpu: 'Ampere Altra Max M128-30' },
  { code: 'AU', name: '悉尼-IPv6', cpu: 'AMD Ryzen 9 9950X 16-Core Processor' },
] as const

const NODE_GEO_FIXTURES = [
  { latitude: 34.0522, longitude: -118.2437, city: 'Los Angeles', countryCode: 'US' },
  { latitude: 22.3193, longitude: 114.1694, city: 'Hong Kong', countryCode: 'HK' },
  { latitude: 35.6762, longitude: 139.6503, city: 'Tokyo', countryCode: 'JP' },
  { latitude: 1.3521, longitude: 103.8198, city: 'Singapore', countryCode: 'SG' },
  { latitude: 50.1109, longitude: 8.6821, city: 'Frankfurt', countryCode: 'DE' },
  { latitude: 51.5072, longitude: -0.1276, city: 'London', countryCode: 'GB' },
  { latitude: 25.033, longitude: 121.5654, city: 'Taipei', countryCode: 'TW' },
  { latitude: -33.8688, longitude: 151.2093, city: 'Sydney', countryCode: 'AU' },
  { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', countryCode: 'US' },
  { latitude: 22.6273, longitude: 120.3014, city: 'Kaohsiung', countryCode: 'TW' },
  { latitude: 34.6937, longitude: 135.5023, city: 'Osaka', countryCode: 'JP' },
  { latitude: 48.8566, longitude: 2.3522, city: 'Paris', countryCode: 'FR' },
] as const

export interface VisualFixtureOptions {
  fixedNow?: string
  dark?: boolean
  earthRenderer?: 'cobe' | 'realistic' | 'tiled'
  colorVisionFriendly?: boolean
  viewMode?: 'card' | 'list'
  nodeCardSize?: 'mini' | 'compact' | 'comfortable' | 'large'
  nodeLimit?: number
  hideEarth?: boolean
  hideGeneralCard?: boolean
  visitorInfoEnabled?: boolean
  glassColorPreset?: '翡翠' | '柔和' | '高对比' | '午夜'
  generalCardPreset?: '官方' | '基础' | '运维' | '资源' | '财务' | '流量' | 'GPU' | '资产' | '完整' | '自定义'
  generalCardKeys?: string
  homeQuickControlPreset?: '基础' | '流量' | '运维' | '完整' | '自定义'
  homeQuickControlKeys?: string
  disablePageAnimation?: boolean
  stopEarth?: boolean
  geoByNode?: boolean
  pingMetricDelayMs?: number
  pingRecordPreserveHours?: number
  approximatePingMetricStats?: boolean
  metricRangeAware?: boolean
  metricAggregationIntervalSeconds?: number
  missingCpuMetricHistory?: boolean
  pingTaskOrdering?: boolean
  backendVersion?: string
  nodeCustomTagsVisible?: boolean
  firstNodeTags?: string
  firstNodeTrafficLimit?: number
  homePingTaskSelections?: Record<string, number[]>
  loggedIn?: boolean
}

function uuidFor(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
}

function buildClients() {
  return Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const fixture = REGION_FIXTURES[index % REGION_FIXTURES.length]
    const uuid = uuidFor(index)
    return [uuid, {
      uuid,
      name: index < REGION_FIXTURES.length ? fixture.name : `${fixture.name}-${index + 1}`,
      cpu_name: fixture.cpu,
      virtualization: index % 3 === 0 ? 'docker' : 'kvm',
      arch: index % 4 === 0 ? 'aarch64' : 'x86_64',
      cpu_cores: index % 4 + 1,
      cpu_physical_cores: Math.max(1, index % 3 + 1),
      os: index % 2 === 0 ? 'Ubuntu 24.04.4 LTS' : 'Debian GNU/Linux 12',
      kernel_version: '6.8.0-visual-test',
      gpu_name: index === 3 ? 'NVIDIA A100 80GB PCIe' : '',
      ipv4: `192.0.2.${index + 10}`,
      ipv6: `2001:db8:abcd:${index + 1}::${index + 10}`,
      region: fixture.code,
      public_remark: index === 1 ? '长备注用于验证文本换行与裁切' : '',
      mem_total: (index % 4 + 1) * GIB,
      swap_total: index % 3 === 0 ? 2 * GIB : 0,
      disk_total: (index % 3 + 1) * 40 * GIB,
      version: '1.2.6-visual',
      weight: index,
      price: index === 5 ? 0 : 9.9 + index,
      billing_cycle: 365,
      auto_renewal: index % 2 === 0,
      currency: 'USD',
      expired_at: index === 6 ? '2026-08-02T00:00:00.000Z' : '2027-07-25T00:00:00.000Z',
      group: index < 6 ? '生产' : '测试,边缘',
      tags: index % 2 === 0 ? '核心节点<jade>;视觉回归长标签<blue>' : '边缘节点<orange>',
      hidden: false,
      traffic_limit: index === 6 ? 2 * TIB : 20 * TIB,
      traffic_limit_type: 'sum',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: FIXED_NOW,
    }]
  }))
}

function buildStatuses() {
  return Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const uuid = uuidFor(index)
    const offline = index === 5
    const highLoad = index === 2
    const trafficWarning = index === 6
    const memTotal = (index % 4 + 1) * GIB
    const diskTotal = (index % 3 + 1) * 40 * GIB
    return [uuid, {
      client: uuid,
      time: FIXED_NOW,
      cpu: offline ? 0 : highLoad ? 96.4 : 8 + index * 2.7,
      gpu: index === 3 ? 72.5 : 0,
      gpu_count: index === 3 ? 1 : 0,
      gpu_average_usage: index === 3 ? 72.5 : 0,
      gpu_detailed_info: index === 3 ? [{ name: 'NVIDIA A100', utilization: 72.5, memory_total: 80 * GIB, memory_used: 52 * GIB, temperature: 61 }] : [],
      ram: offline ? 0 : Math.round(memTotal * (0.28 + index * 0.025)),
      ram_total: memTotal,
      swap: index % 3 === 0 ? (index + 1) * 64 * 1024 ** 2 : 0,
      swap_total: index % 3 === 0 ? 2 * GIB : 0,
      load: offline ? 0 : 0.18 + index * 0.11,
      load5: offline ? 0 : 0.14 + index * 0.09,
      load15: offline ? 0 : 0.1 + index * 0.07,
      temp: offline ? 0 : 36 + index,
      disk: Math.round(diskTotal * (0.18 + index * 0.035)),
      disk_total: diskTotal,
      net_in: offline ? 0 : 32_000 + index * 91_000,
      net_out: offline ? 0 : 18_000 + index * 63_000,
      net_total_up: (index + 1) * 45 * GIB,
      net_total_down: trafficWarning ? 1.78 * TIB : (index + 1) * 62 * GIB,
      traffic_up: (index + 1) * 3 * GIB,
      traffic_down: (index + 1) * 5 * GIB,
      process: offline ? 0 : 72 + index * 4,
      connections: offline ? 0 : 140 + index * 17,
      connections_udp: offline ? 0 : 8 + index,
      online: !offline,
      uptime: offline ? 0 : (index + 3) * 86_400,
      message: '',
      updated_at: FIXED_NOW,
      ping: {
        1: { name: 'Tokyo', latest: offline ? -1 : 42 + index * 13, avg: 50 + index * 11, tail: 88 + index * 14, loss: offline ? 100 : index * 2.3, min: 32, max: 260 },
      },
    }]
  }))
}

const clients = buildClients()
const statuses = buildStatuses()
const PING_TASK_FIXTURES = [
  { id: 1, name: '洛杉矶' },
  { id: 2, name: '法兰克福' },
  { id: 3, name: 'Google' },
  { id: 4, name: 'Cloudflare' },
  { id: 5, name: 'ChatGPT' },
  { id: 6, name: 'DMIT-LAX-Pro' },
  { id: 7, name: 'BWG-LAX-DC6' },
  { id: 8, name: '东京' },
] as const

function buildRecords(uuid = uuidFor(0)) {
  const status = statuses[uuid] ?? statuses[uuidFor(0)]
  return Array.from({ length: 48 }, (_, index) => ({
    ...status,
    client: uuid,
    time: new Date(Date.parse(FIXED_NOW) - (47 - index) * 75_000).toISOString(),
    cpu: Math.max(1, Number(status.cpu) + Math.sin(index / 5) * 8),
    ram: Math.max(0, Number(status.ram) + index * 2 * 1024 ** 2),
    disk: Math.max(0, Number(status.disk) + index * 4 * 1024 ** 2),
    net_in: 80_000 + index * 12_000,
    net_out: 50_000 + index * 9_000,
  }))
}

const METRIC_KEYS = [
  'cpu.usage',
  'load.average',
  'memory.used',
  'memory.total',
  'swap.used',
  'swap.total',
  'temperature',
  'disk.used',
  'disk.total',
  'net.in.rate',
  'net.out.rate',
  'net.total.down',
  'net.total.up',
  'traffic.down',
  'traffic.up',
  'process.count',
  'connections.tcp',
  'connections.udp',
  'gpu.usage',
  'gpu.device.usage',
  'gpu.memory.used',
  'gpu.memory.total',
  'gpu.temperature',
  'ping.latency_ms',
  'ping.loss',
] as const

function metricValue(key: string, index: number, taskIndex = 0): number {
  const values: Record<string, number> = {
    'cpu.usage': 22 + Math.sin(index / 4) * 12,
    'load.average': 0.45 + Math.sin(index / 6) * 0.2,
    'memory.used': 1.2 * GIB + index * 3 * 1024 ** 2,
    'memory.total': 4 * GIB,
    'swap.used': 260 * 1024 ** 2 + index * 1024 ** 2,
    'swap.total': 2 * GIB,
    'temperature': 44 + Math.sin(index / 5) * 5,
    'disk.used': 18 * GIB + index * 4 * 1024 ** 2,
    'disk.total': 80 * GIB,
    'net.in.rate': 420_000 + index * 13_000,
    'net.out.rate': 280_000 + index * 9_000,
    'net.total.down': 860 * GIB + index * 11 * GIB,
    'net.total.up': 540 * GIB + index * 8 * GIB,
    'traffic.down': 8 * GIB + index * 2 * GIB,
    'traffic.up': 5 * GIB + index * GIB,
    'process.count': 86 + index % 9,
    'connections.tcp': 220 + index * 2,
    'connections.udp': 12 + index % 4,
    'gpu.usage': 0,
    'gpu.device.usage': 0,
    'gpu.memory.used': 0,
    'gpu.memory.total': 0,
    'gpu.temperature': 0,
    'ping.latency_ms': 4 + taskIndex * 21 + Math.sin((index + taskIndex) / 3) * (4 + taskIndex),
    'ping.loss': taskIndex === 5 && index % 11 === 0 ? 100 : index % (13 + taskIndex) === 0 ? 8 : 0,
  }
  return values[key] ?? 0
}

function buildMetricResponse(payload: Record<string, unknown>, options: VisualFixtureOptions = {}) {
  const requested = Array.isArray(payload.metric_keys) ? payload.metric_keys.map(String) : METRIC_KEYS
  const uuids = Array.isArray(payload.entity_ids)
    ? payload.entity_ids.map(String)
    : [typeof payload.entity_id === 'string' ? payload.entity_id : uuidFor(0)]
  const fallbackEnd = Date.parse(FIXED_NOW)
  const requestedEnd = typeof payload.end === 'string' ? Date.parse(payload.end) : fallbackEnd
  const requestedHours = typeof payload.hours === 'number' && Number.isFinite(payload.hours)
    ? Math.max(1, payload.hours)
    : 1
  const requestedStart = typeof payload.start === 'string'
    ? Date.parse(payload.start)
    : requestedEnd - requestedHours * 3_600_000
  const defaultPointCount = options.metricRangeAware ? 96 : 48
  const configuredIntervalSeconds = options.metricAggregationIntervalSeconds ?? 0
  const configuredIntervalMs = configuredIntervalSeconds * 1000
  const useConfiguredAggregation = configuredIntervalMs > 0 && requestedEnd - requestedStart >= configuredIntervalMs
  let intervalMs = 75_000
  if (useConfiguredAggregation)
    intervalMs = configuredIntervalMs
  else if (options.metricRangeAware)
    intervalMs = Math.max(1, (requestedEnd - requestedStart) / Math.max(1, defaultPointCount - 1))

  let rangeStart = fallbackEnd - (defaultPointCount - 1) * intervalMs
  if (useConfiguredAggregation)
    rangeStart = Math.ceil(requestedStart / intervalMs) * intervalMs
  else if (options.metricRangeAware)
    rangeStart = requestedStart
  const pointCount = useConfiguredAggregation
    ? Math.max(1, Math.floor((requestedEnd - rangeStart) / intervalMs) + 1)
    : defaultPointCount
  const points = Array.from({ length: pointCount }, (_, index) => ({
    time: new Date(rangeStart + index * intervalMs).toISOString(),
    index,
  }))
  const aggregationMetadata = useConfiguredAggregation
    ? {
        downsampled: true,
        downsample_algorithm: 'avg',
        interval_seconds: configuredIntervalSeconds,
        max_points: typeof payload.max_points === 'number' ? payload.max_points : undefined,
      }
    : { downsampled: false }
  const series = uuids.flatMap(uuid => requested
    .filter(key => !options.missingCpuMetricHistory || key !== 'cpu.usage')
    .flatMap(key => key.startsWith('ping.')
      ? PING_TASK_FIXTURES.map((task, taskIndex) => ({
          metric_key: key,
          entity_id: uuid,
          type: 'gauge',
          tags: { task_id: String(task.id), task_name: task.name },
          ...aggregationMetadata,
          points: points.map(point => ({ time: point.time, value: metricValue(key, point.index, taskIndex), count: 1 })),
        }))
      : [{
          metric_key: key,
          entity_id: uuid,
          type: 'gauge',
          tags: {},
          ...aggregationMetadata,
          points: points.map(point => ({ time: point.time, value: metricValue(key, point.index) })),
        }]))
  return { start: points[0].time, end: points.at(-1)?.time, series, count: series.length }
}

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

async function handleRpc(route: Route, options: VisualFixtureOptions = {}): Promise<void> {
  const payload = route.request().postDataJSON() as { id: unknown, method: string, params?: Record<string, unknown> }
  const uuid = typeof payload.params?.uuid === 'string' ? payload.params.uuid : uuidFor(0)
  const metricNodeUuids = Array.isArray(payload.params?.entity_ids)
    ? payload.params.entity_ids.map(String)
    : [typeof payload.params?.entity_id === 'string' ? payload.params.entity_id : uuid]
  const requestedNodeLimit = Math.max(1, Math.min(12, options.nodeLimit ?? 12))
  const limitedClients = Object.fromEntries(Object.entries(clients).slice(0, requestedNodeLimit))
  const fixtureClients = options.firstNodeTags === undefined && options.firstNodeTrafficLimit === undefined
    ? limitedClients
    : {
        ...limitedClients,
        [uuidFor(0)]: {
          ...limitedClients[uuidFor(0)],
          tags: options.firstNodeTags ?? clients[uuidFor(0)].tags,
          traffic_limit: options.firstNodeTrafficLimit ?? clients[uuidFor(0)].traffic_limit,
        },
      }
  const fixtureStatuses = Object.fromEntries(
    Object.entries(statuses).filter(([nodeUuid]) => nodeUuid in fixtureClients),
  )
  const pingRecords = Array.from({ length: 48 }, (_, index) => ({
    task_id: 1,
    client: uuid,
    time: new Date(Date.parse(FIXED_NOW) - (47 - index) * 75_000).toISOString(),
    value: index % 17 === 0 ? -1 : 76 + index,
  }))
  const orderedPingTaskFixtures = options.pingTaskOrdering
    ? [PING_TASK_FIXTURES[2]!, PING_TASK_FIXTURES[0]!, PING_TASK_FIXTURES[1]!]
    : PING_TASK_FIXTURES.slice(0, 3)
  const pingTasks = orderedPingTaskFixtures.map((task, index) => ({
    id: task.id,
    name: task.name,
    interval: 60,
    loss: index === 1 ? 3.2 : 0,
    weight: index + 1,
    default_on: true,
    clients: Object.keys(fixtureClients),
  }))
  let result: unknown

  switch (payload.method) {
    case 'rpc.ping':
      result = 'pong'
      break
    case 'common:getNodes':
      result = fixtureClients
      break
    case 'common:getNodesLatestStatus':
      result = fixtureStatuses
      break
    case 'common:getNodeRecentStatus':
      result = { count: 48, records: buildRecords(uuid) }
      break
    case 'common:getRecords':
      result = payload.params?.type === 'ping'
        ? { count: 48, records: pingRecords, tasks: pingTasks }
        : { count: 48, records: buildRecords(uuid) }
      break
    case 'public:getClientRecentRecords':
      result = buildRecords(uuid)
      break
    case 'public:getRecordsByUUID':
      result = { count: 48, records: buildRecords(uuid), load_type: 'all', has_gpu_data: false }
      break
    case 'public:getPingRecords':
      result = { count: 48, records: pingRecords, tasks: pingTasks }
      break
    case 'public:getPublicPingTasks':
      result = pingTasks
      break
    case 'public:listMetricDefinitions':
      result = METRIC_KEYS.map(name => ({ name, description: name, type: 'gauge', retention_days: 30 }))
      break
    case 'public:queryMetrics':
      result = buildMetricResponse(payload.params ?? {}, options)
      break
    case 'public:getPingMetricStats':
      result = {
        start: FIXED_NOW,
        end: FIXED_NOW,
        interval_seconds: 60,
        stats: metricNodeUuids.flatMap(nodeUuid => PING_TASK_FIXTURES.map((task, index) => ({
          entity_id: nodeUuid,
          task_id: String(task.id),
          name: task.name,
          type: 'icmp',
          interval: 60,
          tags: {},
          total: 48,
          valid: index === 5 ? 43 : 48,
          loss: index === 5 ? 10.42 : 0,
          loss_approximate: options.approximatePingMetricStats ?? false,
          min: 2 + index * 18,
          max: 16 + index * 28,
          avg: 5 + index * 21,
          latest: 6 + index * 22,
          p50: 5 + index * 21,
          p99: 14 + index * 27,
          stddev: 1.5 + index,
          p99_p50_ratio: 1.2 + index * 0.12,
        }))),
        count: metricNodeUuids.length * PING_TASK_FIXTURES.length,
      }
      break
    case 'public:getNodesInformation':
      result = Object.values(fixtureClients)
      break
    case 'public:getMe':
      result = { logged_in: false }
      break
    case 'public:getVersion':
    case 'common:getBackendVersion':
    case 'rpc.getVersion':
      result = { version: options.backendVersion ?? '1.2.6-visual', hash: 'visual' }
      break
    default:
      result = null
  }

  if (
    (payload.method === 'public:queryMetrics' || payload.method === 'public:getPingMetricStats')
    && options.pingMetricDelayMs
  ) {
    await new Promise(resolve => setTimeout(resolve, options.pingMetricDelayMs))
  }

  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(jsonRpcResult(payload.id, result)),
  })
}

export async function installKomariFixture(page: Page, options: VisualFixtureOptions = {}): Promise<void> {
  const settings = {
    themeMode: options.dark ? 'dark' : 'light',
    dataUpdateInterval: 60,
    rpcTransportMode: 'http',
    defaultViewMode: options.viewMode ?? 'card',
    nodeCardSize: options.nodeCardSize ?? 'compact',
    earthRenderer: options.earthRenderer ?? 'realistic',
    hideEarth: options.hideEarth ?? false,
    hideGeneralCard: options.hideGeneralCard ?? false,
    stopEarth: options.stopEarth ?? true,
    visitorInfoEnabled: options.visitorInfoEnabled ?? true,
    glassColorPreset: options.glassColorPreset ?? '翡翠',
    generalCardPreset: options.generalCardPreset ?? '基础',
    generalCardKeys: options.generalCardKeys,
    colorVisionMode: options.colorVisionFriendly ? '色觉友好' : '标准',
    hideAdminEntryWhenLoggedOut: false,
    hidePriceWhenLoggedOut: false,
    disablePageAnimation: options.disablePageAnimation ?? true,
    homeQuickControlsEnabled: true,
    homeQuickControlPreset: options.homeQuickControlPreset ?? '完整',
    homeQuickControlKeys: options.homeQuickControlKeys,
    homeToolsEnabled: true,
    nodeListCustomTagsVisible: options.nodeCustomTagsVisible ?? true,
    homePingTaskSelections: options.homePingTaskSelections
      ? JSON.stringify({ version: 1, nodes: options.homePingTaskSelections })
      : undefined,
  }

  await page.addInitScript(({ fixedNow }) => {
    localStorage.clear()
    sessionStorage.clear()
    const NativeDate = Date
    const fixedTimestamp = new NativeDate(fixedNow).getTime()
    const monotonicStart = performance.now()
    class FixedDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(args.length ? args[0] : fixedNow)
      }

      static now() {
        return fixedTimestamp + (performance.now() - monotonicStart)
      }
    }
    window.Date = FixedDate as DateConstructor
  }, { fixedNow: options.fixedNow ?? FIXED_NOW })

  await page.route('**/api/public', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'success',
      message: 'ok',
      data: {
        allow_cors: true,
        custom_body: '',
        custom_head: '',
        description: '固定虚构节点视觉回归环境',
        disable_password_login: false,
        oauth_enable: false,
        oauth_provider: null,
        private_site: false,
        record_enabled: true,
        record_preserve_time: 720,
        ping_record_preserve_time: options.pingRecordPreserveHours ?? 720,
        sitename: 'Komari Visual Lab',
        theme: 'GlassOps',
        theme_settings: settings,
        visitor_audit_enabled: false,
      },
    }),
  }))
  await page.route('**/api/me', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      logged_in: options.loggedIn ?? false,
      username: options.loggedIn ? 'visual-admin' : 'visual-guest',
    }),
  }))
  await page.route('**/api/version', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'success', message: 'ok', data: { version: options.backendVersion ?? '1.2.6-visual', hash: 'visual' } }),
  }))
  await page.route('**/api/admin/theme/settings?theme=GlassOps', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'success', message: 'ok' }),
  }))
  await page.route('**/rpc2**', route => handleRpc(route, options))
  await page.route('**/api/rpc2**', route => handleRpc(route, options))
  function geoForRoute(route: Route) {
    if (!options.geoByNode)
      return NODE_GEO_FIXTURES[2]
    const decodedUrl = decodeURIComponent(route.request().url())
    const ipv4Match = decodedUrl.match(FIXTURE_IPV4_REGEX)
    const ipv6Match = decodedUrl.match(FIXTURE_IPV6_REGEX)
    const index = ipv4Match
      ? Number(ipv4Match[1]) - 10
      : ipv6Match
        ? Number(ipv6Match[1]) - 1
        : 2
    return NODE_GEO_FIXTURES[index] ?? NODE_GEO_FIXTURES[2]
  }
  await page.route('https://api.ip.sb/**', (route) => {
    const geo = geoForRoute(route)
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ip: '2001:db8::25', latitude: geo.latitude, longitude: geo.longitude, city: geo.city, region: geo.city, country: 'Japan', country_code: geo.countryCode, organization: 'Example Networks', asn: 64500 }),
    })
  })
  await page.route('https://ipinfo.io/**', (route) => {
    const geo = geoForRoute(route)
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ loc: `${geo.latitude},${geo.longitude}`, city: geo.city, country: geo.countryCode, org: 'AS64500 Example Networks' }),
    })
  })
  await page.route('https://ipwho.is/**', (route) => {
    const geo = geoForRoute(route)
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ip: '2001:db8::25', latitude: geo.latitude, longitude: geo.longitude, city: geo.city, region: geo.city, country: 'Japan', country_code: geo.countryCode, connection: { org: 'Example Networks', asn: 64500 } }),
    })
  })
  await page.route('https://ipapi.co/**', (route) => {
    const geo = geoForRoute(route)
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ip: '2001:db8::25', latitude: geo.latitude, longitude: geo.longitude, city: geo.city, region: geo.city, country_name: 'Japan', country_code: geo.countryCode, org: 'Example Networks', asn: 'AS64500' }),
    })
  })
}
