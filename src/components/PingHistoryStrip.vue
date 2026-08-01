<script setup lang="ts">
import type { NodePingBar } from '@/composables/useNodePingDisplay'
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  bars: NodePingBar[]
  label: string
  hoverPaddingTop?: number
}>()

const activeTooltip = ref('')
const activeTooltipLines = computed(() => activeTooltip.value.split('\n'))
const tooltipX = ref(0)
const tooltipY = ref(0)
const root = ref<HTMLElement | null>(null)
let lastPointer: { clientX: number, clientY: number } | null = null
let restoreFrame = 0
function showBarTooltip(bar: NodePingBar, target: HTMLElement, clientX?: number) {
  const rect = target.getBoundingClientRect()
  if (!rect || rect.width <= 0)
    return

  activeTooltip.value = bar.tooltip
  const anchorX = clientX ?? (rect.left + rect.width / 2)
  tooltipX.value = Math.max(72, Math.min(window.innerWidth - 72, anchorX))
  tooltipY.value = rect.top - 8
}

function barAtPointer(clientX: number, clientY: number): { bar: NodePingBar, element: HTMLElement } | null {
  const rootElement = root.value
  if (!rootElement || props.bars.length === 0)
    return null

  const rect = rootElement.getBoundingClientRect()
  if (
    rect.width <= 0
    || clientX < rect.left
    || clientX > rect.right
    || clientY < rect.top - (props.hoverPaddingTop || 0)
    || clientY > rect.bottom
  ) {
    return null
  }

  const relativeX = Math.min(rect.width - Number.EPSILON, Math.max(0, clientX - rect.left))
  const index = Math.min(
    props.bars.length - 1,
    Math.floor(relativeX / rect.width * props.bars.length),
  )
  const element = rootElement.querySelector<HTMLElement>(`[data-ping-history-index="${index}"]`)
  const bar = props.bars[index]
  return element && bar ? { bar, element } : null
}

function handleRootPointer(event: MouseEvent | PointerEvent) {
  lastPointer = {
    clientX: event.clientX,
    clientY: event.clientY,
  }
  const match = barAtPointer(event.clientX, event.clientY)
  if (match)
    showBarTooltip(match.bar, match.element, event.clientX)
  else
    hideTooltip()
}

function hideTooltip() {
  activeTooltip.value = ''
}

function handlePointerLeave() {
  lastPointer = null
  hideTooltip()
}

function restoreTooltipAtPointer() {
  const point = lastPointer
  const rootElement = root.value
  if (!point || !rootElement)
    return

  const match = barAtPointer(point.clientX, point.clientY)
  if (!match) {
    hideTooltip()
    return
  }

  showBarTooltip(match.bar, match.element, point.clientX)
}

function scheduleTooltipRestore() {
  cancelAnimationFrame(restoreFrame)
  void nextTick(() => {
    restoreFrame = requestAnimationFrame(restoreTooltipAtPointer)
  })
}

watch(() => props.bars, scheduleTooltipRestore, { flush: 'post' })

onMounted(() => {
  document.addEventListener('pointerdown', hideTooltip, true)
  window.addEventListener('blur', hideTooltip)
  window.addEventListener('scroll', hideTooltip, true)
  window.addEventListener('resize', scheduleTooltipRestore)
})

onActivated(scheduleTooltipRestore)
onDeactivated(hideTooltip)

onBeforeUnmount(() => {
  cancelAnimationFrame(restoreFrame)
  document.removeEventListener('pointerdown', hideTooltip, true)
  window.removeEventListener('blur', hideTooltip)
  window.removeEventListener('scroll', hideTooltip, true)
  window.removeEventListener('resize', scheduleTooltipRestore)
})
</script>

<template>
  <div
    ref="root"
    v-bind="$attrs"
    class="ping-history-strip relative grid min-w-0 gap-px"
    :class="{ 'has-expanded-hit-area': (props.hoverPaddingTop || 0) > 0 }"
    :style="{
      'grid-template-columns': `repeat(${bars.length}, minmax(0, 1fr))`,
      '--ping-hover-top': `${props.hoverPaddingTop || 0}px`,
    }"
    role="img"
    :aria-label="label"
    @pointerenter="handleRootPointer"
    @pointermove="handleRootPointer"
    @pointerleave="handlePointerLeave"
    @mouseenter="handleRootPointer"
    @mousemove="handleRootPointer"
    @mouseleave="handlePointerLeave"
  >
    <span
      v-for="(bar, index) in bars"
      :key="bar.key"
      class="block h-full min-w-0 rounded-[1px] outline-none"
      :class="bar.className"
      :data-ping-history-index="index"
      :aria-label="bar.tooltip.replace('\n', '，')"
    />
  </div>

  <Teleport to="body">
    <div
      v-if="activeTooltip"
      role="tooltip"
      class="ping-history-tooltip pointer-events-none fixed z-[300] w-max max-w-40 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-popover/96 px-2 py-1.5 text-left text-[11px] font-medium leading-4 text-popover-foreground shadow-lg backdrop-blur-xl"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <div class="whitespace-nowrap text-popover-foreground/70 tabular-nums">
        {{ activeTooltipLines[0] }}
      </div>
      <div
        v-if="activeTooltipLines.length > 1"
        class="whitespace-nowrap text-popover-foreground/90 tabular-nums"
      >
        {{ activeTooltipLines.slice(1).join(' ') }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ping-history-strip {
  box-sizing: border-box;
  min-height: 12px;
  padding-block: 2px;
}

.ping-history-strip.has-expanded-hit-area::before {
  position: absolute;
  z-index: 1;
  top: calc(-1 * var(--ping-hover-top));
  right: -0.15rem;
  bottom: -0.2rem;
  left: -0.15rem;
  content: '';
}

.ping-history-strip > span {
  position: relative;
  z-index: 2;
}
</style>
