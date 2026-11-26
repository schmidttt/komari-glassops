import type { MaybeRefOrGetter } from 'vue'
import type { PingComparisonRange } from '@/services/ping-comparison.service'
import { computed, ref, shallowRef, toValue, watch } from 'vue'
import { usePublicHomePingTasks } from '@/composables/useHomePingTasks'
import { loadPingComparison } from '@/services/ping-comparison.service'
import { useAppStore } from '@/stores/app'
import { getApplicableHomePingTasks } from '@/utils/homePingConfig'

type ComparisonWindow = '1' | '6' | '24' | 'custom'
const HOUR_MS = 3_600_000

export function usePingComparison(nodeIds: MaybeRefOrGetter<readonly string[]>) {
  const appStore = useAppStore()
  const catalog = usePublicHomePingTasks()
  const commonTasks = computed(() => {
    const ids = toValue(nodeIds)
    if (ids.length < 2)
      return []
    const [first, ...otherIds] = ids
    return getApplicableHomePingTasks(catalog.tasks.value, first!)
      .filter(task => otherIds.every(id => task.clients?.includes(id)))
  })
  const selectedTaskId = ref('')
  const selectedWindow = ref<ComparisonWindow>('6')
  const startInput = ref('')
  const endInput = ref('')
  const customRange = shallowRef<PingComparisonRange | null>(null)
  const customError = ref('')
  const shownRange = shallowRef<PingComparisonRange | null>(null)
  const refreshKey = ref(0)
  const loading = ref(false)
  const error = ref('')
  const result = shallowRef<Awaited<ReturnType<typeof loadPingComparison>> | null>(null)
  const retentionHours = computed(() => appStore.publicSettings?.ping_record_preserve_time || 720)
  const nodeKey = computed(() => JSON.stringify(toValue(nodeIds)))

  watch(commonTasks, (tasks) => {
    if (!tasks.some(task => String(task.id) === selectedTaskId.value))
      selectedTaskId.value = tasks.length ? String(tasks[0]!.id) : ''
  }, { immediate: true })

  function applyCustomRange() {
    const now = Date.now()
    const start = new Date(startInput.value).getTime()
    const end = new Date(endInput.value).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      customError.value = '请选择有效的开始和结束时间。'
      return
    }
    if (end > now || end - start > retentionHours.value * HOUR_MS) {
      customError.value = '请选择已过去的时间，且时长不超过 Ping 记录保留范围。'
      return
    }
    customError.value = ''
    customRange.value = { start, end }
  }

  watch([nodeKey, selectedTaskId, selectedWindow, customRange, refreshKey], async (_value, _oldValue, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    result.value = null
    error.value = ''
    loading.value = false
    shownRange.value = null
    const ids = [...toValue(nodeIds)]
    const task = commonTasks.value.find(item => String(item.id) === selectedTaskId.value)
    const end = Date.now()
    const range = selectedWindow.value === 'custom'
      ? customRange.value
      : { start: end - Number(selectedWindow.value) * HOUR_MS, end }
    if (ids.length < 2 || !task || !range)
      return

    shownRange.value = range
    loading.value = true
    try {
      const data = await loadPingComparison(ids, task.id, range, retentionHours.value)
      if (active)
        result.value = data
    }
    catch {
      if (active)
        error.value = '暂时无法读取线路历史，请重试。'
    }
    finally {
      if (active)
        loading.value = false
    }
  }, { immediate: true })

  return {
    catalog,
    commonTasks,
    selectedTaskId,
    selectedWindow,
    startInput,
    endInput,
    customError,
    shownRange,
    loading,
    error,
    result,
    applyCustomRange,
    refresh: () => { refreshKey.value++ },
  }
}
