import type { PublicSettings } from '@/utils/api'
import type { HomePingTaskSelections } from '@/utils/homePingConfig'
import { getSharedApi } from '@/utils/api'
import { HOME_PING_CONFIG_KEY, serializeHomePingTaskSelections } from '@/utils/homePingConfig'

function normalizeThemeSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  return value as Record<string, unknown>
}

export async function saveHomePingTaskSelections(
  expectedTheme: string,
  selections: HomePingTaskSelections,
): Promise<PublicSettings> {
  const api = getSharedApi()
  const latest = await api.getPublicSettings()

  if (!expectedTheme || latest.theme !== expectedTheme)
    throw new Error('当前启用主题已变化，请刷新页面后重新配置。')

  const mergedSettings = {
    ...normalizeThemeSettings(latest.theme_settings),
    [HOME_PING_CONFIG_KEY]: serializeHomePingTaskSelections(selections),
  }

  await api.updateThemeSettings(latest.theme, mergedSettings)
  return api.getPublicSettings()
}
