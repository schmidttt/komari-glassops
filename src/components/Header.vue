<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import VisitorInfo from '@/components/VisitorInfo.vue'
import { useVisitorAudit } from '@/composables/useVisitorAudit'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()
const { record: recordVisitorEvent } = useVisitorAudit()

const isScrolled = inject<ReturnType<typeof ref<boolean>>>('isScrolled', ref(false))

const siteFavicon = ref('/favicon.ico')

const themeButton = computed(() => {
  if (appStore.themeMode === 'auto') {
    return {
      title: `自动主题（当前${appStore.isDark ? '深色' : '浅色'}）`,
      icon: 'tabler:brightness-auto',
      pressed: true,
    }
  }
  if (appStore.themeMode === 'light') {
    return {
      title: '浅色主题',
      icon: 'icon-park-outline:sun-one',
      pressed: false,
    }
  }
  return {
    title: '深色主题',
    icon: 'icon-park-outline:moon',
    pressed: false,
  }
})

const actionButtons = computed(() => {
  const buttons: Array<{ title: string, icon: string, action: string, pressed?: boolean }> = []

  if (router.currentRoute.value.name === 'home' && appStore.privateFeaturesAllowed && appStore.homeToolsEnabled) {
    buttons.push({
      title: appStore.homeAdvancedToolsVisible ? '收起高级工具' : '显示高级工具',
      icon: 'tabler:tools',
      action: 'toggleHomeTools',
      pressed: appStore.homeAdvancedToolsVisible,
    })
  }

  if (router.currentRoute.value.name === 'home' && appStore.privateFeaturesAllowed) {
    buttons.push({
      title: '首页延迟监控',
      icon: 'tabler:clock-cog',
      action: 'openHomePingSettings',
      pressed: appStore.homePingSettingsVisible,
    })
  }

  buttons.push({
    title: themeButton.value.title,
    icon: themeButton.value.icon,
    action: 'toggleTheme',
    pressed: themeButton.value.pressed,
  })

  if (!appStore.loading && (appStore.privateFeaturesAllowed || !appStore.hideAdminEntryWhenLoggedOut)) {
    buttons.push({
      title: '后台管理',
      icon: 'icon-park-outline:setting',
      action: 'jumpToSetting',
    })
  }
  return buttons
})

function handleButtonClick(action: string) {
  switch (action) {
    case 'toggleTheme':
      appStore.updateThemeMode()
      void recordVisitorEvent({
        event: 'theme_mode_change',
        path: router.currentRoute.value.path,
        route: String(router.currentRoute.value.name ?? ''),
        target: appStore.themeMode,
      })
      break
    case 'toggleHomeTools':
      appStore.homeAdvancedToolsVisible = !appStore.homeAdvancedToolsVisible
      break
    case 'openHomePingSettings':
      appStore.homePingSettingsVisible = true
      break
    case 'jumpToSetting':
      void recordVisitorEvent({
        event: 'admin_entry_click',
        path: router.currentRoute.value.path,
        route: String(router.currentRoute.value.name ?? ''),
      })
      try {
        sessionStorage.setItem('komariOfficialAppRoute', '/admin')
        location.href = '/admin-app/index.html'
      }
      catch {
        location.href = '/admin-app/index.html?__komari_route=%2Fadmin'
      }
      break
  }
}

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
</script>

<template>
  <!-- 访客 IP 组件，全局悬浮 -->
  <VisitorInfo v-if="!appStore.loading && appStore.visitorInfoEnabled" />

  <div
    class="transition-all duration-200 top-0 sticky z-10 border-b border-transparent"
    :class="isScrolled ? '!border-slate-500/10 backdrop-blur-lg' : 'bg-transparent'"
  >
    <div class="mx-auto h-14 w-full max-w-[2200px] px-4 flex-between">
      <div class="flex items-center gap-3 cursor-pointer" @click="router.push('/')">
        <Avatar class="size-8">
          <AvatarImage :src="siteFavicon" :alt="sitename" />
          <AvatarFallback>{{ sitename.slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <h3 class="m-0 text-lg font-semibold">
          {{ sitename }}
        </h3>
      </div>
      <TooltipProvider :delay-duration="200">
        <div class="flex items-center gap-2">
          <Tooltip v-for="button in actionButtons" :key="button.action">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="button.title"
                :aria-pressed="button.pressed"
                :class="button.pressed && 'bg-background/70 text-selection'"
                @click="handleButtonClick(button.action)"
              >
                <Icon :icon="button.icon" :width="18" :height="18" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ button.title }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  </div>
</template>
