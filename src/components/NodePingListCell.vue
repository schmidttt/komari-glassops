<script setup lang="ts">
import PingHistoryStrip from '@/components/PingHistoryStrip.vue'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'

const props = defineProps<{
  uuid: string
  online: boolean
  enabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const {
  latencyRenderBars,
  lossRenderBars,
} = useNodePingDisplay(
  () => props.uuid,
  {
    enabled: () => props.enabled !== false,
  },
)
</script>

<template>
  <button
    type="button"
    class="group flex w-full flex-col gap-[1px] pr-4 text-left"
    aria-label="打开延迟和丢包监测"
    @click.stop="emit('click')"
  >
    <div class="group/panel relative items-center gap-1 opacity-80 hover:opacity-100">
      <PingHistoryStrip
        :bars="latencyRenderBars"
        label="延迟历史，鼠标悬浮查看具体时间与延迟"
        class="h-1.5 cursor-auto items-end"
      />
    </div>
    <div class="group/panel relative items-center gap-1 opacity-80 hover:opacity-100">
      <PingHistoryStrip
        :bars="lossRenderBars"
        label="丢包历史，鼠标悬浮查看具体时间与丢包率"
        class="h-1.5 cursor-auto items-end"
      />
    </div>
  </button>
</template>
