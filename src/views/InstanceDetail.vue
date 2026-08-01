<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardX } from '@/components/ui/card-x'
import { Empty } from '@/components/ui/empty'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getPassMarkCpuLookupUrl } from '@/utils/cpuBenchmark'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat } from '@/utils/helper'
import { getTrafficUsed, hasTrafficLimit } from '@/utils/nodeMetricsHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { parseTags } from '@/utils/tagHelper'

const LoadChart = defineAsyncComponent(() => import('@/components/LoadChart.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const nodesStore = useNodesStore()
const activeDetailSection = ref<'load' | 'ping'>('ping')
const data = computed(() => nodesStore.visibleNodesByUuid.get(String(route.params.id)))
const detailNodes = computed(() => nodesStore.visibleNodes)
const detailNodeIndex = computed(() => detailNodes.value.findIndex(node => node.uuid === data.value?.uuid))
const isFavoriteNode = computed(() => data.value ? appStore.isFavoriteNode(data.value.uuid) : false)
const cpuBenchmarkUrl = computed(() => getPassMarkCpuLookupUrl(data.value?.cpu_name ?? ''))

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'minute')
const getRegionAltText = (region: string) => getRegionDisplayName(region) || getRegionCode(region)
const customTags = computed(() => parseTags(data.value?.tags).map(tag => tag.text))
const ipSupport = computed(() => {
  const protocols: string[] = []
  if (data.value?.ipv4)
    protocols.push('IPv4')
  if (data.value?.ipv6)
    protocols.push('IPv6')
  return protocols
})

interface InfoItem {
  label: string
  value: string
  icon: string
  wide?: boolean
}

const hardwareInfo = computed<InfoItem[]>(() => {
  const node = data.value
  if (!node)
    return []

  const items: InfoItem[] = [
    {
      label: 'CPU',
      value: `${node.cpu_name || '-'}${node.cpu_cores > 0 ? ` (x${node.cpu_cores})` : ''}`,
      icon: 'tabler:cpu',
    },
    { label: '架构', value: node.arch || '-', icon: 'tabler:binary-tree' },
    { label: '虚拟化', value: node.virtualization || '-', icon: 'tabler:server-2' },
  ]

  if ((node.cpu_physical_cores ?? 0) > 0) {
    items.push({
      label: '物理核心',
      value: `${node.cpu_physical_cores} 核`,
      icon: 'tabler:cpu-2',
    })
  }

  const gpuName = node.gpu_name?.trim()
  if (gpuName && gpuName.toLowerCase() !== 'none')
    items.push({ label: 'GPU', value: gpuName, icon: 'tabler:device-desktop-analytics', wide: true })

  return items
})

const systemInfo = computed<InfoItem[]>(() => {
  const node = data.value
  if (!node)
    return []

  return [
    { label: '操作系统', value: getOSName(node.os), icon: 'tabler:device-desktop' },
    { label: '内核版本', value: node.kernel_version || '-', icon: 'tabler:code' },
    { label: '运行时间', value: formatUptime(node.uptime ?? 0), icon: 'tabler:clock-up' },
    {
      label: '最后上报',
      value: node.status_updated_at || node.time
        ? formatDateTime(node.status_updated_at || node.time)
        : '-',
      icon: 'tabler:clock-check',
    },
  ]
})

const storageInfo = computed<InfoItem[]>(() => {
  const node = data.value
  if (!node)
    return []

  return [
    { label: '内存', value: formatBytes(node.mem_total ?? 0), icon: 'tabler:device-sd-card' },
    { label: '交换内存', value: formatBytes(node.swap_total ?? 0), icon: 'tabler:switch-3' },
    { label: '硬盘', value: formatBytes(node.disk_total ?? 0), icon: 'tabler:server-2' },
  ]
})

const networkInfo = computed<InfoItem[]>(() => {
  const node = data.value
  if (!node)
    return []

  const trafficUsed = getTrafficUsed(node)
  const trafficLimit = hasTrafficLimit(node) ? formatBytes(node.traffic_limit) : '∞'

  return [
    {
      label: '总流量',
      value: `↑ ${formatBytes(node.net_total_up ?? 0)}  ↓ ${formatBytes(node.net_total_down ?? 0)} · ${formatBytes(trafficUsed)} / ${trafficLimit}`,
      icon: 'tabler:arrows-transfer-up-down',
    },
    {
      label: '网络速率',
      value: `↑ ${formatBytesPerSecond(node.net_out ?? 0)}  ↓ ${formatBytesPerSecond(node.net_in ?? 0)}`,
      icon: 'tabler:gauge',
    },
  ]
})

function navigateDetailNode(offset: number): void {
  const nodes = detailNodes.value
  const index = detailNodeIndex.value
  if (nodes.length < 2 || index < 0)
    return
  const target = nodes[(index + offset + nodes.length) % nodes.length]
  if (target)
    void router.push({ name: 'instance-detail', params: { id: target.uuid } })
}

function selectDetailNode(event: Event): void {
  const uuid = (event.target as HTMLSelectElement).value
  if (uuid && uuid !== data.value?.uuid)
    void router.push({ name: 'instance-detail', params: { id: uuid } })
}

function toggleCurrentFavorite(): void {
  if (data.value)
    appStore.toggleFavoriteNode(data.value.uuid)
}

watch(data, () => {
  activeDetailSection.value = 'ping'
}, { immediate: true })
</script>

<template>
  <div class="instance-detail space-y-4 pb-6">
    <div v-if="!data" class="p-4">
      <CardX>
        <Empty description="节点不存在或已被删除">
          <template #extra>
            <Button @click="router.push('/')">
              返回首页
            </Button>
          </template>
        </Empty>
      </CardX>
    </div>

    <template v-else>
      <header class="mx-4 flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-card/45 p-3 shadow-[0_20px_55px_-38px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-4">
        <Button variant="ghost" size="icon-sm" class="shrink-0 bg-background/35 hover:bg-background/65" aria-label="返回首页" @click="router.push('/')">
          <Icon icon="tabler:arrow-left" width="16" height="16" />
        </Button>
        <img
          v-if="data.region"
          :src="`/images/flags/${getRegionCode(data.region)}.svg`"
          :alt="getRegionAltText(data.region)"
          class="h-8 w-11 shrink-0 rounded object-cover shadow-sm"
        >
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <h1 class="min-w-0 truncate text-lg font-bold tracking-tight sm:text-xl">
              {{ data.name }}
            </h1>
            <Badge :variant="data.online ? 'default' : 'destructive'" class="shrink-0 !rounded-md text-[11px]">
              {{ data.online ? '在线' : '离线' }}
            </Badge>
          </div>
          <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
            <img :src="getOSImage(data.os)" :alt="getOSName(data.os)" class="size-3.5 shrink-0">
            <span class="truncate">{{ getOSName(data.os) }}</span>
            <span aria-hidden="true">·</span>
            <span class="shrink-0">{{ data.arch || '-' }}</span>
          </div>
        </div>
        <div v-if="ipSupport.length || customTags.length" class="flex max-w-full flex-wrap justify-end gap-1">
          <Badge
            v-for="protocol in ipSupport"
            :key="protocol"
            variant="outline"
            class="rounded-md border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0 text-[10px] text-emerald-300"
          >
            {{ protocol }}
          </Badge>
          <Badge
            v-for="tag in customTags"
            :key="tag"
            variant="outline"
            class="rounded-md border-white/10 px-1.5 py-0 text-[10px] text-muted-foreground"
          >
            {{ tag }}
          </Badge>
        </div>
        <div class="ml-auto flex max-w-full items-center gap-0.5 rounded-lg bg-background/35 p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            class="size-7 shrink-0 rounded-md shadow-none"
            :class="isFavoriteNode && 'text-amber-500'"
            :aria-label="isFavoriteNode ? '取消收藏当前节点' : '收藏当前节点'"
            :title="isFavoriteNode ? '取消收藏' : '收藏节点'"
            @click="toggleCurrentFavorite"
          >
            <Icon :icon="isFavoriteNode ? 'tabler:star-filled' : 'tabler:star'" width="14" height="14" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="size-7 shrink-0 rounded-md shadow-none"
            :disabled="detailNodes.length < 2"
            aria-label="上一个节点"
            title="上一个节点"
            @click="navigateDetailNode(-1)"
          >
            <Icon icon="tabler:chevron-left" width="14" height="14" />
          </Button>
          <select
            :value="data.uuid"
            class="h-7 min-w-0 max-w-34 rounded-md border-0 bg-transparent px-1 text-xs text-foreground outline-none sm:max-w-48"
            aria-label="切换节点"
            @change="selectDetailNode"
          >
            <option v-for="node in detailNodes" :key="node.uuid" :value="node.uuid">
              {{ node.name }}
            </option>
          </select>
          <Button
            variant="ghost"
            size="icon-sm"
            class="size-7 shrink-0 rounded-md shadow-none"
            :disabled="detailNodes.length < 2"
            aria-label="下一个节点"
            title="下一个节点"
            @click="navigateDetailNode(1)"
          >
            <Icon icon="tabler:chevron-right" width="14" height="14" />
          </Button>
        </div>
      </header>

      <section class="grid grid-cols-1 gap-3 px-4 lg:grid-cols-2">
        <CardX title="硬件信息" size="small" class="h-full rounded-xl border-white/9 bg-card/42">
          <div class="grid grid-cols-1 gap-x-5 gap-y-4 min-[390px]:grid-cols-2">
            <div
              v-for="item in hardwareInfo"
              :key="item.label"
              class="min-w-0"
              :class="item.wide && 'min-[390px]:col-span-2'"
            >
              <div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon :icon="item.icon" width="14" height="14" />
                <span>{{ item.label }}</span>
                <a
                  v-if="item.label === 'CPU'"
                  :href="cpuBenchmarkUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors hover:bg-background/60 hover:text-foreground"
                  title="在 PassMark 查询该 CPU 的公开 CPU Mark 跑分与排行"
                  @click.stop
                >
                  CPU Mark
                  <Icon icon="tabler:external-link" width="10" height="10" />
                </a>
              </div>
              <div class="break-words text-sm font-medium text-foreground/90">
                {{ item.value }}
              </div>
            </div>
          </div>
        </CardX>

        <CardX title="系统信息" size="small" class="h-full rounded-xl border-white/9 bg-card/42">
          <div class="grid grid-cols-1 gap-x-5 gap-y-4 min-[390px]:grid-cols-2">
            <div v-for="item in systemInfo" :key="item.label" class="min-w-0">
              <div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon :icon="item.icon" width="14" height="14" />
                <span>{{ item.label }}</span>
              </div>
              <div class="flex min-w-0 items-center gap-2 break-words text-sm font-medium text-foreground/90">
                <img v-if="item.label === '操作系统'" :src="getOSImage(data.os)" :alt="getOSName(data.os)" class="size-5 shrink-0">
                <span class="break-words">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </CardX>

        <CardX title="存储信息" size="small" class="h-full rounded-xl border-white/9 bg-card/42">
          <div class="grid grid-cols-1 gap-x-5 gap-y-4 min-[390px]:grid-cols-3">
            <div v-for="item in storageInfo" :key="item.label" class="min-w-0">
              <div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon :icon="item.icon" width="14" height="14" />
                <span>{{ item.label }}</span>
              </div>
              <div class="break-words text-sm font-medium text-foreground/90">
                {{ item.value }}
              </div>
            </div>
          </div>
        </CardX>

        <CardX title="网络信息" size="small" class="h-full rounded-xl border-white/9 bg-card/42">
          <div class="grid grid-cols-1 gap-x-5 gap-y-4 min-[390px]:grid-cols-2">
            <div v-for="item in networkInfo" :key="item.label" class="min-w-0">
              <div class="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon :icon="item.icon" width="14" height="14" />
                <span>{{ item.label }}</span>
              </div>
              <div class="break-words text-sm font-medium leading-relaxed text-foreground/90">
                {{ item.value }}
              </div>
            </div>
          </div>
        </CardX>
      </section>

      <Tabs v-model="activeDetailSection" class="px-4">
        <TabsList class="grid h-12 w-full grid-cols-2 gap-1 rounded-xl border-0 bg-card/48 p-1.5 shadow-inner backdrop-blur-xl">
          <TabsTrigger
            value="ping"
            class="detail-section-trigger h-9 rounded-lg !border-0 bg-transparent text-xs font-semibold text-muted-foreground shadow-none ring-0 transition-colors data-[state=active]:ring-0"
          >
            <Icon icon="tabler:timeline" width="14" height="14" />
            延迟
          </TabsTrigger>
          <TabsTrigger
            value="load"
            class="detail-section-trigger h-9 rounded-lg !border-0 bg-transparent text-xs font-semibold text-muted-foreground shadow-none ring-0 transition-colors data-[state=active]:ring-0"
          >
            <Icon icon="tabler:activity" width="14" height="14" />
            负载
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <PingChart v-if="activeDetailSection === 'ping'" :uuid="data.uuid" class="px-4" />
      <LoadChart v-else :uuid="data.uuid" class="px-4" />
    </template>
  </div>
</template>
