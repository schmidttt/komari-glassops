<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { PingComparisonBucket } from '@/services/ping-comparison.service'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePingComparison } from '@/composables/usePingComparison'
import { useAppStore } from '@/stores/app'
import { getChartSeriesPalette } from '@/utils/chartPalette'
import '@/utils/echarts'

const props = defineProps<{ nodes: NodeData[] }>()
const appStore = useAppStore()
const {
  catalog,
  commonTasks,
  selectedTaskId,
  selectedWindow,
  startInput,
  endInput,
  customError,
  shownRange,
  loading,
  error,
  result,
  applyCustomRange,
  refresh,
} = usePingComparison(() => props.nodes.map(node => node.uuid))
const { loading: tasksLoading, error: tasksError } = catalog

const windows = [
  { value: '1', label: '近 1 小时' },
  { value: '6', label: '近 6 小时' },
  { value: '24', label: '近 24 小时' },
  { value: 'custom', label: '自定义' },
] as const

const activeBucket = ref<{ uuid: string, index: number } | null>(null)
watch(result, () => {
  activeBucket.value = null
})

const rows = computed(() => {
  const colors = getChartSeriesPalette(appStore.colorVisionFriendly)
  const order = appStore.colorVisionFriendly ? [0, 1, 2, 3] : [3, 1, 2, 4]
  const lineTypes = ['solid', 'dashed', 'dotted', [8, 3, 2, 3]] as const
  return (result.value?.nodes ?? []).flatMap((history, index) => {
    const node = props.nodes.find(item => item.uuid === history.uuid)
    return node
      ? [{
          ...history,
          name: node.name,
          color: colors[order[index]!]!,
          lineType: lineTypes[index] ?? 'solid',
        }]
      : []
  })
})

const hasLatency = computed(() => rows.value.some(row => row.latency.some(([, value]) => value !== null)))
const rangeText = computed(() => shownRange.value
  ? `${dayjs(shownRange.value.start).format('M/D HH:mm')} – ${dayjs(shownRange.value.end).format('M/D HH:mm')}`
  : '')
const chartOptions = computed<EChartsOption>(() => {
  const foreground = appStore.isDark ? '#b6c6d7' : '#475569'
  const gridline = appStore.isDark ? 'rgba(148, 163, 184, 0.19)' : 'rgba(71, 85, 105, 0.15)'
  const range = shownRange.value
  const axisFormat = range && dayjs(range.start).format('M/D') !== dayjs(range.end).format('M/D') ? 'M/D HH:mm' : 'HH:mm'
  return {
    animation: false,
    grid: { left: 48, right: 20, top: 16, bottom: 32 },
    textStyle: { color: foreground, fontSize: 11 },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      valueFormatter: (value) => {
        const latency = Array.isArray(value) ? value[1] : value
        return typeof latency === 'number' && Number.isFinite(latency) ? `${Math.round(latency)} ms` : '—'
      },
      axisPointer: { type: 'line', lineStyle: { color: foreground, type: 'dashed', opacity: 0.55 } },
    },
    xAxis: {
      type: 'time',
      min: range?.start,
      max: range?.end,
      splitNumber: 5,
      axisLabel: { formatter: (timestamp: number) => dayjs(timestamp).format(axisFormat), hideOverlap: true },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: gridline } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      axisLabel: { formatter: '{value}' },
      splitLine: { lineStyle: { color: gridline, type: 'dashed' } },
    },
    series: rows.value.map(row => ({
      name: row.name,
      type: 'line',
      data: row.latency,
      showSymbol: row.latency.filter(([, value]) => value !== null).length < 3,
      symbolSize: 5,
      connectNulls: false,
      lineStyle: { color: row.color, width: 2.2, type: typeof row.lineType === 'string' ? row.lineType : [...row.lineType] },
      itemStyle: { color: row.color },
    })),
  }
})

function milliseconds(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)} ms` : '—'
}

function lossLabel(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate))
    return '无样本'
  if (rate === 0)
    return '0% 丢包'
  return `${rate < 0.01 ? '<0.01' : rate.toFixed(2)}% 丢包`
}

function bucketLabel(bucket: PingComparisonBucket): string {
  return `${dayjs(bucket.start).format('M/D HH:mm')} – ${dayjs(bucket.end).format('M/D HH:mm')} · ${lossLabel(bucket.rate)}`
}

function selectAdjacentBucket(event: KeyboardEvent, uuid: string, index: number, delta: number) {
  const next = (event.currentTarget as HTMLButtonElement).parentElement?.children[index + delta]
  if (next instanceof HTMLButtonElement) {
    activeBucket.value = { uuid, index: index + delta }
    next.focus()
  }
}

const bucketDetail = computed(() => {
  const selected = activeBucket.value
  const row = selected && rows.value.find(item => item.uuid === selected.uuid)
  const bucket = row && selected && row.buckets[selected.index]
  return row && bucket ? `${row.name} · ${bucketLabel(bucket)}` : ''
})
</script>

<template>
  <section class="min-w-0 space-y-3" aria-label="线路历史对比">
    <div v-if="nodes.length < 2" class="rounded-xl border border-border/45 bg-background/40 px-4 py-9 text-center">
      <Icon icon="tabler:activity" class="mx-auto mb-3 h-6 w-6 text-selection" />
      <p class="text-sm font-medium text-foreground">
        选两台或更多节点开始对比
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        使用同一探测任务，查看它们在同一时段的延迟与丢包。
      </p>
    </div>
    <p v-else-if="tasksLoading" role="status" class="rounded-xl bg-background/50 p-5 text-sm text-muted-foreground">
      正在读取共同探测任务…
    </p>
    <div v-else-if="tasksError" class="flex flex-wrap items-center gap-3 rounded-xl border border-border/45 bg-background/50 p-4 text-sm">
      <p role="status">
        当前无法获取公开探测任务，请检查后端支持或稍后重试。
      </p>
      <Button variant="outline" size="sm" @click="catalog.refresh().catch(() => {})">
        重试
      </Button>
    </div>
    <p v-else-if="!commonTasks.length" class="rounded-xl border border-border/45 bg-background/50 p-5 text-sm text-muted-foreground">
      所选节点没有共同的探测任务。请调整节点，或在 Komari 将同一任务分配给这些节点。
    </p>
    <template v-else>
      <div class="space-y-3 rounded-xl border border-border/45 bg-background/55 px-3 py-3.5 sm:px-4">
        <div class="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
          <label class="min-w-0 grow space-y-1.5 sm:max-w-70">
            <span class="block text-xs font-medium text-muted-foreground">共同探测任务</span>
            <select v-model="selectedTaskId" class="h-9 w-full truncate rounded-md border border-border/55 bg-background/75 px-2.5 text-sm text-foreground">
              <option v-for="task in commonTasks" :key="task.id" :value="String(task.id)">
                {{ task.name }}
              </option>
            </select>
          </label>
          <div class="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="对比时段">
            <Button
              v-for="window in windows" :key="window.value" :aria-pressed="selectedWindow === window.value"
              :variant="selectedWindow === window.value ? 'secondary' : 'ghost'" size="sm"
              class="h-8 px-2.5 text-xs" @click="selectedWindow = window.value"
            >
              {{ window.label }}
            </Button>
            <Button size="icon-sm" variant="ghost" :disabled="loading || !shownRange" aria-label="刷新线路历史" @click="refresh">
              <Icon icon="tabler:refresh" />
            </Button>
          </div>
        </div>
        <form v-if="selectedWindow === 'custom'" class="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" @submit.prevent="applyCustomRange">
          <label class="min-w-0 space-y-1">
            <span class="block text-xs text-muted-foreground">开始时间</span>
            <Input v-model="startInput" type="datetime-local" required class="min-w-0 bg-background/70" />
          </label>
          <label class="min-w-0 space-y-1">
            <span class="block text-xs text-muted-foreground">结束时间</span>
            <Input v-model="endInput" type="datetime-local" required class="min-w-0 bg-background/70" />
          </label>
          <Button type="submit" variant="outline" class="justify-self-start">
            应用时段
          </Button>
          <p v-if="customError" role="alert" class="text-xs text-destructive sm:col-span-3">
            {{ customError }}
          </p>
        </form>
      </div>

      <p v-if="loading" role="status" class="rounded-xl border border-border/45 bg-background/45 p-5 text-sm text-muted-foreground">
        正在读取线路历史…
      </p>
      <div v-else-if="error" class="flex flex-wrap items-center gap-2 rounded-xl border border-border/45 bg-background/50 p-4 text-sm">
        <p role="alert">
          {{ error }}
        </p>
        <Button variant="outline" size="sm" @click="refresh">
          重试
        </Button>
      </div>
      <div v-else-if="result" class="overflow-hidden rounded-xl border border-border/55 bg-background/55">
        <div class="flex flex-wrap items-start justify-between gap-2 px-3 pt-4 sm:px-5">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-foreground">
              延迟趋势 <span class="ml-1 text-xs font-normal text-muted-foreground">ms</span>
            </h3>
            <p class="mt-1 text-xs tabular-nums text-muted-foreground">
              {{ rangeText }}
            </p>
          </div>
          <span v-if="result.aggregated" class="rounded-md bg-muted/70 px-2 py-1 text-xs text-muted-foreground">含聚合样本</span>
        </div>
        <ul class="flex flex-wrap gap-x-4 gap-y-2 px-3 pt-3 sm:px-5" aria-label="节点图例">
          <li v-for="row in rows" :key="row.uuid" class="flex min-w-0 items-center gap-2 text-xs text-foreground/85">
            <span class="h-0 w-4 shrink-0 border-t-2" :class="row.lineType === 'solid' ? 'border-solid' : row.lineType === 'dotted' ? 'border-dotted' : 'border-dashed'" :style="{ borderColor: row.color }" />
            <span class="max-w-44 truncate" :title="row.name">{{ row.name }}</span>
          </li>
        </ul>
        <VChart v-if="hasLatency" class="h-54 w-full sm:h-66" :option="chartOptions" :update-options="{ notMerge: true }" autoresize />
        <p v-else class="px-3 py-8 text-center text-xs text-muted-foreground">
          所选时段没有可绘制的延迟样本。
        </p>
        <div class="border-t border-border/40 px-3 py-4 sm:px-5">
          <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-xs font-semibold text-foreground">
              丢包时间分布
            </h3>
            <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-xs bg-success/65" /> 正常</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-xs bg-destructive/75" /> 丢包</span>
              <span class="inline-flex items-center gap-1"><span class="loss-empty h-2 w-2 rounded-xs" /> 无样本</span>
            </div>
          </div>
          <div v-for="row in rows" :key="row.uuid" class="mb-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <span class="min-w-0 truncate text-xs font-medium text-foreground/85" :title="row.name">{{ row.name }}</span>
            <span class="text-xs tabular-nums text-muted-foreground">{{ row.unavailable ? '读取失败' : row.stats ? lossLabel(row.stats.loss) : '无样本' }}</span>
            <div class="col-span-2 ml-9 mr-2 flex min-w-0 gap-px sm:ml-7 sm:mr-0" :aria-label="`${row.name} 丢包时间条`">
              <button
                v-for="(bucket, index) in row.buckets" :key="index"
                type="button" class="h-4 min-w-0 flex-1 rounded-xs focus-visible:outline-2 focus-visible:outline-selection"
                :class="bucket.rate === null ? 'loss-empty' : bucket.rate > 0 ? 'bg-destructive/75' : 'bg-success/55'"
                :aria-label="bucketLabel(bucket)" :tabindex="(activeBucket?.uuid === row.uuid ? activeBucket.index : 0) === index ? 0 : -1"
                :title="bucketLabel(bucket)" @click="activeBucket = { uuid: row.uuid, index }"
                @keydown.left.prevent="selectAdjacentBucket($event, row.uuid, index, -1)"
                @keydown.right.prevent="selectAdjacentBucket($event, row.uuid, index, 1)"
              />
            </div>
          </div>
          <p class="min-h-5 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
            {{ bucketDetail }}
          </p>
        </div>
        <div class="grid gap-px border-t border-border/45 bg-border/35 sm:grid-cols-2 xl:grid-cols-4">
          <section v-for="row in rows" :key="row.uuid" class="min-w-0 bg-background/65 px-3 py-3 sm:px-4">
            <h4 class="truncate text-xs font-semibold text-foreground" :title="row.name">
              {{ row.name }}
            </h4>
            <div class="mt-2 grid grid-cols-3 gap-1.5">
              <div>
                <div class="text-[10px] text-muted-foreground">
                  P50
                </div>
                <div class="text-xs tabular-nums">
                  {{ milliseconds(row.stats?.p50) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-muted-foreground">
                  P99
                </div>
                <div class="text-xs tabular-nums">
                  {{ milliseconds(row.stats?.p99) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-muted-foreground">
                  有效／总样本
                </div>
                <div class="text-xs tabular-nums">
                  {{ row.stats ? `${row.stats.valid} / ${row.stats.total}` : '—' }}
                </div>
              </div>
            </div>
            <p v-if="row.stats?.loss_approximate" class="mt-1.5 text-[10px] text-muted-foreground">
              丢包率为聚合估算
            </p>
          </section>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.loss-empty {
  background: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, currentColor 16%, transparent) 0 1px,
    transparent 1px 4px
  );
}
</style>
