<script setup lang="ts">
import { computed } from 'vue'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { parseTags } from '@/utils/tagHelper'

const props = withDefaults(defineProps<{
  tags?: string
  nodeName?: string
  dense?: boolean
}>(), {
  tags: '',
  nodeName: '',
  dense: false,
})

const parsedTags = computed(() => parseTags(props.tags))
const triggerLabel = computed(() => {
  const prefix = props.nodeName ? `${props.nodeName} 的` : ''
  return `查看${prefix}自定义标签（${parsedTags.value.length} 个）`
})
</script>

<template>
  <DataTooltip
    v-if="parsedTags.length"
    placement="top"
    reference-selector=".node-card"
    constrain-to-reference
    as="span"
    class="inline-flex shrink-0"
    content-class="node-tag-tooltip !max-w-none !p-2"
  >
    <button
      type="button"
      data-node-tag-trigger
      class="node-tag-trigger inline-flex shrink-0 items-center justify-center rounded-md border border-selection/30 bg-selection/12 text-selection shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:border-selection/50 hover:bg-selection/20 hover:shadow-[0_0_0_3px_rgba(56,189,248,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-selection/45"
      :class="dense ? 'size-5' : 'size-[1.375rem]'"
      :aria-label="triggerLabel"
      @click.stop
      @keydown.stop
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.9"
        :class="dense ? 'size-3' : 'size-[0.8125rem]'"
        aria-hidden="true"
      >
        <path d="M3.75 6.6V4.75a1 1 0 0 1 1-1H6.6a2 2 0 0 1 1.41.59l9.9 9.9a2 2 0 0 1 0 2.82l-2.85 2.85a2 2 0 0 1-2.82 0l-9.9-9.9A2 2 0 0 1 1.75 8.6V6.75a1 1 0 0 1 1-1h1" />
        <circle cx="6.25" cy="7.25" r="1.15" />
        <path d="m12.15 9.15 5.76 5.76" opacity=".55" />
      </svg>
    </button>

    <template #content>
      <span class="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1.5" aria-label="节点自定义标签">
        <span class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-popover-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="size-3.5 text-selection" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.6V4.75a1 1 0 0 1 1-1H6.6a2 2 0 0 1 1.41.59l9.9 9.9a2 2 0 0 1 0 2.82l-2.85 2.85a2 2 0 0 1-2.82 0l-9.9-9.9A2 2 0 0 1 1.75 8.6V6.75a1 1 0 0 1 1-1h1" />
            <circle cx="6.25" cy="7.25" r="1.15" />
          </svg>
          <span>自定义标签</span>
          <span class="text-[10px] tabular-nums text-muted-foreground">{{ parsedTags.length }}</span>
        </span>
        <span class="h-4 w-px shrink-0 bg-border/65" aria-hidden="true" />
        <span
          v-for="tag in parsedTags"
          :key="`${tag.text}-${tag.color}`"
          data-node-tag-chip
          class="inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none"
          :style="{
            borderColor: `${tag.hex}55`,
            backgroundColor: `${tag.hex}16`,
            color: tag.hex,
          }"
        >
          <span class="size-1 shrink-0 rounded-full bg-current opacity-80" aria-hidden="true" />
          <span class="break-all">{{ tag.text }}</span>
        </span>
      </span>
    </template>
  </DataTooltip>
</template>
