<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/layout/AppHeader.vue'
import AppToast from './components/layout/AppToast.vue'
import { useDictionaryStore } from './stores/dictionary'
import { Monitor } from 'lucide-vue-next'

const route = useRoute()
const dictionary = useDictionaryStore()

const screenTooSmall = ref(false)
const dismissedWarning = ref(false)
const MIN_WIDTH = 900

function checkScreen() {
  screenTooSmall.value = window.innerWidth < MIN_WIDTH
}

onMounted(() => {
  checkScreen()
  window.addEventListener('resize', checkScreen)
})
onBeforeUnmount(() => window.removeEventListener('resize', checkScreen))
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Small screen warning -->
    <div
      v-if="screenTooSmall && !dismissedWarning"
      class="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3 shrink-0"
    >
      <Monitor class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p class="text-xs text-amber-800 dark:text-amber-300 flex-1">
        This application works best on screens 900px or wider. Consider using a larger device for the full editing experience.
      </p>
      <button @click="dismissedWarning = true" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 text-xs font-medium shrink-0">
        Dismiss
      </button>
    </div>

    <AppHeader />
    <main class="flex-1 flex flex-col overflow-hidden">
      <router-view />
    </main>
    <AppToast />
  </div>
</template>
