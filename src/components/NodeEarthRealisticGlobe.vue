<script setup lang="ts">
import type { GlobeInstance } from 'globe.gl'
import type { AmbientLight, DirectionalLight, HemisphereLight, MeshPhongMaterial, Texture } from 'three'
import type { EarthMeteorOccluder, EarthMeteorScreenTarget } from '@/components/EarthMeteorOverlay.vue'
import type { NodeData } from '@/stores/nodes'
import {
  useDocumentVisibility,
  useElementSize,
  useElementVisibility,
} from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EarthMeteorOverlay from '@/components/EarthMeteorOverlay.vue'
import { useNodeGeoClusters } from '@/composables/useNodeGeoClusters'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  nodes?: NodeData[]
}>()

const EARTH_DAY_TEXTURE = '/images/earth/earth-blue-marble.jpg'
const EARTH_NIGHT_TEXTURE = '/images/earth/earth-night.jpg'
const EARTH_BUMP_MAP = '/images/earth/earth-topology.png'
const EARTH_SPECULAR_MAP = '/images/earth/earth-water.png'
const CHINA_COORD: [number, number] = [35.8617, 104.1954]
const GLOBE_ALTITUDE = 1.58

const appStore = useAppStore()

const containerRef = ref<HTMLDivElement>()
const globeHostRef = ref<HTMLDivElement>()
const { width: containerWidth, height: containerHeight } = useElementSize(containerRef)

const documentVisibility = useDocumentVisibility()
const elementVisible = useElementVisibility(containerRef)
const shouldRender = computed(() => documentVisibility.value === 'visible' && elementVisible.value)

let globe: GlobeInstance | null = null
let globeMaterial: MeshPhongMaterial | null = null
let waterSpecularMap: Texture | null = null
let ambientLight: AmbientLight | null = null
let hemisphereLight: HemisphereLight | null = null
let keyLight: DirectionalLight | null = null
let fillLight: DirectionalLight | null = null
let rimLight: DirectionalLight | null = null
let loadingGlobe = false
let destroyed = false
let globeReady = false
const labelElements = new Map<string, HTMLElement>()

interface GlobePoint {
  id: string
  lat: number
  lng: number
  code: string
  servers: number
  onlineServers: number
}

interface GlobeLabel {
  id: string
  lat: number
  lng: number
  code: string
}

const {
  regionClusters,
  totalServers,
  onlineServers,
  offlineServers,
  clusterKey,
} = useNodeGeoClusters({ nodes: () => props.nodes })

const pointsData = computed<GlobePoint[]>(() => regionClusters.value.map(cluster => ({
  id: cluster.id,
  lat: cluster.coord[0],
  lng: cluster.coord[1],
  code: cluster.code,
  servers: cluster.servers,
  onlineServers: cluster.onlineServers,
})))

const labelsData = computed<GlobeLabel[]>(() => regionClusters.value.map(cluster => ({
  id: cluster.id,
  lat: cluster.coord[0],
  lng: cluster.coord[1],
  code: cluster.code,
})))

function earthTextureUrl() {
  return appStore.isDark ? EARTH_NIGHT_TEXTURE : EARTH_DAY_TEXTURE
}

function pointColor(point: object): string {
  const data = point as GlobePoint
  if (data.onlineServers > 0)
    return appStore.isDark ? 'rgba(34, 211, 238, 1)' : 'rgba(2, 132, 199, 0.98)'
  return appStore.isDark ? 'rgba(250, 204, 21, 0.92)' : 'rgba(202, 138, 4, 0.88)'
}

function createLabelElement(data: object): HTMLElement {
  const label = data as GlobeLabel
  const root = document.createElement('div')
  root.className = 'earth-label'
  root.dataset.clusterId = label.id
  labelElements.set(label.id, root)

  const flag = document.createElement('img')
  flag.className = 'earth-label-flag'
  flag.src = `/images/flags/${label.code}.svg`
  flag.alt = label.code
  root.appendChild(flag)

  return root
}

function getMeteorTargets(): EarthMeteorScreenTarget[] {
  if (!globe || !globeReady)
    return []

  return regionClusters.value.map((cluster) => {
    const projected = globe!.getScreenCoords(cluster.coord[0], cluster.coord[1], 0.012)
    const label = labelElements.get(cluster.id)
    return {
      id: cluster.id,
      x: projected.x,
      y: projected.y,
      visible: label ? label.style.opacity !== '0' : true,
    }
  })
}

function getRenderSize() {
  const width = containerWidth.value || globeHostRef.value?.clientWidth || 320
  const height = containerHeight.value || globeHostRef.value?.clientHeight || width
  return { width, height }
}

function getMeteorOccluder(): EarthMeteorOccluder {
  const { width, height } = getRenderSize()
  return {
    centerX: width / 2,
    centerY: height / 2,
    radius: Math.min(width, height) * 0.48,
  }
}

function resizeGlobe() {
  if (!globe)
    return
  const { width, height } = getRenderSize()
  globe.width(width).height(height)
}

function isContainerInViewport(): boolean {
  if (!containerRef.value || typeof window === 'undefined')
    return true
  const rect = containerRef.value.getBoundingClientRect()
  return rect.bottom > 0
    && rect.right > 0
    && rect.top < window.innerHeight
    && rect.left < window.innerWidth
}

function resetPointOfView(transitionMs = 0) {
  globe?.pointOfView({ lat: CHINA_COORD[0], lng: CHINA_COORD[1], altitude: GLOBE_ALTITUDE }, transitionMs)
}

function applyControls() {
  if (!globe)
    return
  const controls = globe.controls()
  controls.autoRotate = shouldRender.value && !appStore.stopEarth
  controls.autoRotateSpeed = 1.6
  controls.enableDamping = true
  controls.enableZoom = false
  controls.enablePan = false
  controls.rotateSpeed = 0.55
}

function applyMaterialStyle() {
  if (!globe || !globeMaterial)
    return
  const dark = appStore.isDark
  globe.globeImageUrl(earthTextureUrl())
  globeMaterial.bumpScale = dark ? 0.018 : 0.026
  globeMaterial.shininess = dark ? 7 : 9
  globeMaterial.emissive.set(dark ? 0x213744 : 0x35586C)
  globeMaterial.emissiveIntensity = dark ? 0.12 : 0.22
  globeMaterial.specular.set(dark ? 0x2B4253 : 0x6F8CA3)
  globeMaterial.needsUpdate = true
  if (ambientLight) {
    ambientLight.color.set(dark ? 0xBBD7E8 : 0xE8F3FF)
    ambientLight.intensity = dark ? 1.78 : 1.46
  }
  if (hemisphereLight) {
    hemisphereLight.color.set(dark ? 0x8CC7EA : 0xEAF6FF)
    hemisphereLight.groundColor.set(dark ? 0x0B1A25 : 0x466A7F)
    hemisphereLight.intensity = dark ? 1.08 : 1.12
  }
  if (keyLight) {
    keyLight.color.set(dark ? 0xD6E9F7 : 0xFFF7ED)
    keyLight.intensity = dark ? 1.5 : 1.62
  }
  if (fillLight) {
    fillLight.color.set(dark ? 0x8FB5CC : 0xBFDBFE)
    fillLight.intensity = dark ? 0.9 : 1.04
  }
  if (rimLight) {
    rimLight.color.set(dark ? 0x22D3EE : 0x67E8F9)
    rimLight.intensity = dark ? 0.42 : 0.14
  }
  globe.renderer().toneMappingExposure = dark ? 1.34 : 1.28
  globeHostRef.value?.setAttribute('data-earth-phase', dark ? 'night' : 'day')
  globe
    .pointColor(pointColor)
    .ringColor(() => dark ? 'rgba(45, 212, 191, 0.34)' : 'rgba(14, 165, 233, 0.28)')
    .atmosphereColor(dark ? '#0ea5e9' : '#93c5fd')
    .atmosphereAltitude(dark ? 0.065 : 0.045)
}

function syncDataToGlobe() {
  if (!globe)
    return
  globe
    .pointsData(pointsData.value)
    .ringsData(pointsData.value)
    .htmlElementsData(labelsData.value)
}

async function startGlobe() {
  if (globe || loadingGlobe || !globeHostRef.value)
    return

  loadingGlobe = true
  await nextTick()

  try {
    const [{ default: Globe }, THREE] = await Promise.all([
      import('globe.gl'),
      import('three'),
    ])

    if (destroyed || !globeHostRef.value)
      return

    const { width, height } = getRenderSize()
    globe = new Globe(globeHostRef.value, {
      rendererConfig: {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      },
    })
      .width(width)
      .height(height)
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl(earthTextureUrl())
      .bumpImageUrl(EARTH_BUMP_MAP)
      .showAtmosphere(true)
      .pointsData(pointsData.value)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.008)
      .pointRadius((point: object) => ((point as GlobePoint).onlineServers > 0 ? 0.22 : 0.13))
      .pointColor(pointColor)
      .pointsMerge(false)
      .pointsTransitionDuration(260)
      .ringsData(pointsData.value)
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(() => appStore.isDark ? 'rgba(45, 212, 191, 0.34)' : 'rgba(14, 165, 233, 0.28)')
      .ringMaxRadius(1.4)
      .ringPropagationSpeed(0.8)
      .ringRepeatPeriod(2400)
      .htmlElementsData(labelsData.value)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(0.012)
      .htmlElement(createLabelElement)
      .htmlElementVisibilityModifier((el: HTMLElement, isVisible: boolean) => {
        el.style.opacity = isVisible ? '1' : '0'
        el.style.filter = isVisible ? 'blur(0)' : 'blur(14px)'
      })
      .htmlTransitionDuration(260)
      .onGlobeReady(() => {
        globeReady = true
        globeHostRef.value?.setAttribute('data-render-ready', 'true')
        resizeGlobe()
        applyControls()
        if (documentVisibility.value === 'visible' && isContainerInViewport()) {
          globe?.resumeAnimation()
        }
        else {
          globe?.pauseAnimation()
        }
      })

    const renderer = globe.renderer()
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = appStore.isDark ? 1.34 : 1.08
    renderer.domElement.style.background = 'transparent'

    const material = globe.globeMaterial()
    if ('shininess' in material) {
      globeMaterial = material as MeshPhongMaterial
      waterSpecularMap = new THREE.TextureLoader().load(EARTH_SPECULAR_MAP, () => {
        if (!globeMaterial)
          return
        if (waterSpecularMap)
          waterSpecularMap.colorSpace = THREE.NoColorSpace
        globeMaterial.specularMap = waterSpecularMap
        globeMaterial.needsUpdate = true
      })
      globeMaterial.specular = new THREE.Color(appStore.isDark ? 0x657C91 : 0x5B7185)
    }

    ambientLight = new THREE.AmbientLight(0xE8F3FF, 1.08)
    hemisphereLight = new THREE.HemisphereLight(
      0xEAF6FF,
      0x284657,
      0.86,
    )
    keyLight = new THREE.DirectionalLight(0xFFF7ED, 1.34)
    keyLight.position.set(1.5, 1.05, 1.85)
    fillLight = new THREE.DirectionalLight(0xBFDBFE, 0.62)
    fillLight.position.set(-1.25, 0.15, 1.05)
    rimLight = new THREE.DirectionalLight(0x67E8F9, 0.14)
    rimLight.position.set(-1.1, 0.55, -1.55)
    globe.lights([ambientLight, hemisphereLight, keyLight, fillLight, rimLight])

    applyMaterialStyle()
    applyControls()
    resetPointOfView(0)
  }
  finally {
    loadingGlobe = false
  }
}

function stopGlobe() {
  if (!globe)
    return

  const renderer = globe.renderer()
  globe.pauseAnimation()
  globe._destructor()
  // three-render-objects only disposes renderer resources. Explicitly release
  // the browser context as well so repeated renderer/theme switches do not
  // leave enough retired WebGL contexts around to affect the next globe.
  renderer.forceContextLoss()
  globe = null
  globeReady = false
  globeHostRef.value?.removeAttribute('data-render-ready')
  globeHostRef.value?.removeAttribute('data-earth-phase')
  globeMaterial = null
  ambientLight = null
  hemisphereLight = null
  keyLight = null
  fillLight = null
  rimLight = null
  waterSpecularMap?.dispose()
  waterSpecularMap = null
  labelElements.clear()
  if (globeHostRef.value)
    globeHostRef.value.replaceChildren()
}

onMounted(() => {
  void startGlobe()
})

onBeforeUnmount(() => {
  destroyed = true
  stopGlobe()
})

watch([containerWidth, containerHeight], ([width, height]) => {
  if (width <= 0 || height <= 0)
    return
  resizeGlobe()
})

watch(() => regionClusters.value.map(clusterKey).join(','), () => {
  syncDataToGlobe()
})

watch(() => appStore.isDark, () => {
  applyMaterialStyle()
})

watch(() => appStore.stopEarth, (stopped) => {
  applyControls()
  if (stopped)
    resetPointOfView(300)
})

watch(shouldRender, (visible) => {
  if (!globe || !globeReady)
    return
  if (visible) {
    globe.resumeAnimation()
    applyControls()
    resizeGlobe()
    return
  }
  globe.pauseAnimation()
  applyControls()
})
</script>

<template>
  <div ref="containerRef" class="realistic-earth-shell relative z-0 aspect-square w-full max-w-[var(--earth-max-size,30rem)] mx-auto translate-y-1 md:translate-y-0 overflow-visible pointer-events-none">
    <div
      ref="globeHostRef"
      class="earth-globe-host absolute inset-0 z-10 w-full h-full select-none touch-auto pointer-events-auto cursor-grab active:cursor-grabbing"
    />

    <EarthMeteorOverlay
      :active="shouldRender"
      :is-dark="appStore.isDark"
      :reduced-motion="appStore.disablePageAnimation"
      :get-targets="getMeteorTargets"
      :get-occluder="getMeteorOccluder"
    />

    <div
      v-if="totalServers > 0"
      class="earth-status-badge absolute left-0 top-0 z-20 flex items-center gap-2.5 rounded-lg bg-background/72 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-md ring-1 ring-border/45 backdrop-blur-xl pointer-events-none"
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
.earth-globe-host {
  contain: layout paint;
  background: transparent;
  transform: none;
  transform-origin: center top;
  transition: transform 420ms ease;
}

.realistic-earth-shell::before {
  position: absolute;
  z-index: 1;
  top: 43%;
  left: 50%;
  width: 82%;
  height: 82%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(56 189 248 / 0.12) 0%,
    rgb(37 99 235 / 0.095) 43%,
    rgb(99 102 241 / 0.05) 61%,
    transparent 78%
  );
  content: '';
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(1.18);
  transition: opacity 420ms ease;
}

.earth-globe-host :deep(canvas) {
  background: transparent !important;
  filter: saturate(1.02) contrast(0.88) brightness(1.32);
  outline: none;
}

:global(.dark .earth-globe-host canvas) {
  filter: saturate(1.08) contrast(1.025) brightness(1.27) drop-shadow(0 0 10px rgb(56 189 248 / 0.12))
    drop-shadow(0 0 28px rgb(59 130 246 / 0.1)) drop-shadow(0 0 58px rgb(99 102 241 / 0.065));
}

:global(.dark .realistic-earth-shell::before) {
  opacity: 1;
}

.earth-globe-host :deep(.scene-container) {
  background: transparent !important;
}

.earth-globe-host :deep(.earth-label) {
  pointer-events: none;
  position: relative;
  transform: translate(-50%, -118%);
  transition:
    opacity 500ms ease,
    filter 500ms ease;
  will-change: opacity, filter;
}

.earth-globe-host :deep(.earth-label-flag) {
  position: relative;
  z-index: 2;
  width: 1.4rem;
  height: 1.4rem;
  display: block;
  border-radius: 0.24rem;
  filter: drop-shadow(0 0 1px rgb(15 23 42 / 0.92)) drop-shadow(0 6px 8px rgb(15 23 42 / 0.46));
  object-fit: cover;
}

@media (min-width: 1440px) and (max-height: 1100px) {
  .realistic-earth-shell::before {
    top: 50%;
    width: 88%;
    height: 88%;
  }
}

@media (min-width: 1440px) and (min-height: 1101px) {
  .realistic-earth-shell::before {
    top: 50%;
    width: 88%;
    height: 88%;
  }
}
</style>
