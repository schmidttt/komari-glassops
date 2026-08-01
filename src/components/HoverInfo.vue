<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{
  label: string
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const pinned = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

function updatePosition() {
  const rect = root.value?.getBoundingClientRect()
  if (!rect)
    return

  tooltipX.value = Math.max(112, Math.min(window.innerWidth - 112, rect.left + rect.width / 2))
  tooltipY.value = rect.top - 8
}

function handlePointerEnter(event: PointerEvent) {
  if (event.pointerType === 'touch')
    return
  updatePosition()
  open.value = true
}

function handlePointerLeave() {
  if (!pinned.value)
    open.value = false
}

function handleFocusIn() {
  updatePosition()
  open.value = true
}

function handleFocusOut() {
  if (!pinned.value)
    open.value = false
}

function togglePinned() {
  updatePosition()
  pinned.value = !pinned.value
  open.value = pinned.value
}

function close() {
  open.value = false
  pinned.value = false
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node))
    close()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  window.addEventListener('blur', close)
  window.addEventListener('scroll', close, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  window.removeEventListener('blur', close)
  window.removeEventListener('scroll', close, true)
})
</script>

<template>
  <span
    ref="root"
    class="inline-flex"
    @pointerenter="handlePointerEnter"
    @pointermove="handlePointerEnter"
    @pointerleave="handlePointerLeave"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
    @click.stop="togglePinned"
    @keydown.esc="close"
  >
    <slot />
  </span>

  <Teleport to="body">
    <div
      v-if="open"
      role="tooltip"
      :aria-label="label"
      class="pointer-events-none fixed z-[300] w-max max-w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-popover/96 p-3 text-xs text-popover-foreground shadow-xl backdrop-blur-xl"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <slot name="content" />
    </div>
  </Teleport>
</template>
