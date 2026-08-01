import type { PingTaskInfo } from '@/utils/rpc'

export const HOME_PING_CONFIG_KEY = 'homePingTaskSelections'
export const HOME_PING_CONFIG_VERSION = 1
export const HOME_PING_DEFAULT_HOURS = 4
export const HOME_PING_HOUR_OPTIONS = [1, 4, 6, 9, 12] as const
export const HOME_PING_MAX_TASKS = 3

export type HomePingTaskSelections = Record<string, number[]>
export type HomePingHours = typeof HOME_PING_HOUR_OPTIONS[number]

export function isHomePingHours(value: unknown): value is HomePingHours {
  return typeof value === 'number' && HOME_PING_HOUR_OPTIONS.includes(value as HomePingHours)
}

interface HomePingTaskConfigV1 {
  version: 1
  nodes: HomePingTaskSelections
}

function normalizeTaskIds(value: unknown): number[] {
  if (!Array.isArray(value))
    return []

  const result: number[] = []
  const seen = new Set<number>()
  for (const item of value) {
    const taskId = typeof item === 'number' ? item : Number(item)
    if (!Number.isInteger(taskId) || taskId <= 0 || seen.has(taskId))
      continue

    result.push(taskId)
    seen.add(taskId)
  }
  return result
}

function normalizeNodeMap(value: unknown): HomePingTaskSelections {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}

  const result: HomePingTaskSelections = {}
  for (const [uuid, taskIds] of Object.entries(value as Record<string, unknown>)) {
    const normalizedUuid = uuid.trim()
    if (!normalizedUuid)
      continue
    result[normalizedUuid] = normalizeTaskIds(taskIds).slice(0, HOME_PING_MAX_TASKS)
  }
  return result
}

export function parseHomePingTaskSelections(raw: unknown): HomePingTaskSelections {
  let value = raw
  if (typeof raw === 'string') {
    if (!raw.trim())
      return {}
    try {
      value = JSON.parse(raw) as unknown
    }
    catch {
      return {}
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}

  const record = value as Record<string, unknown>
  if ('nodes' in record)
    return normalizeNodeMap(record.nodes)

  // Accept the early unversioned node map so pre-release builds remain readable.
  return normalizeNodeMap(record)
}

export function serializeHomePingTaskSelections(selections: HomePingTaskSelections): string {
  const config: HomePingTaskConfigV1 = {
    version: HOME_PING_CONFIG_VERSION,
    nodes: normalizeNodeMap(selections),
  }
  return JSON.stringify(config)
}

export function getApplicableHomePingTasks(tasks: PingTaskInfo[], uuid: string): PingTaskInfo[] {
  if (!uuid.trim())
    return []
  return tasks
    .filter(task => Array.isArray(task.clients) && task.clients.includes(uuid))
    .slice()
    .sort((left, right) => {
      const weightDelta = (left.weight ?? left.id) - (right.weight ?? right.id)
      return weightDelta || left.id - right.id
    })
}

export function getEffectiveHomePingTaskIds(
  selections: HomePingTaskSelections,
  uuid: string,
  tasks: PingTaskInfo[],
): number[] {
  const applicableTasks = getApplicableHomePingTasks(tasks, uuid)
  const applicableIds = new Set(applicableTasks.map(task => task.id))

  if (Object.hasOwn(selections, uuid)) {
    return normalizeTaskIds(selections[uuid])
      .filter(taskId => applicableIds.has(taskId))
      .slice(0, HOME_PING_MAX_TASKS)
  }

  return applicableTasks.slice(0, HOME_PING_MAX_TASKS).map(task => task.id)
}

export function sanitizeHomePingTaskSelections(
  selections: HomePingTaskSelections,
  publicNodeIds: Iterable<string>,
  tasks: PingTaskInfo[],
): HomePingTaskSelections {
  const allowedNodes = new Set(publicNodeIds)
  const result: HomePingTaskSelections = {}

  for (const [uuid, taskIds] of Object.entries(selections)) {
    if (!allowedNodes.has(uuid))
      continue

    const applicableIds = new Set(getApplicableHomePingTasks(tasks, uuid).map(task => task.id))
    result[uuid] = normalizeTaskIds(taskIds)
      .filter(taskId => applicableIds.has(taskId))
      .slice(0, HOME_PING_MAX_TASKS)
  }

  return result
}
