<script setup>
import { useUiStore } from '../../stores/ui'
import { AlertTriangle } from 'lucide-vue-next'

const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.confirmDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="ui.resolveConfirm(false)"
    >
      <div class="card p-6 max-w-md w-full mx-4 shadow-xl">
        <div class="flex items-start gap-3">
          <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-lg">{{ ui.confirmDialog.title }}</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ ui.confirmDialog.message }}
            </p>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button class="btn-secondary" @click="ui.resolveConfirm(false)">Cancel</button>
          <button class="btn-danger" @click="ui.resolveConfirm(true)">Confirm</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
