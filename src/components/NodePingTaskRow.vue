<script setup lang="ts">
import type { HomePingHours } from '@/utils/homePingConfig'
import type { PingTaskInfo } from '@/utils/rpc'
import { computed } from 'vue'
import PingHistoryStrip from '@/components/PingHistoryStrip.vue'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'

const props = defineProps<{
  nodeUuid: string
  task: PingTaskInfo
  hours: HomePingHours
  dense?: boolean
  enabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const {
  pingStats,
  latencyRenderBars,
  lossRenderBars,
} = useNodePingDisplay(
  () => props.nodeUuid,
  {
    hours: () => props.hours,
    taskIds: () => [props.task.id],
    enabled: () => props.enabled !== false,
  },
)

const taskType = computed(() => (props.task.type || 'ping').toUpperCase())
const latencyText = computed(() => {
  if (pingStats.hasData.value)
    return `${Math.round(pingStats.latestLatency.value || pingStats.avgLatency.value)} ms`
  if (pingStats.loading.value)
    return '加载中'
  return '-'
})
const lossText = computed(() => {
  if (pingStats.hasData.value)
    return `${pingStats.avgLoss.value.toFixed(1)}%`
  if (pingStats.loading.value)
    return '加载中'
  return '-'
})
</script>

<template>
  <button
    type="button"
    class="group grid min-w-0 items-center gap-y-1 rounded-md px-1 py-1 text-left transition-colors hover:bg-background/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :class="props.dense
      ? 'grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_minmax(0,.8fr)] gap-x-1.5'
      : 'grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2'"
    :aria-label="`${task.name}，延迟 ${latencyText}，丢包 ${lossText}`"
    @click.stop="emit('click')"
  >
    <div class="flex min-w-0 items-center gap-1.5">
      <span class="size-1.5 shrink-0 rounded-full bg-selection" />
      <span class="truncate text-[11px] font-medium">{{ task.name }}</span>
      <span v-if="!props.dense" class="shrink-0 rounded-full border border-selection/25 bg-selection/10 px-1 py-px text-[8px] font-semibold text-selection">
        {{ taskType }}
      </span>
    </div>
    <span class="truncate text-right text-[11px] font-semibold tabular-nums text-warning">{{ latencyText }}</span>
    <span class="truncate text-right text-[11px] font-semibold tabular-nums">{{ lossText }}</span>

    <span aria-hidden="true" />
    <PingHistoryStrip
      :bars="latencyRenderBars"
      :label="`${task.name} 延迟历史，鼠标悬浮查看具体时间与延迟`"
      :hover-padding-top="22"
      class="h-2 opacity-80 transition-opacity hover:opacity-100"
    />
    <PingHistoryStrip
      :bars="lossRenderBars"
      :label="`${task.name} 丢包历史，鼠标悬浮查看具体时间与丢包率`"
      :hover-padding-top="22"
      class="h-2 opacity-80 transition-opacity hover:opacity-100"
    />
  </button>
</template>
