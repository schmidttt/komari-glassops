<script setup lang="ts">
import type { MetricSeries, PingMetricTaskStats, PingRecord, PingTaskInfo } from '@/utils/rpc'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import VChart from 'vue-echarts'
import HoverInfo from '@/components/HoverInfo.vue'
import { Button } from '@/components/ui/button'
import { Empty } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PING_RECORD_MAX_COUNT } from '@/constants/load'
import { loadPingRecordsWithTasks } from '@/services/history.service'
import { loadPingMetricStats, loadPublicPingTasks, queryMetrics } from '@/services/metrics.service'
import { useAppStore } from '@/stores/app'
import { ACCESSIBLE_LINE_TYPES, getChartSeriesPalette } from '@/utils/chartPalette'
import { formatUtcMetricBucketDate, resolveMetricAggregationInfo } from '@/utils/metricAggregation'
import { isPingMetric, normalizeMetricSeriesList, orderPingTasksByBackend, PING_LATENCY_METRIC, PING_LOSS_METRIC, pingTaskId, pingTaskName } from '@/utils/metricSeries'
import { cutPeakValues, interpolateNullsLinear } from '@/utils/recordHelper'
import '@/utils/echarts' // 共享 ECharts 配置

const props = defineProps<{
  uuid: string
}>()

const appStore = useAppStore()
const isDark = computed(() => appStore.isDark)

interface CustomRange {
  start: dayjs.Dayjs
  end: dayjs.Dayjs
  hours: number
}

// 图表主题相关颜色
const chartThemeColors = computed(() => ({
  text: isDark.value ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
  textSecondary: isDark.value ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.55)',
  textTertiary: isDark.value ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
  borderColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
  splitLineColor: isDark.value ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  tooltipBg: isDark.value ? 'rgba(32, 35, 39, 0.98)' : 'rgba(250, 252, 255, 0.98)',
  tooltipShadow: isDark.value ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.06)',
  crosshairColor: isDark.value ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
}))

const chartColors = reactive(getChartSeriesPalette(appStore.colorVisionFriendly))

watchEffect(() => {
  chartColors.splice(0, chartColors.length, ...getChartSeriesPalette(appStore.colorVisionFriendly))
})

// 从 publicSettings 获取记录保留时间
const maxPingRecordPreserveTime = computed(() => appStore.publicSettings?.ping_record_preserve_time || 168)

// 视图选项
const presetViews = [
  { label: '1 小时', hours: 1 },
  { label: '6 小时', hours: 6 },
  { label: '12 小时', hours: 12 },
  { label: '1 天', hours: 24 },
]
const CUSTOM_VIEW_LABEL = '自定义'
const DEFAULT_CUSTOM_RANGE_HOURS = 24

// 可用视图列表
const availableViews = computed(() => {
  const views: { label: string, hours?: number }[] = []
  const maxHours = maxPingRecordPreserveTime.value

  for (const v of presetViews) {
    if (maxHours >= v.hours) {
      views.push(v)
    }
  }

  const maxPreset = presetViews.at(-1)
  if (maxPreset && maxHours > maxPreset.hours) {
    const label = maxHours % 24 === 0
      ? `${Math.floor(maxHours / 24)} 天`
      : `${maxHours} 小时`
    views.push({ label, hours: maxHours })
  }
  else if (maxHours > 1 && !presetViews.some(v => v.hours === maxHours)) {
    const label = maxHours % 24 === 0
      ? `${Math.floor(maxHours / 24)} 天`
      : `${maxHours} 小时`
    views.push({ label, hours: maxHours })
  }

  views.push({ label: CUSTOM_VIEW_LABEL })
  return views
})

// 当前选中的视图
const selectedView = ref<string>('')
const customStartInput = ref('')
const customEndInput = ref('')
const appliedCustomRange = shallowRef<CustomRange | null>(null)
const isCustomRange = computed(() => selectedView.value === CUSTOM_VIEW_LABEL)
const customRange = computed<CustomRange | null>(() => {
  if (!customStartInput.value || !customEndInput.value)
    return null

  const start = dayjs(customStartInput.value)
  const end = dayjs(customEndInput.value)
  if (!start.isValid() || !end.isValid() || !end.isAfter(start))
    return null

  return {
    start,
    end,
    hours: Math.max(1, Math.ceil(end.diff(start, 'hour', true))),
  }
})
const customRangeError = computed(() => {
  if (!isCustomRange.value || (!customStartInput.value && !customEndInput.value))
    return ''
  if (!customStartInput.value || !customEndInput.value)
    return '请选择开始和结束时间'
  return customRange.value ? '' : '结束时间必须晚于开始时间'
})
const selectedHours = computed(() => {
  if (isCustomRange.value)
    return appliedCustomRange.value?.hours ?? customRange.value?.hours ?? DEFAULT_CUSTOM_RANGE_HOURS

  const view = availableViews.value.find(v => v.label === selectedView.value)
  return view?.hours || 1
})

function ensureDefaultCustomRange() {
  if (customStartInput.value && customEndInput.value)
    return

  const end = dayjs()
  const hours = Math.max(1, Math.min(DEFAULT_CUSTOM_RANGE_HOURS, maxPingRecordPreserveTime.value))
  customStartInput.value = end.subtract(hours, 'hour').format('YYYY-MM-DDTHH:mm')
  customEndInput.value = end.format('YYYY-MM-DDTHH:mm')
}

// 初始化默认视图
watch(availableViews, (views) => {
  const firstView = views[0]
  if (firstView && !selectedView.value) {
    selectedView.value = firstView.label
  }
}, { immediate: true })

// ==================== 数据状态 ====================
const remoteData = shallowRef<PingRecord[]>([])
interface MetricLossPoint {
  taskId: number
  time: string
  value: number
  count: number
}

const remoteLossData = shallowRef<MetricLossPoint[] | null>(null)
const metricAggregation = shallowRef<ReturnType<typeof resolveMetricAggregationInfo>>(null)
const remoteRangeStart = computed(() => remoteData.value.at(0)?.time ?? '')
const remoteRangeEnd = computed(() => remoteData.value.at(-1)?.time ?? '')
const remoteDataSource = computed(() => remoteLossData.value ? 'metrics' : 'legacy')
const tasks = shallowRef<PingTaskInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const legacyCustomRangeFallback = ref(false)

// 任务选择
const selectedTaskIds = ref<number[]>([])
const cutPeak = ref(false)
const connectBreaks = ref(false)
const showLoss = ref(true)
const tooltipPinned = ref(false)
const pinnedTooltipIndex = ref<number | null>(null)

const chartMargin = { top: 30, right: 24, bottom: 52, left: 56 }
let fetchRecordsSequence = 0
let chartSyncFrame = 0
let pinnedTooltipFrame = 0
let chartHoverFrame = 0
let lastChartPointer: ChartPointerEvent | null = null
let lastChartClientPointer: { clientX: number, clientY: number } | null = null
let lastChartXRatio: number | null = null
let pendingInitialHover = false
let pendingHoverReleaseTimer = 0

interface PingChartExpose {
  resize: () => void
  getWidth: () => number
  getHeight: () => number
  dispatchAction: (payload: { type: string, [key: string]: unknown }) => void
}

const pingChartRef = ref<PingChartExpose | null>(null)
const chartSurfaceRef = ref<HTMLElement | null>(null)
const chartUpdateOptions = {
  notMerge: true,
  lazyUpdate: false,
}

function normalizeMetricTaskId(taskId: string): number {
  if (!taskId.trim())
    return Number.NaN

  const numericTaskId = Number(taskId)
  if (Number.isFinite(numericTaskId))
    return numericTaskId

  let hash = 0
  for (let index = 0; index < taskId.length; index++)
    hash = (hash * 31 + taskId.charCodeAt(index)) | 0
  return Math.abs(hash)
}

function normalizeMetricTask(stat: PingMetricTaskStats): PingTaskInfo {
  return {
    id: normalizeMetricTaskId(stat.task_id),
    name: stat.name?.trim() || pingTaskName(stat) || `Task ${stat.task_id}`,
    interval: stat.interval ?? 0,
    loss: stat.loss,
    min: stat.min,
    max: stat.max,
    avg: stat.avg,
    latest: stat.latest,
    p50: stat.p50,
    p99: stat.p99,
    p99_p50_ratio: stat.p99_p50_ratio,
    stddev: stat.stddev,
    total: stat.total,
    valid: stat.valid,
    loss_approximate: stat.loss_approximate,
    type: stat.type,
  }
}

function buildMetricRecords(seriesList: MetricSeries[]): PingRecord[] {
  const records: PingRecord[] = []
  const normalizedSeriesList = normalizeMetricSeriesList(seriesList).filter(isPingMetric)

  for (const series of normalizedSeriesList) {
    const taskId = normalizeMetricTaskId(pingTaskId(series))
    if (!Number.isFinite(taskId))
      continue

    for (const point of series.points) {
      if (point.value === null)
        continue

      records.push({
        client: series.entity_id,
        task_id: taskId,
        time: point.time,
        value: point.value,
      })
    }
  }

  return records.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())
}

function buildMetricLossPoints(seriesList: MetricSeries[]): MetricLossPoint[] {
  const points: MetricLossPoint[] = []

  for (const series of normalizeMetricSeriesList(seriesList)) {
    if (series.metric_key !== PING_LOSS_METRIC)
      continue

    const taskId = normalizeMetricTaskId(pingTaskId(series))
    if (!Number.isFinite(taskId))
      continue

    for (const point of series.points) {
      if (typeof point.value !== 'number' || !Number.isFinite(point.value))
        continue

      points.push({
        taskId,
        time: point.time,
        value: Math.min(1, Math.max(0, point.value)),
        count: typeof point.count === 'number' && Number.isFinite(point.count) && point.count > 0
          ? point.count
          : 1,
      })
    }
  }

  return points.sort((left, right) => dayjs(left.time).valueOf() - dayjs(right.time).valueOf())
}

async function loadMetricPingPayload(nodeUuid: string): Promise<{
  aggregation: ReturnType<typeof resolveMetricAggregationInfo>
  records: PingRecord[]
  tasks: PingTaskInfo[]
  lossPoints: MetricLossPoint[]
} | null> {
  const range = appliedCustomRange.value
  const metricRangeParams = isCustomRange.value && range
    ? { start: range.start.toDate().toISOString(), end: range.end.toDate().toISOString() }
    : { hours: selectedHours.value }

  const [statsResult, metricsResult, backendTasksResult] = await Promise.allSettled([
    loadPingMetricStats({ entity_id: nodeUuid, ...metricRangeParams, max_points: PING_RECORD_MAX_COUNT }),
    queryMetrics({
      metric_keys: [PING_LATENCY_METRIC, PING_LOSS_METRIC],
      entity_id: nodeUuid,
      ...metricRangeParams,
      downsample: true,
      fill_empty: true,
      max_points: PING_RECORD_MAX_COUNT,
      aggregation: 'avg',
    }),
    loadPublicPingTasks(),
  ])

  const metricStats = statsResult.status === 'fulfilled'
    ? (statsResult.value.stats ?? []).filter(stat => stat.entity_id === nodeUuid)
    : []
  const metricRecords = metricsResult.status === 'fulfilled'
    ? buildMetricRecords(metricsResult.value.series)
    : []
  const metricLossPoints = metricsResult.status === 'fulfilled'
    ? buildMetricLossPoints(metricsResult.value.series)
    : []

  const metricTaskIds = new Set(metricRecords.map(record => record.task_id))
  const metricLossTaskIds = new Set(metricLossPoints.map(point => point.taskId))
  if (
    !metricRecords.length
    || [...metricTaskIds].some(taskId => !metricLossTaskIds.has(taskId))
  ) {
    return null
  }

  const taskMap = new Map<number, PingTaskInfo>()
  for (const stat of metricStats) {
    const task = normalizeMetricTask(stat)
    taskMap.set(task.id, task)
  }

  for (const series of normalizeMetricSeriesList(
    metricsResult.status === 'fulfilled' ? metricsResult.value.series : [],
  ).filter(isPingMetric)) {
    const taskId = normalizeMetricTaskId(pingTaskId(series))
    if (!taskId || taskMap.has(taskId))
      continue

    taskMap.set(taskId, {
      id: taskId,
      name: pingTaskName(series) || `Task ${taskId}`,
      interval: series.interval_seconds ?? 0,
      loss: 0,
    })
  }

  return {
    aggregation: metricsResult.status === 'fulfilled'
      ? resolveMetricAggregationInfo(metricsResult.value.series)
      : null,
    records: metricRecords,
    tasks: orderPingTasksByBackend(
      [...taskMap.values()],
      backendTasksResult.status === 'fulfilled' ? backendTasksResult.value : [],
    ),
    lossPoints: metricLossPoints,
  }
}

// ==================== 数据获取 ====================

async function fetchRecords() {
  if (tooltipPinned.value)
    releasePinnedTooltip()

  const sequence = ++fetchRecordsSequence
  const requestedUuid = props.uuid
  if (!requestedUuid)
    return

  if (isCustomRange.value && !customRange.value) {
    remoteData.value = []
    remoteLossData.value = null
    metricAggregation.value = null
    tasks.value = []
    error.value = customRangeError.value || '请选择有效的自定义时间范围'
    legacyCustomRangeFallback.value = false
    loading.value = false
    return
  }

  appliedCustomRange.value = isCustomRange.value ? customRange.value : null

  loading.value = true
  error.value = null

  try {
    const metricPayload = await loadMetricPingPayload(requestedUuid).catch(() => null)
    if (sequence !== fetchRecordsSequence || requestedUuid !== props.uuid)
      return

    legacyCustomRangeFallback.value = !metricPayload && isCustomRange.value
    const range = appliedCustomRange.value
    const legacyHours = range
      ? Math.min(
          maxPingRecordPreserveTime.value,
          Math.max(range.hours, Math.ceil(dayjs().diff(range.start, 'hour', true))),
        )
      : selectedHours.value
    const result = metricPayload ?? await loadPingRecordsWithTasks(legacyHours, PING_RECORD_MAX_COUNT, requestedUuid)
    if (sequence !== fetchRecordsSequence || requestedUuid !== props.uuid)
      return

    const records = result.records
    records.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())

    remoteData.value = records
    remoteLossData.value = metricPayload?.lossPoints ?? null
    metricAggregation.value = metricPayload?.aggregation ?? null
    tasks.value = result.tasks

    if (tasks.value.length > 0 && selectedTaskIds.value.length === 0) {
      selectedTaskIds.value = tasks.value.map(t => t.id)
    }
  }
  catch (err) {
    if (sequence !== fetchRecordsSequence || requestedUuid !== props.uuid)
      return

    error.value = err instanceof Error ? err.message : '获取数据失败'
    legacyCustomRangeFallback.value = false
    remoteData.value = []
    remoteLossData.value = null
    metricAggregation.value = null
    tasks.value = []
  }
  finally {
    if (sequence === fetchRecordsSequence)
      loading.value = false
  }
}

// ==================== 数据处理 ====================

const mergedData = computed(() => {
  const data = remoteData.value
  if (!data.length)
    return []

  const taskList = tasks.value

  const taskIntervals = taskList
    .map(t => t.interval)
    .filter((v): v is number => typeof v === 'number' && v > 0)

  const fallbackIntervalSec = taskIntervals.length ? Math.min(...taskIntervals) : 60
  const toleranceMs = Math.min(
    6000,
    Math.max(800, Math.floor(fallbackIntervalSec * 1000 * 0.25)),
  )

  const grouped: Map<number, Record<string, unknown>> = new Map()
  const anchors: number[] = []
  const metricLossPoints = remoteLossData.value
  const events = [
    ...data.map(record => ({
      kind: 'latency' as const,
      time: record.time,
      taskId: record.task_id,
      value: record.value,
      count: 1,
    })),
    ...(metricLossPoints ?? []).map(point => ({
      kind: 'loss' as const,
      time: point.time,
      taskId: point.taskId,
      value: point.value * 100,
      count: point.count,
    })),
  ].sort((left, right) => dayjs(left.time).valueOf() - dayjs(right.time).valueOf())

  for (const event of events) {
    const ts = dayjs(event.time).valueOf()
    let anchor: number | null = null

    for (let index = anchors.length - 1; index >= 0; index--) {
      const a = anchors[index]
      if (a === undefined || ts - a > toleranceMs)
        break
      if (Math.abs(a - ts) <= toleranceMs) {
        anchor = a
        break
      }
    }

    const useTs = anchor ?? ts
    if (!grouped.has(useTs)) {
      grouped.set(useTs, { time: dayjs(useTs).toISOString() })
      if (anchor === null) {
        anchors.push(useTs)
      }
    }

    const group = grouped.get(useTs)!
    if (event.kind === 'latency') {
      group[event.taskId] = event.value < 0 ? null : event.value
      if (metricLossPoints === null) {
        const lossSumKey = `lossSum:${event.taskId}`
        const lossCountKey = `lossCount:${event.taskId}`
        group[lossSumKey] = Number(group[lossSumKey] ?? 0) + (event.value < 0 ? 100 : 0)
        group[lossCountKey] = Number(group[lossCountKey] ?? 0) + 1
      }
    }
    else {
      const lossSumKey = `lossSum:${event.taskId}`
      const lossCountKey = `lossCount:${event.taskId}`
      group[lossSumKey] = Number(group[lossSumKey] ?? 0) + event.value * event.count
      group[lossCountKey] = Number(group[lossCountKey] ?? 0) + event.count
    }
  }

  const merged = Array.from(grouped.values()).map((group) => {
    for (const task of taskList) {
      const lossSum = Number(group[`lossSum:${task.id}`] ?? 0)
      const lossCount = Number(group[`lossCount:${task.id}`] ?? 0)
      group[`loss:${task.id}`] = lossCount > 0 ? lossSum / lossCount : null
      group[`lossCount:${task.id}`] = lossCount
      delete group[`lossSum:${task.id}`]
    }
    return group
  }).sort(
    (a, b) => dayjs(a.time as string).valueOf() - dayjs(b.time as string).valueOf(),
  )

  const range = appliedCustomRange.value
  if (isCustomRange.value && range) {
    const fromTs = range.start.valueOf()
    const toTs = range.end.valueOf()
    return merged.filter((item) => {
      const timestamp = dayjs(item.time as string).valueOf()
      return timestamp >= fromTs && timestamp <= toTs
    })
  }

  const hours = selectedHours.value
  const lastItem = merged.at(-1)
  const lastTs = lastItem ? dayjs(lastItem.time as string).valueOf() : dayjs().valueOf()
  const fromTs = lastTs - hours * 3600_000

  let startIdx = 0
  for (let i = 0; i < merged.length; i++) {
    const item = merged[i]
    if (!item)
      continue
    const ts = dayjs(item.time as string).valueOf()
    if (ts >= fromTs) {
      startIdx = Math.max(0, i - 1)
      break
    }
  }

  return merged.slice(startIdx)
})

function getDisplayPointLimit(hours: number): number {
  if (hours <= 1)
    return 60
  if (hours <= 6)
    return 96
  if (hours <= 12)
    return 128
  if (hours <= 24)
    return 160

  return Math.min(480, 160 + Math.round(40 * Math.log2(hours / 24)))
}

function aggregateRowsForDisplay(
  rows: Record<string, unknown>[],
  taskList: PingTaskInfo[],
  pointLimit: number,
): Record<string, unknown>[] {
  if (rows.length <= pointLimit)
    return rows

  const aggregatedRows: Record<string, unknown>[] = []
  for (let bucketIndex = 0; bucketIndex < pointLimit; bucketIndex++) {
    const start = Math.floor(bucketIndex * rows.length / pointLimit)
    const end = Math.max(start + 1, Math.floor((bucketIndex + 1) * rows.length / pointLimit))
    const bucket = rows.slice(start, end)
    const timeRow = bucket[Math.floor(bucket.length / 2)] ?? bucket[0]
    if (!timeRow)
      continue

    const aggregated: Record<string, unknown> = {
      time: timeRow.time,
    }

    for (const task of taskList) {
      let latencyTotal = 0
      let latencyCount = 0
      let lossTotal = 0
      let lossCount = 0

      for (const row of bucket) {
        const latency = row[task.id]
        if (typeof latency === 'number' && Number.isFinite(latency)) {
          latencyTotal += latency
          latencyCount++
        }

        const loss = normalizeLossValue(row[`loss:${task.id}`])
        if (loss === null)
          continue
        const recordedCount = Number(row[`lossCount:${task.id}`] ?? 0)
        const weight = Number.isFinite(recordedCount) && recordedCount > 0 ? recordedCount : 1
        lossTotal += loss * weight
        lossCount += weight
      }

      aggregated[task.id] = latencyCount > 0 ? latencyTotal / latencyCount : null
      aggregated[`loss:${task.id}`] = lossCount > 0 ? lossTotal / lossCount : null
      aggregated[`lossCount:${task.id}`] = lossCount
    }

    aggregatedRows.push(aggregated)
  }

  return aggregatedRows
}

const chartData = computed(() => {
  let data = aggregateRowsForDisplay(
    mergedData.value,
    tasks.value,
    getDisplayPointLimit(selectedHours.value),
  )
  const selectedKeys = selectedTaskIds.value.map(String)

  if (selectedKeys.length === 0)
    return []

  if (cutPeak.value) {
    data = cutPeakValues(data, selectedKeys)
  }

  if (connectBreaks.value && selectedKeys.length > 0 && data.length > 0) {
    data = interpolateNullsLinear(data, selectedKeys, {
      maxGapMultiplier: 6,
      minCapMs: 2 * 60_000,
      maxCapMs: 30 * 60_000,
    })
  }

  return data
})

// ==================== 工具函数 ====================

function formatTime(time: string, showDate: boolean): string {
  if (metricAggregation.value?.isDaily)
    return formatUtcMetricBucketDate(time)

  const date = dayjs(time)
  if (showDate) {
    return date.format('M/D HH:mm')
  }
  return date.format('HH:mm')
}

function formatTimeForTooltip(time: string, hours: number): string {
  if (metricAggregation.value?.isDaily)
    return `${formatUtcMetricBucketDate(time, true)} · 日聚合`

  const date = dayjs(time)
  const formatted = hours < 24
    ? date.format('HH:mm:ss')
    : date.format('MM/DD HH:mm')
  return metricAggregation.value
    ? `${formatted} · ${metricAggregation.value.label}`
    : formatted
}

const showDateInAxis = computed(() => selectedHours.value >= 24)

// ==================== 任务选择 ====================

// 获取任务颜色（根据任务在完整列表中的索引）
function getTaskColor(taskId: number): string {
  const taskIndex = tasks.value.findIndex(t => t.id === taskId)
  const safeIndex = Math.max(0, taskIndex % chartColors.length)
  return chartColors[safeIndex]!
}

// 最新值统计（从服务端 tasks 获取，保持颜色顺序）
const latestValues = computed(() => {
  if (!tasks.value.length)
    return []

  const latestMap = new Map<number, number | null>()
  for (const task of tasks.value) {
    for (let i = remoteData.value.length - 1; i >= 0; i--) {
      const rec = remoteData.value[i]
      if (rec && rec.task_id === task.id && rec.value >= 0) {
        latestMap.set(task.id, rec.value)
        break
      }
    }
  }

  return tasks.value.map((task, idx) => {
    const safeIdx = Math.max(0, idx % chartColors.length)
    return {
      ...task,
      latestValue: latestMap.get(task.id) ?? null,
      color: chartColors[safeIdx]!,
    }
  })
})

const selectedTasks = computed(() => {
  return tasks.value.filter(t => selectedTaskIds.value.includes(t.id))
})

function normalizeLossValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null
}

function getLossStatusColor(value: number | null): string {
  if (value === null)
    return isDark.value ? '#94a3b8' : '#64748b'
  if (value <= 0)
    return isDark.value ? '#34d399' : '#047857'

  if (isDark.value) {
    if (value <= 1)
      return '#fda4af'
    if (value <= 3)
      return '#fb7185'
    if (value <= 10)
      return '#ff5c79'
    if (value <= 25)
      return '#ff4568'
    if (value <= 50)
      return '#ff315b'
    if (value <= 75)
      return '#ff2452'
    return '#ff1748'
  }

  if (value <= 1)
    return '#be4660'
  if (value <= 3)
    return '#b83250'
  if (value <= 10)
    return '#b42342'
  if (value <= 25)
    return '#aa1738'
  if (value <= 50)
    return '#9f1239'
  if (value <= 75)
    return '#8f102f'
  return '#7f1028'
}

function getAggregateLoss(
  row: Record<string, unknown>,
  taskList: PingTaskInfo[],
): number | null {
  let weightedLoss = 0
  let sampleCount = 0

  for (const task of taskList) {
    const loss = normalizeLossValue(row[`loss:${task.id}`])
    if (loss === null)
      continue

    const recordedCount = Number(row[`lossCount:${task.id}`] ?? 0)
    const weight = Number.isFinite(recordedCount) && recordedCount > 0 ? recordedCount : 1
    weightedLoss += loss * weight
    sampleCount += weight
  }

  return sampleCount > 0 ? weightedLoss / sampleCount : null
}

function escapeTooltipHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

// 切换任务选中状态
function toggleTask(taskId: number) {
  if (selectedTaskIds.value.includes(taskId)) {
    selectedTaskIds.value = selectedTaskIds.value.filter(id => id !== taskId)
  }
  else {
    selectedTaskIds.value = [...selectedTaskIds.value, taskId]
  }
}

function showAllTasks() {
  selectedTaskIds.value = tasks.value.map(t => t.id)
}

function hideAllTasks() {
  selectedTaskIds.value = []
}

function showPinnedTooltip(dataIndex = pinnedTooltipIndex.value) {
  cancelAnimationFrame(pinnedTooltipFrame)
  if (!tooltipPinned.value || dataIndex === null || dataIndex < 0 || dataIndex >= chartData.value.length)
    return

  void nextTick(() => {
    pinnedTooltipFrame = requestAnimationFrame(() => {
      pingChartRef.value?.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex,
      })
    })
  })
}

function pinTooltip(dataIndex: number) {
  if (!Number.isInteger(dataIndex) || dataIndex < 0 || dataIndex >= chartData.value.length)
    return

  tooltipPinned.value = true
  pinnedTooltipIndex.value = dataIndex
  showPinnedTooltip(dataIndex)
}

function releasePinnedTooltip() {
  cancelAnimationFrame(pinnedTooltipFrame)
  tooltipPinned.value = false
  pinnedTooltipIndex.value = null
  void nextTick(() => {
    pingChartRef.value?.dispatchAction({ type: 'hideTip' })
  })
}

interface ChartPointerEvent {
  offsetX?: number
  offsetY?: number
}

function getChartDataIndexAtPointer(event: ChartPointerEvent): number | null {
  const chart = pingChartRef.value
  const x = Number(event.offsetX)
  const y = Number(event.offsetY)
  const dataLength = chartData.value.length
  if (!chart || !Number.isFinite(x) || !Number.isFinite(y) || dataLength === 0)
    return null

  const width = chart.getWidth()
  const height = chart.getHeight()
  const plotLeft = chartMargin.left
  const plotRight = width - chartMargin.right
  const plotTop = showLoss.value ? 24 : chartMargin.top
  const plotBottom = height - chartMargin.bottom
  if (x < plotLeft || x > plotRight || y < plotTop || y > plotBottom)
    return null

  const ratio = plotRight > plotLeft ? (x - plotLeft) / (plotRight - plotLeft) : 0
  return dataLength === 1
    ? 0
    : Math.round(Math.min(1, Math.max(0, ratio)) * (dataLength - 1))
}

function showHoverTooltipAtPointer() {
  if (tooltipPinned.value)
    return
  const currentPointer = resolveChartPointerFromClient()
  // Async task summaries can move the chart after the first pointer event.
  // Prefer the pointer's current client position while it remains inside the
  // plot; otherwise retain the original chart-relative position so the first
  // hover is not discarded by that layout shift.
  const pointerDataIndex = currentPointer
    ? getChartDataIndexAtPointer(currentPointer) ?? getChartDataIndexAtPointer(lastChartPointer ?? {})
    : getChartDataIndexAtPointer(lastChartPointer ?? {})
  const dataIndex = pointerDataIndex ?? (
    lastChartXRatio === null || chartData.value.length === 0
      ? null
      : Math.round(lastChartXRatio * (chartData.value.length - 1))
  )
  if (dataIndex === null)
    return
  pingChartRef.value?.dispatchAction({
    type: 'showTip',
    seriesIndex: 0,
    dataIndex,
  })
  if (pendingInitialHover) {
    window.clearTimeout(pendingHoverReleaseTimer)
    pendingHoverReleaseTimer = window.setTimeout(() => {
      pendingInitialHover = false
    }, 700)
  }
}

function scheduleHoverTooltip() {
  cancelAnimationFrame(chartHoverFrame)
  chartHoverFrame = requestAnimationFrame(showHoverTooltipAtPointer)
}

function handleChartPointerMove(event: ChartPointerEvent) {
  lastChartPointer = {
    offsetX: event.offsetX,
    offsetY: event.offsetY,
  }
  const chart = pingChartRef.value
  const x = Number(event.offsetX)
  if (chart && Number.isFinite(x)) {
    const plotWidth = chart.getWidth() - chartMargin.left - chartMargin.right
    if (plotWidth > 0)
      lastChartXRatio = Math.min(1, Math.max(0, (x - chartMargin.left) / plotWidth))
  }
  scheduleHoverTooltip()
}

function resolveChartPointerFromClient(): ChartPointerEvent | null {
  const point = lastChartClientPointer
  const canvas = chartSurfaceRef.value?.querySelector<HTMLCanvasElement>('canvas')
  const chart = pingChartRef.value
  if (!point || !canvas || !chart)
    return null

  const rect = canvas.getBoundingClientRect()
  if (
    rect.width <= 0
    || rect.height <= 0
    || point.clientX < rect.left
    || point.clientX > rect.right
    || point.clientY < rect.top
    || point.clientY > rect.bottom
  ) {
    return null
  }

  return {
    offsetX: (point.clientX - rect.left) / rect.width * chart.getWidth(),
    offsetY: (point.clientY - rect.top) / rect.height * chart.getHeight(),
  }
}

function handleChartSurfacePointerMove(event: MouseEvent | PointerEvent) {
  lastChartClientPointer = {
    clientX: event.clientX,
    clientY: event.clientY,
  }
  const pointer = resolveChartPointerFromClient()
  if (pointer) {
    lastChartPointer = pointer
  }
  else {
    const rect = chartSurfaceRef.value?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      const chartWidth = pingChartRef.value?.getWidth() || rect.width
      const chartHeight = pingChartRef.value?.getHeight() || rect.height
      lastChartPointer = {
        offsetX: (event.clientX - rect.left) / rect.width * chartWidth,
        offsetY: (event.clientY - rect.top) / rect.height * chartHeight,
      }
    }
  }
  const rect = chartSurfaceRef.value?.getBoundingClientRect()
  if (rect && rect.width > 0)
    lastChartXRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  pendingInitialHover = loading.value || chartData.value.length === 0
  scheduleHoverTooltip()
}

function handleChartContainerPointerMove(event: MouseEvent | PointerEvent) {
  const rect = chartSurfaceRef.value?.getBoundingClientRect()
  if (
    !rect
    || event.clientX < rect.left
    || event.clientX > rect.right
    || event.clientY < rect.top
    || event.clientY > rect.bottom
  ) {
    // Loading task summaries changes the chart's document position. Some
    // browsers emit a pointer transition while the cursor itself is stationary.
    // Keep the remembered chart-relative point through the first rendered
    // frame; a short release window restores normal leave behaviour.
    if (pendingInitialHover)
      return
    if (lastChartClientPointer || lastChartPointer)
      handleChartPointerLeave()
    return
  }

  handleChartSurfacePointerMove(event)
}

function handleChartFinished() {
  // vue-echarts applies asynchronous option updates after Vue's DOM flush.
  // Replaying on ECharts' finished event guarantees the remembered pointer is
  // evaluated against the first fully rendered data frame.
  scheduleHoverTooltip()
}

function handleChartPointerLeave() {
  lastChartPointer = null
  lastChartClientPointer = null
  lastChartXRatio = null
  pendingInitialHover = false
  window.clearTimeout(pendingHoverReleaseTimer)
  cancelAnimationFrame(chartHoverFrame)
  if (!tooltipPinned.value)
    pingChartRef.value?.dispatchAction({ type: 'hideTip' })
}

function handleChartPointerClick(event: ChartPointerEvent) {
  const dataIndex = getChartDataIndexAtPointer(event)
  if (dataIndex === null)
    return
  pinTooltip(dataIndex)
}

function handleTooltipControlClick(event: MouseEvent) {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-ping-tooltip-action]')
    : null
  if (!target)
    return

  event.preventDefault()
  event.stopPropagation()
  if (target.dataset.pingTooltipAction === 'release')
    releasePinnedTooltip()
}

function handleTooltipWheel(event: WheelEvent) {
  if (event.target instanceof Element && event.target.closest('[data-ping-tooltip-scroll]'))
    event.stopPropagation()
}

function handleTooltipKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && tooltipPinned.value)
    releasePinnedTooltip()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!tooltipPinned.value)
    return

  const target = event.target
  if (target instanceof Node && chartSurfaceRef.value?.contains(target))
    return

  releasePinnedTooltip()
}

function toggleAllTaskVisibility() {
  if (selectedTaskIds.value.length)
    hideAllTasks()
  else
    showAllTasks()
}

// ==================== 图表配置 ====================

// 通用 Tooltip 配置
const baseTooltipConfig = computed(() => ({
  trigger: 'axis' as const,
  // ZRender's native tooltip trigger can miss the first hover while async
  // data replaces the chart option. Pointer movement is replayed explicitly
  // below, so the first loaded frame and later updates share one path.
  triggerOn: 'none' as const,
  alwaysShowContent: tooltipPinned.value,
  renderMode: 'html' as const,
  confine: true,
  enterable: true,
  showDelay: 0,
  hideDelay: tooltipPinned.value ? 0 : 180,
  transitionDuration: 0,
  backgroundColor: chartThemeColors.value.tooltipBg,
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 6,
  textStyle: {
    color: chartThemeColors.value.text,
    fontSize: 12,
    lineHeight: 20,
  },
  // Moving a backdrop-filtered element forces the chart below it to be recomposited.
  // An opaque-enough surface keeps the same visual hierarchy without the hover hitch.
  extraCssText: `max-width:calc(100vw - 24px);overflow:hidden;contain:layout style paint;will-change:transform;z-index:9;box-shadow:0 0 0 1px ${chartThemeColors.value.tooltipShadow},0 12px 32px ${chartThemeColors.value.tooltipShadow}`,
  axisPointer: {
    type: 'line' as const,
    animation: false,
    animationDurationUpdate: 0,
    lineStyle: {
      color: chartThemeColors.value.crosshairColor,
      width: 1,
      type: 'dashed' as const,
    },
    shadowStyle: {
      color: chartThemeColors.value.crosshairColor,
    },
  },
}))

function getChartNumericValue(value: unknown): number | null {
  const candidate = Array.isArray(value) ? value[1] : value
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

const pingChartOption = computed(() => {
  const taskList = selectedTasks.value
  const data = chartData.value
  const hours = selectedHours.value
  const aggregateLossValues = data.map(row => getAggregateLoss(row, taskList))
  const lossTrackSymbolWidth = hours <= 24 ? 6 : hours <= 168 ? 5 : 4

  // 构建 series，确保颜色与卡片一致
  const latencySeries = taskList.map((task, index) => {
    const color = getTaskColor(task.id)
    const lineType = appStore.colorVisionFriendly
      ? (ACCESSIBLE_LINE_TYPES[index % ACCESSIBLE_LINE_TYPES.length] ?? 'solid')
      : 'solid'
    return {
      id: `ping-latency-${task.id}`,
      name: task.name,
      type: 'line' as const,
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map(d => d[task.id] as number | null ?? null),
      smooth: cutPeak.value ? 0.45 : false,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.5, color, cap: 'round' as const, type: lineType },
      itemStyle: { color }, // 确保 symbol 颜色一致
    }
  })
  const aggregateLossSeries = {
    id: 'aggregate-loss-track',
    name: '聚合丢包率',
    type: 'scatter' as const,
    xAxisIndex: 0,
    yAxisIndex: 0,
    data: showLoss.value
      ? aggregateLossValues.map(value => ({
          value: 0.5,
          aggregateLoss: value,
          itemStyle: {
            color: getLossStatusColor(value),
            shadowBlur: value !== null && value >= 50 ? 4 : 0,
            shadowColor: value !== null && value >= 50 ? getLossStatusColor(value) : 'transparent',
          },
        }))
      : [],
    symbol: 'roundRect',
    symbolSize: [lossTrackSymbolWidth, 8],
    clip: false,
    emphasis: {
      focus: 'series' as const,
    },
    silent: false,
    z: 6,
  }

  // 颜色映射表（用于 Tooltip）
  const colorMap = new Map<number, string>()
  tasks.value.forEach((task, idx) => {
    const safeIdx = Math.max(0, idx % chartColors.length)
    colorMap.set(task.id, chartColors[safeIdx]!)
  })
  const taskListMaxHeight = typeof window === 'undefined'
    ? 150
    : Math.max(96, Math.min(160, Math.floor(window.innerHeight * 0.22)))
  const tooltipGridColumns = showLoss.value
    ? '8px minmax(64px,1fr) 58px 90px'
    : '8px minmax(64px,1fr) 58px'
  const tooltipRowStyle = `display:grid;grid-template-columns:${tooltipGridColumns};column-gap:12px;align-items:center;width:100%;min-height:22px;box-sizing:border-box`
  const tooltipNumericStyle = 'display:block;width:100%;justify-self:end;text-align:right;font-weight:600;font-variant-numeric:tabular-nums'
  const tooltipHtmlCache = new Map<string, string>()
  const tooltipTaskMeta = taskList.map(task => ({
    task,
    escapedName: escapeTooltipHtml(task.name),
    color: colorMap.get(task.id) || chartColors[0],
  }))

  return {
    animation: false,
    // 全局颜色设置（用于图例等）
    color: [
      ...tasks.value.map((_, idx) => {
        const safeIdx = Math.max(0, idx % chartColors.length)
        return chartColors[safeIdx]!
      }),
    ],
    tooltip: {
      ...baseTooltipConfig.value,
      formatter: (params: unknown) => {
        const p = params as Array<{ seriesName: string, value: unknown, dataIndex: number }>
        if (!p.length)
          return ''
        const firstParam = p[0]
        if (!firstParam)
          return ''
        const rowData = data[firstParam.dataIndex]
        if (!rowData)
          return ''

        const isPinnedPoint = tooltipPinned.value && pinnedTooltipIndex.value === firstParam.dataIndex
        const cacheKey = `${firstParam.dataIndex}:${isPinnedPoint ? 'pinned' : 'hover'}`
        const cachedHtml = tooltipHtmlCache.get(cacheKey)
        if (cachedHtml)
          return cachedHtml

        const time = rowData.time as string
        const timeStr = formatTimeForTooltip(time, hours)
        const tooltipStatus = isPinnedPoint
          ? `<button type="button" data-ping-tooltip-action="release" style="appearance:none;border:1px solid ${chartThemeColors.value.borderColor};border-radius:999px;background:transparent;color:${chartThemeColors.value.text};cursor:pointer;font:inherit;font-size:10px;line-height:18px;padding:0 7px;touch-action:manipulation">已固定 · 解除</button>`
          : `<span style="font-size:10px;font-weight:500;color:${chartThemeColors.value.textTertiary}">单击图表固定后滚动</span>`
        let html = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px"><span style="font-weight:600;color:${chartThemeColors.value.textSecondary};font-variant-numeric:tabular-nums">${escapeTooltipHtml(timeStr)}</span>${tooltipStatus}</div>`

        if (showLoss.value) {
          const aggregateLoss = getAggregateLoss(rowData, taskList)
          const aggregateColor = getLossStatusColor(aggregateLoss)
          const aggregateText = aggregateLoss === null ? '无采样' : `${aggregateLoss.toFixed(2)}%`
          html += `<div style="${tooltipRowStyle};min-width:min(300px,calc(100vw - 56px));padding:0 0 5px;margin-bottom:5px;border-bottom:1px solid ${chartThemeColors.value.borderColor}"><span style="display:block;width:8px;height:8px;border-radius:50%;background:${aggregateColor}"></span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">聚合丢包率</span><span aria-hidden="true"></span><span style="${tooltipNumericStyle};font-weight:700;color:${aggregateColor}">${aggregateText}</span></div>`
        }

        let taskRows = ''
        for (const { task, escapedName, color } of tooltipTaskMeta) {
          const latency = getChartNumericValue(rowData[task.id])
          const loss = normalizeLossValue(rowData[`loss:${task.id}`])
          const lossColor = getLossStatusColor(loss)
          const colorDot = `<span style="display:block;width:8px;height:8px;border-radius:50%;background:${color}"></span>`
          const latencyText = latency === null ? '-' : `${Math.round(latency)} ms`
          const lossText = loss === null ? '丢包 -' : `丢包 ${loss.toFixed(2)}%`
          taskRows += `<div style="${tooltipRowStyle}">${colorDot}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapedName}</span><span style="${tooltipNumericStyle}">${latencyText}</span>${showLoss.value ? `<span style="${tooltipNumericStyle};color:${lossColor}">${lossText}</span>` : ''}</div>`
        }

        html += `<div data-ping-tooltip-scroll style="display:flex;min-width:min(300px,calc(100vw - 56px));max-height:${taskListMaxHeight}px;box-sizing:border-box;flex-direction:column;gap:2px;overflow-y:auto;overscroll-behavior:contain">${taskRows}</div>`
        tooltipHtmlCache.set(cacheKey, html)
        return html
      },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
      icon: 'roundRect',
      textStyle: { fontSize: 11, color: chartThemeColors.value.textSecondary },
      data: taskList.map(t => t.name),
    },
    grid: [
      {
        left: chartMargin.left,
        right: chartMargin.right,
        top: 31,
        height: 8,
      },
      {
        ...chartMargin,
        top: showLoss.value ? 66 : chartMargin.top,
      },
    ],
    graphic: [
      ...(showLoss.value
        ? [{
            type: 'text',
            left: chartMargin.left,
            top: 7,
            silent: true,
            style: {
              text: '丢包率 (%)',
              fill: chartThemeColors.value.textSecondary,
              fontSize: 11,
              fontWeight: 500,
            },
          }]
        : []),
      {
        type: 'text',
        left: chartMargin.left,
        top: showLoss.value ? 48 : 7,
        silent: true,
        style: {
          text: '延迟 (ms)',
          fill: chartThemeColors.value.textSecondary,
          fontSize: 11,
          fontWeight: 500,
        },
      },
    ],
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
    },
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: data.map(d => formatTime(d.time as string, showDateInAxis.value)),
        boundaryGap: false,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisPointer: {
          show: true,
          snap: true,
          triggerTooltip: true,
          animation: false,
          label: { show: false },
          lineStyle: {
            color: chartThemeColors.value.crosshairColor,
            width: 1,
            type: 'dashed' as const,
          },
        },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: data.map(d => formatTime(d.time as string, showDateInAxis.value)),
        axisLabel: {
          fontSize: 11,
          color: chartThemeColors.value.textSecondary,
          margin: 12,
        },
        axisLine: {
          show: true,
          lineStyle: { color: chartThemeColors.value.borderColor, width: 1 },
        },
        axisTick: { show: false },
        boundaryGap: false,
        axisPointer: {
          show: true,
          snap: true,
          triggerTooltip: true,
          animation: false,
          lineStyle: {
            color: chartThemeColors.value.crosshairColor,
            width: 1,
            type: 'dashed' as const,
          },
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: 0,
        max: 1,
        show: false,
      },
      {
        type: 'value',
        gridIndex: 1,
        axisLabel: { fontSize: 11, color: chartThemeColors.value.textSecondary, formatter: '{value}' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: chartThemeColors.value.splitLineColor,
            type: 'dashed' as const,
          },
        },
      },
    ],
    series: [...latencySeries, aggregateLossSeries],
  }
})

// ==================== 生命周期 ====================

watch(selectedView, () => {
  selectedTaskIds.value = []
  if (isCustomRange.value)
    ensureDefaultCustomRange()
  fetchRecords()
})

watch(() => props.uuid, () => {
  remoteData.value = []
  remoteLossData.value = null
  metricAggregation.value = null
  tasks.value = []
  selectedTaskIds.value = []
  fetchRecords()
})

function scheduleChartSync() {
  cancelAnimationFrame(chartSyncFrame)
  void nextTick(() => {
    chartSyncFrame = requestAnimationFrame(() => {
      pingChartRef.value?.resize()
      scheduleHoverTooltip()
    })
  })
}

watch(
  [chartData, selectedTasks, showLoss, isDark, loading],
  () => {
    scheduleChartSync()
    if (tooltipPinned.value) {
      const dataIndex = pinnedTooltipIndex.value
      if (dataIndex === null || dataIndex >= chartData.value.length)
        releasePinnedTooltip()
      else
        showPinnedTooltip(dataIndex)
    }
  },
  { flush: 'post' },
)

onMounted(() => {
  const firstView = availableViews.value[0]
  if (firstView && !selectedView.value) {
    selectedView.value = firstView.label
  }
  fetchRecords()
  scheduleChartSync()
  window.addEventListener('keydown', handleTooltipKeydown)
  document.addEventListener('pointermove', handleChartContainerPointerMove, true)
  document.addEventListener('mousemove', handleChartContainerPointerMove, true)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(chartSyncFrame)
  cancelAnimationFrame(pinnedTooltipFrame)
  cancelAnimationFrame(chartHoverFrame)
  window.clearTimeout(pendingHoverReleaseTimer)
  window.removeEventListener('keydown', handleTooltipKeydown)
  document.removeEventListener('pointermove', handleChartContainerPointerMove, true)
  document.removeEventListener('mousemove', handleChartContainerPointerMove, true)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 时间范围、图表控制和任务选择 -->
    <div class="flex flex-col gap-2">
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Tabs v-model="selectedView" class="min-w-0 !block">
          <div class="min-w-0 overflow-x-auto rounded-sm pointer-events-auto">
            <TabsList class="h-8 w-max rounded-md bg-background/50 backdrop-blur-xl">
              <TabsTrigger
                v-for="view in availableViews" :key="view.label" :value="view.label"
                class="h-6.5 flex-none shrink-0 rounded-sm border-none text-xs shadow-none data-[state=active]:text-green-600"
              >
                {{ view.label }}
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        <div class="order-3 col-span-2 flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-xl border border-black/8 bg-background/30 p-1.5 lg:order-none lg:col-span-1 lg:justify-center dark:border-white/8">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 shrink-0 rounded-lg border border-black/10 bg-background/45 px-2.5 text-xs text-foreground/75 shadow-sm hover:bg-background/70 data-[state=on]:border-selection/55 data-[state=on]:bg-selection/20 data-[state=on]:text-selection data-[state=on]:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--selection)_22%,transparent)] dark:border-white/10"
            :data-state="showLoss ? 'on' : 'off'"
            :aria-pressed="showLoss"
            title="在延迟图顶部显示聚合丢包方格轨道，并在同一时间提示中列出各任务丢包率"
            @click="showLoss = !showLoss"
          >
            <span class="size-1.5 rounded-full" :class="showLoss ? 'bg-selection shadow-[0_0_8px_var(--selection)]' : 'bg-muted-foreground/35'" />
            <Icon icon="tabler:wave-sine" width="14" height="14" />
            <span class="hidden sm:inline">显示丢包</span>
            <span class="sm:hidden">丢包</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 shrink-0 rounded-lg border border-black/10 bg-background/45 px-2.5 text-xs text-foreground/75 shadow-sm hover:bg-background/70 data-[state=on]:border-selection/55 data-[state=on]:bg-selection/20 data-[state=on]:text-selection data-[state=on]:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--selection)_22%,transparent)] dark:border-white/10"
            :data-state="cutPeak ? 'on' : 'off'"
            :aria-pressed="cutPeak"
            title="使用 EWMA 平滑延迟突变，只改变图表显示，不修改原始数据"
            @click="cutPeak = !cutPeak"
          >
            <span class="size-1.5 rounded-full" :class="cutPeak ? 'bg-selection shadow-[0_0_8px_var(--selection)]' : 'bg-muted-foreground/35'" />
            <Icon icon="tabler:chart-arrows-vertical" width="14" height="14" />
            <span class="hidden sm:inline">削峰平滑</span>
            <span class="sm:hidden">平滑</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 shrink-0 rounded-lg border border-black/10 bg-background/45 px-2.5 text-xs text-foreground/75 shadow-sm hover:bg-background/70 data-[state=on]:border-selection/55 data-[state=on]:bg-selection/20 data-[state=on]:text-selection data-[state=on]:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--selection)_22%,transparent)] dark:border-white/10"
            :data-state="connectBreaks ? 'on' : 'off'"
            :aria-pressed="connectBreaks"
            title="连接短暂缺采样形成的断点；较长的数据缺口仍保持断开"
            @click="connectBreaks = !connectBreaks"
          >
            <span class="size-1.5 rounded-full" :class="connectBreaks ? 'bg-selection shadow-[0_0_8px_var(--selection)]' : 'bg-muted-foreground/35'" />
            <Icon icon="tabler:git-merge" width="14" height="14" />
            <span class="hidden sm:inline">断点连线</span>
            <span class="sm:hidden">连线</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 shrink-0 rounded-lg border border-black/10 bg-background/45 px-2.5 text-xs text-foreground/75 shadow-sm hover:bg-background/70 data-[state=on]:border-selection/55 data-[state=on]:bg-selection/20 data-[state=on]:text-selection dark:border-white/10"
            :data-state="!selectedTaskIds.length ? 'on' : 'off'"
            :aria-pressed="!selectedTaskIds.length"
            :title="selectedTaskIds.length ? '隐藏全部延迟与丢包序列' : '恢复显示全部监控任务'"
            @click="toggleAllTaskVisibility"
          >
            <Icon :icon="selectedTaskIds.length ? 'tabler:eye-off' : 'tabler:eye'" width="14" height="14" />
            {{ selectedTaskIds.length ? '隐藏全部' : '显示全部' }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 shrink-0 rounded-lg border border-black/10 bg-background/45 px-2.5 text-xs text-foreground/75 shadow-sm hover:bg-background/70 dark:border-white/10"
            :disabled="loading"
            title="重新获取当前时间范围的监控记录"
            @click="fetchRecords"
          >
            <Icon icon="tabler:refresh" width="14" height="14" :class="loading && 'animate-spin'" />
            刷新
          </Button>
        </div>

        <div class="order-2 flex items-center justify-end gap-2">
          <Button
            variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/50 hover:bg-background"
            :class="selectedTaskIds.length === tasks.length ? 'shadow-[0_0_0_2px] shadow-green-600/10 text-green-600' : ''"
            @click="showAllTasks"
          >
            全选
          </Button>
          <Button
            variant="ghost" size="xs" class="h-7 rounded-sm border-none bg-background/50 hover:bg-background"
            :class="!selectedTaskIds.length && 'shadow-[0_0_0_2px] shadow-green-600/10 text-green-600'"
            @click="hideAllTasks"
          >
            全不选
          </Button>
        </div>
      </div>

      <div v-if="isCustomRange" class="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <div class="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(0,13rem)_minmax(0,13rem)_auto]">
          <Input
            v-model="customStartInput"
            type="datetime-local"
            aria-label="延迟图开始时间"
            class="h-8 bg-background/50 text-xs"
          />
          <Input
            v-model="customEndInput"
            type="datetime-local"
            aria-label="延迟图结束时间"
            class="h-8 bg-background/50 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="!customRange"
            class="h-8 text-xs"
            @click="fetchRecords"
          >
            应用
          </Button>
        </div>
        <div v-if="customRangeError" class="text-[11px] text-orange-500">
          {{ customRangeError }}
        </div>
        <div v-else-if="legacyCustomRangeFallback" class="text-[11px] text-muted-foreground">
          旧接口按可用保留时长回溯，再裁剪到所选区间
        </div>
      </div>
      <div
        v-if="metricAggregation"
        data-testid="ping-aggregation-hint"
        class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"
      >
        <span class="inline-flex items-center gap-1 font-semibold text-foreground/75">
          <Icon icon="tabler:calendar-stats" width="13" height="13" />
          {{ metricAggregation.label }}
        </span>
        <span>每个点表示该统计区间的平均值；日期按统计桶显示。</span>
      </div>
    </div>

    <!-- 内容区域 -->
    <Spinner :show="loading" content-class="flex flex-col gap-4">
      <div v-if="error" class="text-red-500 py-8 text-center">
        {{ error }}
      </div>
      <div v-else-if="tasks.length === 0 && !loading" class="py-8">
        <Empty description="暂无延迟数据" />
      </div>

      <template v-else>
        <!-- 最新值统计卡片（可点击切换选中状态） -->
        <div
          v-if="latestValues.length > 0" class="gap-3 grid"
          style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))"
        >
          <div
            v-for="task in latestValues" :key="task.id"
            :data-ping-task-id="task.id"
            class="flex cursor-pointer select-none items-center gap-3 rounded-lg border border-white/8 bg-background/35 p-2.5 transition-all hover:border-white/15 hover:bg-background/55 hover:shadow-[0_10px_28px_-20px_rgba(0,0,0,0.9)]"
            :class="[!selectedTaskIds.includes(task.id) && 'opacity-30']"
            :onmouseover="(e: MouseEvent) => ((e.currentTarget as HTMLElement).style.borderColor = task.color)"
            :onmouseout="(e: MouseEvent) => ((e.currentTarget as HTMLElement).style.borderColor = '')"
            @click="toggleTask(task.id)"
          >
            <div class="flex-1 min-w-0">
              <div class="flex gap-2 items-center">
                <div class="rounded h-4 w-1" :style="{ backgroundColor: task.color }" />
                <span class="text-sm font-semibold truncate">{{ task.name }}</span>
                <div class="flex-1" />
                <HoverInfo :label="`${task.name} 任务详细统计`">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    :aria-label="`${task.name} 任务详细统计`"
                  >
                    <Icon icon="carbon:information" :width="14" :height="14" />
                  </Button>
                  <template #content>
                    <div class="grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                      <template v-if="task.min !== undefined">
                        <span class="text-muted-foreground">最小</span>
                        <span class="font-medium">{{ Math.round(task.min) }} ms</span>
                      </template>
                      <template v-if="task.max !== undefined">
                        <span class="text-muted-foreground">最大</span>
                        <span class="font-medium">{{ Math.round(task.max) }} ms</span>
                      </template>
                      <template v-if="task.avg !== undefined">
                        <span class="text-muted-foreground">平均</span>
                        <span class="font-medium">{{ Math.round(task.avg) }} ms</span>
                      </template>
                      <template v-if="task.latest !== undefined">
                        <span class="text-muted-foreground">最新</span>
                        <span class="font-medium">{{ Math.round(task.latest) }} ms</span>
                      </template>
                      <template v-if="task.p50 !== undefined">
                        <span class="text-muted-foreground">P50</span>
                        <span class="font-medium">{{ Math.round(task.p50) }} ms</span>
                      </template>
                      <template v-if="task.p99 !== undefined">
                        <span class="text-muted-foreground">P99</span>
                        <span class="font-medium">{{ Math.round(task.p99) }} ms</span>
                      </template>
                      <template v-if="task.p99_p50_ratio !== undefined">
                        <span class="text-muted-foreground">波动率</span>
                        <span class="font-medium">{{ task.p99_p50_ratio.toFixed(2) }}</span>
                      </template>
                      <template v-if="task.interval !== undefined">
                        <span class="text-muted-foreground">间隔</span>
                        <span class="font-medium">{{ task.interval }}s</span>
                      </template>
                      <template v-if="task.type">
                        <span class="text-muted-foreground">类型</span>
                        <span class="font-medium">{{ task.type.toUpperCase() }}</span>
                      </template>
                      <template v-if="task.stddev !== undefined">
                        <span class="text-muted-foreground">标准差</span>
                        <span class="font-medium">{{ task.stddev.toFixed(1) }}</span>
                      </template>
                      <template v-if="task.total !== undefined">
                        <span class="text-muted-foreground">总数</span>
                        <span class="font-medium">{{ task.total }}</span>
                      </template>
                      <template v-if="task.valid !== undefined">
                        <span class="text-muted-foreground">有效</span>
                        <span class="font-medium">{{ task.valid }}</span>
                      </template>
                    </div>
                  </template>
                </HoverInfo>
              </div>
              <div class="mt-2 grid grid-cols-3 gap-1.5">
                <div class="min-w-0 rounded-md bg-slate-500/6 px-1.5 py-1">
                  <div class="truncate text-[9px] text-muted-foreground">
                    平均延迟
                  </div>
                  <div class="truncate text-[11px] font-semibold tabular-nums">
                    {{ task.avg !== undefined ? `${Math.round(task.avg)} ms` : '-' }}
                  </div>
                </div>
                <div class="min-w-0 rounded-md bg-slate-500/6 px-1.5 py-1">
                  <div class="truncate text-[9px] text-muted-foreground">
                    丢包率
                  </div>
                  <div class="truncate text-[11px] font-semibold tabular-nums">
                    {{ task.loss.toFixed(2) }}%{{ task.loss_approximate ? '≈' : '' }}
                  </div>
                </div>
                <div class="min-w-0 rounded-md bg-slate-500/6 px-1.5 py-1">
                  <div class="truncate text-[9px] text-muted-foreground">
                    波动率
                  </div>
                  <div class="truncate text-[11px] font-semibold tabular-nums">
                    {{ task.p99_p50_ratio !== undefined ? task.p99_p50_ratio.toFixed(2) : '-' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 延迟图与聚合丢包方格轨道 -->
        <div
          ref="chartSurfaceRef"
          data-testid="ping-chart-surface"
          :data-ping-source="remoteDataSource"
          :data-ping-range-start="remoteRangeStart"
          :data-ping-range-end="remoteRangeEnd"
          :data-ping-aggregation-interval="metricAggregation?.intervalSeconds ?? ''"
          class="overflow-hidden rounded-xl border border-black/8 bg-background/45 dark:border-white/8"
          @pointerenter="handleChartSurfacePointerMove"
          @pointermove="handleChartSurfacePointerMove"
          @mouseenter="handleChartSurfacePointerMove"
          @mousemove="handleChartSurfacePointerMove"
          @click.capture="handleTooltipControlClick"
          @wheel.capture="handleTooltipWheel"
        >
          <div class="h-72 p-2 sm:h-96 sm:p-4">
            <VChart
              ref="pingChartRef"
              :option="pingChartOption"
              :update-options="chartUpdateOptions"
              autoresize
              @finished="handleChartFinished"
              @zr:click="handleChartPointerClick"
              @zr:mousemove="handleChartPointerMove"
            />
          </div>
        </div>
      </template>
    </Spinner>
  </div>
</template>
