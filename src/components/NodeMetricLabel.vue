<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

type NodeMetric = 'cpu' | 'memory' | 'disk' | 'traffic' | 'ping'

const props = withDefaults(defineProps<{
  metric: NodeMetric
  compact?: boolean
  iconOnly?: boolean
}>(), {
  compact: false,
  iconOnly: false,
})

const metricMeta = computed(() => ({
  cpu: {
    icon: 'tabler:cpu',
    label: 'CPU',
    tone: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300',
  },
  memory: {
    icon: 'tabler:database',
    label: '内存',
    tone: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300',
  },
  disk: {
    icon: 'tabler:server-2',
    label: '硬盘',
    tone: 'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-300',
  },
  traffic: {
    icon: 'tabler:arrows-transfer-up-down',
    label: '流量',
    tone: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300',
  },
  ping: {
    icon: 'tabler:activity-heartbeat',
    label: 'TCPing',
    tone: 'bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:text-cyan-300',
  },
})[props.metric])
</script>

<template>
  <span
    class="inline-flex min-w-0 items-center font-semibold text-foreground/85"
    :class="compact ? 'gap-1' : 'gap-1.5'"
    :data-node-metric="metric"
  >
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-[5px] ring-1 ring-inset"
      :class="[metricMeta.tone, compact ? 'size-4' : 'size-[1.125rem]']"
      aria-hidden="true"
    >
      <Icon :icon="metricMeta.icon" :width="compact ? 11 : 13" :height="compact ? 11 : 13" />
    </span>
    <span v-if="!iconOnly">{{ metricMeta.label }}</span>
  </span>
</template>
