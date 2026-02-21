<script setup>
import { useUiStore } from '../../stores/ui'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-vue-next'

const ui = useUiStore()

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
}

const colorMap = {
  success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div
          v-for="toast in ui.toasts"
          :key="toast.id"
          class="flex items-start gap-2 p-3 rounded-lg border shadow-lg text-sm"
          :class="colorMap[toast.type]"
        >
          <component :is="iconMap[toast.type]" class="w-4 h-4 shrink-0 mt-0.5" />
          <span class="flex-1">{{ toast.message }}</span>
          <button @click="ui.removeToast(toast.id)" class="shrink-0 opacity-60 hover:opacity-100">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
