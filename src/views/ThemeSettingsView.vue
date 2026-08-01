<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { Icon } from '@iconify/vue'
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app'
import { getSharedApi } from '@/utils/api'
import themeManifest from '../../komari-theme.json'

interface ThemeSettingItem {
  key?: string
  name: string
  type: 'title' | 'switch' | 'select' | 'number' | 'richtext' | 'string'
  default?: unknown
  options?: string
  help?: string
}

interface ThemeSettingSection {
  id: string
  title: string
  index: number
  items: ThemeSettingItem[]
}

type ThemeSettingValue = string | number | boolean

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const api = getSharedApi()
const isEmbedded = computed(() => route.query.embedded === '1')
const stickyRef = ref<HTMLElement>()
const { height: stickyHeight } = useElementSize(stickyRef)
const manifestConfiguration = themeManifest.configuration as unknown as {
  data?: ThemeSettingItem[] | string
  schema?: ThemeSettingItem[]
}
const schema = Array.isArray(manifestConfiguration.data)
  ? manifestConfiguration.data
  : manifestConfiguration.schema ?? []
const themeShort = themeManifest.short
const formValues = ref<Record<string, ThemeSettingValue>>({})
const activeSectionId = ref('all')
const saving = ref(false)
const loading = ref(true)
const statusMessage = ref('')
const statusKind = ref<'success' | 'error' | ''>('')
const sectionElements = new Map<string, HTMLElement>()
let scrollFrame = 0

function settingsTopOffset(): number {
  const stickyTop = isEmbedded.value ? 0 : 56
  return stickyTop + stickyHeight.value + 28
}

const sections = computed<ThemeSettingSection[]>(() => {
  const result: ThemeSettingSection[] = []
  for (const item of schema) {
    if (item.type === 'title') {
      result.push({
        id: `section-${result.length + 1}`,
        title: item.name,
        index: result.length + 1,
        items: [],
      })
      continue
    }
    result.at(-1)?.items.push(item)
  }
  return result
})

function normalizeSettings(value: unknown): Record<string, ThemeSettingValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  return Object.fromEntries(Object.entries(value)
    .filter((entry): entry is [string, ThemeSettingValue] =>
      typeof entry[1] === 'string'
      || typeof entry[1] === 'number'
      || typeof entry[1] === 'boolean'))
}

function getDefaultValues(): Record<string, ThemeSettingValue> {
  return Object.fromEntries(schema
    .filter(item => item.type !== 'title' && item.key)
    .map((item) => {
      const value = item.default
      return [item.key!, typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : '']
    }))
}

function loadValues(settings: unknown) {
  formValues.value = {
    ...getDefaultValues(),
    ...normalizeSettings(settings),
  }
}

function selectOptions(item: ThemeSettingItem): string[] {
  return (item.options ?? '')
    .split(',')
    .map(option => option.trim())
    .filter(Boolean)
}

function stringValue(key: string | undefined): string {
  if (!key)
    return ''
  const value = formValues.value[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function inputValue(key: string | undefined): string | number {
  if (!key)
    return ''
  const value = formValues.value[key]
  return typeof value === 'string' || typeof value === 'number' ? value : ''
}

function setStringValue(key: string | undefined, value: unknown) {
  if (key)
    formValues.value[key] = String(value ?? '')
}

function setNumberValue(key: string | undefined, value: unknown) {
  if (!key)
    return
  const normalized = String(value ?? '').trim()
  formValues.value[key] = normalized === '' ? '' : Number(normalized)
}

function bindSectionRef(id: string) {
  return (element: Element | ComponentPublicInstance | null) => {
    if (element instanceof HTMLElement)
      sectionElements.set(id, element)
    else
      sectionElements.delete(id)
  }
}

function scrollToSection(id: string) {
  activeSectionId.value = id
  if (id === 'all') {
    window.scrollTo({
      top: 0,
      behavior: appStore.disablePageAnimation ? 'auto' : 'smooth',
    })
    return
  }

  const target = sectionElements.get(id)
  if (!target)
    return
  const top = window.scrollY + target.getBoundingClientRect().top - settingsTopOffset()
  window.scrollTo({
    top: Math.max(0, top),
    behavior: appStore.disablePageAnimation ? 'auto' : 'smooth',
  })
}

function updateActiveSection() {
  scrollFrame = 0
  if (window.scrollY < 72) {
    activeSectionId.value = 'all'
    return
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
    activeSectionId.value = sections.value.at(-1)?.id ?? 'all'
    return
  }

  let current = sections.value[0]?.id ?? 'all'
  for (const section of sections.value) {
    const element = sectionElements.get(section.id)
    if (!element)
      continue
    if (element.getBoundingClientRect().top <= settingsTopOffset() + 10)
      current = section.id
    else
      break
  }
  activeSectionId.value = current
}

function scheduleScrollSpy() {
  if (scrollFrame)
    return
  scrollFrame = window.requestAnimationFrame(updateActiveSection)
}

function resetToDefaults() {
  loadValues({})
  statusKind.value = ''
  statusMessage.value = '已恢复主题默认值，点击保存后生效。'
}

async function saveSettings() {
  if (saving.value)
    return

  saving.value = true
  statusKind.value = ''
  statusMessage.value = ''
  try {
    const granted = await appStore.requireLoginPermission('themeConfiguration', { force: true })
    if (!granted)
      throw new Error('请先登录管理员账户。')

    const latest = await api.getPublicSettings()
    if (latest.theme !== themeShort)
      throw new Error('当前启用主题已经变化，请返回后台确认后重试。')

    const merged = {
      ...normalizeSettings(latest.theme_settings),
      ...formValues.value,
    }
    await api.updateThemeSettings(themeShort, merged)
    appStore.publicSettings = await api.getPublicSettings()
    loadValues(appStore.publicSettings.theme_settings)
    statusKind.value = 'success'
    statusMessage.value = '主题设置已保存并生效。'
  }
  catch (error) {
    statusKind.value = 'error'
    statusMessage.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  }
  finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const granted = await appStore.requireLoginPermission('themeConfiguration', { force: true })
    if (!granted) {
      location.href = '/admin'
      return
    }
    const latest = await api.getPublicSettings()
    if (latest.theme !== themeShort) {
      statusKind.value = 'error'
      statusMessage.value = '当前启用的不是 GlassOps 主题，设置页已切换为只读。'
    }
    loadValues(latest.theme_settings)
    await nextTick()
    updateActiveSection()
    window.addEventListener('scroll', scheduleScrollSpy, { passive: true })
    window.addEventListener('resize', scheduleScrollSpy)
  }
  catch (error) {
    statusKind.value = 'error'
    statusMessage.value = error instanceof Error ? error.message : '加载主题设置失败。'
  }
  finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', scheduleScrollSpy)
  window.removeEventListener('resize', scheduleScrollSpy)
  if (scrollFrame)
    window.cancelAnimationFrame(scrollFrame)
})
</script>

<template>
  <div
    class="theme-settings-page mx-auto w-full max-w-[2200px] px-3 pb-16 md:px-5"
    :class="{ 'is-embedded': isEmbedded }"
  >
    <div ref="stickyRef" class="theme-settings-sticky">
      <div class="flex min-w-0 items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[0.65rem] font-semibold tracking-[0.22em] text-cyan-600/80 uppercase dark:text-cyan-300/75">
            Komari GlassOps
          </p>
          <h1 class="truncate text-lg font-semibold md:text-xl">
            主题设置
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button v-if="!isEmbedded" variant="outline" size="sm" class="hidden sm:inline-flex" @click="router.push('/')">
            <Icon icon="tabler:home" />
            返回首页
          </Button>
          <Button size="sm" :disabled="saving || loading || appStore.publicSettings?.theme !== themeShort" @click="saveSettings">
            <Icon :icon="saving ? 'tabler:loader-2' : 'tabler:device-floppy'" :class="saving && 'animate-spin'" />
            {{ saving ? '保存中' : '保存' }}
          </Button>
        </div>
      </div>

      <nav class="settings-tabs" aria-label="主题设置分类">
        <button
          type="button"
          :class="{ 'is-active': activeSectionId === 'all' }"
          @click="scrollToSection('all')"
        >
          全部设置
        </button>
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :class="{ 'is-active': activeSectionId === section.id }"
          @click="scrollToSection(section.id)"
        >
          {{ section.title }}
        </button>
      </nav>
    </div>

    <div
      v-if="statusMessage"
      class="settings-status"
      :class="statusKind === 'error' ? 'is-error' : statusKind === 'success' ? 'is-success' : ''"
      role="status"
    >
      <Icon :icon="statusKind === 'error' ? 'tabler:alert-triangle' : statusKind === 'success' ? 'tabler:circle-check' : 'tabler:info-circle'" />
      {{ statusMessage }}
    </div>

    <div v-if="loading" class="flex min-h-72 items-center justify-center gap-2 text-muted-foreground">
      <Icon icon="tabler:loader-2" class="animate-spin" />
      正在读取主题设置…
    </div>

    <main v-else class="space-y-7 pt-4">
      <section
        v-for="section in sections"
        :id="section.id"
        :key="section.id"
        :ref="bindSectionRef(section.id)"
        class="settings-section"
      >
        <div class="settings-section-heading">
          <span class="settings-section-index">{{ String(section.index).padStart(2, '0') }}</span>
          <div>
            <h2>{{ section.title }}</h2>
            <p>{{ section.items.length }} 项设置</p>
          </div>
        </div>

        <div class="settings-section-card">
          <article v-for="item in section.items" :key="item.key" class="settings-field">
            <div class="min-w-0">
              <label class="settings-label" :for="`setting-${item.key}`">{{ item.name }}</label>
              <p v-if="item.help" class="settings-help">
                {{ item.help }}
              </p>
            </div>

            <label v-if="item.type === 'switch'" class="settings-switch">
              <input
                :id="`setting-${item.key}`"
                type="checkbox"
                :checked="Boolean(formValues[item.key!])"
                @change="formValues[item.key!] = ($event.target as HTMLInputElement).checked"
              >
              <span aria-hidden="true" />
            </label>

            <select
              v-else-if="item.type === 'select'"
              :id="`setting-${item.key}`"
              :value="stringValue(item.key)"
              class="settings-select"
              @change="setStringValue(item.key, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="option in selectOptions(item)" :key="option" :value="option">
                {{ option }}
              </option>
            </select>

            <Input
              v-else-if="item.type === 'number'"
              :id="`setting-${item.key}`"
              :model-value="inputValue(item.key)"
              type="number"
              class="settings-input"
              @update:model-value="setNumberValue(item.key, $event)"
            />

            <textarea
              v-else-if="item.type === 'richtext'"
              :id="`setting-${item.key}`"
              :value="stringValue(item.key)"
              class="settings-textarea"
              rows="4"
              @input="setStringValue(item.key, ($event.target as HTMLTextAreaElement).value)"
            />

            <Input
              v-else
              :id="`setting-${item.key}`"
              :model-value="inputValue(item.key)"
              class="settings-input"
              @update:model-value="setStringValue(item.key, $event)"
            />
          </article>
        </div>
      </section>
    </main>

    <div v-if="!loading" class="mt-8 flex items-center justify-between gap-3 border-t border-border/50 pt-5">
      <Button variant="ghost" size="sm" @click="resetToDefaults">
        <Icon icon="tabler:restore" />
        恢复主题默认
      </Button>
      <p class="text-xs text-muted-foreground">
        页面顶部的保存按钮会保持可见
      </p>
    </div>
  </div>
</template>

<style scoped>
.theme-settings-sticky {
  position: sticky;
  z-index: 40;
  top: 3.5rem;
  margin-inline: -0.25rem;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: 0 0 1rem 1rem;
  background: color-mix(in srgb, var(--background) 82%, transparent);
  box-shadow: 0 14px 38px rgb(15 23 42 / 0.08);
  padding: 0.82rem 1rem 0.68rem;
  backdrop-filter: blur(24px) saturate(145%);
}

.theme-settings-page.is-embedded {
  min-height: 100vh;
  padding-inline: 0.25rem;
}

.theme-settings-page.is-embedded .theme-settings-sticky {
  top: 0;
  margin-inline: 0;
  border-radius: 0 0 1rem 1rem;
  background: color-mix(in srgb, var(--background) 96%, transparent);
  box-shadow: 0 14px 38px rgb(15 23 42 / 0.12);
}

.settings-tabs {
  display: flex;
  gap: 0.38rem;
  margin-top: 0.55rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.settings-tabs::-webkit-scrollbar {
  display: none;
}

.settings-tabs button {
  flex: none;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.42rem 0.76rem;
  color: var(--muted-foreground);
  font-size: 0.82rem;
  font-weight: 650;
  white-space: nowrap;
  transition: 180ms ease;
}

.settings-tabs button:hover {
  border-color: color-mix(in srgb, var(--primary) 18%, transparent);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  color: var(--foreground);
}

.settings-tabs button.is-active {
  border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, white 24%, transparent);
  color: var(--primary);
}

.settings-status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  padding: 0.65rem 0.8rem;
  color: var(--foreground);
  font-size: 0.86rem;
}

.settings-status.is-success {
  border-color: rgb(16 185 129 / 0.28);
  background: rgb(16 185 129 / 0.08);
  color: #047857;
}

.settings-status.is-error {
  border-color: rgb(244 63 94 / 0.28);
  background: rgb(244 63 94 / 0.08);
  color: #be123c;
}

.settings-section {
  --section-color: var(--primary);

  scroll-margin-top: 8rem;
}

.settings-section-card {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.settings-section-heading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.65rem;
  color: var(--section-color);
}

.settings-section-heading h2 {
  font-size: 1.08rem;
  font-weight: 720;
}

.settings-section-heading p {
  margin-top: 0.08rem;
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.settings-section-index {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--section-color) 35%, transparent);
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--section-color) 10%, transparent);
  font-size: 0.76rem;
  font-weight: 800;
}

.settings-field {
  display: grid;
  min-height: 4.8rem;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 34%);
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 58%, transparent);
  padding: 0.86rem 1rem;
}

.settings-field:last-child {
  border-bottom: 0;
}

.settings-label {
  display: block;
  color: var(--foreground);
  font-size: 0.94rem;
  font-weight: 650;
}

.settings-help {
  margin-top: 0.18rem;
  color: var(--muted-foreground);
  font-size: 0.82rem;
  line-height: 1.45;
}

.settings-input,
.settings-select,
.settings-textarea {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 0.62rem;
  background: color-mix(in srgb, var(--background) 58%, transparent);
  color: var(--foreground);
  font-size: 0.9rem;
  outline: none;
  transition: 160ms ease;
}

.settings-input,
.settings-select {
  min-height: 2.7rem;
  padding-inline: 0.8rem;
}

.settings-textarea {
  min-height: 5.25rem;
  resize: vertical;
  padding: 0.55rem 0.7rem;
  line-height: 1.45;
}

.settings-input:focus,
.settings-select:focus,
.settings-textarea:focus {
  border-color: color-mix(in srgb, var(--primary) 58%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
}

.settings-switch {
  position: relative;
  justify-self: end;
  width: 2.8rem;
  height: 1.55rem;
  cursor: pointer;
}

.settings-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.settings-switch span {
  position: absolute;
  inset: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 82%, transparent);
  transition: 180ms ease;
}

.settings-switch span::after {
  position: absolute;
  top: 0.17rem;
  left: 0.18rem;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 8px rgb(15 23 42 / 0.24);
  content: '';
  transition: 180ms ease;
}

.settings-switch input:checked + span {
  border-color: color-mix(in srgb, var(--primary) 60%, transparent);
  background: var(--primary);
}

.settings-switch input:checked + span::after {
  transform: translateX(1.22rem);
}

@media (max-width: 720px) {
  .theme-settings-sticky {
    top: 3.5rem;
  }

  .settings-field {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .settings-switch {
    justify-self: start;
  }
}

:global(.dark .settings-status.is-success) {
  color: #6ee7b7;
}

:global(.dark .settings-status.is-error) {
  color: #fda4af;
}
</style>
