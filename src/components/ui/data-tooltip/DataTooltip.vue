<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, useSlots } from 'vue'
import { cn } from '@/lib/utils'

type DataTooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  /** 提示文本，留空且无 #content 插槽时不渲染气泡 */
  content?: string
  /** 气泡相对触发元素的方位 */
  placement?: DataTooltipPlacement
  /** 气泡宽度，number 视为 px；默认由内容撑起 */
  width?: number | string
  /** 气泡高度，number 视为 px；默认由内容撑起 */
  height?: number | string
  /** 包裹元素标签，默认 div */
  as?: string
  /** 包裹元素的附加类 */
  class?: HTMLAttributes['class']
  /** 气泡的附加类 */
  contentClass?: HTMLAttributes['class']
  /** 使用最近的祖先元素作为定位参照，例如节点卡片 */
  referenceSelector?: string
  /** 将气泡最大宽度限制在定位参照元素以内 */
  constrainToReference?: boolean
  /** 按定位参照元素宽度计算气泡宽度，例如 0.56 表示卡片宽度的 56% */
  referenceWidthRatio?: number
  /** 由内容自然撑开；referenceWidthRatio 此时作为最小宽度，最大不超过定位参照元素 */
  fitReferenceContent?: boolean
}

defineOptions({
  inheritAttrs: false,
})
const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  as: 'div',
})
const slots = useSlots()
const attrs = useAttrs()

const sizeStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width != null)
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  if (props.height != null)
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  return style
})

const root = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const open = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const referenceMaxWidth = ref<number | null>(null)
const referenceRatioWidth = ref<number | null>(null)
const effectivePlacement = ref<DataTooltipPlacement>(props.placement)
let positionFrame = 0
let resizeObserver: ResizeObserver | null = null

const hasTooltip = computed(() => Boolean(props.content || slots.content))
const tooltipTransform = computed(() => {
  if (effectivePlacement.value === 'bottom')
    return 'translate(-50%, 0)'
  if (effectivePlacement.value === 'left')
    return 'translate(-100%, -50%)'
  if (effectivePlacement.value === 'right')
    return 'translate(0, -50%)'
  return 'translate(-50%, -100%)'
})

const tooltipStyle = computed(() => ({
  ...sizeStyle.value,
  ...(props.fitReferenceContent
    ? {
        width: 'max-content',
        ...(referenceRatioWidth.value != null ? { minWidth: `${referenceRatioWidth.value}px` } : {}),
      }
    : referenceRatioWidth.value != null ? { width: `${referenceRatioWidth.value}px` } : {}),
  left: `${tooltipX.value}px`,
  top: `${tooltipY.value}px`,
  transform: tooltipTransform.value,
  ...(referenceMaxWidth.value != null ? { maxWidth: `${referenceMaxWidth.value}px` } : {}),
}))

function getReferenceElement(): HTMLElement | null {
  if (!root.value)
    return null
  if (!props.referenceSelector)
    return root.value
  return root.value.closest<HTMLElement>(props.referenceSelector) ?? root.value
}

function updateReferenceConstraint() {
  if (!props.constrainToReference && props.referenceWidthRatio == null && !props.fitReferenceContent) {
    referenceMaxWidth.value = null
    referenceRatioWidth.value = null
    return
  }

  const referenceRect = getReferenceElement()?.getBoundingClientRect()
  if (!referenceRect)
    return
  const edgeGap = 10
  const availableWidth = Math.max(0, Math.min(referenceRect.width, window.innerWidth - edgeGap * 2))
  referenceMaxWidth.value = props.constrainToReference ? availableWidth : null
  referenceRatioWidth.value = props.referenceWidthRatio == null
    ? null
    : Math.min(availableWidth, Math.max(0, referenceRect.width * props.referenceWidthRatio))
}

function updatePosition() {
  cancelAnimationFrame(positionFrame)
  positionFrame = requestAnimationFrame(() => {
    const triggerRect = root.value?.getBoundingClientRect()
    const referenceRect = getReferenceElement()?.getBoundingClientRect()
    if (!triggerRect || !referenceRect)
      return

    const tooltipRect = tooltip.value?.getBoundingClientRect()
    const tooltipWidth = tooltipRect?.width || 180
    const tooltipHeight = tooltipRect?.height || 36
    const edgeGap = 10
    const anchorGap = 8
    let placement = props.placement
    const topSpace = referenceRect.top - edgeGap - anchorGap
    const bottomSpace = window.innerHeight - referenceRect.bottom - edgeGap - anchorGap
    if (placement === 'top' && tooltipHeight > topSpace && bottomSpace > topSpace)
      placement = 'bottom'
    else if (placement === 'bottom' && tooltipHeight > bottomSpace && topSpace > bottomSpace)
      placement = 'top'
    effectivePlacement.value = placement

    let x = props.referenceSelector
      ? referenceRect.left + referenceRect.width / 2
      : triggerRect.left + triggerRect.width / 2
    let y = referenceRect.top - anchorGap

    if (placement === 'bottom') {
      y = referenceRect.bottom + anchorGap
    }
    else if (placement === 'left') {
      x = triggerRect.left - anchorGap
      y = triggerRect.top + triggerRect.height / 2
    }
    else if (placement === 'right') {
      x = triggerRect.right + anchorGap
      y = triggerRect.top + triggerRect.height / 2
    }

    if (placement === 'left') {
      x = Math.max(edgeGap + tooltipWidth, x)
    }
    else if (placement === 'right') {
      x = Math.min(window.innerWidth - edgeGap - tooltipWidth, x)
    }
    else {
      x = Math.max(edgeGap + tooltipWidth / 2, Math.min(window.innerWidth - edgeGap - tooltipWidth / 2, x))
    }

    if (placement === 'top') {
      y = Math.max(edgeGap + tooltipHeight, y)
    }
    else if (placement === 'bottom') {
      y = Math.min(window.innerHeight - edgeGap - tooltipHeight, y)
    }
    else {
      y = Math.max(edgeGap + tooltipHeight / 2, Math.min(window.innerHeight - edgeGap - tooltipHeight / 2, y))
    }

    tooltipX.value = x
    tooltipY.value = y
  })
}

function handleViewportChange() {
  updateReferenceConstraint()
  updatePosition()
}

function startPositionTracking() {
  stopPositionTracking()
  window.addEventListener('resize', handleViewportChange, { passive: true })
  document.addEventListener('scroll', handleViewportChange, { capture: true, passive: true })
  resizeObserver = new ResizeObserver(handleViewportChange)
  const reference = getReferenceElement()
  if (reference)
    resizeObserver.observe(reference)
  if (tooltip.value)
    resizeObserver.observe(tooltip.value)
}

function stopPositionTracking() {
  window.removeEventListener('resize', handleViewportChange)
  document.removeEventListener('scroll', handleViewportChange, true)
  resizeObserver?.disconnect()
  resizeObserver = null
}

function showTooltip(event: PointerEvent | MouseEvent | FocusEvent) {
  if (!hasTooltip.value)
    return
  if ('pointerType' in event && event.pointerType === 'touch')
    return
  updateReferenceConstraint()
  effectivePlacement.value = props.placement
  open.value = true
  void nextTick(() => {
    updatePosition()
    startPositionTracking()
  })
}

function hideTooltip() {
  open.value = false
  cancelAnimationFrame(positionFrame)
  stopPositionTracking()
}

onBeforeUnmount(() => {
  cancelAnimationFrame(positionFrame)
  stopPositionTracking()
})
</script>

<template>
  <component
    :is="as"
    ref="root"
    v-bind="attrs"
    data-slot="data-tooltip"
    :class="cn('group/data-tooltip relative inline-block', props.class)"
    @pointerenter="showTooltip"
    @pointerleave="hideTooltip"
    @focusin="showTooltip"
    @focusout="hideTooltip"
  >
    <slot />
  </component>

  <Teleport to="body">
    <span
      v-if="open && (content || $slots.content)"
      ref="tooltip"
      role="tooltip"
      :data-placement="effectivePlacement"
      :class="cn(
        'pointer-events-none fixed z-[340] w-max whitespace-normal break-words rounded-lg border border-white/10 bg-popover/96 px-2.5 py-2 text-left text-[11px] leading-4 text-popover-foreground shadow-xl backdrop-blur-xl',
        props.fitReferenceContent
          ? 'max-w-[calc(100vw-1.25rem)]'
          : 'max-w-[min(22rem,calc(100vw-1.25rem))]',
        props.contentClass,
      )"
      :style="tooltipStyle"
    >
      <slot name="content"><span class="whitespace-pre-line">{{ content }}</span></slot>
    </span>
  </Teleport>
</template>
