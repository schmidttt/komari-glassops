<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import NodeMetricLabel from '@/components/NodeMetricLabel.vue'
import NodePingTaskRow from '@/components/NodePingTaskRow.vue'
import NodeTagChips from '@/components/NodeTagChips.vue'
import PingHistoryStrip from '@/components/PingHistoryStrip.vue'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useNodeHomePingTasks } from '@/composables/useHomePingTasks'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, getStatus } from '@/utils/helper'
import { HOME_PING_HOUR_OPTIONS } from '@/utils/homePingConfig'
import { getDiskPercentage, getMemoryPercentage, getTrafficUsed, getTrafficUsedPercentage, hasTrafficLimit } from '@/utils/nodeMetricsHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getExpireText, hasIPv4, hasIPv6 } from '@/utils/tagHelper'

const props = withDefaults(defineProps<{
  node: NodeData
  reduceMotion?: boolean
  pingEnabled?: boolean
}>(), {
  reduceMotion: false,
  pingEnabled: true,
})

const emit = defineEmits<{
  click: []
  pingClick: []
}>()

const appStore = useAppStore()
const { selectedTasks, loading: pingTasksLoading } = useNodeHomePingTasks(() => props.node.uuid)

const isFavorite = computed(() => appStore.isFavoriteNode(props.node.uuid))
const isMiniNodeCard = computed(() => appStore.nodeCardSize === 'mini')
const nodeCardXSize = computed(() => {
  if (isMiniNodeCard.value)
    return 'small'
  return appStore.nodeCardSize === 'large' ? 'large' : 'medium'
})
const nodeCardGapClass = computed(() => {
  if (appStore.nodeCardSize === 'large')
    return 'gap-5'
  if (appStore.nodeCardSize === 'comfortable')
    return 'gap-4'
  return 'gap-3'
})
const nodeCardHeaderClass = computed(() => {
  if (isMiniNodeCard.value)
    return 'min-[1800px]:!px-4 min-[1800px]:!py-2.5'
  if (appStore.nodeCardSize === 'large')
    return undefined
  return 'min-[1800px]:!px-5 min-[1800px]:!py-3.5'
})
const nodeCardContentClass = computed(() => {
  if (isMiniNodeCard.value)
    return '!p-3 !pt-0 min-[1800px]:!px-4 min-[1800px]:!pb-4'
  if (appStore.nodeCardSize === 'large')
    return undefined
  return 'min-[1800px]:!px-5 min-[1800px]:!pb-5'
})
const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)

const cpuPercentage = computed(() => Math.max(0, props.node.cpu ?? 0))
const cpuStatus = computed(() => getStatus(cpuPercentage.value))
const memPercentage = computed(() => getMemoryPercentage(props.node))
const memStatus = computed(() => getStatus(memPercentage.value))
const diskPercentage = computed(() => getDiskPercentage(props.node))
const diskStatus = computed(() => getStatus(diskPercentage.value))
const trafficUsed = computed(() => getTrafficUsed(props.node))
const trafficPercentage = computed(() => getTrafficUsedPercentage(props.node))
const trafficStatus = computed(() => getStatus(trafficPercentage.value))
const trafficUsageText = computed(() => {
  const limit = hasTrafficLimit(props.node) ? formatBytes(props.node.traffic_limit) : '∞'
  return `${formatBytes(trafficUsed.value)} / ${limit}`
})
const remainingTimeText = computed(() => getExpireText(props.node.expired_at, appStore.lang))
const renewalPriceText = computed(() => {
  if (!appStore.privateFeaturesAllowed && appStore.hidePriceWhenLoggedOut)
    return '***'
  return formatPriceWithCycle(
    props.node.price,
    props.node.billing_cycle,
    props.node.currency,
    appStore.lang,
  )
})
const supportsIPv4 = computed(() => hasIPv4(props.node.ipv4))
const supportsIPv6 = computed(() => hasIPv6(props.node.ipv6))
const osDisplayName = computed(() => getOSName(props.node.os))
const osNameClass = computed(() => {
  const length = osDisplayName.value.length
  if (length > 32)
    return 'text-[8px]'
  if (length > 24)
    return 'text-[9px]'
  if (length > 18)
    return 'text-[10px]'
  return 'text-[11px]'
})
const pingGridClass = computed(() => appStore.nodeCardSize === 'compact'
  ? 'grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_minmax(0,.8fr)] gap-x-1.5'
  : 'grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-2')
const selectedTaskIds = computed(() => selectedTasks.value.map(task => task.id))
const miniTaskIds = computed(() => selectedTaskIds.value.slice(0, 1))
const miniTaskName = computed(() => selectedTasks.value[0]?.name?.trim() || (pingTasksLoading.value ? '读取中' : '未配置'))
const {
  latencyRenderBars: miniLatencyBars,
  lossRenderBars: miniLossBars,
  latencyDisplay: miniLatencyDisplay,
  lossDisplay: miniLossDisplay,
} = useNodePingDisplay(
  () => props.node.uuid,
  {
    hours: () => appStore.homePingHours,
    taskIds: miniTaskIds,
    enabled: () => props.pingEnabled,
    loadingDisplayText: '加载中',
  },
)
const offlineTime = computed(() => formatDateTime(props.node.time))
const nodeMessage = computed(() => props.node.message?.trim() ?? '')
const nodeMessageTooltip = computed(() => {
  if (!nodeMessage.value)
    return ''
  const updatedAt = props.node.status_updated_at ? `\n更新时间：${formatDateTime(props.node.status_updated_at)}` : ''
  return `${nodeMessage.value}${updatedAt}`
})

const uptimeText = computed(() => {
  const seconds = Math.max(0, Math.floor(props.node.uptime ?? 0))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  if (days > 0)
    return `${days}天 ${hours}时`
  const minutes = Math.floor((seconds % 3_600) / 60)
  return hours > 0 ? `${hours}时 ${minutes}分` : `${minutes}分`
})

function handleKeyboardOpen(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  emit('click')
}

function toggleFavorite() {
  appStore.toggleFavoriteNode(props.node.uuid)
}

function getRegionAltText(region: string): string {
  return getRegionDisplayName(region) || getRegionCode(region)
}

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}
</script>

<template>
  <CardX
    hoverable
    :size="nodeCardXSize"
    class="node-card w-full cursor-pointer overflow-hidden border-white/10 shadow-[0_18px_50px_-32px_rgba(2,8,23,0.9)] transition-all duration-200"
    :class="[
      isMiniNodeCard ? 'node-card--mini' : `node-card--${appStore.nodeCardSize}`,
      !props.node.online && '!border-destructive/35',
    ]"
    :header-class="nodeCardHeaderClass"
    :content-class="nodeCardContentClass"
    role="button"
    tabindex="0"
    :aria-label="`查看节点 ${props.node.name} 详情`"
    @click="emit('click')"
    @keydown="handleKeyboardOpen"
  >
    <template #header>
      <div v-if="isMiniNodeCard" class="flex min-w-0 items-center gap-2">
        <span class="relative size-2.5 shrink-0" data-node-online-dot>
          <span class="absolute inset-0 rounded-full" :class="props.node.online ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-destructive'" />
          <span
            v-if="!props.reduceMotion && props.node.online"
            class="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-50 dark:bg-emerald-400"
          />
        </span>
        <span class="node-card-title truncate text-sm font-bold tracking-tight">{{ props.node.name }}</span>
        <NodeTagChips
          v-if="appStore.nodeListCustomTagsVisible"
          :tags="props.node.tags"
          :node-name="props.node.name"
          dense
        />
        <button
          type="button"
          class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-slate-500/10 hover:text-amber-500"
          :class="isFavorite && 'text-amber-500'"
          :aria-label="isFavorite ? `取消收藏 ${props.node.name}` : `收藏 ${props.node.name}`"
          :title="isFavorite ? '取消收藏' : '收藏节点'"
          @click.stop="toggleFavorite"
          @keydown.stop
        >
          <Icon :icon="isFavorite ? 'tabler:star-filled' : 'tabler:star'" width="14" height="14" />
        </button>
        <DataTooltip
          v-if="nodeMessage"
          :content="nodeMessageTooltip"
          placement="top"
          as="span"
          class="inline-flex shrink-0 text-warning"
          content-class="w-56 whitespace-pre-line leading-snug text-left"
        >
          <Icon icon="tabler:alert-triangle-filled" width="13" height="13" aria-label="节点消息" />
        </DataTooltip>
      </div>

      <div v-else class="node-card-header-grid grid w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-0.5">
        <img
          v-if="hasRegion(props.node.region)"
          :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionAltText(props.node.region)"
          class="node-card-flag row-span-2 h-7 w-9 shrink-0 rounded-[4px] object-cover shadow-sm"
        >
        <div v-else class="node-card-flag row-span-2 flex h-7 w-9 shrink-0 items-center justify-center rounded-[4px] bg-slate-500/10 text-muted-foreground">
          <Icon icon="tabler:world" width="17" height="17" />
        </div>
        <div class="flex min-w-0 items-center gap-1.5">
          <span class="node-card-title truncate text-[15px] font-semibold tracking-tight">{{ props.node.name }}</span>
          <NodeTagChips
            v-if="appStore.nodeListCustomTagsVisible"
            :tags="props.node.tags"
            :node-name="props.node.name"
            :dense="appStore.nodeCardSize === 'compact'"
          />
          <DataTooltip
            v-if="nodeMessage"
            :content="nodeMessageTooltip"
            placement="top"
            class="inline-flex shrink-0 text-warning"
            content-class="w-56 whitespace-pre-line leading-snug text-left"
          >
            <Icon icon="tabler:alert-triangle-filled" width="14" height="14" aria-label="节点消息" />
          </DataTooltip>
        </div>
        <div
          class="flex items-center justify-end gap-1 text-[11px] font-semibold"
          :class="props.node.online ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'"
          data-node-online-status
        >
          <button
            type="button"
            class="mr-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-slate-500/10 hover:text-amber-500"
            :class="isFavorite && 'text-amber-500'"
            :aria-label="isFavorite ? `取消收藏 ${props.node.name}` : `收藏 ${props.node.name}`"
            :title="isFavorite ? '取消收藏' : '收藏节点'"
            @click.stop="toggleFavorite"
            @keydown.stop
          >
            <Icon :icon="isFavorite ? 'tabler:star-filled' : 'tabler:star'" width="14" height="14" />
          </button>
          <span class="relative size-2 shrink-0" data-node-online-dot>
            <span class="absolute inset-0 rounded-full" :class="props.node.online ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-destructive'" />
            <span
              v-if="!props.reduceMotion && props.node.online"
              class="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-55 dark:bg-emerald-400"
            />
          </span>
          <span>{{ props.node.online ? '在线' : '离线' }}</span>
        </div>
        <div class="col-span-2 col-start-2 flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <img :src="getOSImage(props.node.os)" :alt="osDisplayName" class="size-3.5 shrink-0">
          <span
            class="min-w-0 whitespace-nowrap leading-none"
            :class="osNameClass"
            :title="osDisplayName"
          >
            {{ osDisplayName }}
          </span>
          <span class="shrink-0 text-[10px]" aria-hidden="true">·</span>
          <span class="shrink-0 text-[10px]">{{ props.node.arch || '-' }}</span>
          <div class="ml-auto flex shrink-0 items-center justify-end gap-1">
            <span
              v-if="supportsIPv4"
              class="inline-flex items-center gap-0.5 rounded-full border border-selection/30 bg-selection/12 px-1.5 py-px text-[9px] font-semibold text-selection"
              aria-label="支持 IPv4"
              title="支持 IPv4"
            >
              <span class="size-1 rounded-full bg-current" aria-hidden="true" />
              V4
            </span>
            <span
              v-if="supportsIPv6"
              class="inline-flex items-center gap-0.5 rounded-full border border-selection/30 bg-selection/12 px-1.5 py-px text-[9px] font-semibold text-selection"
              aria-label="支持 IPv6"
              title="支持 IPv6"
            >
              <span class="size-1 rounded-full bg-current" aria-hidden="true" />
              V6
            </span>
          </div>
        </div>
      </div>
    </template>

    <template #header-extra>
      <div v-if="isMiniNodeCard" class="flex items-center gap-2">
        <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4 shrink-0">
        <img
          v-if="hasRegion(props.node.region)"
          :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionAltText(props.node.region)"
          class="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow-sm"
        >
      </div>
    </template>

    <template #default>
      <div v-if="isMiniNodeCard" class="relative flex flex-col gap-3">
        <div class="flex flex-wrap gap-1.5 text-[10px]">
          <span
            class="rounded-full px-2 py-0.5 font-semibold"
            :class="props.node.online
              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300'
              : 'bg-destructive/10 text-destructive'"
            data-node-online-status
          >
            {{ props.node.online ? `在线 ${uptimeText}` : '离线' }}
          </span>
          <span class="rounded-full bg-slate-500/10 px-2 py-0.5 font-medium text-foreground/80">
            {{ renewalPriceText }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-x-3 gap-y-3">
          <div class="min-w-0">
            <div class="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
              <NodeMetricLabel metric="cpu" compact />
              <span class="font-semibold tabular-nums">{{ cpuPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="cpuPercentage" :status="cpuStatus" :height="5" />
            <div class="mt-1 truncate text-[9px] tabular-nums text-muted-foreground">
              {{ (props.node.load ?? 0).toFixed(2) }}, {{ (props.node.load5 ?? 0).toFixed(2) }}, {{ (props.node.load15 ?? 0).toFixed(2) }}
            </div>
          </div>

          <div class="min-w-0">
            <div class="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
              <NodeMetricLabel metric="memory" compact />
              <span class="font-semibold tabular-nums">{{ memPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="memPercentage" :status="memStatus" :height="5" />
            <div class="mt-1 truncate text-[9px] tabular-nums text-muted-foreground">
              {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
            </div>
          </div>

          <div class="min-w-0">
            <div class="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
              <NodeMetricLabel metric="disk" compact />
              <span class="font-semibold tabular-nums">{{ diskPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="5" />
            <div class="mt-1 truncate text-[9px] tabular-nums text-muted-foreground">
              {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
            </div>
          </div>

          <div class="min-w-0">
            <div class="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
              <NodeMetricLabel metric="traffic" compact />
              <span class="font-semibold tabular-nums">{{ hasTrafficLimit(props.node) ? `${trafficPercentage.toFixed(1)}%` : '∞' }}</span>
            </div>
            <ProgressThin :percentage="trafficPercentage" :status="trafficStatus" :height="5" />
            <div class="mt-1 truncate text-[9px] tabular-nums text-muted-foreground">
              {{ trafficUsageText }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-1.5">
          <div class="min-w-0 rounded-lg bg-slate-500/8 p-2">
            <div class="mb-1 flex items-center gap-1 text-[9px] font-semibold text-foreground/75">
              <Icon icon="tabler:gauge" width="11" height="11" />
              <span class="truncate">实时速率</span>
            </div>
            <div class="space-y-0.5 text-[9px] tabular-nums">
              <div class="flex items-center gap-0.5 truncate text-rose-700 dark:text-rose-300/90">
                <Icon icon="tabler:arrow-up" width="10" height="10" />
                {{ formatBytesPerSecond(props.node.net_out ?? 0) }}
              </div>
              <div class="flex items-center gap-0.5 truncate text-cyan-700 dark:text-cyan-300/90">
                <Icon icon="tabler:arrow-down" width="10" height="10" />
                {{ formatBytesPerSecond(props.node.net_in ?? 0) }}
              </div>
            </div>
          </div>

          <div class="min-w-0 rounded-lg bg-slate-500/8 p-2">
            <div class="mb-1 flex items-center gap-1 text-[9px] font-semibold text-foreground/75">
              <Icon icon="tabler:arrows-transfer-up-down" width="11" height="11" />
              <span class="truncate">累计流量</span>
            </div>
            <div class="space-y-0.5 text-[9px] text-foreground/85 tabular-nums">
              <div class="flex min-w-0 items-center gap-1">
                <Icon icon="tabler:upload" width="10" height="10" class="shrink-0" />
                <span class="truncate">{{ formatBytes(props.node.net_total_up ?? 0) }}</span>
              </div>
              <div class="flex min-w-0 items-center gap-1">
                <Icon icon="tabler:download" width="10" height="10" class="shrink-0" />
                <span class="truncate">{{ formatBytes(props.node.net_total_down ?? 0) }}</span>
              </div>
            </div>
          </div>

          <div class="min-w-0 rounded-lg bg-slate-500/8 p-2">
            <div class="mb-1 flex items-center gap-1 text-[9px] font-semibold text-foreground/75">
              <Icon icon="tabler:calendar-dollar" width="11" height="11" />
              <span class="truncate">续费信息</span>
            </div>
            <div class="space-y-0.5 text-[9px] text-foreground/85 tabular-nums">
              <div class="truncate">
                {{ remainingTimeText === '-' ? '-' : `剩余 ${remainingTimeText}` }}
              </div>
              <div class="truncate">
                {{ renewalPriceText }}
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="selectedTasks.length || pingTasksLoading"
          class="grid grid-cols-2 gap-2"
          role="group"
          aria-label="节点延迟与丢包摘要"
          @click.stop="emit('pingClick')"
        >
          <div
            class="col-span-2 flex min-w-0 items-center gap-1.5 px-1 text-[9px] leading-none text-muted-foreground"
            data-mini-ping-task
          >
            <NodeMetricLabel metric="ping" compact icon-only class="shrink-0" />
            <span class="min-w-0 truncate font-semibold text-foreground/80" :title="`TCPing: ${miniTaskName}`">
              TCPing: {{ miniTaskName }}
            </span>
          </div>
          <div class="min-w-0 rounded-lg bg-slate-500/8 p-2">
            <div class="mb-1 flex items-center justify-between gap-2 text-[10px]">
              <span class="font-semibold text-foreground/80">延迟</span>
              <span class="truncate font-semibold tabular-nums">{{ miniLatencyDisplay }}</span>
            </div>
            <PingHistoryStrip
              :bars="miniLatencyBars"
              label="节点聚合延迟历史，鼠标悬浮查看具体时间与延迟"
              :hover-padding-top="20"
              class="h-2"
            />
          </div>
          <div class="min-w-0 rounded-lg bg-slate-500/8 p-2">
            <div class="mb-1 flex items-center justify-between gap-2 text-[10px]">
              <span class="font-semibold text-foreground/80">丢包</span>
              <span class="truncate font-semibold tabular-nums">{{ miniLossDisplay }}</span>
            </div>
            <PingHistoryStrip
              :bars="miniLossBars"
              label="节点聚合丢包历史，鼠标悬浮查看具体时间与丢包率"
              :hover-padding-top="20"
              class="h-2"
            />
          </div>
        </div>

        <div
          v-if="!props.node.online"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-black/30 backdrop-blur-[2px]"
        >
          <div class="text-sm font-semibold text-destructive">
            离线
          </div>
          <div class="mt-1 text-[11px] text-muted-foreground">
            {{ offlineTime }}
          </div>
        </div>
      </div>

      <div v-else class="node-card-body relative flex flex-col" :class="nodeCardGapClass">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
              <NodeMetricLabel metric="cpu" />
              <span class="font-medium tabular-nums text-violet-700 dark:text-violet-300/90">{{ cpuPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="cpuPercentage" :status="cpuStatus" :height="5" />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
              <NodeMetricLabel metric="memory" />
              <span class="min-w-0 truncate text-right tabular-nums">
                <strong class="font-medium text-rose-700 dark:text-rose-300/90">{{ memPercentage.toFixed(1) }}%</strong>
                <span class="ml-1 text-muted-foreground">
                  {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
                </span>
              </span>
            </div>
            <ProgressThin :percentage="memPercentage" :status="memStatus" :height="5" />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
              <NodeMetricLabel metric="disk" />
              <span class="min-w-0 truncate text-right tabular-nums">
                <strong class="font-medium text-amber-700 dark:text-warning/90">{{ diskPercentage.toFixed(1) }}%</strong>
                <span class="ml-1 text-muted-foreground">
                  {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
                </span>
              </span>
            </div>
            <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="5" />
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
              <NodeMetricLabel metric="traffic" />
              <span class="min-w-0 truncate text-right tabular-nums">
                <strong class="font-medium text-sky-700 dark:text-sky-300/90">
                  {{ hasTrafficLimit(props.node) ? `${trafficPercentage.toFixed(1)}%` : '∞' }}
                </strong>
                <span class="ml-1 text-muted-foreground">
                  {{ trafficUsageText }}
                </span>
              </span>
            </div>
            <ProgressThin :percentage="trafficPercentage" :status="trafficStatus" :height="5" />
          </div>
        </div>

        <div v-if="selectedTasks.length || pingTasksLoading" class="node-card-section-divider flex min-w-0 flex-col gap-1.5 border-t pt-3">
          <div class="flex items-center justify-between px-1">
            <NodeMetricLabel metric="ping" />
            <div class="flex items-center gap-1 text-[11px] text-muted-foreground">
              <select
                v-model.number="appStore.homePingHours"
                class="h-7 cursor-pointer rounded-lg border border-white/10 bg-background/30 px-2 text-[10px] font-semibold text-foreground outline-none transition-colors hover:bg-background/55 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="首页延迟时间范围"
                title="选择首页延迟历史时间范围"
                @click.stop
                @keydown.stop
              >
                <option v-for="hours in HOME_PING_HOUR_OPTIONS" :key="hours" :value="hours">
                  {{ hours }}H
                </option>
              </select>
              <span>· {{ selectedTasks.length }}/3</span>
            </div>
          </div>
          <div class="grid px-1 text-[10px] font-medium text-muted-foreground" :class="pingGridClass">
            <span>任务</span>
            <span class="text-right">延迟</span>
            <span class="text-right">丢包</span>
          </div>
          <div v-if="pingTasksLoading && !selectedTasks.length" class="h-14 animate-pulse rounded-lg bg-slate-500/8" />
          <template v-else>
            <NodePingTaskRow
              v-for="task in selectedTasks"
              :key="task.id"
              :node-uuid="props.node.uuid"
              :task="task"
              :hours="appStore.homePingHours"
              :dense="appStore.nodeCardSize === 'compact'"
              :enabled="props.pingEnabled"
              @click="emit('pingClick')"
            />
          </template>
        </div>

        <div class="node-card-section-divider node-card-summary-grid grid grid-cols-2 gap-1.5 border-t pt-2.5">
          <div class="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-black/8 bg-black/[0.035] dark:border-white/9 dark:bg-white/[0.035]">
            <div class="flex items-center justify-center bg-slate-500/10 px-1 py-1.5 text-center text-[10px] font-semibold leading-3.5 text-foreground/80">
              <span>累计<br>流量</span>
            </div>
            <div class="flex min-w-0 flex-col justify-center gap-0.5 px-1.5 py-1.5 text-[10px] font-normal text-foreground/90 tabular-nums">
              <div class="flex min-w-0 items-center gap-1">
                <Icon icon="tabler:upload" width="11" height="11" class="shrink-0" />
                <span class="min-w-0 whitespace-nowrap">{{ formatBytes(props.node.net_total_up ?? 0) }}</span>
              </div>
              <div class="flex min-w-0 items-center gap-1">
                <Icon icon="tabler:download" width="11" height="11" class="shrink-0" />
                <span class="min-w-0 whitespace-nowrap">{{ formatBytes(props.node.net_total_down ?? 0) }}</span>
              </div>
            </div>
          </div>

          <div class="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-black/8 bg-black/[0.035] dark:border-white/9 dark:bg-white/[0.035]">
            <div class="flex items-center justify-center bg-slate-500/10 px-1 py-1.5 text-center text-[10px] font-semibold leading-3.5 text-foreground/80">
              <span>续费<br>信息</span>
            </div>
            <div class="flex min-w-0 flex-col justify-center gap-0.5 px-1.5 py-1.5 text-[10px] font-normal text-foreground/90 tabular-nums">
              <div class="whitespace-nowrap">
                {{ renewalPriceText }}
              </div>
              <div class="whitespace-nowrap">
                {{ remainingTimeText === '-' ? '-' : `剩余 ${remainingTimeText}` }}
              </div>
            </div>
          </div>
        </div>

        <div class="node-card-section-divider flex min-w-0 items-center justify-between gap-3 border-t pt-3 text-xs">
          <span class="flex min-w-0 items-center gap-2 tabular-nums">
            <span class="flex min-w-0 items-center gap-0.5 text-rose-700 dark:text-rose-300/90">
              <Icon icon="tabler:arrow-up" width="14" height="14" class="shrink-0" />
              <span class="truncate">{{ formatBytesPerSecond(props.node.net_out ?? 0) }}</span>
            </span>
            <span class="flex min-w-0 items-center gap-0.5 text-cyan-700 dark:text-cyan-300/90">
              <Icon icon="tabler:arrow-down" width="14" height="14" class="shrink-0" />
              <span class="truncate">{{ formatBytesPerSecond(props.node.net_in ?? 0) }}</span>
            </span>
          </span>
          <span class="flex shrink-0 items-center gap-1 text-muted-foreground tabular-nums">
            <Icon icon="tabler:clock-hour-4" width="14" height="14" />
            {{ uptimeText }}
          </span>
        </div>

        <div
          v-if="!props.node.online"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-black/30 backdrop-blur-[2px]"
        >
          <div class="text-sm font-semibold text-destructive">
            离线
          </div>
          <div class="mt-1 text-[11px] text-muted-foreground">
            {{ offlineTime }}
          </div>
        </div>
      </div>
    </template>
  </CardX>
</template>

<style scoped>
.node-card {
  container-type: inline-size;
}

@container (max-width: 250px) {
  .node-card-summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (min-width: 1800px) {
  .node-card-title {
    font-size: 1rem;
  }

  .node-card--mini .node-card-title {
    font-size: 0.9375rem;
  }

  .node-card-header-grid {
    grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    column-gap: 0.75rem;
  }

  .node-card-flag {
    width: 2.5rem;
    height: 2rem;
  }

  .node-card--compact .node-card-body {
    gap: 1rem;
  }

  .node-card--comfortable .node-card-body {
    gap: 1.25rem;
  }
}
</style>
