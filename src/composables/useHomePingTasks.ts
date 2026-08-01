import type { MaybeRefOrGetter } from 'vue'
import type { PingTaskInfo } from '@/utils/rpc'
import { computed, ref, shallowRef, toValue } from 'vue'
import { invalidatePublicPingTasks, loadPublicPingTasks } from '@/services/metrics.service'
import { useAppStore } from '@/stores/app'
import { getApplicableHomePingTasks, getEffectiveHomePingTaskIds } from '@/utils/homePingConfig'

const sharedTasks = shallowRef<PingTaskInfo[]>([])
const sharedLoading = ref(false)
const sharedError = ref<string | null>(null)
let sharedPromise: Promise<PingTaskInfo[]> | null = null

async function loadSharedTasks(force = false): Promise<PingTaskInfo[]> {
  if (force)
    invalidatePublicPingTasks()

  if (sharedPromise)
    return sharedPromise

  sharedLoading.value = true
  sharedError.value = null
  sharedPromise = loadPublicPingTasks()
    .then((tasks) => {
      sharedTasks.value = tasks
      return tasks
    })
    .catch((error) => {
      sharedError.value = error instanceof Error ? error.message : '获取延迟任务失败'
      throw error
    })
    .finally(() => {
      sharedLoading.value = false
      sharedPromise = null
    })

  return sharedPromise
}

export function usePublicHomePingTasks() {
  if (!sharedTasks.value.length)
    void loadSharedTasks().catch(() => {})

  return {
    tasks: sharedTasks,
    loading: sharedLoading,
    error: sharedError,
    refresh: () => loadSharedTasks(true),
  }
}

export function useNodeHomePingTasks(uuid: MaybeRefOrGetter<string>) {
  const appStore = useAppStore()
  const publicTasks = usePublicHomePingTasks()

  const applicableTasks = computed(() => getApplicableHomePingTasks(publicTasks.tasks.value, toValue(uuid)))
  const selectedTaskIds = computed(() => {
    return getEffectiveHomePingTaskIds(
      appStore.homePingTaskSelections,
      toValue(uuid),
      publicTasks.tasks.value,
    )
  })
  const selectedTasks = computed(() => {
    const tasksById = new Map(applicableTasks.value.map(task => [task.id, task]))
    return selectedTaskIds.value.flatMap(taskId => tasksById.get(taskId) ?? [])
  })

  return {
    ...publicTasks,
    applicableTasks,
    selectedTaskIds,
    selectedTasks,
  }
}
