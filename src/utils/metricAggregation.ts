import type { MetricSeries } from '@/utils/rpc'

export interface MetricAggregationInfo {
  intervalSeconds: number
  isDaily: boolean
  label: string
}

type MetricAggregationSeries = Pick<MetricSeries, 'downsampled' | 'interval_seconds' | 'points'>

function formatIntervalLabel(intervalSeconds: number): string {
  if (intervalSeconds >= 86_400) {
    const days = Math.max(1, Math.round(intervalSeconds / 86_400))
    return days === 1 ? '按日聚合' : `按 ${days} 天聚合`
  }
  if (intervalSeconds >= 3_600) {
    const hours = Math.max(1, Math.round(intervalSeconds / 3_600))
    return hours === 1 ? '按小时聚合' : `按 ${hours} 小时聚合`
  }
  if (intervalSeconds >= 60) {
    const minutes = Math.max(1, Math.round(intervalSeconds / 60))
    return minutes === 1 ? '按分钟聚合' : `按 ${minutes} 分钟聚合`
  }

  return `按 ${Math.max(1, Math.round(intervalSeconds))} 秒聚合`
}

export function resolveMetricAggregationInfo(seriesList: readonly MetricAggregationSeries[]): MetricAggregationInfo | null {
  const intervals = seriesList
    .filter(series => series.downsampled && series.points.length > 0)
    .map(series => series.interval_seconds)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)

  if (!intervals.length)
    return null

  const intervalSeconds = Math.max(...intervals)
  return {
    intervalSeconds,
    isDaily: intervalSeconds >= 86_400,
    label: formatIntervalLabel(intervalSeconds),
  }
}

export function formatUtcMetricBucketDate(time: string | number, includeYear = false): string {
  const date = new Date(time)
  if (!Number.isFinite(date.getTime()))
    return String(time)

  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  if (!includeYear)
    return `${Number(month)}/${Number(day)}`

  return `${date.getUTCFullYear()}/${month}/${day}`
}
