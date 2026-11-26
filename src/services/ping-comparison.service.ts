import type { MetricSeries, PingMetricTaskStats } from '@/utils/rpc'
import { loadLegacyPingTaskRecords } from '@/services/history.service'
import { loadPingMetricStats, queryMetrics } from '@/services/metrics.service'
import { normalizeMetricSeriesList, PING_LATENCY_METRIC, PING_LOSS_METRIC, pingTaskId } from '@/utils/metricSeries'
import { RpcError } from '@/utils/rpc'

export interface PingComparisonRange {
  start: number
  end: number
}

interface LossSample {
  time: number
  rate: number
  count: number
}

export interface PingComparisonBucket {
  rate: number | null
  start: number
  end: number
}

export interface PingComparisonNode {
  uuid: string
  latency: Array<[number, number | null]>
  buckets: PingComparisonBucket[]
  stats: Pick<PingMetricTaskStats, 'total' | 'valid' | 'loss' | 'p50' | 'p99' | 'loss_approximate'> | null
  unavailable: boolean
}

interface NodeHistory extends Omit<PingComparisonNode, 'buckets'> {
  loss: LossSample[]
  intervalSeconds: number
}

const MAX_POINTS = 500
const MAX_BUCKETS = 40
const HOUR_MS = 3_600_000

function emptyHistory(uuid: string, unavailable = false): NodeHistory {
  return { uuid, latency: [], loss: [], intervalSeconds: 0, stats: null, unavailable }
}

function inRange(time: number, range: PingComparisonRange): boolean {
  return Number.isFinite(time) && time >= range.start && time <= range.end
}

function groupMetricHistory(uuids: readonly string[], taskId: number, range: PingComparisonRange, seriesList: MetricSeries[], stats: PingMetricTaskStats[]): NodeHistory[] {
  const histories = new Map(uuids.map(uuid => [uuid, emptyHistory(uuid)]))
  for (const stat of stats) {
    const history = histories.get(stat.entity_id)
    if (history && String(stat.task_id) === String(taskId) && stat.total > 0)
      history.stats = stat
  }
  for (const series of normalizeMetricSeriesList(seriesList)) {
    const history = histories.get(series.entity_id)
    if (!history || pingTaskId(series) !== String(taskId))
      continue
    if (series.downsampled)
      history.intervalSeconds = Math.max(history.intervalSeconds, series.interval_seconds || 0)
    for (const point of series.points) {
      const time = Date.parse(point.time)
      if (!inRange(time, range))
        continue
      const value = typeof point.value === 'number' && Number.isFinite(point.value) && point.value >= 0 ? point.value : null
      if (series.metric_key === PING_LATENCY_METRIC)
        history.latency.push([time, value])
      if (series.metric_key === PING_LOSS_METRIC && value !== null && value <= 1) {
        const count = typeof point.count === 'number' && Number.isFinite(point.count) && point.count > 0 ? point.count : 1
        history.loss.push({ time, rate: value, count })
      }
    }
  }
  return [...histories.values()]
}

async function loadLegacyHistory(uuid: string, taskId: number, range: PingComparisonRange, retentionHours: number): Promise<NodeHistory> {
  const history = emptyHistory(uuid)
  const hours = Math.min(retentionHours, Math.max(1, Math.ceil((Date.now() - range.start) / HOUR_MS)))
  const records = await loadLegacyPingTaskRecords(uuid, taskId, hours)
  for (const record of records) {
    const time = Date.parse(record.time)
    if (record.client !== uuid || String(record.task_id) !== String(taskId) || !inRange(time, range) || !Number.isFinite(record.value))
      continue
    history.latency.push([time, record.value < 0 ? null : record.value])
    history.loss.push({ time, rate: record.value < 0 ? 1 : 0, count: 1 })
  }
  return history
}

function isMissingMethod(error: unknown): boolean {
  return error instanceof RpcError && error.code === -32601
}

function timeline(history: NodeHistory, range: PingComparisonRange, bucketCount: number): PingComparisonNode {
  const step = (range.end - range.start) / bucketCount
  const bins = Array.from({ length: bucketCount }, (_, index) => ({
    start: range.start + index * step,
    total: 0,
    lost: 0,
  }))
  for (const point of history.loss) {
    const index = Math.min(bucketCount - 1, Math.floor((point.time - range.start) / step))
    const bin = bins[index]!
    bin.total += point.count
    bin.lost += point.rate * point.count
  }
  const total = bins.reduce((sum, bin) => sum + bin.total, 0)
  const lost = bins.reduce((sum, bin) => sum + bin.lost, 0)
  const stats = history.stats ?? (total > 0
    ? { total, valid: Math.max(0, Math.round(total - lost)), loss: 100 * lost / total, loss_approximate: history.intervalSeconds > 0 }
    : null)
  return {
    uuid: history.uuid,
    latency: history.latency.sort((a, b) => a[0] - b[0]),
    buckets: bins.map(bin => ({
      start: bin.start,
      end: bin.start + step,
      rate: bin.total ? 100 * bin.lost / bin.total : null,
    })),
    stats,
    unavailable: history.unavailable,
  }
}

export async function loadPingComparison(uuids: readonly string[], taskId: number, range: PingComparisonRange, retentionHours: number): Promise<{ nodes: PingComparisonNode[], aggregated: boolean }> {
  const filters = {
    entity_ids: [...uuids],
    start: new Date(range.start).toISOString(),
    end: new Date(range.end).toISOString(),
    max_points: MAX_POINTS,
  }
  const [seriesResult, statsResult] = await Promise.allSettled([
    queryMetrics({
      ...filters,
      metric_keys: [PING_LATENCY_METRIC, PING_LOSS_METRIC],
      tags: { task_id: String(taskId) },
      aggregation: 'avg',
      fill_empty: true,
    }),
    loadPingMetricStats({ ...filters, task_id: String(taskId) }),
  ])

  if (seriesResult.status === 'rejected' && !isMissingMethod(seriesResult.reason))
    throw seriesResult.reason
  const stats = statsResult.status === 'fulfilled' ? statsResult.value?.stats ?? [] : []
  const histories = groupMetricHistory(uuids, taskId, range, seriesResult.status === 'fulfilled' ? seriesResult.value?.series ?? [] : [], stats)
  const results = await Promise.all(histories.map(async (history) => {
    if (history.loss.length || (history.stats && history.latency.some(([, value]) => value !== null)))
      return history

    try {
      const legacy = await loadLegacyHistory(history.uuid, taskId, range, retentionHours)
      return legacy.loss.length ? { ...legacy, stats: history.stats } : history
    }
    catch {
      return { ...history, unavailable: seriesResult.status === 'rejected' || Boolean(history.stats?.total) }
    }
  }))

  const intervalSeconds = Math.max(0, ...results.map(history => history.intervalSeconds))
  const bucketCount = intervalSeconds > 0
    ? Math.max(1, Math.min(MAX_BUCKETS, Math.floor((range.end - range.start) / (intervalSeconds * 1000))))
    : MAX_BUCKETS
  return { nodes: results.map(history => timeline(history, range, bucketCount)), aggregated: intervalSeconds > 0 }
}
