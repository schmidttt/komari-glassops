<script setup lang="ts">
import type { GlobeInstance } from 'globe.gl'
import type {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  MeshPhongMaterial,
  PerspectiveCamera,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
} from 'three'
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
const EARTH_NIGHT_TEXTURE_SIZE = [3600, 1800] as const
const SOLAR_REFRESH_MS = 60_000

const DAY_NIGHT_SHADER_UNIFORMS = `
uniform sampler2D nightTexture;
uniform vec3 sunDirectionView;
uniform float cityLightStrength;
uniform float nightBaseStrength;
uniform float nightGeographyStrength;
uniform float daySurfaceStrength;
uniform float dayAmbientStrength;
uniform float dayWarmCompression;
uniform float nightAmbientStrength;
uniform float terminatorWidth;
uniform float twinkleTime;
uniform float twinkleStrength;
`

const DAY_NIGHT_MAP_FRAGMENT = `
#ifdef USE_MAP

  vec4 sampledDayColor = texture2D(map, vMapUv);
  vec3 sampledNightColor = texture2D(nightTexture, vMapUv).rgb;
  vec2 nightTexel = vec2(${(1 / EARTH_NIGHT_TEXTURE_SIZE[0]).toFixed(9)}, ${(1 / EARTH_NIGHT_TEXTURE_SIZE[1]).toFixed(9)});
  vec3 nearbyNightLight = sampledNightColor;
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv + vec2(nightTexel.x, 0.0)).rgb * 0.94);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv - vec2(nightTexel.x, 0.0)).rgb * 0.94);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv + vec2(0.0, nightTexel.y)).rgb * 0.94);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv - vec2(0.0, nightTexel.y)).rgb * 0.94);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv + nightTexel).rgb * 0.90);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv - nightTexel).rgb * 0.90);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv + vec2(nightTexel.x, -nightTexel.y)).rgb * 0.90);
  nearbyNightLight = max(nearbyNightLight, texture2D(nightTexture, vMapUv + vec2(-nightTexel.x, nightTexel.y)).rgb * 0.90);

  float solarIntensity = dot(normalize(vNormal), normalize(sunDirectionView));
  float daylight = smoothstep(-terminatorWidth, terminatorWidth * 1.18, solarIntensity);
  float nightVisibility = 1.0 - smoothstep(-0.08, 0.16, solarIntensity);
  float settlementSignal = max(
    0.0,
    max(nearbyNightLight.r, nearbyNightLight.g * 0.96) - nearbyNightLight.b * 0.50
  );
  float citySignal = max(
    0.0,
    max(sampledNightColor.r, sampledNightColor.g * 0.96) - sampledNightColor.b * 0.50
  );
  float cityMask = pow(smoothstep(0.010, 0.20, citySignal), 0.88);
  float settlementMask = pow(smoothstep(0.0007, 0.050, settlementSignal), 0.56);
  vec2 settlementGrid = vMapUv * vec2(1440.0, 720.0);
  vec2 settlementCell = floor(settlementGrid);
  vec2 settlementOffset = fract(settlementGrid) - 0.5;
  float cityNoise = fract(sin(dot(settlementCell, vec2(12.9898, 78.233))) * 43758.5453);
  float sparkleThreshold = mix(0.88, 0.22, settlementMask);
  float pointDistance = length(settlementOffset);
  float pointCore = 1.0 - smoothstep(0.10, 0.42, pointDistance);
  float pointHalo = 1.0 - smoothstep(0.18, 0.60, pointDistance);
  float pointShape = min(1.0, pointCore + pointHalo * 0.26);
  float settlementSparkle = smoothstep(
    sparkleThreshold,
    min(0.995, sparkleThreshold + 0.10),
    cityNoise
  ) * pointShape * settlementMask;
  vec2 metroGrid = vMapUv * vec2(1920.0, 960.0);
  vec2 metroCell = floor(metroGrid);
  vec2 metroOffset = fract(metroGrid) - 0.5;
  float metroNoise = fract(sin(dot(metroCell, vec2(39.3468, 11.1351))) * 24634.6345);
  float metroThreshold = mix(0.995, 0.54, pow(settlementMask, 1.60));
  float metroPoint = 1.0 - smoothstep(0.08, 0.34, length(metroOffset));
  float metroSparkle = smoothstep(
    metroThreshold,
    min(0.999, metroThreshold + 0.055),
    metroNoise
  ) * metroPoint * pow(settlementMask, 1.35);
  settlementSparkle = max(settlementSparkle, metroSparkle * 0.82);
  float settlementBrightness = mix(0.24, 0.60, pow(settlementMask, 1.72));
  float twinkleCandidate = smoothstep(0.58, 0.92, cityNoise);
  float twinkle = 1.0 + sin(twinkleTime * mix(1.4, 2.6, cityNoise) + cityNoise * 6.28318)
    * twinkleCandidate * twinkleStrength;
  vec3 cityColor = mix(
    sampledNightColor * 1.35,
    vec3(1.0, 0.74, 0.40),
    0.30
  );
  float terrainLuminance = dot(sampledDayColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 moonlitGeography = sampledDayColor.rgb
    * vec3(0.27, 0.34, 0.46)
    * nightGeographyStrength;
  moonlitGeography += terrainLuminance
    * vec3(0.020, 0.034, 0.060)
    * nightGeographyStrength;
  vec3 nightSurface = moonlitGeography
    + sampledNightColor * nightBaseStrength
    + vec3(0.008, 0.016, 0.032);
  float warmHighlight = smoothstep(
    0.10,
    0.38,
    max(0.0, (sampledDayColor.r + sampledDayColor.g) * 0.5 - sampledDayColor.b)
  ) * smoothstep(0.36, 0.72, terrainLuminance);
  float warmCompression = warmHighlight * dayWarmCompression;
  vec3 balancedDayColor = mix(
    sampledDayColor.rgb,
    vec3(terrainLuminance),
    warmCompression * 0.36
  ) * (1.0 - warmCompression * 0.18);
  float dayLightLift = mix(0.98, 1.18, clamp(solarIntensity, 0.0, 1.0));
  vec3 daySurface = balancedDayColor * daySurfaceStrength * dayLightLift;

  diffuseColor *= vec4(mix(nightSurface, daySurface, daylight), sampledDayColor.a);
  totalEmissiveRadiance += balancedDayColor * daylight * dayAmbientStrength;
  totalEmissiveRadiance += moonlitGeography * nightVisibility * nightAmbientStrength;
  totalEmissiveRadiance += cityColor
    * cityMask
    * nightVisibility
    * cityLightStrength
    * 0.08
    * twinkle;
  totalEmissiveRadiance += vec3(1.0, 0.74, 0.34)
    * settlementSparkle
    * nightVisibility
    * cityLightStrength
    * settlementBrightness
    * twinkle;

#endif
`

const ATMOSPHERE_VERTEX_SHADER = `
varying vec2 vAtmosphereUv;

void main() {
  vAtmosphereUv = uv;
  vec4 viewPosition = modelViewMatrix[3];
  vec2 spriteScale = vec2(
    length(modelMatrix[0].xyz),
    length(modelMatrix[1].xyz)
  );
  viewPosition.xy += position.xy * spriteScale;
  gl_Position = projectionMatrix * viewPosition;
}
`

const ATMOSPHERE_FRAGMENT_SHADER = `
uniform vec3 dayAtmosphereColor;
uniform vec3 nightAtmosphereColor;
uniform vec3 sunDirectionView;
uniform float atmosphereIntensity;
varying vec2 vAtmosphereUv;

void main() {
  const float earthRadius = 0.917431;
  vec2 position = (vAtmosphereUv - 0.5) * 2.0;
  float radius = length(position);
  if (radius >= 1.0)
    discard;

  float normalizedAltitude = clamp(
    (radius - earthRadius) / (1.0 - earthRadius),
    0.0,
    1.0
  );
  float outerFade = 1.0 - smoothstep(0.0, 1.0, normalizedAltitude);
  float surfaceContact = smoothstep(earthRadius - 0.006, earthRadius + 0.010, radius);
  float projectedRadius = min(radius / earthRadius, 1.0);
  vec3 limbNormal = normalize(vec3(
    position / earthRadius,
    sqrt(max(0.0, 1.0 - projectedRadius * projectedRadius))
  ));
  float limbSolarIntensity = dot(limbNormal, normalize(sunDirectionView));
  float sunlight = smoothstep(-0.26, 0.42, limbSolarIntensity);
  float twilight = 1.0 - smoothstep(0.0, 0.34, abs(limbSolarIntensity));
  vec3 atmosphereColor = mix(nightAtmosphereColor, dayAtmosphereColor, sunlight);
  float directionalStrength = mix(0.62, 1.0, sunlight) + twilight * 0.10;
  float alpha = surfaceContact
    * pow(outerFade, 1.7)
    * atmosphereIntensity
    * directionalStrength;
  gl_FragColor = vec4(atmosphereColor, alpha);
}
`

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
let nightTexture: Texture | null = null
let ambientLight: AmbientLight | null = null
let hemisphereLight: HemisphereLight | null = null
let keyLight: DirectionalLight | null = null
let fillLight: DirectionalLight | null = null
let rimLight: DirectionalLight | null = null
let atmosphereMaterial: ShaderMaterial | null = null
let atmosphereMesh: Sprite | null = null
let sunDirectionWorld: Vector3 | null = null
let sunDirectionView: Vector3 | null = null
let solarRefreshTimerId = 0
let threeRuntime: typeof import('three') | null = null
let loadingGlobe = false
let destroyed = false
let globeReady = false
const labelElements = new Map<string, HTMLElement>()

interface SurfaceShaderUniforms {
  nightTexture: { value: Texture }
  sunDirectionView: { value: Vector3 }
  cityLightStrength: { value: number }
  nightBaseStrength: { value: number }
  nightGeographyStrength: { value: number }
  daySurfaceStrength: { value: number }
  dayAmbientStrength: { value: number }
  dayWarmCompression: { value: number }
  nightAmbientStrength: { value: number }
  terminatorWidth: { value: number }
  twinkleTime: { value: number }
  twinkleStrength: { value: number }
}

let surfaceShaderUniforms: SurfaceShaderUniforms | null = null

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

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function normalizeLongitude(value: number): number {
  return normalizeDegrees(value + 180) - 180
}

function getSubsolarPoint(date = new Date()): { lat: number, lng: number } {
  const julianDay = date.getTime() / 86_400_000 + 2_440_587.5
  const daysSinceJ2000 = julianDay - 2_451_545
  const meanLongitude = normalizeDegrees(280.46 + 0.9856474 * daysSinceJ2000)
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * daysSinceJ2000) * Math.PI / 180
  const eclipticLongitude = (
    meanLongitude
    + 1.915 * Math.sin(meanAnomaly)
    + 0.02 * Math.sin(2 * meanAnomaly)
  ) * Math.PI / 180
  const obliquity = (23.439 - 0.0000004 * daysSinceJ2000) * Math.PI / 180
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  ) * 180 / Math.PI
  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(eclipticLongitude),
  ) * 180 / Math.PI
  const greenwichSiderealTime = normalizeDegrees(
    280.46061837 + 360.98564736629 * daysSinceJ2000,
  )

  return {
    lat: declination,
    lng: normalizeLongitude(rightAscension - greenwichSiderealTime),
  }
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
  syncAtmosphereGeometry()
}

function syncAtmosphereGeometry() {
  if (!globe || !containerRef.value)
    return

  const camera = globe.camera() as PerspectiveCamera
  const { height } = getRenderSize()
  const globeRadius = globe.getGlobeRadius()
  const cameraDistance = camera.position.length()
  const silhouetteDistance = Math.sqrt(Math.max(
    cameraDistance * cameraDistance - globeRadius * globeRadius,
    1,
  ))
  const focalLength = (height / 2) / Math.tan(camera.fov * Math.PI / 360)
  const visibleRadius = focalLength * globeRadius / silhouetteDistance
  const haloWidth = Math.min(128, Math.max(48, visibleRadius * 0.20))
  const shell = containerRef.value
  shell.style.setProperty('--earth-visible-radius', `${visibleRadius.toFixed(2)}px`)
  shell.style.setProperty('--earth-halo-inner-radius', `${Math.max(0, visibleRadius - 10).toFixed(2)}px`)
  shell.style.setProperty('--earth-halo-contact-radius', `${(visibleRadius + 1).toFixed(2)}px`)
  shell.style.setProperty('--earth-halo-shoulder-radius', `${(visibleRadius + haloWidth * 0.28).toFixed(2)}px`)
  shell.style.setProperty('--earth-halo-fade-radius', `${(visibleRadius + haloWidth * 0.64).toFixed(2)}px`)
  shell.style.setProperty('--earth-halo-outer-radius', `${(visibleRadius + haloWidth).toFixed(2)}px`)
  shell.style.setProperty('--earth-halo-diameter', `${((visibleRadius + haloWidth) * 2).toFixed(2)}px`)
  globeHostRef.value?.setAttribute('data-visible-earth-radius', visibleRadius.toFixed(2))
  globeHostRef.value?.setAttribute('data-atmosphere-halo-width', haloWidth.toFixed(2))
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

function syncSolarLighting(date = new Date()) {
  if (!globe || !threeRuntime || !sunDirectionWorld || !sunDirectionView)
    return

  const subsolar = getSubsolarPoint(date)
  const worldCoords = globe.getCoords(subsolar.lat, subsolar.lng, 1)
  sunDirectionWorld.set(worldCoords.x, worldCoords.y, worldCoords.z).normalize()

  const camera = globe.camera()
  camera.updateMatrixWorld(true)
  sunDirectionView.copy(sunDirectionWorld).transformDirection(camera.matrixWorldInverse)
  surfaceShaderUniforms?.sunDirectionView.value.copy(sunDirectionView)
  const atmosphereSun = atmosphereMaterial?.uniforms.sunDirectionView?.value as Vector3 | undefined
  atmosphereSun?.copy(sunDirectionView)

  if (keyLight)
    keyLight.position.copy(sunDirectionWorld).multiplyScalar(globe.getGlobeRadius() * 2.8)

  const projectedSunAngle = Math.atan2(sunDirectionView.x, sunDirectionView.y) * 180 / Math.PI
  const visibleDayWeight = (sunDirectionView.z + 1) / 2
  const shell = containerRef.value
  shell?.style.setProperty('--earth-atmosphere-angle', `${projectedSunAngle.toFixed(2)}deg`)
  shell?.style.setProperty(
    '--earth-atmosphere-day',
    `rgb(147 218 255 / ${(0.30 + visibleDayWeight * 0.12).toFixed(3)})`,
  )
  shell?.style.setProperty(
    '--earth-atmosphere-night',
    `rgb(96 165 250 / ${(0.26 + (1 - visibleDayWeight) * 0.10).toFixed(3)})`,
  )
  syncAtmosphereGeometry()

  globeHostRef.value?.setAttribute('data-subsolar-lat', subsolar.lat.toFixed(4))
  globeHostRef.value?.setAttribute('data-subsolar-lng', subsolar.lng.toFixed(4))
  globeHostRef.value?.setAttribute(
    'data-sun-view',
    [sunDirectionView.x, sunDirectionView.y, sunDirectionView.z].map(value => value.toFixed(4)).join(','),
  )
}

function startSolarUpdates() {
  window.clearInterval(solarRefreshTimerId)
  syncSolarLighting()
  solarRefreshTimerId = window.setInterval(syncSolarLighting, SOLAR_REFRESH_MS)
}

function stopSolarUpdates() {
  window.clearInterval(solarRefreshTimerId)
  solarRefreshTimerId = 0
}

function syncTwinkleAnimation() {
  if (!shouldRender.value || appStore.disablePageAnimation) {
    if (surfaceShaderUniforms)
      surfaceShaderUniforms.twinkleTime.value = 0
    globeHostRef.value?.setAttribute('data-city-twinkle', 'static')
    return
  }
  globeHostRef.value?.setAttribute('data-city-twinkle', 'animated')
}

function configureSurfaceShader() {
  if (!globeMaterial || !nightTexture || !sunDirectionView)
    return

  globeMaterial.onBeforeCompile = (shader) => {
    const uniforms: SurfaceShaderUniforms = {
      nightTexture: { value: nightTexture! },
      sunDirectionView: { value: sunDirectionView! },
      cityLightStrength: { value: appStore.isDark ? 1.82 : 1.24 },
      nightBaseStrength: { value: appStore.isDark ? 0.24 : 0.25 },
      nightGeographyStrength: { value: appStore.isDark ? 0.84 : 0.84 },
      daySurfaceStrength: { value: appStore.isDark ? 1.34 : 1.24 },
      dayAmbientStrength: { value: appStore.isDark ? 0.20 : 0.19 },
      dayWarmCompression: { value: appStore.isDark ? 0 : 1 },
      nightAmbientStrength: { value: appStore.isDark ? 0.13 : 0.14 },
      terminatorWidth: { value: appStore.isDark ? 0.14 : 0.16 },
      twinkleTime: { value: 0 },
      twinkleStrength: { value: appStore.isDark ? 0.14 : 0.08 },
    }
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>${DAY_NIGHT_SHADER_UNIFORMS}`)
      .replace('#include <map_fragment>', DAY_NIGHT_MAP_FRAGMENT)
    surfaceShaderUniforms = uniforms
  }
  globeMaterial.customProgramCacheKey = () => 'glassops-realistic-solar-v14'
  globeMaterial.needsUpdate = true
}

function createAtmosphereLayer() {
  if (!globe || !threeRuntime || !sunDirectionView)
    return

  atmosphereMaterial = new threeRuntime.ShaderMaterial({
    uniforms: {
      dayAtmosphereColor: { value: new threeRuntime.Color(appStore.isDark ? 0x93DAFF : 0x2589D8) },
      nightAtmosphereColor: { value: new threeRuntime.Color(appStore.isDark ? 0x60A5FA : 0x376F84) },
      sunDirectionView: { value: sunDirectionView },
      atmosphereIntensity: { value: appStore.isDark ? 0.58 : 0.42 },
    },
    vertexShader: ATMOSPHERE_VERTEX_SHADER,
    fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: threeRuntime.NormalBlending,
    toneMapped: false,
  })
  atmosphereMesh = new threeRuntime.Sprite(atmosphereMaterial as unknown as SpriteMaterial)
  const atmosphereDiameter = globe.getGlobeRadius() * 2.18
  atmosphereMesh.scale.set(atmosphereDiameter, atmosphereDiameter, 1)
  atmosphereMesh.name = 'glassops-gradient-atmosphere'
  atmosphereMesh.renderOrder = 4
  atmosphereMesh.frustumCulled = false
  atmosphereMesh.onBeforeRender = () => {
    if (shouldRender.value && !appStore.disablePageAnimation && surfaceShaderUniforms)
      surfaceShaderUniforms.twinkleTime.value = performance.now() / 1000
  }
  globe.scene().add(atmosphereMesh)
  globeHostRef.value?.setAttribute('data-atmosphere-model', 'solar-dual-tone-gradient')
  globeHostRef.value?.setAttribute('data-atmosphere-transmission', 'meteor-visible')
}

function applyMaterialStyle() {
  if (!globe || !globeMaterial)
    return
  const dark = appStore.isDark
  globeMaterial.bumpScale = dark ? 0.018 : 0.026
  globeMaterial.shininess = dark ? 10 : 30
  globeMaterial.emissive.set(0x000000)
  globeMaterial.emissiveIntensity = 0
  globeMaterial.specular.set(dark ? 0x587487 : 0x09131B)
  globeMaterial.needsUpdate = true
  if (surfaceShaderUniforms) {
    surfaceShaderUniforms.cityLightStrength.value = dark ? 1.82 : 1.24
    surfaceShaderUniforms.nightBaseStrength.value = dark ? 0.24 : 0.25
    surfaceShaderUniforms.nightGeographyStrength.value = dark ? 0.84 : 0.84
    surfaceShaderUniforms.daySurfaceStrength.value = dark ? 1.34 : 1.24
    surfaceShaderUniforms.dayAmbientStrength.value = dark ? 0.20 : 0.19
    surfaceShaderUniforms.dayWarmCompression.value = dark ? 0 : 1
    surfaceShaderUniforms.nightAmbientStrength.value = dark ? 0.13 : 0.14
    surfaceShaderUniforms.terminatorWidth.value = dark ? 0.14 : 0.16
    surfaceShaderUniforms.twinkleStrength.value = dark ? 0.14 : 0.08
  }
  if (ambientLight) {
    ambientLight.color.set(dark ? 0x9EC5DD : 0xE8F3FF)
    ambientLight.intensity = dark ? 0.66 : 0.82
  }
  if (hemisphereLight) {
    hemisphereLight.color.set(dark ? 0x8CC7EA : 0xEAF6FF)
    hemisphereLight.groundColor.set(dark ? 0x0B1A25 : 0x466A7F)
    hemisphereLight.intensity = dark ? 0.38 : 0.52
  }
  if (keyLight) {
    keyLight.color.set(dark ? 0xD6E9F7 : 0xFFF7ED)
    keyLight.intensity = dark ? 1.82 : 1.36
  }
  if (fillLight) {
    fillLight.color.set(dark ? 0x8FB5CC : 0xBFDBFE)
    fillLight.intensity = dark ? 0.22 : 0.30
  }
  if (rimLight) {
    rimLight.color.set(dark ? 0x22D3EE : 0x67E8F9)
    rimLight.intensity = dark ? 0.1 : 0.06
  }
  const dayAtmosphereColor = atmosphereMaterial?.uniforms.dayAtmosphereColor?.value as import('three').Color | undefined
  const nightAtmosphereColor = atmosphereMaterial?.uniforms.nightAtmosphereColor?.value as import('three').Color | undefined
  dayAtmosphereColor?.set(dark ? 0x93DAFF : 0x2589D8)
  nightAtmosphereColor?.set(dark ? 0x60A5FA : 0x376F84)
  if (atmosphereMaterial?.uniforms.atmosphereIntensity)
    atmosphereMaterial.uniforms.atmosphereIntensity.value = dark ? 0.58 : 0.42

  globe.renderer().toneMappingExposure = dark ? 1.18 : 1.00
  globeHostRef.value?.setAttribute('data-earth-phase', dark ? 'night' : 'day')
  globeHostRef.value?.setAttribute('data-lighting-model', 'solar-terminator')
  globeHostRef.value?.setAttribute('data-city-lights', 'nasa-black-marble-2016')
  globeHostRef.value?.setAttribute('data-city-light-density', 'black-marble-weighted')
  globeHostRef.value?.setAttribute('data-city-light-strength', (dark ? 1.82 : 1.24).toFixed(2))
  globeHostRef.value?.setAttribute('data-night-geography-strength', '0.84')
  globeHostRef.value?.setAttribute('data-day-surface-strength', (dark ? 1.34 : 1.24).toFixed(2))
  globeHostRef.value?.setAttribute('data-day-warm-compression', dark ? '0.00' : '1.00')
  globeHostRef.value?.setAttribute('data-light-ocean-specular', dark ? 'standard' : 'suppressed')
  globeHostRef.value?.setAttribute('data-dark-atmosphere-halo', dark ? 'enhanced' : 'minimal')
  globeHostRef.value?.setAttribute('data-atmosphere-day-color', dark ? '#93daff' : '#2589d8')
  globeHostRef.value?.setAttribute('data-atmosphere-night-color', dark ? '#60a5fa' : '#376f84')
  globeHostRef.value?.setAttribute('data-solar-refresh-ms', String(SOLAR_REFRESH_MS))
  globe
    .pointColor(pointColor)
    .ringColor(() => dark ? 'rgba(45, 212, 191, 0.34)' : 'rgba(14, 165, 233, 0.28)')
  syncSolarLighting()
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

    threeRuntime = THREE
    sunDirectionWorld = new THREE.Vector3(0, 0, 1)
    sunDirectionView = new THREE.Vector3(0, 0, 1)
    const textureLoader = new THREE.TextureLoader()
    nightTexture = textureLoader.load(EARTH_NIGHT_TEXTURE)
    nightTexture.colorSpace = THREE.SRGBColorSpace
    waterSpecularMap = textureLoader.load(EARTH_SPECULAR_MAP)
    waterSpecularMap.colorSpace = THREE.NoColorSpace

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
      .globeImageUrl(EARTH_DAY_TEXTURE)
      .bumpImageUrl(EARTH_BUMP_MAP)
      .showAtmosphere(false)
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
      .onZoom(() => syncSolarLighting())
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
        syncSolarLighting()
      })

    const renderer = globe.renderer()
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = appStore.isDark ? 1.18 : 1.00
    renderer.domElement.style.background = 'transparent'

    const material = globe.globeMaterial()
    if ('shininess' in material) {
      globeMaterial = material as MeshPhongMaterial
      globeMaterial.specularMap = waterSpecularMap
      globeMaterial.specular = new THREE.Color(appStore.isDark ? 0x657C91 : 0x5B7185)
      configureSurfaceShader()
    }

    ambientLight = new THREE.AmbientLight(0xE8F3FF, 1.08)
    hemisphereLight = new THREE.HemisphereLight(
      0xEAF6FF,
      0x284657,
      0.86,
    )
    keyLight = new THREE.DirectionalLight(0xFFF7ED, 1.34)
    fillLight = new THREE.DirectionalLight(0xBFDBFE, 0.62)
    fillLight.position.set(-1.25, 0.15, 1.05)
    rimLight = new THREE.DirectionalLight(0x67E8F9, 0.14)
    rimLight.position.set(-1.1, 0.55, -1.55)
    globe.lights([ambientLight, hemisphereLight, keyLight, fillLight, rimLight])

    createAtmosphereLayer()
    applyMaterialStyle()
    applyControls()
    resetPointOfView(0)
    startSolarUpdates()
    syncTwinkleAnimation()
  }
  finally {
    loadingGlobe = false
  }
}

function stopGlobe() {
  if (!globe)
    return

  stopSolarUpdates()
  if (atmosphereMesh)
    globe.scene().remove(atmosphereMesh)
  atmosphereMaterial?.dispose()
  atmosphereMesh = null
  atmosphereMaterial = null

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
  globeHostRef.value?.removeAttribute('data-lighting-model')
  globeHostRef.value?.removeAttribute('data-city-lights')
  globeHostRef.value?.removeAttribute('data-city-light-density')
  globeHostRef.value?.removeAttribute('data-city-light-strength')
  globeHostRef.value?.removeAttribute('data-atmosphere-model')
  globeHostRef.value?.removeAttribute('data-atmosphere-transmission')
  globeHostRef.value?.removeAttribute('data-subsolar-lat')
  globeHostRef.value?.removeAttribute('data-subsolar-lng')
  globeHostRef.value?.removeAttribute('data-sun-view')
  globeHostRef.value?.removeAttribute('data-night-geography-strength')
  globeHostRef.value?.removeAttribute('data-day-surface-strength')
  globeHostRef.value?.removeAttribute('data-day-warm-compression')
  globeHostRef.value?.removeAttribute('data-light-ocean-specular')
  globeHostRef.value?.removeAttribute('data-dark-atmosphere-halo')
  globeHostRef.value?.removeAttribute('data-atmosphere-day-color')
  globeHostRef.value?.removeAttribute('data-atmosphere-night-color')
  globeHostRef.value?.removeAttribute('data-visible-earth-radius')
  globeHostRef.value?.removeAttribute('data-atmosphere-halo-width')
  globeHostRef.value?.removeAttribute('data-solar-refresh-ms')
  globeHostRef.value?.removeAttribute('data-city-twinkle')
  globeMaterial = null
  surfaceShaderUniforms = null
  ambientLight = null
  hemisphereLight = null
  keyLight = null
  fillLight = null
  rimLight = null
  waterSpecularMap?.dispose()
  waterSpecularMap = null
  nightTexture?.dispose()
  nightTexture = null
  sunDirectionWorld = null
  sunDirectionView = null
  threeRuntime = null
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

watch(() => appStore.disablePageAnimation, () => {
  syncTwinkleAnimation()
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
    syncSolarLighting()
    syncTwinkleAnimation()
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

.realistic-earth-shell::after {
  position: absolute;
  z-index: 17;
  top: 50%;
  left: 50%;
  width: var(--earth-halo-diameter, 108%);
  height: var(--earth-halo-diameter, 108%);
  border-radius: 50%;
  background: linear-gradient(
    var(--earth-atmosphere-angle, 90deg),
    var(--earth-atmosphere-night, rgb(96 165 250 / 0.32)) 0%,
    var(--earth-atmosphere-day, rgb(147 218 255 / 0.4)) 100%
  );
  content: '';
  filter: blur(10px) saturate(0.9);
  -webkit-mask: radial-gradient(
    circle at center,
    transparent 0 var(--earth-halo-inner-radius, 222px),
    rgb(0 0 0 / 0.4) var(--earth-visible-radius, 230px),
    rgb(0 0 0 / 0.76) var(--earth-halo-contact-radius, 232px),
    rgb(0 0 0 / 0.44) var(--earth-halo-shoulder-radius, 242px),
    rgb(0 0 0 / 0.16) var(--earth-halo-fade-radius, 252px),
    transparent var(--earth-halo-outer-radius, 262px)
  );
  mask: radial-gradient(
    circle at center,
    transparent 0 var(--earth-halo-inner-radius, 222px),
    rgb(0 0 0 / 0.4) var(--earth-visible-radius, 230px),
    rgb(0 0 0 / 0.76) var(--earth-halo-contact-radius, 232px),
    rgb(0 0 0 / 0.44) var(--earth-halo-shoulder-radius, 242px),
    rgb(0 0 0 / 0.16) var(--earth-halo-fade-radius, 252px),
    transparent var(--earth-halo-outer-radius, 262px)
  );
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 420ms ease;
}

:global(.dark .realistic-earth-shell::after) {
  opacity: 1;
}

.earth-globe-host :deep(canvas) {
  background: transparent !important;
  filter: saturate(0.99) contrast(1.005) brightness(1);
  outline: none;
}

:global(.dark .earth-globe-host canvas) {
  filter: saturate(1.1) contrast(1.02) brightness(1.05);
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

.realistic-earth-shell :deep(.earth-meteor-overlay) {
  z-index: 18;
  isolation: isolate;
}
</style>
