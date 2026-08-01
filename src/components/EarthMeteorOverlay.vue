<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { useElementSize, useRafFn } from '@vueuse/core'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import {
  EARTH_METEOR_BATCH_GAP_MS,
  EARTH_METEOR_COUNT,
  EARTH_METEOR_DASH_LENGTH,
  EARTH_METEOR_FLIGHT_MS,
  EARTH_METEOR_INTERVAL_MS,
  EARTH_METEOR_SVG_STROKE,
  getEarthMeteorColors,
  getEarthMeteorDelayMs,
  getEarthMeteorInitialGap,
} from '@/utils/earthMeteor'

export interface EarthMeteorScreenTarget {
  id: string
  x: number
  y: number
  visible: boolean
  depth?: number
}

export interface EarthMeteorOccluder {
  centerX: number
  centerY: number
  radius: number
}

interface EarthMeteorStroke {
  id: string
  targetId: string
  paletteIndex: number
  tailColor: string
  bodyColor: string
  headColor: string
  delayMs: number
  launchOrder: number
  direction: number
  angleSpan: number
  radiusScale: number
  curveScale: number
}

const props = defineProps<{
  active: boolean
  isDark: boolean
  reducedMotion: boolean
  getTargets: () => EarthMeteorScreenTarget[]
  getOccluder?: () => EarthMeteorOccluder | null
}>()

const rootRef = ref<HTMLDivElement>()
const { width, height } = useElementSize(rootRef)
const strokes = ref<EarthMeteorStroke[]>([])
const batchPhase = ref<'idle' | 'waiting' | 'flying' | 'cooldown'>('idle')
const batchTargetId = ref('')
const batchTargetVisible = ref(true)
const batchTargetDepth = ref<number | null>(null)
const batchTargetMissing = ref(false)
const occluder = ref<EarthMeteorOccluder | null>(null)
const occlusionMaskId = `earth-meteor-occlusion-${useId().replaceAll(':', '')}`
const completedStrokeCount = ref(0)
const strokeElements = new Map<string, SVGPathElement>()
const completedStrokeIds = new Set<string>()
let nextBatchTimerId = 0
let sequence = 0
let batchStartedAt = 0
let batchTarget: EarthMeteorScreenTarget | null = null
let waitingForTargets = false

function motionAllowed(): boolean {
  if (!props.active || props.reducedMotion || typeof window === 'undefined')
    return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function currentTargets(): EarthMeteorScreenTarget[] {
  const currentWidth = width.value || rootRef.value?.clientWidth || 0
  const currentHeight = height.value || rootRef.value?.clientHeight || 0
  return props.getTargets().filter(target =>
    target.visible
    && Number.isFinite(target.x)
    && Number.isFinite(target.y)
    && target.x >= 0
    && target.x <= currentWidth
    && target.y >= 0
    && target.y <= currentHeight,
  )
}

function projectedBatchTarget(): EarthMeteorScreenTarget | null {
  if (!batchTarget) {
    batchTargetMissing.value = false
    return null
  }

  const projected = props.getTargets().find(target => target.id === batchTarget?.id)
  if (
    projected
    && Number.isFinite(projected.x)
    && Number.isFinite(projected.y)
  ) {
    batchTarget = { ...projected }
    batchTargetMissing.value = false
    return batchTarget
  }

  // Node/region clusters can change after the page receives fresher metadata.
  // Never keep drawing towards the cached coordinates of a target that no
  // longer exists; that produces a convincing but incorrect "ghost landing".
  batchTargetMissing.value = true
  return null
}

interface EarthMeteorPath {
  d: string
  start: EarthMeteorPoint
  control1: EarthMeteorPoint
  control2: EarthMeteorPoint
  end: EarthMeteorPoint
}

interface EarthMeteorPoint {
  x: number
  y: number
}

interface EarthMeteorMotion {
  phase: 'waiting' | 'flying' | 'drilling' | 'landed'
  headProgress: number
  tailProgress: number
}

function buildPath(stroke: EarthMeteorStroke, target: EarthMeteorScreenTarget): EarthMeteorPath {
  const currentWidth = width.value || rootRef.value?.clientWidth || 320
  const currentHeight = height.value || rootRef.value?.clientHeight || currentWidth
  const size = Math.min(currentWidth, currentHeight)
  const centerX = currentWidth / 2
  const centerY = currentHeight / 2
  const targetRadius = Math.max(1, Math.hypot(target.x - centerX, target.y - centerY))
  const targetAngle = Math.atan2(target.y - centerY, target.x - centerX)
  const startAngle = targetAngle - stroke.direction * stroke.angleSpan
  const startRadius = Math.min(
    size * 0.49,
    Math.max(size * 0.44, targetRadius * stroke.radiusScale),
  )
  const startRadialX = Math.cos(startAngle)
  const startRadialY = Math.sin(startAngle)
  const targetRadialX = Math.cos(targetAngle)
  const targetRadialY = Math.sin(targetAngle)
  const startTangentX = -startRadialY * stroke.direction
  const startTangentY = startRadialX * stroke.direction
  const targetTangentX = -targetRadialY * stroke.direction
  const targetTangentY = targetRadialX * stroke.direction
  const controlDistance = (4 / 3) * Math.tan(stroke.angleSpan / 4)
    * Math.max(startRadius, targetRadius)
    * stroke.curveScale
  const startX = centerX + startRadialX * startRadius
  const startY = centerY + startRadialY * startRadius
  const control1X = startX + startTangentX * controlDistance
  const control1Y = startY + startTangentY * controlDistance
  const control2X = target.x - targetTangentX * controlDistance
  const control2Y = target.y - targetTangentY * controlDistance

  return {
    d: [
      `M ${startX.toFixed(1)} ${startY.toFixed(1)}`,
      `C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}`,
      `${control2X.toFixed(1)} ${control2Y.toFixed(1)}`,
      `${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
    ].join(' '),
    start: { x: startX, y: startY },
    control1: { x: control1X, y: control1Y },
    control2: { x: control2X, y: control2Y },
    end: { x: target.x, y: target.y },
  }
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function easeOutCubic(value: number): number {
  return 1 - (1 - clamp(value)) ** 3
}

function easeInOutCubic(value: number): number {
  const progress = clamp(value)
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2
}

function lerpPoint(start: EarthMeteorPoint, end: EarthMeteorPoint, progress: number): EarthMeteorPoint {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  }
}

function splitCubic(path: EarthMeteorPath, progress: number): [EarthMeteorPath, EarthMeteorPath] {
  const t = clamp(progress)
  const point01 = lerpPoint(path.start, path.control1, t)
  const point12 = lerpPoint(path.control1, path.control2, t)
  const point23 = lerpPoint(path.control2, path.end, t)
  const point012 = lerpPoint(point01, point12, t)
  const point123 = lerpPoint(point12, point23, t)
  const point = lerpPoint(point012, point123, t)

  return [
    {
      d: '',
      start: path.start,
      control1: point01,
      control2: point012,
      end: point,
    },
    {
      d: '',
      start: point,
      control1: point123,
      control2: point23,
      end: path.end,
    },
  ]
}

function cubicSubpath(path: EarthMeteorPath, startProgress: number, endProgress: number): EarthMeteorPath {
  const start = clamp(startProgress)
  const end = clamp(endProgress)
  if (end <= start + 0.0001) {
    const point = end >= 1 ? path.end : splitCubic(path, end)[0].end
    return {
      d: `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      start: point,
      control1: point,
      control2: point,
      end: point,
    }
  }

  const [leading] = splitCubic(path, end)
  const relativeStart = end > 0 ? start / end : 0
  const [, segment] = splitCubic(leading, relativeStart)
  segment.d = [
    `M ${segment.start.x.toFixed(2)} ${segment.start.y.toFixed(2)}`,
    `C ${segment.control1.x.toFixed(2)} ${segment.control1.y.toFixed(2)}`,
    `${segment.control2.x.toFixed(2)} ${segment.control2.y.toFixed(2)}`,
    `${segment.end.x.toFixed(2)} ${segment.end.y.toFixed(2)}`,
  ].join(' ')
  return segment
}

function meteorMotion(stroke: EarthMeteorStroke, timestamp: number): EarthMeteorMotion {
  const elapsed = timestamp - batchStartedAt - stroke.delayMs
  if (elapsed < 0) {
    return {
      phase: 'waiting',
      headProgress: 0,
      tailProgress: 0,
    }
  }

  const progress = clamp(elapsed / EARTH_METEOR_FLIGHT_MS)
  // The final 30% is reserved for the visible "drill into the server" phase.
  // The head stays pinned to the target while the tail follows it into the hole.
  const arrivalProgress = 0.7
  if (progress < arrivalProgress) {
    const headProgress = easeOutCubic(progress / arrivalProgress)
    return {
      phase: 'flying',
      headProgress,
      tailProgress: Math.max(0, headProgress - EARTH_METEOR_DASH_LENGTH),
    }
  }

  if (progress < 1) {
    const drillingProgress = easeInOutCubic(
      (progress - arrivalProgress) / (1 - arrivalProgress),
    )
    return {
      phase: 'drilling',
      headProgress: 1,
      tailProgress: 1 - EARTH_METEOR_DASH_LENGTH
        + EARTH_METEOR_DASH_LENGTH * drillingProgress,
    }
  }

  return {
    phase: 'landed',
    headProgress: 1,
    tailProgress: 1,
  }
}

function completeStroke(strokeId: string) {
  if (completedStrokeIds.has(strokeId) || batchPhase.value !== 'flying')
    return

  completedStrokeIds.add(strokeId)
  completedStrokeCount.value = completedStrokeIds.size
  if (completedStrokeIds.size < strokes.value.length)
    return

  batchPhase.value = 'cooldown'
  strokes.value = []
  batchTarget = null
  batchTargetId.value = ''
  scheduleNextBatch()
}

function applyPaths(timestamp = performance.now()) {
  const target = projectedBatchTarget()
  batchTargetVisible.value = target?.visible ?? false
  batchTargetDepth.value = Number.isFinite(target?.depth) ? target!.depth! : null
  const nextOccluder = props.getOccluder?.() ?? null
  if (
    nextOccluder
    && Number.isFinite(nextOccluder.centerX)
    && Number.isFinite(nextOccluder.centerY)
    && Number.isFinite(nextOccluder.radius)
    && nextOccluder.radius > 0
  ) {
    const current = occluder.value
    if (
      !current
      || Math.abs(current.centerX - nextOccluder.centerX) > 0.25
      || Math.abs(current.centerY - nextOccluder.centerY) > 0.25
      || Math.abs(current.radius - nextOccluder.radius) > 0.25
    ) {
      occluder.value = nextOccluder
    }
  }
  else if (occluder.value) {
    occluder.value = null
  }
  const landedStrokeIds: string[] = []
  for (const stroke of strokes.value) {
    const fullPath = target && target.id === stroke.targetId ? buildPath(stroke, target) : null
    const motion = meteorMotion(stroke, timestamp)
    const visiblePath = fullPath
      ? cubicSubpath(fullPath, motion.tailProgress, motion.headProgress)
      : null
    const visible = Boolean(
      visiblePath
      && motion.phase !== 'waiting'
      && motion.phase !== 'landed'
      && motion.headProgress > motion.tailProgress,
    )
    for (const layer of ['aura', 'main', 'core']) {
      const element = strokeElements.get(`${stroke.id}:${layer}`)
      if (!element)
        continue
      element.setAttribute('d', visiblePath?.d || 'M 0 0')
      element.style.visibility = visible ? 'visible' : 'hidden'
      element.dataset.motionPhase = motion.phase
      element.dataset.headProgress = motion.headProgress.toFixed(4)
      element.dataset.tailProgress = motion.tailProgress.toFixed(4)
      if (target && visiblePath) {
        element.dataset.fullPathD = fullPath?.d
        element.dataset.fullStartX = fullPath?.start.x.toFixed(2)
        element.dataset.fullStartY = fullPath?.start.y.toFixed(2)
        element.dataset.targetX = target.x.toFixed(1)
        element.dataset.targetY = target.y.toFixed(1)
        element.dataset.headX = visiblePath.end.x.toFixed(2)
        element.dataset.headY = visiblePath.end.y.toFixed(2)
        element.dataset.tailX = visiblePath.start.x.toFixed(2)
        element.dataset.tailY = visiblePath.start.y.toFixed(2)
      }
    }
    const gradient = rootRef.value?.querySelector<SVGLinearGradientElement>(
      `#${stroke.id}-gradient`,
    )
    if (visiblePath && gradient) {
      gradient.setAttribute('x1', visiblePath.start.x.toFixed(2))
      gradient.setAttribute('y1', visiblePath.start.y.toFixed(2))
      gradient.setAttribute('x2', visiblePath.end.x.toFixed(2))
      gradient.setAttribute('y2', visiblePath.end.y.toFixed(2))
    }
    if (motion.phase === 'landed')
      landedStrokeIds.push(stroke.id)
  }
  landedStrokeIds.forEach(completeStroke)
}

defineExpose({
  refresh: applyPaths,
})

function setStrokeRef(id: string, layer: string, element: Element | ComponentPublicInstance | null) {
  const key = `${id}:${layer}`
  if (element instanceof SVGPathElement) {
    strokeElements.set(key, element)
    applyPaths()
    return
  }
  strokeElements.delete(key)
}

function bindStrokeRef(id: string, layer: string) {
  return (element: Element | ComponentPublicInstance | null) => setStrokeRef(id, layer, element)
}

function shuffledLaunchOrders(): number[] {
  const orders = Array.from({ length: EARTH_METEOR_COUNT }, (_, index) => index)
  for (let index = orders.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = orders[index]!
    orders[index] = orders[swapIndex]!
    orders[swapIndex] = current
  }
  return orders
}

function routeOffsets(): number[] {
  const orientation = Math.random() > 0.5 ? 1 : -1
  const offsets = [
    orientation * (0.84 + Math.random() * 0.06),
    -orientation * (1.08 + Math.random() * 0.09),
    orientation * (1.48 + Math.random() * 0.06),
  ]
  return offsets.sort(() => Math.random() - 0.5)
}

function updateStrokeColors() {
  strokes.value = strokes.value.map((stroke) => {
    const colors = getEarthMeteorColors(props.isDark, stroke.paletteIndex)
    return {
      ...stroke,
      tailColor: colors.tail,
      bodyColor: colors.body,
      headColor: colors.head,
    }
  })
}

function clearNextBatchTimer() {
  if (nextBatchTimerId !== 0) {
    window.clearTimeout(nextBatchTimerId)
    nextBatchTimerId = 0
  }
}

function emitBatch(): boolean {
  clearNextBatchTimer()
  if (!motionAllowed()) {
    strokes.value = []
    batchPhase.value = 'idle'
    return false
  }

  const targets = currentTargets()
  if (targets.length === 0) {
    waitingForTargets = true
    batchPhase.value = 'waiting'
    return false
  }

  waitingForTargets = false
  completedStrokeIds.clear()
  completedStrokeCount.value = 0
  sequence += 1
  batchStartedAt = performance.now()
  batchTarget = { ...targets[Math.floor(Math.random() * targets.length)]! }
  batchTargetId.value = batchTarget.id
  batchTargetMissing.value = false
  batchTargetVisible.value = batchTarget.visible
  batchPhase.value = 'flying'
  const paletteOffset = Math.floor(Math.random() * EARTH_METEOR_COUNT)
  const launchOrders = shuffledLaunchOrders()
  const offsets = routeOffsets()
  strokes.value = Array.from({ length: EARTH_METEOR_COUNT }, (_, index) => {
    const paletteIndex = index + paletteOffset
    const colors = getEarthMeteorColors(props.isDark, paletteIndex)
    const angleOffset = offsets[index]!
    const launchOrder = launchOrders[index]!
    return {
      id: `earth-meteor-${sequence}-${index}`,
      targetId: batchTarget!.id,
      paletteIndex,
      tailColor: colors.tail,
      bodyColor: colors.body,
      headColor: colors.head,
      delayMs: getEarthMeteorDelayMs(getEarthMeteorInitialGap(launchOrder)),
      launchOrder,
      direction: angleOffset > 0 ? -1 : 1,
      angleSpan: Math.abs(angleOffset),
      radiusScale: 1.08 + Math.random() * 0.08,
      curveScale: 1.08 + Math.random() * 0.08,
    }
  })
  void nextTick(applyPaths)
  return true
}

function scheduleNextBatch() {
  clearNextBatchTimer()
  const elapsed = performance.now() - batchStartedAt
  const delay = Math.max(
    EARTH_METEOR_BATCH_GAP_MS,
    EARTH_METEOR_INTERVAL_MS - elapsed,
  )
  nextBatchTimerId = window.setTimeout(() => {
    nextBatchTimerId = 0
    emitBatch()
  }, delay)
}

function stopScheduler() {
  clearNextBatchTimer()
  waitingForTargets = false
  batchPhase.value = 'idle'
  completedStrokeIds.clear()
  completedStrokeCount.value = 0
  strokes.value = []
  batchTarget = null
  batchTargetId.value = ''
  batchTargetDepth.value = null
  batchTargetMissing.value = false
}

function startScheduler() {
  stopScheduler()
  if (!motionAllowed())
    return
  emitBatch()
}

const { pause: pauseRaf, resume: resumeRaf } = useRafFn(() => {
  if (!motionAllowed())
    return
  if (waitingForTargets && strokes.value.length === 0)
    emitBatch()
  applyPaths()
}, { immediate: false })

onMounted(() => {
  if (motionAllowed()) {
    resumeRaf()
    startScheduler()
  }
})

onBeforeUnmount(() => {
  stopScheduler()
  pauseRaf()
})

watch(
  () => [props.active, props.reducedMotion] as const,
  () => {
    if (motionAllowed()) {
      resumeRaf()
      startScheduler()
      return
    }
    stopScheduler()
    pauseRaf()
  },
)

watch(
  () => props.isDark,
  () => {
    updateStrokeColors()
  },
)

watch([width, height], () => {
  applyPaths()
})
</script>

<template>
  <div
    ref="rootRef"
    class="earth-meteor-overlay"
    data-meteor-renderer="shared-svg"
    :data-meteor-interval-ms="EARTH_METEOR_INTERVAL_MS"
    :data-meteor-flight-ms="EARTH_METEOR_FLIGHT_MS"
    :data-meteor-count="strokes.length || undefined"
    :data-meteor-sequence="sequence || undefined"
    :data-meteor-target-id="batchTargetId || undefined"
    :data-meteor-target-visible="batchTargetVisible"
    :data-meteor-target-depth="batchTargetDepth?.toFixed(4)"
    :data-meteor-target-missing="batchTargetMissing"
    :data-meteor-occluded="Boolean(occluder && !batchTargetVisible)"
    :data-meteor-phase="batchPhase"
    :data-meteor-completed-count="completedStrokeCount"
  >
    <svg
      class="earth-meteor-svg"
      :viewBox="`0 0 ${width || 320} ${height || width || 320}`"
      aria-hidden="true"
    >
      <defs>
        <mask
          v-if="occluder"
          :id="occlusionMaskId"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          :width="width || 320"
          :height="height || width || 320"
        >
          <rect
            x="0"
            y="0"
            :width="width || 320"
            :height="height || width || 320"
            fill="white"
          />
          <circle
            :cx="occluder.centerX"
            :cy="occluder.centerY"
            :r="Math.max(0, occluder.radius - 0.75)"
            fill="black"
          />
        </mask>
        <linearGradient
          v-for="stroke in strokes"
          :id="`${stroke.id}-gradient`"
          :key="`${stroke.id}-gradient`"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" :stop-color="stroke.tailColor" stop-opacity="0" />
          <stop offset="18%" :stop-color="stroke.bodyColor" stop-opacity="0.32" />
          <stop offset="55%" :stop-color="stroke.bodyColor" stop-opacity="0.88" />
          <stop offset="84%" :stop-color="stroke.headColor" stop-opacity="1" />
          <stop offset="100%" :stop-color="stroke.headColor" />
        </linearGradient>
      </defs>
      <g
        v-for="stroke in strokes"
        :key="stroke.id"
        class="earth-meteor-beam"
        :data-launch-order="stroke.launchOrder"
        :data-approach-direction="stroke.direction"
        :data-occluded="Boolean(occluder && !batchTargetVisible)"
        :mask="occluder && !batchTargetVisible ? `url(#${occlusionMaskId})` : undefined"
        :style="{
          '--meteor-color': stroke.headColor,
          '--meteor-width': String(EARTH_METEOR_SVG_STROKE),
          '--meteor-aura-width': String(EARTH_METEOR_SVG_STROKE * 2.35),
          '--meteor-core-width': String(EARTH_METEOR_SVG_STROKE * 0.42),
        }"
      >
        <path
          :ref="bindStrokeRef(stroke.id, 'aura')"
          :data-stroke-id="stroke.id"
          :data-target-id="stroke.targetId"
          d="M 0 0"
          pathLength="1"
          class="earth-meteor-layer earth-meteor-aura"
          :stroke="`url(#${stroke.id}-gradient)`"
        />
        <path
          :ref="bindStrokeRef(stroke.id, 'main')"
          :data-stroke-id="stroke.id"
          :data-target-id="stroke.targetId"
          d="M 0 0"
          pathLength="1"
          class="earth-meteor-layer earth-meteor-stroke"
          :stroke="`url(#${stroke.id}-gradient)`"
        />
        <path
          :ref="bindStrokeRef(stroke.id, 'core')"
          :data-stroke-id="stroke.id"
          :data-target-id="stroke.targetId"
          d="M 0 0"
          pathLength="1"
          class="earth-meteor-layer earth-meteor-core"
          :stroke="`url(#${stroke.id}-gradient)`"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.earth-meteor-overlay,
.earth-meteor-svg {
  position: absolute;
  z-index: 18;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.earth-meteor-layer {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 1;
  vector-effect: non-scaling-stroke;
}

.earth-meteor-aura {
  stroke-width: var(--meteor-aura-width);
  filter: blur(2.8px) drop-shadow(0 0 10px color-mix(in srgb, var(--meteor-color) 68%, transparent));
  opacity: 0.82;
}

.earth-meteor-stroke {
  stroke-width: var(--meteor-width);
  filter: drop-shadow(0 0 2.5px var(--meteor-color))
    drop-shadow(0 0 8px color-mix(in srgb, var(--meteor-color) 58%, transparent));
}

.earth-meteor-core {
  stroke-width: var(--meteor-core-width);
  filter: drop-shadow(0 0 3px var(--meteor-color));
}
</style>
