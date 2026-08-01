<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed, ref, useAttrs } from 'vue'
import worldCountriesRaw from '@/assets/world-countries-110m.geojson?raw'
import { useNodeGeoClusters } from '@/composables/useNodeGeoClusters'
import { useAppStore } from '@/stores/app'

defineOptions({
  inheritAttrs: false,
})
const props = defineProps<{
  nodes?: NodeData[]
}>()
const attrs = useAttrs()
const appStore = useAppStore()

const MAP_WIDTH = 1440
const MAP_HEIGHT = 680
const MAP_PADDING_X = 6
const MAP_PADDING_Y = 14
const VISIBLE_NORTH_LAT = 84
const VISIBLE_SOUTH_LAT = -58

type Position = [number, number]

interface CountryFeature {
  properties: {
    name: string
    iso2: string
    continent: string
    mapColor: number
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: Position[][] | Position[][][]
  }
}

interface MapPoint {
  x: number
  y: number
}

interface MapBox {
  left: number
  right: number
  top: number
  bottom: number
}

interface MapSegment {
  start: MapPoint
  end: MapPoint
}

interface ClusterMarker {
  id: string
  code: string
  label: string
  index: number
  servers: number
  onlineServers: number
  offlineServers: number
  nodes: Array<{
    uuid: string
    name: string
    online: boolean
  }>
  x: number
  y: number
  flagX: number
  flagY: number
  connectorX: number
  connectorY: number
  statusClass: string
}

interface CountryLabel {
  name: string
  coord: [number, number]
}

const worldCountries = JSON.parse(worldCountriesRaw) as {
  features: CountryFeature[]
}

const countryLabels: CountryLabel[] = [
  { name: 'CANADA', coord: [58, -108] },
  { name: 'U.S.A.', coord: [38, -100] },
  { name: 'BRAZIL', coord: [-11, -52] },
  { name: 'EUROPE', coord: [51, 15] },
  { name: 'AFRICA', coord: [8, 21] },
  { name: 'RUSSIA', coord: [60, 86] },
  { name: 'CHINA', coord: [35, 104] },
  { name: 'INDIA', coord: [21, 79] },
  { name: 'AUSTRALIA', coord: [-25, 134] },
]

const {
  regionClusters,
  totalServers,
  onlineServers,
  offlineServers,
} = useNodeGeoClusters({ nodes: () => props.nodes })

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function projectCoord(coord: [number, number]): MapPoint {
  const [lat, lng] = coord
  const visibleLat = clamp(lat, VISIBLE_SOUTH_LAT, VISIBLE_NORTH_LAT)
  return {
    x: MAP_PADDING_X + ((lng + 180) / 360) * (MAP_WIDTH - MAP_PADDING_X * 2),
    y: MAP_PADDING_Y + ((VISIBLE_NORTH_LAT - visibleLat) / (VISIBLE_NORTH_LAT - VISIBLE_SOUTH_LAT)) * (MAP_HEIGHT - MAP_PADDING_Y * 2),
  }
}

function ringToPath(ring: Position[]): string {
  return `${ring.map((coord, index) => {
    const point = projectCoord([coord[1], coord[0]])
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  }).join(' ')} Z`
}

function featureToPath(feature: CountryFeature): string {
  if (feature.geometry.type === 'Polygon')
    return (feature.geometry.coordinates as Position[][]).map(ringToPath).join(' ')

  return (feature.geometry.coordinates as Position[][][])
    .flatMap(polygon => polygon.map(ringToPath))
    .join(' ')
}

const countryPaths = worldCountries.features.map(feature => ({
  name: feature.properties.name,
  iso2: feature.properties.iso2,
  continent: feature.properties.continent,
  path: featureToPath(feature),
}))

const activeCountryCodes = computed(() => new Set(
  regionClusters.value.map(cluster => cluster.code.toUpperCase()),
))

function markerScaleForCount(count: number): number {
  if (count >= 20)
    return 0.64
  if (count >= 12)
    return 0.8
  return 1
}

function pointInBox(point: MapPoint, box: MapBox): boolean {
  return point.x >= box.left
    && point.x <= box.right
    && point.y >= box.top
    && point.y <= box.bottom
}

function segmentOrientation(first: MapPoint, second: MapPoint, third: MapPoint): number {
  return (second.y - first.y) * (third.x - second.x)
    - (second.x - first.x) * (third.y - second.y)
}

function segmentsIntersect(first: MapSegment, second: MapSegment): boolean {
  const o1 = segmentOrientation(first.start, first.end, second.start)
  const o2 = segmentOrientation(first.start, first.end, second.end)
  const o3 = segmentOrientation(second.start, second.end, first.start)
  const o4 = segmentOrientation(second.start, second.end, first.end)
  return o1 * o2 < 0 && o3 * o4 < 0
}

function segmentIntersectsBox(segment: MapSegment, box: MapBox, padding = 0): boolean {
  const expanded = {
    left: box.left - padding,
    right: box.right + padding,
    top: box.top - padding,
    bottom: box.bottom + padding,
  }
  if (pointInBox(segment.start, expanded) || pointInBox(segment.end, expanded))
    return true

  const topLeft = { x: expanded.left, y: expanded.top }
  const topRight = { x: expanded.right, y: expanded.top }
  const bottomRight = { x: expanded.right, y: expanded.bottom }
  const bottomLeft = { x: expanded.left, y: expanded.bottom }
  return [
    { start: topLeft, end: topRight },
    { start: topRight, end: bottomRight },
    { start: bottomRight, end: bottomLeft },
    { start: bottomLeft, end: topLeft },
  ].some(edge => segmentsIntersect(segment, edge))
}

function pointDistanceToSegment(point: MapPoint, segment: MapSegment): number {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0)
    return Math.hypot(point.x - segment.start.x, point.y - segment.start.y)
  const ratio = clamp(
    ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
    0,
    1,
  )
  return Math.hypot(
    point.x - (segment.start.x + ratio * dx),
    point.y - (segment.start.y + ratio * dy),
  )
}

const clusterMarkers = computed<ClusterMarker[]>(() => {
  const scale = markerScaleForCount(regionClusters.value.length)
  const projectedPoints = regionClusters.value.map(cluster => projectCoord(cluster.coord))
  const occupiedFlagBoxes: MapBox[] = []
  const occupiedConnectors: MapSegment[] = []
  const placements: ClusterMarker[] = []
  const offsets = [
    [0, 0],
    [-48, -6],
    [48, -6],
    [-78, 12],
    [78, 12],
    [-28, -42],
    [28, -42],
    [-94, -22],
    [94, -22],
    [-58, -56],
    [58, -56],
    [0, -70],
    [-116, 18],
    [116, 18],
    [-126, -48],
    [126, -48],
    [-42, 52],
    [42, 52],
    [-102, 62],
    [102, 62],
    [0, 82],
  ] as const

  function flagBox(center: MapPoint): MapBox {
    return {
      left: center.x - 24 * scale,
      right: center.x + 32 * scale,
      top: center.y - 21 * scale,
      bottom: center.y + 18 * scale,
    }
  }

  function boxesOverlap(first: MapBox, second: MapBox, padding = 5 * scale): boolean {
    return first.left < second.right + padding
      && first.right > second.left - padding
      && first.top < second.bottom + padding
      && first.bottom > second.top - padding
  }

  function pointHitsBox(point: MapPoint, box: MapBox, padding = 11 * scale): boolean {
    return point.x >= box.left - padding
      && point.x <= box.right + padding
      && point.y >= box.top - padding
      && point.y <= box.bottom + padding
  }

  function connectorEnd(point: MapPoint, center: MapPoint): MapPoint {
    const dx = point.x - center.x
    const dy = point.y - center.y
    const horizontalRatio = Math.abs(dx) > 0.001 ? (21 * scale) / Math.abs(dx) : Number.POSITIVE_INFINITY
    const verticalRatio = Math.abs(dy) > 0.001 ? (14 * scale) / Math.abs(dy) : Number.POSITIVE_INFINITY
    const ratio = Math.min(horizontalRatio, verticalRatio, 1)
    return {
      x: center.x + dx * ratio,
      y: center.y + dy * ratio,
    }
  }

  const orderedIndices = projectedPoints
    .map((point, index) => ({
      index,
      density: projectedPoints.filter((candidate, candidateIndex) =>
        candidateIndex !== index && Math.hypot(candidate.x - point.x, candidate.y - point.y) < 126 * scale,
      ).length,
    }))
    .sort((first, second) => second.density - first.density || first.index - second.index)

  for (const { index } of orderedIndices) {
    const cluster = regionClusters.value[index]!
    const point = projectedPoints[index]!
    const baseFlagCenter = { x: point.x, y: point.y - 48 * scale }
    const candidates = offsets.map(([offsetX, offsetY]) => {
      const center = {
        x: clamp(baseFlagCenter.x + offsetX * scale, 34 * scale, MAP_WIDTH - 36 * scale),
        y: clamp(baseFlagCenter.y + offsetY * scale, 24 * scale, MAP_HEIGHT - 22 * scale),
      }
      const box = flagBox(center)
      const connector = {
        start: { x: point.x, y: point.y - 2 },
        end: connectorEnd(point, center),
      }
      const nodeCollisions = projectedPoints.filter((candidatePoint, candidateIndex) =>
        candidateIndex !== index && pointHitsBox(candidatePoint, box),
      ).length
      const flagCollisions = occupiedFlagBoxes.filter(existing => boxesOverlap(existing, box)).length
      const connectorThroughFlags = occupiedFlagBoxes.filter(existing =>
        segmentIntersectsBox(connector, existing, 4 * scale),
      ).length
      const flagBlocksConnectors = occupiedConnectors.filter(existing =>
        segmentIntersectsBox(existing, box, 4 * scale),
      ).length
      const connectorCrossings = occupiedConnectors.filter(existing =>
        segmentsIntersect(connector, existing),
      ).length
      const connectorNearNodes = projectedPoints.filter((candidatePoint, candidateIndex) =>
        candidateIndex !== index && pointDistanceToSegment(candidatePoint, connector) < 10 * scale,
      ).length
      const distance = Math.hypot(center.x - baseFlagCenter.x, center.y - baseFlagCenter.y)
      return {
        center,
        box,
        connector,
        score:
          flagCollisions * 2_000_000
          + connectorThroughFlags * 1_500_000
          + flagBlocksConnectors * 1_500_000
          + nodeCollisions * 500_000
          + connectorNearNodes * 180_000
          + connectorCrossings * 80_000
          + distance,
      }
    })
    const selected = candidates.reduce((best, candidate) => candidate.score < best.score ? candidate : best)
    const flagCenter = selected.center
    occupiedFlagBoxes.push(selected.box)
    occupiedConnectors.push(selected.connector)
    placements.push({
      id: cluster.id,
      code: cluster.code,
      label: cluster.label,
      index: index + 1,
      servers: cluster.servers,
      onlineServers: cluster.onlineServers,
      offlineServers: Math.max(0, cluster.servers - cluster.onlineServers),
      nodes: cluster.nodes,
      x: point.x,
      y: point.y,
      flagX: flagCenter.x,
      flagY: flagCenter.y,
      connectorX: selected.connector.end.x,
      connectorY: selected.connector.end.y,
      statusClass: cluster.onlineServers > 0 ? 'is-online' : 'is-offline',
    })
  }

  return placements.sort((first, second) => first.index - second.index)
})

const markerScale = computed(() => markerScaleForCount(clusterMarkers.value.length))

const projectedCountryLabels = countryLabels.map(label => ({
  name: label.name,
  ...projectCoord(label.coord),
}))

const onlineRate = computed(() => {
  if (totalServers.value === 0)
    return 0
  return Math.round((onlineServers.value / totalServers.value) * 100)
})

const hoveredMarker = ref<ClusterMarker | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

function updateTooltipPosition(event: PointerEvent | FocusEvent) {
  if ('clientX' in event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    tooltipX.value = Math.max(132, Math.min(window.innerWidth - 132, event.clientX))
    tooltipY.value = Math.max(76, Math.min(window.innerHeight - 20, event.clientY - 12))
    return
  }

  const rect = (event.currentTarget as Element | null)?.getBoundingClientRect()
  if (!rect)
    return
  tooltipX.value = Math.max(132, Math.min(window.innerWidth - 132, rect.left + rect.width / 2))
  tooltipY.value = Math.max(76, rect.top - 8)
}

function showClusterTooltip(marker: ClusterMarker, event: PointerEvent | FocusEvent) {
  hoveredMarker.value = marker
  updateTooltipPosition(event)
}

function hideClusterTooltip() {
  hoveredMarker.value = null
}
</script>

<template>
  <div
    v-bind="attrs"
    class="earth-map-shell relative z-0 w-full overflow-hidden rounded-[1.5rem] border border-white/45 shadow-[0_24px_80px_rgb(15_23_42/0.18)] backdrop-blur-2xl dark:border-cyan-200/10"
    :class="{ 'reduce-motion': appStore.disablePageAnimation }"
  >
    <div class="map-stage">
      <svg
        class="map-svg absolute inset-0 size-full"
        :viewBox="`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="简约单色国家分区节点世界地图"
      >
        <defs>
          <linearGradient id="map-ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="ocean-stop-top" />
            <stop offset="100%" class="ocean-stop-bottom" />
          </linearGradient>
          <pattern id="paper-grain" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M0 16 C18 7 35 26 54 15 S76 11 86 19" class="paper-line" />
            <path d="M-8 53 C13 40 31 63 49 51 S69 44 84 57" class="paper-line" />
          </pattern>
          <filter id="active-country-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#22d3ee" flood-opacity="0.7" />
          </filter>
          <filter id="flag-shadow" x="-60%" y="-60%" width="220%" height="240%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.48" />
          </filter>
        </defs>

        <rect :width="MAP_WIDTH" :height="MAP_HEIGHT" fill="url(#map-ocean)" />
        <rect :width="MAP_WIDTH" :height="MAP_HEIGHT" fill="url(#paper-grain)" class="paper-overlay" />

        <g class="graticule" aria-hidden="true">
          <line v-for="lng in [-120, -60, 0, 60, 120]" :key="`lng-${lng}`" :x1="projectCoord([0, lng]).x" y1="0" :x2="projectCoord([0, lng]).x" :y2="MAP_HEIGHT" />
          <line v-for="lat in [-30, 0, 30, 60]" :key="`lat-${lat}`" x1="0" :y1="projectCoord([lat, 0]).y" :x2="MAP_WIDTH" :y2="projectCoord([lat, 0]).y" />
        </g>

        <g class="countries">
          <path
            v-for="country in countryPaths"
            :key="country.iso2 || country.name"
            :d="country.path"
            class="country"
            :class="{ 'has-node': activeCountryCodes.has(country.iso2) }"
            fill-rule="evenodd"
            vector-effect="non-scaling-stroke"
          >
            <title>{{ country.name }}</title>
          </path>
        </g>

        <g class="country-labels" aria-hidden="true">
          <text v-for="label in projectedCountryLabels" :key="label.name" :x="label.x" :y="label.y">
            {{ label.name }}
          </text>
        </g>

        <g class="node-markers">
          <g
            v-for="(marker, markerIndex) in clusterMarkers"
            :key="marker.id"
            class="node-marker-group"
            :data-marker-id="marker.id"
          >
            <line
              :x1="marker.x"
              :y1="marker.y - 2"
              :x2="marker.connectorX"
              :y2="marker.connectorY"
              class="flag-stem-halo"
              :class="marker.statusClass"
              :data-marker-id="marker.id"
            />
            <line
              :x1="marker.x"
              :y1="marker.y - 2"
              :x2="marker.connectorX"
              :y2="marker.connectorY"
              class="flag-stem"
              :class="marker.statusClass"
              :data-marker-id="marker.id"
            />
            <circle
              :cx="marker.x"
              :cy="marker.y"
              :r="13 * markerScale"
              class="node-pulse"
              :class="marker.statusClass"
              :style="{ '--pulse-delay': `${-(markerIndex % 6) * 0.38}s` }"
            />
            <circle :cx="marker.x" :cy="marker.y" :r="4.2 * markerScale" class="node-dot" :class="marker.statusClass" />
            <g
              class="node-marker-hover-target"
              tabindex="0"
              :aria-label="`${marker.label || marker.code}，${marker.onlineServers} 台在线，${marker.offlineServers} 台离线`"
              @pointerenter="showClusterTooltip(marker, $event)"
              @pointermove="showClusterTooltip(marker, $event)"
              @pointerleave="hideClusterTooltip"
              @focus="showClusterTooltip(marker, $event)"
              @blur="hideClusterTooltip"
            >
              <image
                v-if="marker.code"
                :href="`/images/flags/${marker.code}.svg`"
                :x="marker.flagX - 21 * markerScale"
                :y="marker.flagY - 14 * markerScale"
                :width="42 * markerScale"
                :height="28 * markerScale"
                preserveAspectRatio="xMidYMid slice"
                class="map-flag"
                filter="url(#flag-shadow)"
              >
                <title>{{ marker.label || marker.code }}</title>
              </image>
              <g class="cluster-index" :transform="`translate(${marker.flagX + 19 * markerScale} ${marker.flagY - 8 * markerScale})`">
                <circle :r="9.5 * markerScale" />
                <text :font-size="11 * markerScale" dy="0.35em">{{ marker.index }}</text>
              </g>
            </g>
          </g>
        </g>
      </svg>

      <div class="map-status">
        <span class="status-online">
          <i />
          {{ onlineServers }} ONLINE
        </span>
        <span v-if="offlineServers > 0" class="status-offline">
          <i />
          {{ offlineServers }} OFF
        </span>
        <strong v-if="totalServers > 0">{{ onlineRate }}%</strong>
      </div>
    </div>

    <aside class="map-region-panel">
      <header>
        <span>节点分布</span>
        <strong>{{ onlineRate }}% 在线</strong>
      </header>
      <div v-if="clusterMarkers.length > 0" class="map-region-list">
        <article
          v-for="marker in clusterMarkers"
          :key="`region-${marker.id}`"
          :class="marker.statusClass"
          tabindex="0"
          :aria-label="`${marker.label || marker.code} 节点列表`"
          @pointerenter="showClusterTooltip(marker, $event)"
          @pointermove="showClusterTooltip(marker, $event)"
          @pointerleave="hideClusterTooltip"
          @focus="showClusterTooltip(marker, $event)"
          @blur="hideClusterTooltip"
        >
          <span class="map-region-index">{{ marker.index }}</span>
          <img v-if="marker.code" :src="`/images/flags/${marker.code}.svg`" :alt="marker.code">
          <div class="min-w-0">
            <b>{{ marker.label || marker.code }}</b>
            <small>
              {{ marker.onlineServers }} 在线
              <template v-if="marker.offlineServers > 0"> · {{ marker.offlineServers }} 离线</template>
            </small>
          </div>
          <em>×{{ marker.servers }}</em>
        </article>
      </div>
      <div v-else class="map-region-empty">
        暂无可定位节点
      </div>
    </aside>
  </div>

  <Teleport to="body">
    <div
      v-if="hoveredMarker"
      data-testid="tiled-cluster-tooltip"
      role="tooltip"
      class="map-cluster-tooltip pointer-events-none fixed z-[320] w-64 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-full"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <div class="map-cluster-tooltip-header">
        <span class="map-region-index">{{ hoveredMarker.index }}</span>
        <img v-if="hoveredMarker.code" :src="`/images/flags/${hoveredMarker.code}.svg`" :alt="hoveredMarker.code">
        <div class="min-w-0">
          <b>{{ hoveredMarker.label || hoveredMarker.code }}</b>
          <small>{{ hoveredMarker.onlineServers }} 在线 · {{ hoveredMarker.servers }} 台</small>
        </div>
      </div>
      <div class="map-cluster-tooltip-list">
        <div v-for="node in hoveredMarker.nodes" :key="node.uuid">
          <span :class="node.online ? 'is-online' : 'is-offline'" />
          <b>{{ node.name }}</b>
          <em :class="node.online ? 'is-online' : 'is-offline'">{{ node.online ? '在线' : '离线' }}</em>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.earth-map-shell {
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(15rem, 1fr);
  background: rgb(239 246 248 / 0.76);
}

.map-stage {
  position: relative;
  min-width: 0;
  aspect-ratio: 1440 / 680;
  overflow: hidden;
  border-right: 1px solid rgb(14 116 144 / 0.12);
}

.map-svg {
  display: block;
  background: transparent;
}

.ocean-stop-top {
  stop-color: rgb(244 248 249 / 0.98);
}

.ocean-stop-bottom {
  stop-color: rgb(222 236 240 / 0.96);
}

.paper-line {
  fill: none;
  stroke: rgb(71 85 105 / 0.055);
  stroke-width: 1;
}

.paper-overlay {
  opacity: 0.7;
}

.graticule line {
  stroke: rgb(14 116 144 / 0.075);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.country {
  fill: #17647c;
  stroke: rgb(224 242 254 / 0.56);
  stroke-width: 0.68;
  transition:
    filter 220ms ease,
    opacity 220ms ease;
}

.country.has-node {
  fill: #0f7d99;
  stroke: rgb(34 211 238 / 0.98);
  stroke-width: 1.5;
  filter: url(#active-country-glow);
}

.country-labels text {
  fill: rgb(240 249 255 / 0.8);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  paint-order: stroke;
  stroke: rgb(8 47 73 / 0.64);
  stroke-width: 2.5px;
  text-anchor: middle;
}

.flag-stem,
.flag-stem-halo {
  vector-effect: non-scaling-stroke;
}

.flag-stem-halo {
  stroke: rgb(14 165 233 / 0.22);
  stroke-width: 4.4;
  filter: blur(0.35px);
}

.flag-stem {
  stroke: rgb(2 132 199 / 0.92);
  stroke-width: 1.85;
  stroke-dasharray: 4 3;
  filter: drop-shadow(0 0 2px rgb(14 165 233 / 0.38));
}

.flag-stem-halo.is-offline {
  stroke: rgb(244 63 94 / 0.2);
}

.flag-stem.is-offline {
  stroke: rgb(225 29 72 / 0.9);
  filter: drop-shadow(0 0 2px rgb(244 63 94 / 0.34));
}

.node-pulse {
  fill: rgb(34 211 238 / 0.25);
  stroke: rgb(34 211 238 / 0.72);
  stroke-width: 1.15;
  transform-box: fill-box;
  transform-origin: center;
  animation: map-node-breathe 3.15s cubic-bezier(0.22, 0.7, 0.28, 1) var(--pulse-delay, 0s) infinite;
  vector-effect: non-scaling-stroke;
  will-change: transform, opacity;
}

.node-pulse.is-offline {
  fill: rgb(251 113 133 / 0.16);
  stroke: rgb(244 63 94 / 0.76);
  animation-name: map-node-offline-breathe;
  animation-duration: 1.7s;
}

.node-dot {
  fill: #22d3ee;
  stroke: white;
  stroke-width: 1.65;
  filter: drop-shadow(0 0 4px rgb(103 232 249 / 0.82)) drop-shadow(0 0 9px rgb(34 211 238 / 0.56));
  vector-effect: non-scaling-stroke;
}

.node-dot.is-offline {
  fill: #f43f5e;
  filter: drop-shadow(0 0 5px rgb(244 63 94 / 0.78));
  animation: map-node-offline-dot 1.7s ease-in-out var(--pulse-delay, 0s) infinite;
}

@keyframes map-node-breathe {
  0% {
    opacity: 0.78;
    transform: scale(0.68);
  }

  72%,
  100% {
    opacity: 0;
    transform: scale(1.58);
  }
}

@keyframes map-node-offline-breathe {
  0% {
    opacity: 0.82;
    transform: scale(0.7);
  }

  78%,
  100% {
    opacity: 0;
    transform: scale(1.62);
  }
}

@keyframes map-node-offline-dot {
  0%,
  100% {
    opacity: 0.82;
  }

  48% {
    opacity: 1;
  }
}

.earth-map-shell.reduce-motion .node-pulse,
.earth-map-shell.reduce-motion .node-dot {
  animation: none;
}

.node-marker-group {
  pointer-events: none;
}

.node-marker-hover-target {
  cursor: help;
  outline: none;
  pointer-events: all;
}

.node-marker-hover-target:focus-visible {
  filter: drop-shadow(0 0 5px rgb(34 211 238 / 0.72));
}

.cluster-index circle {
  fill: #facc15;
  stroke: rgb(255 255 255 / 0.96);
  stroke-width: 1.8;
  filter: drop-shadow(0 2px 4px rgb(15 23 42 / 0.52));
  vector-effect: non-scaling-stroke;
}

.cluster-index text {
  fill: #2c1604;
  font-weight: 900;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgb(255 255 255 / 0.34);
  stroke-width: 0.45px;
}

.map-flag {
  overflow: hidden;
  clip-path: inset(0 round 2px);
}

.map-status {
  position: absolute;
  z-index: 4;
  top: 0.8rem;
  left: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgb(255 255 255 / 0.58);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.66);
  box-shadow: 0 10px 30px rgb(15 23 42 / 0.12);
  padding: 0.34rem 0.62rem;
  color: rgb(51 65 85 / 0.82);
  font-size: 0.62rem;
  font-weight: 800;
  backdrop-filter: blur(14px) saturate(145%);
}

.map-status span {
  display: inline-flex;
  align-items: center;
  gap: 0.24rem;
}

.map-status i {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px rgb(16 185 129 / 0.72);
}

.map-status .status-offline i {
  background: #f43f5e;
  box-shadow: 0 0 8px rgb(244 63 94 / 0.64);
}

.map-status strong {
  color: rgb(2 132 199 / 0.94);
}

.map-region-panel {
  display: flex;
  min-width: 0;
  max-height: 100%;
  flex-direction: column;
  gap: 0.55rem;
  background: rgb(238 246 249 / 0.66);
  padding: 0.8rem;
}

.map-region-panel header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 2rem;
  border: 1px solid rgb(14 116 144 / 0.22);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.45);
  color: rgb(8 47 73 / 0.78);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.map-region-panel header strong {
  color: #059669;
  letter-spacing: 0.02em;
}

.map-region-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 0.42rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.map-region-list article {
  display: grid;
  min-width: 0;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.38rem;
  border: 1px solid rgb(14 116 144 / 0.2);
  border-radius: 0.68rem;
  background: rgb(255 255 255 / 0.48);
  padding: 0.42rem 0.48rem;
  outline: none;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.map-region-list article:hover,
.map-region-list article:focus-visible {
  border-color: rgb(6 182 212 / 0.58);
  background: rgb(255 255 255 / 0.72);
  transform: translateY(-1px);
}

.map-region-list article.is-offline {
  border-color: rgb(225 29 72 / 0.22);
}

.map-region-index {
  display: grid;
  width: 1.28rem;
  height: 1.28rem;
  place-items: center;
  border: 1.5px solid rgb(255 255 255 / 0.88);
  border-radius: 50%;
  background: #facc15;
  color: #422006;
  box-shadow: 0 2px 7px rgb(15 23 42 / 0.28);
  font-size: 0.64rem;
  font-weight: 900;
}

.map-region-list img {
  width: 1.15rem;
  height: 0.78rem;
  border-radius: 0.12rem;
  object-fit: cover;
  filter: drop-shadow(0 2px 3px rgb(15 23 42 / 0.22));
}

.map-region-list b,
.map-region-list small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-region-list b {
  color: rgb(15 23 42 / 0.88);
  font-size: 0.63rem;
}

.map-region-list small {
  margin-top: 0.05rem;
  color: rgb(71 85 105 / 0.76);
  font-size: 0.5rem;
}

.map-region-list em {
  color: rgb(2 132 199 / 0.86);
  font-size: 0.55rem;
  font-style: normal;
  font-weight: 800;
}

.map-region-empty {
  display: grid;
  min-height: 8rem;
  place-items: center;
  color: rgb(71 85 105 / 0.62);
  font-size: 0.7rem;
}

:global(.dark .earth-map-shell) {
  background: rgb(7 22 32 / 0.84);
}

:global(.dark .map-stage) {
  border-right-color: rgb(103 232 249 / 0.1);
}

:global(.dark .flag-stem-halo) {
  stroke: rgb(103 232 249 / 0.2);
}

:global(.dark .flag-stem) {
  stroke: rgb(103 232 249 / 0.78);
  filter: drop-shadow(0 0 2px rgb(34 211 238 / 0.34));
}

:global(.dark .flag-stem-halo.is-offline) {
  stroke: rgb(251 113 133 / 0.2);
}

:global(.dark .flag-stem.is-offline) {
  stroke: rgb(251 113 133 / 0.82);
}

:global(.dark .map-region-panel) {
  background: rgb(5 18 28 / 0.72);
}

:global(.dark .map-region-panel header),
:global(.dark .map-region-list article) {
  border-color: rgb(103 232 249 / 0.15);
  background: rgb(8 31 44 / 0.66);
}

:global(.dark .map-region-panel header) {
  color: rgb(207 250 254 / 0.74);
}

:global(.dark .map-region-list b) {
  color: rgb(240 249 255 / 0.86);
}

:global(.dark .map-region-list article:hover),
:global(.dark .map-region-list article:focus-visible) {
  border-color: rgb(103 232 249 / 0.48);
  background: rgb(12 42 56 / 0.88);
}

.map-cluster-tooltip {
  overflow: hidden;
  border: 1px solid rgb(125 211 252 / 0.22);
  border-radius: 0.85rem;
  background: rgb(8 22 34 / 0.94);
  box-shadow: 0 16px 44px rgb(2 8 23 / 0.38);
  color: rgb(240 249 255 / 0.94);
  backdrop-filter: blur(18px) saturate(135%);
}

.map-cluster-tooltip-header {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid rgb(125 211 252 / 0.12);
  padding: 0.62rem 0.7rem;
}

.map-cluster-tooltip-header img {
  width: 1.45rem;
  height: 0.96rem;
  border-radius: 0.15rem;
  object-fit: cover;
}

.map-cluster-tooltip-header b,
.map-cluster-tooltip-header small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-cluster-tooltip-header b {
  font-size: 0.74rem;
}

.map-cluster-tooltip-header small {
  margin-top: 0.1rem;
  color: rgb(186 230 253 / 0.64);
  font-size: 0.58rem;
}

.map-cluster-tooltip-list {
  display: grid;
  max-height: 12rem;
  gap: 0.12rem;
  overflow-y: auto;
  padding: 0.46rem 0.55rem 0.55rem;
  scrollbar-width: thin;
}

.map-cluster-tooltip-list > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.42rem;
  border-radius: 0.5rem;
  padding: 0.32rem 0.38rem;
  background: rgb(255 255 255 / 0.035);
}

.map-cluster-tooltip-list span {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
}

.map-cluster-tooltip-list span.is-online {
  background: #34d399;
  box-shadow: 0 0 8px rgb(52 211 153 / 0.58);
}

.map-cluster-tooltip-list span.is-offline {
  background: #fb7185;
  box-shadow: 0 0 8px rgb(251 113 133 / 0.5);
}

.map-cluster-tooltip-list b {
  overflow: hidden;
  font-size: 0.67rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-cluster-tooltip-list em {
  font-size: 0.58rem;
  font-style: normal;
  font-weight: 700;
}

.map-cluster-tooltip-list em.is-online {
  color: #6ee7b7;
}

.map-cluster-tooltip-list em.is-offline {
  color: #fda4af;
}

:global(.dark .map-region-list small),
:global(.dark .map-region-empty) {
  color: rgb(186 230 253 / 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .node-pulse,
  .node-dot {
    animation: none;
  }
}

:global(.dark .ocean-stop-top) {
  stop-color: rgb(10 31 43 / 0.98);
}

:global(.dark .ocean-stop-bottom) {
  stop-color: rgb(5 20 30 / 0.99);
}

:global(.dark .paper-line) {
  stroke: rgb(125 211 252 / 0.045);
}

:global(.dark .graticule line) {
  stroke: rgb(125 211 252 / 0.13);
}

@media (max-width: 980px) {
  .earth-map-shell {
    grid-template-columns: 1fr;
  }

  .map-stage {
    border-right: 0;
    border-bottom: 1px solid rgb(14 116 144 / 0.12);
  }

  .map-region-panel {
    max-height: 13rem;
  }

  .map-region-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .map-stage {
    min-height: 15rem;
    aspect-ratio: auto;
  }

  .map-region-list {
    grid-template-columns: 1fr;
  }
}

:global(.dark .country) {
  fill: #164f62;
  stroke: rgb(186 230 253 / 0.24);
  filter: none;
}

:global(.dark .country.has-node) {
  fill: #176d82;
  stroke: rgb(103 232 249 / 0.94);
  filter: url(#active-country-glow);
}

:global(.dark .country-labels text) {
  fill: rgb(240 249 255 / 0.72);
  stroke: rgb(15 23 42 / 0.76);
}

:global(.dark .map-status),
:global(.dark .map-node-chip) {
  border-color: rgb(125 211 252 / 0.18);
  background: rgb(8 25 42 / 0.72);
  color: rgb(224 242 254 / 0.86);
}

:global(.dark .map-status strong) {
  color: rgb(103 232 249 / 0.94);
}

:global(.dark .map-node-chip small),
:global(.dark .map-node-more) {
  color: rgb(125 211 252 / 0.9);
}

@media (max-width: 640px) {
  .earth-map-shell {
    min-height: 18rem;
  }

  .country-labels text {
    font-size: 10px;
  }

  .map-node-strip {
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .map-node-strip::-webkit-scrollbar {
    display: none;
  }
}
</style>
