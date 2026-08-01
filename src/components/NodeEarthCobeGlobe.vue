<script setup lang="ts">
import type { COBEOptions, Globe, Marker } from 'cobe'
import type { ComponentPublicInstance } from 'vue'
import type { EarthMeteorOccluder, EarthMeteorScreenTarget } from '@/components/EarthMeteorOverlay.vue'
import type { NodeData } from '@/stores/nodes'
import {
  useDocumentVisibility,
  useElementSize,
  useElementVisibility,
  useRafFn,
} from '@vueuse/core'
import createGlobe from 'cobe'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EarthMeteorOverlay from '@/components/EarthMeteorOverlay.vue'
import { useNodeGeoClusters } from '@/composables/useNodeGeoClusters'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  nodes?: NodeData[]
}>()
const appStore = useAppStore()

const containerRef = ref<HTMLDivElement>()
const stageRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const meteorOverlayRef = ref<{ refresh: () => void }>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)

const documentVisibility = useDocumentVisibility()
const elementVisible = useElementVisibility(containerRef)
const shouldRender = computed(() => documentVisibility.value === 'visible' && elementVisible.value)
const shouldAutoRotate = computed(() => !appStore.stopEarth)

const COBE_BASE_RADIUS = 0.8
const COBE_MARKER_ELEVATION = 0.025
const COBE_VISUAL_SCALE = 1.18
const COBE_ORBIT_SAMPLES = 144
const FULL_CIRCLE = Math.PI * 2
let globe: Globe | null = null
const INITIAL_THETA = 0.22
const MIN_THETA = -0.65
const MAX_THETA = 0.65
const CHINA_COORD: [number, number] = [35.8617, 104.1954]
const DEFAULT_PHI = normalizePhi(-Math.PI / 2 - CHINA_COORD[1] * Math.PI / 180)
let phi = DEFAULT_PHI
let targetPhi = phi
let theta = INITIAL_THETA
let targetTheta = INITIAL_THETA
let isPointerDown = false
let lastPointerX = 0
let lastPointerY = 0
let staticRedrawUntil = 0
const labelElements = new Map<string, HTMLElement>()
const orbitTrackElements = new Map<string, SVGPathElement>()
const orbitPlanetElements = new Map<string, SVGGElement>()

type Vec3 = readonly [number, number, number]

interface CobeOrbit {
  id: 'a' | 'b' | 'c'
  normal: Vec3
  radius: number
  phase: number
  durationMs: number
  tone: 'cool' | 'warm'
  planetRadius: number
  crossRadius: number
  basisU: Vec3
  basisV: Vec3
}

function normalizeVector([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

function crossVector([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ]
}

function createOrbit(
  config: Omit<CobeOrbit, 'normal' | 'basisU' | 'basisV'> & { normal: Vec3 },
): CobeOrbit {
  const normal = normalizeVector(config.normal)
  const helper: Vec3 = Math.abs(normal[1]) > 0.82 ? [1, 0, 0] : [0, 1, 0]
  const basisU = normalizeVector(crossVector(normal, helper))
  const basisV = normalizeVector(crossVector(normal, basisU))
  return { ...config, normal, basisU, basisV }
}

const COBE_ORBITS = [
  createOrbit({
    id: 'a',
    normal: [0.2, 0.91, 0.36],
    radius: 0.842,
    phase: 0.36,
    durationMs: 10_800,
    tone: 'cool',
    planetRadius: 0.72,
    crossRadius: 2.4,
  }),
  createOrbit({
    id: 'b',
    normal: [-0.62, 0.38, 0.69],
    radius: 0.856,
    phase: 2.48,
    durationMs: 13_600,
    tone: 'warm',
    planetRadius: 0.62,
    crossRadius: 2.1,
  }),
  createOrbit({
    id: 'c',
    normal: [0.57, 0.49, -0.66],
    radius: 0.834,
    phase: 4.72,
    durationMs: 11_900,
    tone: 'cool',
    planetRadius: 0.54,
    crossRadius: 1.85,
  }),
] as const

let orbitStartedAt = 0

function normalizePhi(value: number): number {
  const circle = Math.PI * 2
  let next = value % circle
  if (next <= -Math.PI)
    next += circle
  if (next > Math.PI)
    next -= circle
  return next
}

function clampTheta(value: number): number {
  return Math.min(Math.max(value, MIN_THETA), MAX_THETA)
}

function rotateGlobePoint([x, y, z]: Vec3): Vec3 {
  const thetaCosine = Math.cos(theta)
  const thetaSine = Math.sin(theta)
  const phiCosine = Math.cos(phi)
  const phiSine = Math.sin(phi)
  return [
    phiCosine * x + phiSine * z,
    phiSine * thetaSine * x + thetaCosine * y - phiCosine * thetaSine * z,
    -phiSine * thetaCosine * x + thetaSine * y + phiCosine * thetaCosine * z,
  ]
}

function orbitPoint(orbit: CobeOrbit, angle: number): Vec3 {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return [
    orbit.radius * (orbit.basisU[0] * cosine + orbit.basisV[0] * sine),
    orbit.radius * (orbit.basisU[1] * cosine + orbit.basisV[1] * sine),
    orbit.radius * (orbit.basisU[2] * cosine + orbit.basisV[2] * sine),
  ]
}

function projectOrbitPoint(point: Vec3) {
  const [rotatedX, rotatedY, depth] = rotateGlobePoint(point)
  const width = containerWidth.value || 320
  const height = containerHeight.value || width
  const aspect = width / height
  return {
    x: (rotatedX / aspect * COBE_VISUAL_SCALE + 1) * 50,
    y: (-rotatedY * COBE_VISUAL_SCALE + 1) * 50,
    depth,
    visible: depth >= 0,
  }
}

function buildVisibleOrbitPath(orbit: CobeOrbit): { d: string, visibleRatio: number } {
  const commands: string[] = []
  let drawing = false
  let visibleSamples = 0

  for (let index = 0; index <= COBE_ORBIT_SAMPLES; index += 1) {
    const angle = index / COBE_ORBIT_SAMPLES * FULL_CIRCLE
    const projected = projectOrbitPoint(orbitPoint(orbit, angle))
    if (!projected.visible) {
      drawing = false
      continue
    }

    visibleSamples += 1
    commands.push(`${drawing ? 'L' : 'M'} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`)
    drawing = true
  }

  return {
    d: commands.join(' '),
    visibleRatio: visibleSamples / (COBE_ORBIT_SAMPLES + 1),
  }
}

function applyOrbitStyles(now = typeof performance === 'undefined' ? Date.now() : performance.now()) {
  if (!orbitStartedAt)
    orbitStartedAt = now

  for (const orbit of COBE_ORBITS) {
    const track = orbitTrackElements.get(orbit.id)
    if (track) {
      const path = buildVisibleOrbitPath(orbit)
      track.setAttribute('d', path.d)
      track.dataset.visibleRatio = path.visibleRatio.toFixed(3)
    }

    const planet = orbitPlanetElements.get(orbit.id)
    if (!planet)
      continue

    const elapsed = appStore.disablePageAnimation ? 0 : Math.max(0, now - orbitStartedAt)
    const angle = orbit.phase + elapsed / orbit.durationMs * FULL_CIRCLE
    const projected = projectOrbitPoint(orbitPoint(orbit, angle))
    const horizonFade = Math.min(Math.max(projected.depth / 0.12, 0), 1)
    planet.setAttribute('transform', `translate(${projected.x.toFixed(2)} ${projected.y.toFixed(2)})`)
    planet.style.opacity = projected.visible ? horizonFade.toFixed(3) : '0'
    planet.style.visibility = projected.visible ? 'visible' : 'hidden'
    planet.dataset.orbitDepth = projected.depth.toFixed(4)
    planet.dataset.orbitVisible = projected.visible ? 'true' : 'false'
  }
}

function resetStoppedView() {
  phi = DEFAULT_PHI
  targetPhi = DEFAULT_PHI
  theta = INITIAL_THETA
  targetTheta = INITIAL_THETA
}

function triggerStaticRedrawWindow(duration = 1500) {
  if (typeof performance === 'undefined') {
    staticRedrawUntil = Date.now() + duration
    return
  }
  staticRedrawUntil = performance.now() + duration
}

function shouldKeepStaticRedraw(): boolean {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now()
  return now < staticRedrawUntil
}

const {
  regionClusters,
  totalServers,
  onlineServers,
  offlineServers,
  clusterKey,
} = useNodeGeoClusters({ nodes: () => props.nodes })

function markerId(code: string): string {
  return `cdn-${code.toLowerCase()}`
}

const AMBIENT_LIGHTS = [
  { location: [37.77, -122.42], colorIndex: 0 },
  { location: [40.71, -74], colorIndex: 1 },
  { location: [34.05, -118.24], colorIndex: 4 },
  { location: [47.61, -122.33], colorIndex: 5 },
  { location: [41.88, -87.63], colorIndex: 2 },
  { location: [25.76, -80.19], colorIndex: 3 },
  { location: [51.51, -0.13], colorIndex: 0 },
  { location: [48.86, 2.35], colorIndex: 3 },
  { location: [52.52, 13.41], colorIndex: 1 },
  { location: [59.33, 18.07], colorIndex: 5 },
  { location: [41.9, 12.5], colorIndex: 2 },
  { location: [40.42, -3.7], colorIndex: 4 },
  { location: [25.2, 55.27], colorIndex: 2 },
  { location: [1.35, 103.82], colorIndex: 1 },
  { location: [35.68, 139.69], colorIndex: 4 },
  { location: [22.32, 114.17], colorIndex: 2 },
  { location: [37.57, 126.98], colorIndex: 0 },
  { location: [31.23, 121.47], colorIndex: 5 },
  { location: [19.08, 72.88], colorIndex: 3 },
  { location: [13.76, 100.5], colorIndex: 1 },
  { location: [-33.87, 151.21], colorIndex: 0 },
  { location: [-37.81, 144.96], colorIndex: 5 },
  { location: [-36.85, 174.76], colorIndex: 2 },
  { location: [-23.55, -46.63], colorIndex: 1 },
  { location: [-34.6, -58.38], colorIndex: 4 },
  { location: [-33.45, -70.67], colorIndex: 3 },
  { location: [4.71, -74.07], colorIndex: 0 },
  { location: [19.43, -99.13], colorIndex: 2 },
  { location: [43.65, -79.38], colorIndex: 3 },
  { location: [-1.29, 36.82], colorIndex: 5 },
  { location: [-26.2, 28.05], colorIndex: 2 },
  { location: [30.04, 31.24], colorIndex: 4 },
] satisfies Array<{ location: [number, number], colorIndex: number }>

const AMBIENT_LIGHT_PALETTES = {
  dark: [
    [0.30, 0.82, 1],
    [0.23, 0.92, 0.88],
    [1, 0.77, 0.34],
    [0.65, 0.58, 1],
    [1, 0.52, 0.69],
    [0.88, 0.97, 1],
  ],
  light: [
    [0.04, 0.50, 0.82],
    [0.02, 0.66, 0.66],
    [0.93, 0.54, 0.13],
    [0.42, 0.35, 0.78],
    [0.86, 0.30, 0.46],
    [0.22, 0.60, 0.78],
  ],
} satisfies Record<'dark' | 'light', Array<[number, number, number]>>

const STARBURSTS = [
  { x: 12, y: 55, size: 0.76, delay: -0.4, tone: 'ice' },
  { x: 22, y: 84, size: 1.08, delay: -2.1, tone: 'white' },
  { x: 42, y: 8, size: 0.62, delay: -1.2, tone: 'ice' },
  { x: 73, y: 10, size: 1.18, delay: -3.2, tone: 'white' },
  { x: 88, y: 31, size: 0.9, delay: -0.8, tone: 'ice' },
  { x: 91, y: 68, size: 1.12, delay: -2.6, tone: 'white' },
  { x: 63, y: 93, size: 0.72, delay: -1.7, tone: 'ice' },
] as const

const STAR_SPECKS = Array.from({ length: 28 }, (_, index) => ({
  x: 8 + ((index * 29) % 86),
  y: 7 + ((index * 43) % 84),
  size: 1 + (index % 3) * 0.55,
  delay: -((index % 9) * 0.37),
}))

const markers = computed<Marker[]>(() => {
  const palette = AMBIENT_LIGHT_PALETTES[appStore.isDark ? 'dark' : 'light']
  const ambientMarkers: Marker[] = AMBIENT_LIGHTS.map((light, index) => ({
    id: `ambient-${index}`,
    location: light.location,
    size: index % 5 === 0 ? 0.0125 : index % 3 === 0 ? 0.0095 : 0.007,
    color: palette[light.colorIndex]!,
  }))
  const nodeMarkers: Marker[] = regionClusters.value.map(cluster => ({
    id: markerId(cluster.id),
    location: cluster.coord,
    size: cluster.onlineServers > 0 ? 0.034 : 0.024,
    color: cluster.onlineServers > 0
      ? (appStore.isDark ? [0.20, 0.62, 0.78] : [0.04, 0.43, 0.7])
      : (appStore.isDark ? [0.86, 0.38, 0.42] : [0.78, 0.31, 0.35]),
  }))
  return [...ambientMarkers, ...nodeMarkers]
})

function projectCoord(coord: [number, number]): { x: number, y: number, visible: boolean, depth: number } {
  const [lat, lng] = coord
  const latitude = lat * Math.PI / 180
  const longitude = lng * Math.PI / 180 - Math.PI
  const latitudeCosine = Math.cos(latitude)
  const markerRadius = COBE_BASE_RADIUS + COBE_MARKER_ELEVATION
  const marker = [
    -latitudeCosine * Math.cos(longitude) * markerRadius,
    Math.sin(latitude) * markerRadius,
    latitudeCosine * Math.sin(longitude) * markerRadius,
  ] as const
  const width = containerWidth.value || 320
  const height = containerHeight.value || width
  const aspect = width / height
  const [rotatedX, rotatedY, rotatedZ] = rotateGlobePoint(marker)
  return {
    x: ((rotatedX / aspect * COBE_VISUAL_SCALE + 1) / 2) * width,
    y: ((-rotatedY * COBE_VISUAL_SCALE + 1) / 2) * height,
    visible: rotatedZ >= 0 || rotatedX * rotatedX + rotatedY * rotatedY >= COBE_BASE_RADIUS ** 2,
    depth: rotatedZ,
  }
}

function getClusterStyle(coord: [number, number]): { transform: string, opacity: string, filter: string } {
  const projected = projectCoord(coord)

  return {
    transform: `translate3d(${projected.x.toFixed(1)}px, ${projected.y.toFixed(1)}px, 0) translate(-50%, -50%)`,
    opacity: projected.visible ? '1' : '0',
    filter: projected.visible ? 'blur(0)' : 'blur(12px)',
  }
}

function applyLabelStyles() {
  for (const cluster of regionClusters.value) {
    const element = labelElements.get(cluster.id)
    if (!element)
      continue
    const style = getClusterStyle(cluster.coord)
    element.style.transform = style.transform
    element.style.opacity = style.opacity
    element.style.filter = style.filter
    const projected = projectCoord(cluster.coord)
    element.dataset.projectedX = projected.x.toFixed(1)
    element.dataset.projectedY = projected.y.toFixed(1)
    element.dataset.projectedDepth = projected.depth.toFixed(4)
    element.dataset.projectedVisible = String(projected.depth >= 0)
  }
}

function applyOverlayStyles() {
  applyLabelStyles()
  applyOrbitStyles()
  meteorOverlayRef.value?.refresh()
}

function getMeteorTargets(): EarthMeteorScreenTarget[] {
  return regionClusters.value.map((cluster) => {
    const projected = projectCoord(cluster.coord)
    return {
      id: cluster.id,
      x: projected.x,
      y: projected.y,
      // Flags are allowed to remain visible slightly past the limb because they
      // sit above the surface. Meteors must use the actual hemisphere depth,
      // otherwise a beam can keep aiming at that raised flag after its surface
      // target has already rotated behind the globe.
      visible: projected.depth >= 0,
      depth: projected.depth,
    }
  })
}

function getMeteorOccluder(): EarthMeteorOccluder {
  const width = containerWidth.value || stageRef.value?.clientWidth || 320
  const height = containerHeight.value || stageRef.value?.clientHeight || width
  return {
    centerX: width / 2,
    centerY: height / 2,
    radius: Math.min(width, height) * COBE_BASE_RADIUS * COBE_VISUAL_SCALE / 2,
  }
}

function setLabelRef(id: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    labelElements.set(id, element)
    const cluster = regionClusters.value.find(item => item.id === id)
    if (cluster) {
      const style = getClusterStyle(cluster.coord)
      element.style.transform = style.transform
      element.style.opacity = style.opacity
      element.style.filter = style.filter
      const projected = projectCoord(cluster.coord)
      element.dataset.projectedX = projected.x.toFixed(1)
      element.dataset.projectedY = projected.y.toFixed(1)
    }
    return
  }

  labelElements.delete(id)
}

function bindLabelRef(id: string) {
  return (element: Element | ComponentPublicInstance | null) => setLabelRef(id, element)
}

function bindOrbitTrackRef(id: string) {
  return (element: Element | ComponentPublicInstance | null) => {
    if (element instanceof SVGPathElement) {
      orbitTrackElements.set(id, element)
      const orbit = COBE_ORBITS.find(item => item.id === id)
      if (orbit) {
        const path = buildVisibleOrbitPath(orbit)
        element.setAttribute('d', path.d)
        element.dataset.visibleRatio = path.visibleRatio.toFixed(3)
      }
      return
    }
    orbitTrackElements.delete(id)
  }
}

function bindOrbitPlanetRef(id: string) {
  return (element: Element | ComponentPublicInstance | null) => {
    if (element instanceof SVGGElement) {
      orbitPlanetElements.set(id, element)
      applyOrbitStyles()
      return
    }
    orbitPlanetElements.delete(id)
  }
}

const cobeLabels = computed(() => regionClusters.value.map(cluster => ({
  id: cluster.id,
  code: cluster.code,
})))

const themeColors = computed(() => {
  if (appStore.isDark) {
    return {
      dark: 0.94,
      diffuse: 1.12,
      mapBrightness: 6.4,
      mapBaseBrightness: 0.024,
      baseColor: [0.012, 0.075, 0.16] as [number, number, number],
      markerColor: [0.20, 0.82, 1] as [number, number, number],
      glowColor: [0.04, 0.48, 0.82] as [number, number, number],
    }
  }
  return {
    dark: 0.96,
    diffuse: 1.32,
    mapBrightness: 5.4,
    mapBaseBrightness: 0.048,
    baseColor: [0.62, 0.84, 0.94] as [number, number, number],
    markerColor: [0.10, 0.57, 0.84] as [number, number, number],
    glowColor: [0.54, 0.90, 1] as [number, number, number],
  }
})

function getThemeOptions(): Partial<COBEOptions> {
  const colors = themeColors.value
  return {
    dark: colors.dark,
    diffuse: colors.diffuse,
    mapBrightness: colors.mapBrightness,
    mapBaseBrightness: colors.mapBaseBrightness,
    baseColor: colors.baseColor,
    markerColor: colors.markerColor,
    glowColor: colors.glowColor,
    markers: markers.value,
  }
}

function getRenderSize() {
  const width = containerWidth.value || canvasRef.value?.clientWidth || 320
  const height = containerHeight.value || canvasRef.value?.clientHeight || width
  return { width, height }
}

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined')
    return 1

  return Math.min(window.devicePixelRatio || 1, 2)
}

function buildInitialOptions(): COBEOptions {
  const colors = themeColors.value
  const { width, height } = getRenderSize()
  return {
    devicePixelRatio: getDevicePixelRatio(),
    width,
    height,
    phi,
    theta,
    dark: colors.dark,
    diffuse: colors.diffuse,
    mapSamples: 22000,
    mapBrightness: colors.mapBrightness,
    mapBaseBrightness: colors.mapBaseBrightness,
    baseColor: colors.baseColor,
    markerColor: colors.markerColor,
    glowColor: colors.glowColor,
    markers: markers.value,
    markerElevation: 0.025,
    arcs: [],
    scale: COBE_VISUAL_SCALE,
  }
}

function updateGlobeFrame() {
  if (!globe)
    return
  const { width, height } = getRenderSize()
  globe.update({ phi, theta, width, height })
}

function applyThemeToGlobe() {
  if (!globe)
    return

  globe.update(getThemeOptions())
  stageRef.value?.setAttribute('data-cobe-theme', appStore.isDark ? 'dark' : 'light')
  triggerStaticRedrawWindow(1000)
  requestAnimationFrame(() => {
    updateGlobeFrame()
    applyOverlayStyles()
  })
}

const ORIENTATION_IDLE_EPSILON = 1e-5
const { pause: pauseRaf, resume: resumeRaf } = useRafFn(
  () => {
    if (!globe)
      return
    const now = typeof performance === 'undefined' ? Date.now() : performance.now()
    const prevPhi = phi
    const prevTheta = theta
    if (!isPointerDown && shouldAutoRotate.value)
      targetPhi += 0.0010
    phi += (targetPhi - phi) * 1
    theta += (targetTheta - theta) * 1
    const orientationIdle = (
      Math.abs(phi - prevPhi) < ORIENTATION_IDLE_EPSILON
      && Math.abs(theta - prevTheta) < ORIENTATION_IDLE_EPSILON
    )
    if (orientationIdle) {
      if (!shouldAutoRotate.value && shouldKeepStaticRedraw()) {
        updateGlobeFrame()
        applyLabelStyles()
      }
    }
    else {
      updateGlobeFrame()
      applyLabelStyles()
    }
    applyOrbitStyles(now)
  },
  { immediate: false },
)

function startGlobe() {
  if (!canvasRef.value)
    return
  if (appStore.stopEarth) {
    resetStoppedView()
    triggerStaticRedrawWindow()
  }
  orbitStartedAt = typeof performance === 'undefined' ? Date.now() : performance.now()
  globe = createGlobe(canvasRef.value, buildInitialOptions())
  requestAnimationFrame(() => {
    updateGlobeFrame()
    applyOverlayStyles()
  })
  if (documentVisibility.value === 'visible')
    resumeRaf()
}

function releaseCanvasContext(canvas: HTMLCanvasElement | undefined) {
  const context = canvas?.getContext('webgl2') || canvas?.getContext('webgl')
  context?.getExtension('WEBGL_lose_context')?.loseContext()
}

onMounted(() => {
  startGlobe()
})

onBeforeUnmount(() => {
  pauseRaf()
  const canvas = canvasRef.value
  globe?.destroy()
  releaseCanvasContext(canvas)
  globe = null
  orbitTrackElements.clear()
  orbitPlanetElements.clear()
})

watch(() => appStore.isDark, async () => {
  await nextTick()
  applyThemeToGlobe()
})

watch(
  [containerWidth, containerHeight],
  ([width, height]) => {
    if (!globe || width <= 0 || height <= 0)
      return
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow(600)
    updateGlobeFrame()
    applyOverlayStyles()
  },
)

watch(
  () => appStore.stopEarth,
  (stopped) => {
    if (stopped)
      resetStoppedView()
    triggerStaticRedrawWindow()
    updateGlobeFrame()
    applyOverlayStyles()
  },
)

watch(
  () => regionClusters.value.map(clusterKey).join(','),
  () => {
    if (!globe)
      return
    globe.update({ markers: markers.value, arcs: [] })
    applyOverlayStyles()
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow(600)
  },
)

watch(shouldRender, (visible) => {
  if (!globe)
    return
  if (visible) {
    if (!shouldAutoRotate.value)
      triggerStaticRedrawWindow()
    resumeRaf()
  }
  else {
    pauseRaf()
  }
})

function onPointerDown(e: PointerEvent) {
  isPointerDown = true
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  const target = e.currentTarget as HTMLElement
  try {
    target.setPointerCapture(e.pointerId)
  }
  catch {
    // Synthetic accessibility/test events and older WebViews can expose the
    // API without an active native pointer. Rotation still works without
    // capture because move/up are bound to the same stage.
  }
}

function applyManualRotation(deltaX: number, deltaY: number) {
  targetPhi += deltaX / 200
  targetTheta = clampTheta(targetTheta + deltaY / 300)
  // Keep labels, meteor targets, orbit occlusion and the WebGL globe on the
  // same frame even when automatic rotation is stopped or the RAF loop has
  // been throttled by the browser.
  phi = targetPhi
  theta = targetTheta
  stageRef.value?.setAttribute('data-cobe-phi', phi.toFixed(4))
  stageRef.value?.setAttribute('data-cobe-theta', theta.toFixed(4))
  updateGlobeFrame()
  applyOverlayStyles()
  triggerStaticRedrawWindow(320)
}

function onPointerMove(e: PointerEvent) {
  if (!isPointerDown)
    return
  const deltaX = e.clientX - lastPointerX
  const deltaY = e.clientY - lastPointerY
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  applyManualRotation(deltaX, deltaY)
}

function onKeyDown(e: KeyboardEvent) {
  const keyDelta = 48
  if (e.key === 'ArrowLeft')
    applyManualRotation(-keyDelta, 0)
  else if (e.key === 'ArrowRight')
    applyManualRotation(keyDelta, 0)
  else if (e.key === 'ArrowUp')
    applyManualRotation(0, -keyDelta)
  else if (e.key === 'ArrowDown')
    applyManualRotation(0, keyDelta)
  else
    return

  e.preventDefault()
}

function onPointerUp(e: PointerEvent) {
  isPointerDown = false
  const target = e.currentTarget as HTMLElement
  if (target.hasPointerCapture(e.pointerId))
    target.releasePointerCapture(e.pointerId)
}
</script>

<template>
  <div ref="containerRef" class="cobe-earth-shell relative aspect-square w-full max-w-[var(--earth-max-size,30rem)] mx-auto translate-y-1 md:translate-y-0">
    <div
      ref="stageRef"
      class="cobe-globe-stage absolute inset-0"
      data-visual-scale="1.18"
      data-cobe-palette="orbital-ice"
      data-cobe-visual="orbital-grid"
      :data-ambient-light-count="AMBIENT_LIGHTS.length"
      :data-cobe-theme="appStore.isDark ? 'dark' : 'light'"
      tabindex="0"
      aria-label="可旋转节点地球，可拖动或使用方向键查看"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeyDown"
    >
      <div class="cobe-atmosphere" aria-hidden="true" />

      <div class="cobe-starfield" aria-hidden="true">
        <i
          v-for="(star, index) in STAR_SPECKS"
          :key="index"
          :style="{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
          }"
        />
      </div>

      <canvas
        ref="canvasRef"
        class="earth-globe-canvas absolute inset-0 w-full h-full select-none touch-none cursor-grab active:cursor-grabbing"
      />

      <div class="cobe-light-wash" aria-hidden="true" />

      <svg class="cobe-grid-layer" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <clipPath id="cobe-grid-clip">
            <circle cx="50" cy="50" r="47.2" />
          </clipPath>
          <linearGradient id="cobe-grid-stroke" x1="8" y1="12" x2="90" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" />
            <stop offset="52%" />
            <stop offset="100%" />
          </linearGradient>
        </defs>
        <g clip-path="url(#cobe-grid-clip)" class="cobe-grid-sphere">
          <ellipse class="cobe-grid-line" cx="50" cy="50" rx="12" ry="47.2" />
          <ellipse class="cobe-grid-line" cx="50" cy="50" rx="25" ry="47.2" />
          <ellipse class="cobe-grid-line" cx="50" cy="50" rx="37" ry="47.2" />
          <ellipse class="cobe-grid-line" cx="50" cy="50" rx="47.2" ry="47.2" />
          <path class="cobe-grid-line" d="M 4 34 C 24 26 76 26 96 34" />
          <path class="cobe-grid-line" d="M 2.8 43 C 24 38 76 38 97.2 43" />
          <path class="cobe-grid-line cobe-grid-equator" d="M 2.8 50 C 24 48.5 76 48.5 97.2 50" />
          <path class="cobe-grid-line" d="M 2.8 57 C 24 62 76 62 97.2 57" />
          <path class="cobe-grid-line" d="M 4 66 C 24 74 76 74 96 66" />
        </g>
      </svg>

      <svg
        class="cobe-orbit-layer"
        viewBox="0 0 100 100"
        aria-hidden="true"
        data-orbit-space="globe"
        data-orbit-occlusion="front-hemisphere"
      >
        <defs>
          <linearGradient id="cobe-orbit-cool" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" />
            <stop offset="48%" />
            <stop offset="100%" />
          </linearGradient>
          <linearGradient id="cobe-orbit-warm" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" />
            <stop offset="54%" />
            <stop offset="100%" />
          </linearGradient>
        </defs>
        <path
          v-for="orbit in COBE_ORBITS"
          :key="`track-${orbit.id}`"
          :ref="bindOrbitTrackRef(orbit.id)"
          :class="`cobe-orbit-track cobe-orbit-track-${orbit.id}`"
          :data-orbit-id="orbit.id"
        />
        <g
          v-for="orbit in COBE_ORBITS"
          :key="`planet-${orbit.id}`"
          :ref="bindOrbitPlanetRef(orbit.id)"
          :class="`cobe-orbit-spark cobe-orbit-particle-${orbit.tone}`"
          :data-orbit-id="orbit.id"
        >
          <circle class="cobe-orbit-particle" :r="orbit.planetRadius" />
          <line
            class="cobe-orbit-spark-cross"
            :x1="-orbit.crossRadius"
            y1="0"
            :x2="orbit.crossRadius"
            y2="0"
          />
          <line
            class="cobe-orbit-spark-cross"
            x1="0"
            :y1="-orbit.crossRadius"
            x2="0"
            :y2="orbit.crossRadius"
          />
        </g>
      </svg>

      <div class="cobe-starbursts" aria-hidden="true">
        <i
          v-for="star in STARBURSTS"
          :key="`${star.x}-${star.y}`"
          :class="`is-${star.tone}`"
          :style="{
            left: `${star.x}%`,
            top: `${star.y}%`,
            transform: `translate(-50%, -50%) scale(${star.size})`,
            animationDelay: `${star.delay}s`,
          }"
        />
      </div>

      <EarthMeteorOverlay
        ref="meteorOverlayRef"
        :active="shouldRender"
        :is-dark="appStore.isDark"
        :reduced-motion="appStore.disablePageAnimation"
        :get-targets="getMeteorTargets"
        :get-occluder="getMeteorOccluder"
      />

      <div
        v-for="label in cobeLabels"
        :key="label.id"
        :ref="bindLabelRef(label.id)"
        :data-cluster-id="label.id"
        class="absolute left-0 top-0 z-3 rounded-[0.18rem] transition-[opacity,filter] duration-300"
      >
        <img
          :src="`/images/flags/${label.code}.svg`" :alt="label.code"
          class="cobe-flag block size-5 rounded-[0.18rem]"
        >
      </div>
    </div>

    <div
      v-if="totalServers > 0"
      class="earth-status-badge absolute left-0 top-0 flex items-center gap-2.5 rounded-lg bg-background/85 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-md ring-1 ring-border/60 pointer-events-none"
    >
      <div v-if="onlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-2 rounded-full bg-green-600 animate-pulse" />
        <span class="text-green-600">{{ onlineServers }}</span>
      </div>
      <div v-if="offlineServers > 0" class="flex items-center gap-1">
        <span class="inline-block size-2 rounded-full bg-yellow-600 animate-pulse" />
        <span class="text-yellow-600">{{ offlineServers }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.earth-globe-canvas {
  contain: layout paint;
  z-index: 2;
  background: transparent;
  filter: saturate(0.9) contrast(1.04) brightness(1.08) drop-shadow(0 12px 28px rgb(14 116 144 / 0.14));
  transition: filter 360ms ease;
}

.cobe-earth-shell {
  isolation: isolate;
}

.cobe-globe-stage {
  transform: none;
  transform-origin: center top;
  transition: transform 420ms ease;
}

.cobe-atmosphere {
  position: absolute;
  z-index: 1;
  inset: 2.8%;
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 50%,
    rgb(255 255 255 / 0.22) 0%,
    rgb(186 230 253 / 0.16) 58%,
    rgb(125 211 252 / 0.22) 76%,
    rgb(56 189 248 / 0.38) 88%,
    rgb(224 242 254 / 0.72) 96%,
    rgb(125 211 252 / 0.3) 100%
  );
  box-shadow:
    0 0 15px rgb(125 211 252 / 0.32),
    0 0 34px rgb(56 189 248 / 0.2),
    0 0 70px rgb(14 165 233 / 0.1);
  filter: blur(3.5px);
  pointer-events: none;
  transition:
    background 360ms ease,
    box-shadow 360ms ease,
    opacity 360ms ease;
}

.cobe-light-wash {
  position: absolute;
  z-index: 2;
  inset: 8%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 26% 69%, rgb(251 191 36 / 0.12), transparent 23%),
    radial-gradient(circle at 73% 28%, rgb(34 211 238 / 0.2), transparent 27%),
    radial-gradient(circle at 72% 72%, rgb(59 130 246 / 0.15), transparent 32%),
    radial-gradient(circle at 38% 28%, rgb(167 139 250 / 0.12), transparent 25%);
  mix-blend-mode: soft-light;
  opacity: 0.54;
  pointer-events: none;
  transition: opacity 360ms ease;
}

.cobe-grid-layer,
.cobe-orbit-layer,
.cobe-starbursts,
.cobe-starfield {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.cobe-grid-layer {
  z-index: 3;
  overflow: visible;
  opacity: 0.7;
  mix-blend-mode: screen;
}

.cobe-grid-stroke stop:first-child,
#cobe-grid-stroke stop:first-child {
  stop-color: rgb(186 230 253 / 0.18);
}

#cobe-grid-stroke stop:nth-child(2) {
  stop-color: rgb(103 232 249 / 0.56);
}

#cobe-grid-stroke stop:last-child {
  stop-color: rgb(125 211 252 / 0.16);
}

.cobe-grid-line {
  fill: none;
  stroke: url('#cobe-grid-stroke');
  stroke-width: 0.17;
  stroke-dasharray: 0.45 0.9;
  vector-effect: non-scaling-stroke;
}

.cobe-grid-equator {
  stroke-width: 0.22;
  stroke-dasharray: 0.65 0.7;
}

.cobe-orbit-layer {
  z-index: 3;
  overflow: visible;
  filter: drop-shadow(0 0 3px rgb(56 189 248 / 0.28));
}

#cobe-orbit-cool stop:first-child,
#cobe-orbit-cool stop:last-child {
  stop-color: rgb(103 232 249 / 0.04);
}

#cobe-orbit-cool stop:nth-child(2) {
  stop-color: rgb(125 211 252 / 0.86);
}

#cobe-orbit-warm stop:first-child,
#cobe-orbit-warm stop:last-child {
  stop-color: rgb(251 191 36 / 0.03);
}

#cobe-orbit-warm stop:nth-child(2) {
  stop-color: rgb(251 191 36 / 0.66);
}

.cobe-orbit-track {
  fill: none;
  stroke-width: 0.3;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.cobe-orbit-track-a,
.cobe-orbit-track-c {
  stroke: url('#cobe-orbit-cool');
}

.cobe-orbit-track-b {
  stroke: url('#cobe-orbit-warm');
  stroke-dasharray: 1.6 1.1;
}

.cobe-orbit-track-c {
  stroke-dasharray: 0.7 1.35;
  opacity: 0.72;
}

.cobe-orbit-spark {
  color: rgb(103 232 249);
  pointer-events: none;
  transition: opacity 90ms linear;
  will-change: opacity;
}

.cobe-orbit-particle {
  fill: currentColor;
  stroke: rgb(255 255 255 / 0.82);
  stroke-width: 0.18;
}

.cobe-orbit-spark-cross {
  fill: none;
  stroke: currentColor;
  stroke-width: 0.16;
  stroke-linecap: round;
  opacity: 0.92;
  vector-effect: non-scaling-stroke;
}

.cobe-orbit-particle-cool {
  filter: drop-shadow(0 0 2px rgb(34 211 238)) drop-shadow(0 0 5px rgb(14 165 233 / 0.8));
}

.cobe-orbit-particle-warm {
  color: rgb(253 224 71);
  filter: drop-shadow(0 0 2px rgb(251 191 36)) drop-shadow(0 0 5px rgb(249 115 22 / 0.62));
}

.cobe-starfield {
  z-index: 3;
  overflow: hidden;
  clip-path: circle(48.6% at 50% 50%);
}

.cobe-starfield i {
  position: absolute;
  display: block;
  border-radius: 999px;
  background: rgb(224 242 254 / 0.7);
  box-shadow: 0 0 4px rgb(125 211 252 / 0.66);
  animation: cobe-speck-twinkle 3.3s ease-in-out infinite;
}

.cobe-starbursts {
  z-index: 5;
  overflow: visible;
}

.cobe-starbursts i {
  position: absolute;
  width: 1.12rem;
  height: 1.12rem;
  color: rgb(186 230 253);
  filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 10px rgb(56 189 248 / 0.82));
  animation: cobe-starburst-twinkle 3.8s ease-in-out infinite;
}

.cobe-starbursts i::before,
.cobe-starbursts i::after {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 100%;
  height: 1px;
  content: '';
  background: linear-gradient(90deg, transparent, currentColor 43%, white 50%, currentColor 57%, transparent);
  transform: translate(-50%, -50%);
}

.cobe-starbursts i::after {
  transform: translate(-50%, -50%) rotate(90deg) scaleX(0.72);
}

.cobe-starbursts i.is-white {
  color: rgb(248 250 252);
}

@keyframes cobe-speck-twinkle {
  0%,
  100% {
    opacity: 0.18;
    transform: scale(0.72);
  }

  48% {
    opacity: 0.82;
    transform: scale(1);
  }
}

@keyframes cobe-starburst-twinkle {
  0%,
  100% {
    opacity: 0.38;
  }

  45% {
    opacity: 1;
  }
}

.cobe-flag {
  filter: drop-shadow(0 0 1px rgb(15 23 42 / 0.88)) drop-shadow(0 7px 8px rgb(15 23 42 / 0.4));
}

:global(.dark .earth-globe-canvas) {
  filter: saturate(1.08) contrast(1.06) brightness(0.98) drop-shadow(0 14px 30px rgb(8 47 73 / 0.22));
}

:global(.dark .cobe-atmosphere) {
  background: radial-gradient(
    circle at 50% 50%,
    rgb(2 6 23 / 0.38) 0%,
    rgb(8 47 73 / 0.32) 58%,
    rgb(7 89 133 / 0.3) 76%,
    rgb(8 145 178 / 0.38) 88%,
    rgb(103 232 249 / 0.46) 96%,
    rgb(34 211 238 / 0.18) 100%
  );
  box-shadow:
    0 0 16px rgb(8 145 178 / 0.32),
    0 0 38px rgb(34 211 238 / 0.18),
    0 0 76px rgb(14 116 144 / 0.12);
}

:global(.dark .cobe-light-wash) {
  mix-blend-mode: screen;
  opacity: 0.26;
}

:global(:not(.dark) .cobe-grid-layer) {
  opacity: 0.44;
  mix-blend-mode: multiply;
}

:global(:not(.dark) #cobe-grid-stroke stop:first-child) {
  stop-color: rgb(14 116 144 / 0.13);
}

:global(:not(.dark) #cobe-grid-stroke stop:nth-child(2)) {
  stop-color: rgb(2 132 199 / 0.34);
}

:global(:not(.dark) #cobe-grid-stroke stop:last-child) {
  stop-color: rgb(14 116 144 / 0.1);
}

:global(:not(.dark) .cobe-starfield i) {
  background: rgb(255 255 255 / 0.9);
  box-shadow: 0 0 4px rgb(14 165 233 / 0.48);
}

:global(:not(.dark) .cobe-orbit-layer) {
  filter: drop-shadow(0 0 3px rgb(14 165 233 / 0.18));
}

:global(:not(.dark) .cobe-starbursts i) {
  color: rgb(255 255 255);
  filter: drop-shadow(0 0 3px rgb(255 255 255)) drop-shadow(0 0 9px rgb(14 165 233 / 0.58));
}

@media (prefers-reduced-motion: reduce) {
  .cobe-orbit-spark,
  .cobe-starfield i,
  .cobe-starbursts i {
    display: none;
  }
}
</style>
