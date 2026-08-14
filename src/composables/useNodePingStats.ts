import type { MaybeRefOrGetter } from 'vue'
import type { PingMetricTaskStats } from '@/utils/rpc'
import { useThrottleFn } from '@vueuse/core'
import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import { PING_RECORD_MAX_COUNT } from '@/constants/load'
import { abortPingRecords, loadPingRecords } from '@/services/history.service'
import { abortPingMetricStats, abortQueryMetrics, loadPingMetricStats, queryMetrics } from '@/services/metrics.service'
import { isPingMetric, normalizeMetricSeriesList, PING_LATENCY_METRIC, PING_LOSS_METRIC, pingTaskId } from '@/utils/metricSeries'

export interface NodePingHistoryPoint {
  time: string
  latency: number | null
  loss: number | null
}

export interface NodePingStatsState {
  avgLatency: number
  latestLatency: number
  avgLoss: number
  avgVolatility: number
  history: NodePingHistoryPoint[]
  hasData: boolean
}

interface PingRecord {
  client: string
  task_id: number
  time: string
  value: number
}

interface MetricLossPoint {
  taskId: number
  time: string
  value: number
  count: number
}

function normalizeMaxCount(maxCount: number | null | undefined): number | undefined {
  if (typeof maxCount !== 'number' || !Number.isFinite(maxCount) || maxCount <= 0)
    return undefined
  return Math.floor(maxCount)
}

interface SharedPingRecordsState {
  recordsByClient: Map<string, PingRecord[]>
  source: 'metric' | 'legacy'
  metricStats?: PingMetricTaskStats[]
  metricLossPoints?: MetricLossPoint[]
}

interface SharedPingRecordsEntry {
  data: ReturnType<typeof shallowRef<SharedPingRecordsState | null>>
  loading: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string | null>>
  promise: Promise<void> | null
  refreshTimer: ReturnType<typeof setInterval> | null
  subscribers: number
  lastFetchedAt: number
}

const HISTORY_BUCKET_COUNT = 20
const CACHE_VERSION = 9
const CACHE_KEY_PREFIX = 'komari-glassops:node-ping-stats'
const FULL_LOSS_EPSILON = 1e-6
const PING_RECORD_REFRESH_INTERVAL_MS = 60_000
const PING_METRIC_BATCH_WINDOW_MS = 20
const PING_METRIC_BATCH_MAX_NODES = 20
const sharedPingRecordsCache = new Map<string, SharedPingRecordsEntry>()

interface PendingMetricBatch {
  nodeUuids: Set<string>
  waiters: Map<string, Array<(value: SharedPingRecordsState | null) => void>>
  timer: ReturnType<typeof setTimeout>
  hours: number
  maxCount?: number
}

const pendingMetricBatches = new Map<string, PendingMetricBatch>()

interface TaskRecordSummary {
  total: number
  success: number
}

function createEmptyStats(): NodePingStatsState {
  return {
    avgLatency: 0,
    latestLatency: 0,
    avgLoss: 0,
    avgVolatility: 0,
    history: [],
    hasData: false,
  }
}

function average(values: number[]): number {
  if (!values.length)
    return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function weightedAverage(values: Array<{ value: number, weight: number }>): number {
  const weightedValues = values.filter(item => item.weight > 0)
  const totalWeight = weightedValues.reduce((sum, item) => sum + item.weight, 0)
  if (!totalWeight)
    return 0

  return weightedValues.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function summarizeTaskRecords(records: PingRecord[]): Map<number, TaskRecordSummary> {
  const summaries = new Map<number, TaskRecordSummary>()

  for (const record of records) {
    const summary = summaries.get(record.task_id) ?? { total: 0, success: 0 }
    summary.total += 1
    if (record.value >= 0) {
      summary.success += 1
    }
    summaries.set(record.task_id, summary)
  }

  return summaries
}

function getIncludedTaskIds(records: PingRecord[]): Set<number> {
  const recordSummaries = summarizeTaskRecords(records)

  return new Set(
    [...recordSummaries.entries()]
      .filter(([, summary]) => summary.total > 0)
      .map(([taskId]) => taskId),
  )
}

function getCacheKey(uuid: string, hours: number, maxCount: number | undefined, taskSelectionKey: string): string {
  return `${CACHE_KEY_PREFIX}:${uuid}:${hours}:${maxCount ?? 'all'}:${taskSelectionKey}`
}

function getSharedPingRecordsKey(hours: number, maxCount?: number, uuid?: string): string {
  return `${uuid?.trim() || 'all'}:${hours}:${maxCount ?? 'all'}`
}

function isValidHistoryPoint(value: unknown): value is NodePingHistoryPoint {
  if (!value || typeof value !== 'object')
    return false

  const point = value as Record<string, unknown>
  const latency = point.latency
  const loss = point.loss

  return typeof point.time === 'string'
    && (latency === null || typeof latency === 'number')
    && (loss === null || typeof loss === 'number')
}

function isValidStatsState(value: unknown): value is NodePingStatsState {
  if (!value || typeof value !== 'object')
    return false

  const state = value as Record<string, unknown>
  return typeof state.avgLatency === 'number'
    && typeof state.latestLatency === 'number'
    && typeof state.avgLoss === 'number'
    && typeof state.avgVolatility === 'number'
    && typeof state.hasData === 'boolean'
    && Array.isArray(state.history)
    && state.history.every(isValidHistoryPoint)
}

function readStatsCache(
  uuid: string,
  hours: number,
  maxCount: number | undefined,
  taskSelectionKey: string,
): NodePingStatsState | null {
  if (typeof window === 'undefined')
    return null

  try {
    const raw = window.localStorage.getItem(getCacheKey(uuid, hours, maxCount, taskSelectionKey))
    if (!raw)
      return null

    const parsed = JSON.parse(raw) as { version?: number, stats?: unknown }
    if (parsed.version !== CACHE_VERSION || !isValidStatsState(parsed.stats))
      return null

    return parsed.stats
  }
  catch {
    return null
  }
}

function writeStatsCache(
  uuid: string,
  hours: number,
  maxCount: number | undefined,
  taskSelectionKey: string,
  value: NodePingStatsState,
): void {
  if (typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(
      getCacheKey(uuid, hours, maxCount, taskSelectionKey),
      JSON.stringify({
        version: CACHE_VERSION,
        updatedAt: new Date().toISOString(),
        stats: value,
      }),
    )
  }
  catch {
  }
}

function createSharedPingRecordsEntry(): SharedPingRecordsEntry {
  return {
    data: shallowRef<SharedPingRecordsState | null>(null),
    loading: ref(false),
    error: ref<string | null>(null),
    promise: null,
    refreshTimer: null,
    subscribers: 0,
    lastFetchedAt: 0,
  }
}

function getSharedPingRecordsEntry(hours: number, maxCount?: number, uuid?: string): SharedPingRecordsEntry {
  const key = getSharedPingRecordsKey(hours, maxCount, uuid)
  const cachedEntry = sharedPingRecordsCache.get(key)
  if (cachedEntry)
    return cachedEntry

  const nextEntry = createSharedPingRecordsEntry()
  sharedPingRecordsCache.set(key, nextEntry)
  return nextEntry
}

function buildRecordsByClient(records: PingRecord[]): Map<string, PingRecord[]> {
  const grouped = new Map<string, PingRecord[]>()

  for (const record of records) {
    if (!record.client)
      continue

    const clientRecords = grouped.get(record.client) ?? []
    clientRecords.push(record)
    grouped.set(record.client, clientRecords)
  }

  for (const clientRecords of grouped.values()) {
    clientRecords.sort(
      (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime(),
    )
  }

  return grouped
}

function normalizeTaskId(taskId: string): number {
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

function buildMetricRecordsByClient(nodeUuid: string, stats: PingMetricTaskStats[], records: PingRecord[]): Map<string, PingRecord[]> {
  const grouped = buildRecordsByClient(records)
  if (grouped.size)
    return grouped

  const syntheticRecords = stats
    .filter(stat => stat.entity_id === nodeUuid && typeof stat.latest === 'number' && Number.isFinite(stat.latest))
    .map((stat): PingRecord => ({
      client: nodeUuid,
      task_id: normalizeTaskId(stat.task_id),
      time: new Date().toISOString(),
      value: stat.latest!,
    }))

  return buildRecordsByClient(syntheticRecords)
}

async function loadPingMetricRecordsForNodes(
  nodeUuids: string[],
  hours: number,
  maxCount: number | undefined,
  batched: boolean,
): Promise<Map<string, SharedPingRecordsState | null>> {
  const requestedNodes = [...new Set(nodeUuids.filter(Boolean))]
  const entityParams = batched
    ? { entity_ids: requestedNodes }
    : { entity_id: requestedNodes[0] }
  const [statsResult, metricsResult] = await Promise.allSettled([
    loadPingMetricStats({ ...entityParams, hours, max_points: maxCount }),
    queryMetrics({
      metric_keys: [PING_LATENCY_METRIC, PING_LOSS_METRIC],
      ...entityParams,
      hours,
      downsample: true,
      fill_empty: true,
      max_points: maxCount,
      aggregation: 'avg',
    }),
  ])

  const stats = statsResult.status === 'fulfilled'
    ? (statsResult.value.stats ?? []).filter(stat => requestedNodes.includes(stat.entity_id))
    : []
  const metricRecordsByNode = new Map<string, PingRecord[]>()
  const metricLossPointsByNode = new Map<string, MetricLossPoint[]>()
  const metricLossTaskIdsByNode = new Map<string, Set<number>>()

  if (metricsResult.status === 'fulfilled') {
    const seriesList = normalizeMetricSeriesList(metricsResult.value.series)
    for (const series of seriesList) {
      const nodeUuid = series.entity_id
      if (!requestedNodes.includes(nodeUuid))
        continue

      const taskId = normalizeTaskId(pingTaskId(series))
      if (!Number.isFinite(taskId))
        continue

      if (series.metric_key === PING_LOSS_METRIC) {
        const metricLossPoints = metricLossPointsByNode.get(nodeUuid) ?? []
        const metricLossTaskIds = metricLossTaskIdsByNode.get(nodeUuid) ?? new Set<number>()
        for (const point of series.points) {
          if (!isFiniteNumber(point.value))
            continue

          metricLossPoints.push({
            taskId,
            time: point.time,
            value: point.value,
            count: isFiniteNumber(point.count) && point.count > 0 ? point.count : 1,
          })
          metricLossTaskIds.add(taskId)
        }
        metricLossPointsByNode.set(nodeUuid, metricLossPoints)
        metricLossTaskIdsByNode.set(nodeUuid, metricLossTaskIds)
        continue
      }

      if (!isPingMetric(series))
        continue

      const metricRecords = metricRecordsByNode.get(nodeUuid) ?? []
      for (const point of series.points) {
        if (point.value === null)
          continue

        metricRecords.push({
          client: series.entity_id,
          task_id: taskId,
          time: point.time,
          value: point.value,
        })
      }
      metricRecordsByNode.set(nodeUuid, metricRecords)
    }
  }

  const states = new Map<string, SharedPingRecordsState | null>()
  for (const nodeUuid of requestedNodes) {
    const nodeStats = stats.filter(stat => stat.entity_id === nodeUuid)
    const nodeMetricRecords = metricRecordsByNode.get(nodeUuid) ?? []
    const nodeMetricLossPoints = metricLossPointsByNode.get(nodeUuid) ?? []
    const metricLossTaskIds = metricLossTaskIdsByNode.get(nodeUuid) ?? new Set<number>()
    const recordsByClient = buildMetricRecordsByClient(nodeUuid, nodeStats, nodeMetricRecords)
    const exactLossTaskIds = new Set(
      nodeStats
        .filter(stat => stat.total > 0 && !stat.loss_approximate && isFiniteNumber(stat.loss))
        .map(stat => normalizeTaskId(stat.task_id)),
    )
    const hasCompleteLossSeries = exactLossTaskIds.size > 0
      && [...exactLossTaskIds].every(taskId => metricLossTaskIds.has(taskId))

    states.set(nodeUuid, hasCompleteLossSeries
      ? {
          recordsByClient,
          source: 'metric',
          metricStats: nodeStats,
          metricLossPoints: nodeMetricLossPoints,
        }
      : null)
  }

  return states
}

async function loadSingleNodePingMetricRecords(nodeUuid: string, hours: number, maxCount?: number): Promise<SharedPingRecordsState | null> {
  const states = await loadPingMetricRecordsForNodes([nodeUuid], hours, maxCount, false)
  return states.get(nodeUuid) ?? null
}

function getMetricBatchKey(hours: number, maxCount?: number): string {
  return `${hours}:${maxCount ?? 'all'}`
}

async function flushMetricBatch(key: string): Promise<void> {
  const batch = pendingMetricBatches.get(key)
  if (!batch)
    return

  pendingMetricBatches.delete(key)
  const nodeUuids = [...batch.nodeUuids]
  for (let offset = 0; offset < nodeUuids.length; offset += PING_METRIC_BATCH_MAX_NODES) {
    const chunk = nodeUuids.slice(offset, offset + PING_METRIC_BATCH_MAX_NODES)
    let states = new Map<string, SharedPingRecordsState | null>()
    try {
      states = await loadPingMetricRecordsForNodes(chunk, batch.hours, batch.maxCount, true)
    }
    catch {
    }

    for (const nodeUuid of chunk) {
      const state = states.get(nodeUuid) ?? null
      for (const resolve of batch.waiters.get(nodeUuid) ?? [])
        resolve(state)
    }
  }
}

function loadBatchedPingMetricRecords(nodeUuid: string, hours: number, maxCount?: number): Promise<SharedPingRecordsState | null> {
  const key = getMetricBatchKey(hours, maxCount)

  return new Promise((resolve) => {
    const current = pendingMetricBatches.get(key)
    if (current) {
      current.nodeUuids.add(nodeUuid)
      const waiters = current.waiters.get(nodeUuid) ?? []
      waiters.push(resolve)
      current.waiters.set(nodeUuid, waiters)
      return
    }

    const batch: PendingMetricBatch = {
      nodeUuids: new Set([nodeUuid]),
      waiters: new Map([[nodeUuid, [resolve]]]),
      hours,
      maxCount,
      timer: setTimeout(() => {
        void flushMetricBatch(key)
      }, PING_METRIC_BATCH_WINDOW_MS),
    }
    pendingMetricBatches.set(key, batch)
  })
}

async function loadSharedPingRecords(entry: SharedPingRecordsEntry, hours: number, maxCount?: number, nodeUuid?: string): Promise<void> {
  if (entry.promise)
    return entry.promise

  entry.loading.value = true
  entry.error.value = null

  entry.promise = (async () => {
    try {
      const batchedMetricState = nodeUuid
        ? await loadBatchedPingMetricRecords(nodeUuid, hours, maxCount).catch(() => null)
        : null
      const metricState = batchedMetricState ?? (nodeUuid
        ? await loadSingleNodePingMetricRecords(nodeUuid, hours, maxCount).catch(() => null)
        : null)
      if (entry.subscribers === 0)
        return

      if (metricState) {
        entry.data.value = metricState
      }
      else {
        const records = await loadPingRecords(hours, maxCount, nodeUuid)
        if (entry.subscribers === 0)
          return

        entry.data.value = {
          recordsByClient: buildRecordsByClient(records),
          source: 'legacy',
        }
      }
      entry.lastFetchedAt = Date.now()
    }
    catch (err) {
      entry.error.value = err instanceof Error ? err.message : '获取 Ping 历史失败'
      throw err
    }
    finally {
      entry.loading.value = false
      entry.promise = null
    }
  })()

  return entry.promise
}

function startSharedPingRecordsRefresh(entry: SharedPingRecordsEntry, hours: number, maxCount?: number, uuid?: string): void {
  if (entry.refreshTimer)
    return

  entry.refreshTimer = setInterval(() => {
    void loadSharedPingRecords(entry, hours, maxCount, uuid).catch(() => {})
  }, PING_RECORD_REFRESH_INTERVAL_MS)
}

function stopSharedPingRecordsRefresh(entry: SharedPingRecordsEntry): void {
  if (!entry.refreshTimer)
    return

  clearInterval(entry.refreshTimer)
  entry.refreshTimer = null
}

function retainSharedPingRecordsEntry(hours: number, maxCount?: number, uuid?: string): () => void {
  const entry = getSharedPingRecordsEntry(hours, maxCount, uuid)
  entry.subscribers += 1
  startSharedPingRecordsRefresh(entry, hours, maxCount, uuid)

  let released = false
  return () => {
    if (released)
      return

    released = true
    entry.subscribers = Math.max(0, entry.subscribers - 1)
    if (entry.subscribers === 0) {
      stopSharedPingRecordsRefresh(entry)
      abortPingRecords(hours, maxCount, uuid)
      if (uuid?.trim()) {
        abortPingMetricStats({
          entity_id: uuid,
          hours,
          max_points: maxCount,
        })
        abortQueryMetrics({
          metric_keys: [PING_LATENCY_METRIC, PING_LOSS_METRIC],
          entity_id: uuid,
          hours,
          downsample: true,
          fill_empty: true,
          max_points: maxCount,
          aggregation: 'avg',
        })
      }
    }
  }
}

function buildPingHistory(records: PingRecord[], metricLossPoints?: MetricLossPoint[]): NodePingHistoryPoint[] {
  const sortedRecords = records
    .map((record) => {
      const timestamp = new Date(record.time).getTime()
      return { ...record, timestamp }
    })
    .filter(record => Number.isFinite(record.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)
  const sortedMetricLossPoints = (metricLossPoints ?? [])
    .map(point => ({ ...point, timestamp: new Date(point.time).getTime() }))
    .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.value) && point.count > 0)
    .sort((left, right) => left.timestamp - right.timestamp)

  if (!sortedRecords.length && !sortedMetricLossPoints.length)
    return []

  const firstTime = Math.min(
    sortedRecords[0]?.timestamp ?? Number.POSITIVE_INFINITY,
    sortedMetricLossPoints[0]?.timestamp ?? Number.POSITIVE_INFINITY,
  )
  const lastTime = Math.max(
    sortedRecords.at(-1)?.timestamp ?? Number.NEGATIVE_INFINITY,
    sortedMetricLossPoints.at(-1)?.timestamp ?? Number.NEGATIVE_INFINITY,
  )
  const bucketCount = Math.min(HISTORY_BUCKET_COUNT, Math.max(sortedRecords.length, sortedMetricLossPoints.length))
  const bucketSize = Math.max(1, (lastTime - firstTime) / bucketCount)

  const history: NodePingHistoryPoint[] = []
  let recordIndex = 0
  let metricLossPointIndex = 0

  for (let index = 0; index < bucketCount; index++) {
    const startTime = firstTime + bucketSize * index
    const endTime = index === bucketCount - 1 ? lastTime + 1 : startTime + bucketSize
    let totalCount = 0
    let lostCount = 0
    let latencySum = 0
    let latencyCount = 0
    let metricLossSum = 0
    let metricLossCount = 0

    while (recordIndex < sortedRecords.length) {
      const record = sortedRecords[recordIndex]
      if (!record || record.timestamp >= endTime)
        break

      if (record.timestamp >= startTime) {
        totalCount += 1
        if (record.value >= 0) {
          latencySum += record.value
          latencyCount += 1
        }
        else {
          lostCount += 1
        }
      }
      recordIndex += 1
    }

    while (metricLossPointIndex < sortedMetricLossPoints.length) {
      const point = sortedMetricLossPoints[metricLossPointIndex]
      if (!point || point.timestamp >= endTime)
        break

      if (point.timestamp >= startTime) {
        metricLossSum += point.value * point.count
        metricLossCount += point.count
      }
      metricLossPointIndex += 1
    }

    history.push({
      time: new Date(startTime).toISOString(),
      latency: latencyCount ? latencySum / latencyCount : null,
      loss: metricLossPoints
        ? (metricLossCount ? metricLossSum / metricLossCount * 100 : null)
        : (totalCount ? lostCount / totalCount * 100 : null),
    })
  }

  return history
}

function getPercentile(values: number[], percentile: number): number | null {
  if (!values.length)
    return null

  const sorted = [...values].sort((left, right) => left - right)
  const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * percentile))
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lowerValue = sorted[lowerIndex]
  const upperValue = sorted[upperIndex]

  if (lowerValue === undefined || upperValue === undefined)
    return null
  if (lowerIndex === upperIndex)
    return lowerValue

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex)
}

function buildStats(records: PingRecord[], metricStats?: PingMetricTaskStats[], metricLossPoints?: MetricLossPoint[]): NodePingStatsState {
  const statsWithSamples = (metricStats ?? []).filter(stat => stat.total > 0)
  if (statsWithSamples.length) {
    const history = buildPingHistory(records.filter(record => record.value >= 0), metricLossPoints)
    const latencyValues = statsWithSamples
      .flatMap(stat => stat.valid > 0 && isFiniteNumber(stat.avg)
        ? [{ value: stat.avg, weight: stat.valid }]
        : [])
    const latestLatencyValues = statsWithSamples
      .map(stat => stat.latest)
      .filter(isFiniteNumber)
    const lossValues = statsWithSamples
      .filter(stat => !stat.loss_approximate && isFiniteNumber(stat.loss))
      .map(stat => ({ value: stat.loss, weight: stat.total }))
    const volatilityValues = statsWithSamples
      .filter(stat => stat.valid > 0 && isFiniteNumber(stat.p99_p50_ratio))
      .map(stat => ({ value: stat.p99_p50_ratio!, weight: stat.valid }))

    const avgLoss = weightedAverage(lossValues)

    return {
      avgLatency: latencyValues.length ? weightedAverage(latencyValues) : average(latestLatencyValues),
      latestLatency: average(latestLatencyValues),
      avgLoss,
      avgVolatility: weightedAverage(volatilityValues),
      history,
      hasData: true,
    }
  }

  const includedTaskIds = getIncludedTaskIds(records)

  if (!includedTaskIds.size)
    return createEmptyStats()

  const filteredRecords = records.filter(record => includedTaskIds.has(record.task_id))
  const history = buildPingHistory(filteredRecords)
  const taskRecords = new Map<number, PingRecord[]>()

  for (const record of filteredRecords) {
    const currentRecords = taskRecords.get(record.task_id) ?? []
    currentRecords.push(record)
    taskRecords.set(record.task_id, currentRecords)
  }

  const latencyValues: number[] = []
  const taskLossValues: number[] = []
  const volatilityValues: number[] = []

  for (const recordsByTask of taskRecords.values()) {
    const validValues = recordsByTask
      .map(record => record.value)
      .filter(value => value >= 0)

    taskLossValues.push((recordsByTask.length - validValues.length) / recordsByTask.length * 100)

    if (!validValues.length)
      continue

    latencyValues.push(average(validValues))

    if (validValues.length > 1) {
      const p50 = getPercentile(validValues, 0.5)
      const p99 = getPercentile(validValues, 0.99)
      if (isFiniteNumber(p50) && isFiniteNumber(p99) && p50 > FULL_LOSS_EPSILON) {
        volatilityValues.push(p99 / p50)
      }
    }
  }

  const historyLatencyValues = history
    .map(point => point.latency)
    .filter(isFiniteNumber)
  const historyLossValues = history
    .map(point => point.loss)
    .filter(isFiniteNumber)

  const avgLatency = latencyValues.length ? average(latencyValues) : average(historyLatencyValues)
  const latestLatency = [...filteredRecords].reverse().find(record => record.value >= 0)?.value ?? avgLatency
  const avgLoss = taskLossValues.length ? average(taskLossValues) : average(historyLossValues)
  const avgVolatility = average(volatilityValues)
  const hasData = history.length > 0 || latencyValues.length > 0 || taskLossValues.length > 0

  return {
    avgLatency,
    latestLatency,
    avgLoss,
    avgVolatility,
    history,
    hasData,
  }
}

export function useNodePingStats(
  uuid: MaybeRefOrGetter<string>,
  options?: {
    hours?: MaybeRefOrGetter<number>
    enabled?: MaybeRefOrGetter<boolean>
    maxCount?: MaybeRefOrGetter<number | undefined>
    taskIds?: MaybeRefOrGetter<number[] | undefined>
  },
) {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const resolved = computed(() => {
    const hours = Math.max(1, Math.floor(toValue(options?.hours) ?? 24))
    const maxCount = normalizeMaxCount(toValue(options?.maxCount) ?? PING_RECORD_MAX_COUNT)
    const taskIds = [...new Set(
      (toValue(options?.taskIds) ?? [])
        .filter(taskId => Number.isInteger(taskId) && taskId > 0),
    )].sort((left, right) => left - right)
    return {
      uuid: toValue(uuid),
      hours,
      maxCount,
      taskIds,
      taskSelectionKey: taskIds.length ? taskIds.join(',') : 'all',
      cacheKey: getSharedPingRecordsKey(hours, maxCount, toValue(uuid)),
      enabled: toValue(options?.enabled) ?? true,
    }
  })

  let activeCacheKey: string | null = null
  let releaseSharedRecords: (() => void) | null = null

  function syncSharedRecordsSubscription(hours: number | null, maxCount?: number, uuid?: string): void {
    const cacheKey = hours === null ? null : getSharedPingRecordsKey(hours, maxCount, uuid)
    if (activeCacheKey === cacheKey)
      return

    releaseSharedRecords?.()
    releaseSharedRecords = null
    activeCacheKey = null

    if (hours === null)
      return

    releaseSharedRecords = retainSharedPingRecordsEntry(hours, maxCount, uuid)
    activeCacheKey = cacheKey
  }

  onScopeDispose(() => {
    syncSharedRecordsSubscription(null)
  })

  // stats 由共享 getRecords 结果派生；共享记录每分钟刷新一次后会自动重算。
  const stats = computed<NodePingStatsState>(() => {
    const { uuid: nodeUuid, hours, maxCount, taskIds, taskSelectionKey, enabled } = resolved.value
    if (!enabled || !nodeUuid.trim())
      return createEmptyStats()

    // 通过 getSharedPingRecordsEntry 读取（不存在则创建），确保 computed 始终对
    // entry.data 这个 shallowRef 建立响应式依赖——即便首次加载尚未返回。
    const entry = getSharedPingRecordsEntry(hours, maxCount, nodeUuid)
    const state = entry.data.value
    if (!state)
      return readStatsCache(nodeUuid, hours, maxCount, taskSelectionKey) ?? createEmptyStats()

    const selectedTaskIds = taskIds.length ? new Set(taskIds) : null
    const records = (state.recordsByClient.get(nodeUuid) ?? [])
      .filter(record => !selectedTaskIds || selectedTaskIds.has(record.task_id))
    const metricStats = state.metricStats
      ?.filter(stat => !selectedTaskIds || selectedTaskIds.has(normalizeTaskId(stat.task_id)))
    const metricLossPoints = state.metricLossPoints
      ?.filter(point => !selectedTaskIds || selectedTaskIds.has(point.taskId))
    return records.length || metricStats?.length
      ? buildStats(records, metricStats, metricLossPoints)
      : createEmptyStats()
  })

  // 副作用：按需触发首次共享加载并维护 loading/error，不再命令式写入 stats。
  watch(
    resolved,
    async (next, _previous, onCleanup) => {
      let cancelled = false
      onCleanup(() => {
        cancelled = true
      })

      const { uuid: nodeUuid, hours, maxCount, enabled } = next
      if (!enabled || !nodeUuid.trim()) {
        syncSharedRecordsSubscription(null)
        loading.value = false
        error.value = null
        return
      }

      syncSharedRecordsSubscription(hours, maxCount, nodeUuid)
      const entry = getSharedPingRecordsEntry(hours, maxCount, nodeUuid)
      const shouldLoadRecords = !entry.data.value
        || Date.now() - entry.lastFetchedAt >= PING_RECORD_REFRESH_INTERVAL_MS

      if (!shouldLoadRecords) {
        loading.value = false
        error.value = null
        return
      }

      const shouldShowLoading = !entry.data.value
      loading.value = shouldShowLoading
      error.value = null

      try {
        await loadSharedPingRecords(entry, hours, maxCount, nodeUuid)
      }
      catch (err) {
        if (!cancelled && shouldShowLoading)
          error.value = err instanceof Error ? err.message : '获取 Ping 历史失败'
      }
      finally {
        if (!cancelled)
          loading.value = false
      }
    },
    { immediate: true },
  )

  // 共享记录会定时刷新，节流回写 localStorage，避免多节点同时重算时密集写盘。
  const persistStats = useThrottleFn(
    (nodeUuid: string, hours: number, maxCount: number | undefined, taskSelectionKey: string, value: NodePingStatsState) => {
      writeStatsCache(nodeUuid, hours, maxCount, taskSelectionKey, value)
    },
    30_000,
    true,
    true,
  )

  watch(stats, (value) => {
    if (!value.hasData)
      return
    const { uuid: nodeUuid, hours, maxCount, taskSelectionKey, enabled } = resolved.value
    if (enabled && nodeUuid.trim())
      persistStats(nodeUuid, hours, maxCount, taskSelectionKey, value)
  })

  return {
    stats,
    loading,
    error,
    history: computed(() => stats.value.history),
    avgLatency: computed(() => stats.value.avgLatency),
    latestLatency: computed(() => stats.value.latestLatency),
    avgLoss: computed(() => stats.value.avgLoss),
    avgVolatility: computed(() => stats.value.avgVolatility),
    hasData: computed(() => stats.value.hasData),
  }
}
