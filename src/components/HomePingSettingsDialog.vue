<script setup lang="ts">
import type { HomePingTaskSelections } from '@/utils/homePingConfig'
import type { PingTaskInfo } from '@/utils/rpc'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { AppDialog } from '@/components/ui/app-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePublicHomePingTasks } from '@/composables/useHomePingTasks'
import { saveHomePingTaskSelections } from '@/services/theme-settings.service'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import {
  getApplicableHomePingTasks,
  getEffectiveHomePingTaskIds,
  HOME_PING_MAX_TASKS,
  sanitizeHomePingTaskSelections,
} from '@/utils/homePingConfig'
import { getRegionDisplayName } from '@/utils/regionHelper'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const appStore = useAppStore()
const nodesStore = useNodesStore()
const { tasks, loading: tasksLoading, error: tasksError, refresh } = usePublicHomePingTasks()

const nodeSearch = ref('')
const taskSearch = ref('')
const selectedUuid = ref('')
const draftSelections = ref<HomePingTaskSelections>({})
const checkingPermission = ref(false)
const saving = ref(false)
const dialogError = ref<string | null>(null)

const publicNodes = computed(() => {
  return nodesStore.nodes
    .filter(node => !node.hidden)
    .slice()
    .sort((left, right) => left.weight - right.weight || left.name.localeCompare(right.name))
})

const filteredNodes = computed(() => {
  const keyword = nodeSearch.value.trim().toLowerCase()
  if (!keyword)
    return publicNodes.value
  return publicNodes.value.filter((node) => {
    const region = getRegionDisplayName(node.region)
    return [node.name, node.os, node.arch, region, node.region]
      .some(value => value?.toLowerCase().includes(keyword))
  })
})

const currentNode = computed(() => publicNodes.value.find(node => node.uuid === selectedUuid.value) ?? null)
const currentApplicableTasks = computed(() => getApplicableHomePingTasks(tasks.value, selectedUuid.value))
const currentSelectedIds = computed(() => {
  return getEffectiveHomePingTaskIds(draftSelections.value, selectedUuid.value, tasks.value)
})
const currentSelectedTasks = computed(() => {
  const tasksById = new Map(currentApplicableTasks.value.map(task => [task.id, task]))
  return currentSelectedIds.value.flatMap(taskId => tasksById.get(taskId) ?? [])
})
const filteredAvailableTasks = computed(() => {
  const keyword = taskSearch.value.trim().toLowerCase()
  const selected = new Set(currentSelectedIds.value)
  return currentApplicableTasks.value.filter((task) => {
    if (selected.has(task.id))
      return false
    if (!keyword)
      return true
    return [task.name, task.type, String(task.id)]
      .some(value => value?.toLowerCase().includes(keyword))
  })
})
const currentHasOverride = computed(() => {
  return Boolean(selectedUuid.value)
    && Object.hasOwn(draftSelections.value, selectedUuid.value)
})

function cloneSelections(value: HomePingTaskSelections): HomePingTaskSelections {
  return Object.fromEntries(Object.entries(value).map(([uuid, taskIds]) => [uuid, [...taskIds]]))
}

function setCurrentSelection(taskIds: number[]) {
  if (!selectedUuid.value)
    return
  draftSelections.value = {
    ...draftSelections.value,
    [selectedUuid.value]: taskIds.slice(0, HOME_PING_MAX_TASKS),
  }
}

function selectNode(uuid: string) {
  selectedUuid.value = uuid
  taskSearch.value = ''
}

function selectTask(task: PingTaskInfo) {
  if (currentSelectedIds.value.length >= HOME_PING_MAX_TASKS)
    return
  setCurrentSelection([...currentSelectedIds.value, task.id])
}

function removeTask(taskId: number) {
  setCurrentSelection(currentSelectedIds.value.filter(id => id !== taskId))
}

function moveTask(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= currentSelectedIds.value.length)
    return
  const next = [...currentSelectedIds.value]
  const current = next[index]
  const target = next[nextIndex]
  if (current === undefined || target === undefined)
    return
  next[index] = target
  next[nextIndex] = current
  setCurrentSelection(next)
}

function pinTask(index: number) {
  if (index <= 0 || index >= currentSelectedIds.value.length)
    return

  const next = [...currentSelectedIds.value]
  const [taskId] = next.splice(index, 1)
  if (taskId === undefined)
    return
  next.unshift(taskId)
  setCurrentSelection(next)
}

function clearCurrentNode() {
  setCurrentSelection([])
}

function resetAllToThemeDefault() {
  draftSelections.value = {}
}

function closeDialog() {
  if (!saving.value)
    emit('update:open', false)
}

async function prepareDialog() {
  checkingPermission.value = true
  dialogError.value = null
  try {
    const granted = await appStore.requireLoginPermission('themeConfiguration', { force: true })
    if (!granted) {
      window.$message?.warning('登录状态已过期，请重新登录后配置首页延迟监控。')
      emit('update:open', false)
      return
    }

    await refresh()
    draftSelections.value = cloneSelections(sanitizeHomePingTaskSelections(
      appStore.homePingTaskSelections,
      publicNodes.value.map(node => node.uuid),
      tasks.value,
    ))
    if (!publicNodes.value.some(node => node.uuid === selectedUuid.value))
      selectedUuid.value = publicNodes.value[0]?.uuid ?? ''
  }
  catch (error) {
    dialogError.value = error instanceof Error ? error.message : '加载延迟配置失败'
  }
  finally {
    checkingPermission.value = false
  }
}

async function saveSettings() {
  if (saving.value)
    return

  saving.value = true
  dialogError.value = null
  try {
    const granted = await appStore.requireLoginPermission('themeConfiguration', { force: true })
    if (!granted)
      throw new Error('登录状态已过期，请重新登录后保存。')

    const theme = appStore.publicSettings?.theme ?? ''
    const sanitized = sanitizeHomePingTaskSelections(
      draftSelections.value,
      publicNodes.value.map(node => node.uuid),
      tasks.value,
    )
    appStore.publicSettings = await saveHomePingTaskSelections(theme, sanitized)
    draftSelections.value = cloneSelections(sanitized)
    window.$message?.success('首页延迟监控配置已全站生效。')
    emit('update:open', false)
  }
  catch (error) {
    dialogError.value = error instanceof Error ? error.message : '保存失败'
    window.$message?.error(dialogError.value)
  }
  finally {
    saving.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open)
      void prepareDialog()
  },
  { immediate: true },
)
</script>

<template>
  <AppDialog
    :open="open"
    title="首页延迟监控"
    description="为每台公开服务器选择 0–3 个现有 Ping 任务，保存后对全站访客生效。"
    content-class="max-w-6xl"
    body-class="!p-0"
    mobile-fullscreen
    @update:open="!$event && closeDialog()"
  >
    <div v-if="checkingPermission" class="flex min-h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Icon icon="tabler:loader-2" width="18" height="18" class="animate-spin" />
      正在验证管理员权限…
    </div>

    <div v-else class="grid min-h-0 sm:h-[min(70dvh,46rem)] sm:grid-cols-[16rem_minmax(0,1fr)]">
      <aside class="flex min-h-0 flex-col border-b border-border/60 bg-background/15 sm:border-r sm:border-b-0">
        <div class="space-y-2 border-b border-border/60 p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold">公开服务器</span>
            <span class="text-[10px] text-muted-foreground">{{ publicNodes.length }} 台</span>
          </div>
          <div class="relative">
            <Input
              v-model="nodeSearch"
              placeholder="搜索服务器名称、地区或系统"
              aria-label="搜索服务器"
              class="h-10 border-white/10 bg-background/35 pl-9 text-xs"
            />
            <Icon icon="tabler:search" width="15" height="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <div class="max-h-52 min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-none">
          <button
            v-for="node in filteredNodes"
            :key="node.uuid"
            type="button"
            class="mb-1 flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-background/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="selectedUuid === node.uuid ? 'bg-selection/12 text-foreground ring-1 ring-selection/30' : 'text-muted-foreground'"
            @click="selectNode(node.uuid)"
          >
            <span class="size-2 shrink-0 rounded-full" :class="node.online ? 'bg-success' : 'bg-destructive'" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold">{{ node.name }}</span>
              <span class="block truncate text-[10px]">{{ getRegionDisplayName(node.region) || node.os || '未设置地区' }}</span>
            </span>
            <span class="rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] tabular-nums">
              {{ getEffectiveHomePingTaskIds(draftSelections, node.uuid, tasks).length }}/3
            </span>
          </button>
          <p v-if="!filteredNodes.length" class="px-3 py-8 text-center text-xs text-muted-foreground">
            没有匹配的公开服务器
          </p>
        </div>
      </aside>

      <section class="min-w-0 p-3 sm:overflow-y-auto sm:p-4">
        <div v-if="dialogError" class="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {{ dialogError }}
        </div>
        <div v-if="currentNode" class="space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/10 bg-background/20 p-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="truncate text-sm font-semibold">
                  {{ currentNode.name }}
                </h3>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px]"
                  :class="currentHasOverride ? 'bg-selection/12 text-selection' : 'bg-slate-500/10 text-muted-foreground'"
                >
                  {{ currentHasOverride ? '自定义' : '主题默认' }}
                </span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                未自定义时自动读取该服务器前三个适用任务；清空后不显示 TCPing 区域。
              </p>
            </div>
            <Button variant="outline" size="sm" class="min-h-10 shrink-0 bg-background/20" @click="clearCurrentNode">
              <Icon icon="tabler:eraser" width="15" height="15" />
              清空本机
            </Button>
          </div>

          <div>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="text-xs font-semibold">
                  已选任务
                </h4>
                <span class="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  <Icon icon="tabler:alert-circle" width="13" height="13" />
                  mini 卡片仅显示第 1 个任务的延迟与丢包
                </span>
              </div>
              <span class="text-[10px] text-muted-foreground">{{ currentSelectedTasks.length }}/{{ HOME_PING_MAX_TASKS }}</span>
            </div>
            <div class="space-y-2">
              <div
                v-for="(task, index) in currentSelectedTasks"
                :key="task.id"
                data-testid="selected-home-ping-task"
                :data-task-id="task.id"
                class="flex min-h-14 items-center gap-3 rounded-lg border border-selection/20 bg-selection/7 px-3 py-2"
              >
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-selection text-xs font-bold text-background">
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-semibold">{{ task.name }}</span>
                  <span class="mt-0.5 block text-[10px] text-muted-foreground">{{ (task.type || 'ping').toUpperCase() }} · #{{ task.id }}</span>
                </span>
                <div class="flex shrink-0 items-center">
                  <button
                    type="button"
                    class="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-selection/10 hover:text-selection disabled:cursor-not-allowed disabled:text-muted-foreground/30 disabled:opacity-60"
                    :aria-label="`置顶任务 ${task.name}`"
                    :title="index === 0 ? '已是第 1 个任务' : '置顶为第 1 个任务'"
                    :disabled="index === 0"
                    @click="pinTask(index)"
                  >
                    <Icon icon="tabler:pin" width="16" height="16" />
                  </button>
                  <button
                    type="button"
                    class="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-background/30 disabled:opacity-25"
                    aria-label="上移任务"
                    :disabled="index === 0"
                    @click="moveTask(index, -1)"
                  >
                    <Icon icon="tabler:arrow-up" width="16" height="16" />
                  </button>
                  <button
                    type="button"
                    class="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-background/30 disabled:opacity-25"
                    aria-label="下移任务"
                    :disabled="index === currentSelectedTasks.length - 1"
                    @click="moveTask(index, 1)"
                  >
                    <Icon icon="tabler:arrow-down" width="16" height="16" />
                  </button>
                  <button
                    type="button"
                    class="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="删除任务"
                    @click="removeTask(task.id)"
                  >
                    <Icon icon="tabler:x" width="16" height="16" />
                  </button>
                </div>
              </div>
              <div v-if="!currentSelectedTasks.length" class="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-muted-foreground">
                该服务器的首页 TCPing 区域已隐藏
              </div>
            </div>
          </div>

          <div>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 class="text-xs font-semibold">
                可选任务
              </h4>
              <div class="relative w-full sm:w-72">
                <Input
                  v-model="taskSearch"
                  placeholder="搜索任务名称、类型或 ID"
                  aria-label="搜索延迟任务"
                  class="h-10 border-white/10 bg-background/25 pl-9 text-xs"
                />
                <Icon icon="tabler:search" width="15" height="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div v-if="tasksLoading" class="flex items-center gap-2 py-8 text-xs text-muted-foreground">
              <Icon icon="tabler:loader-2" width="16" height="16" class="animate-spin" />
              正在读取 Komari Ping 任务…
            </div>
            <div v-else-if="tasksError" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {{ tasksError }}
            </div>
            <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                v-for="task in filteredAvailableTasks"
                :key="task.id"
                type="button"
                class="flex min-h-14 items-center gap-3 rounded-lg border border-white/10 bg-background/15 px-3 py-2 text-left transition-colors hover:border-selection/35 hover:bg-selection/7 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="currentSelectedTasks.length >= HOME_PING_MAX_TASKS"
                @click="selectTask(task)"
              >
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-500/10 text-selection">
                  <Icon icon="tabler:activity-heartbeat" width="17" height="17" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-semibold">{{ task.name }}</span>
                  <span class="mt-0.5 block text-[10px] text-muted-foreground">{{ (task.type || 'ping').toUpperCase() }} · #{{ task.id }}</span>
                </span>
                <Icon icon="tabler:plus" width="16" height="16" class="shrink-0 text-muted-foreground" />
              </button>
              <p v-if="!filteredAvailableTasks.length" class="col-span-full px-3 py-8 text-center text-xs text-muted-foreground">
                {{ currentApplicableTasks.length ? '没有更多匹配任务' : '该服务器没有适用的 Ping 任务' }}
              </p>
            </div>
          </div>
        </div>
        <div v-else class="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
          请选择一台公开服务器
        </div>
      </section>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" class="min-h-11 px-3 text-muted-foreground" :disabled="saving" @click="resetAllToThemeDefault">
          <Icon icon="tabler:restore" width="16" height="16" />
          恢复主题默认
        </Button>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="ghost" class="min-h-11 px-4" :disabled="saving" @click="closeDialog">
            取消
          </Button>
          <Button class="min-h-11 px-5" :disabled="saving || checkingPermission" @click="saveSettings">
            <Icon v-if="saving" icon="tabler:loader-2" width="16" height="16" class="animate-spin" />
            <Icon v-else icon="tabler:device-floppy" width="16" height="16" />
            {{ saving ? '保存中' : '保存' }}
          </Button>
        </div>
      </div>
    </template>
  </AppDialog>
</template>
