<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDictionaryStore } from '../../stores/dictionary'
import { useUiStore } from '../../stores/ui'
import { BookOpen, List, Wand2, Download, Sun, Moon, Loader2 } from 'lucide-vue-next'
import { useLocalStorage } from '@vueuse/core'
import { saveAs } from 'file-saver'

const route = useRoute()
const router = useRouter()
const dictionary = useDictionaryStore()
const ui = useUiStore()

const darkMode = useLocalStorage('darkMode', true)
const isExporting = ref(false)

function toggleDark() {
  darkMode.value = !darkMode.value
  document.documentElement.classList.toggle('dark', darkMode.value)
}

// Apply dark mode on load
if (darkMode.value) {
  document.documentElement.classList.add('dark')
}

async function exportLift() {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const xml = await dictionary.exportToLift()
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    saveAs(blob, 'dictionary.lift')
    ui.success('LIFT file downloaded')
  } catch (err) {
    ui.error('Export failed: ' + err.message)
  } finally {
    isExporting.value = false
  }
}

const navItems = computed(() => [
  { path: '/', name: 'Dashboard', icon: BookOpen, show: true },
  { path: '/browse', name: 'Browse & Edit', icon: List, show: dictionary.isLoaded },
  { path: '/mass-edit', name: 'Mass Edit', icon: Wand2, show: dictionary.isLoaded }
])
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 h-14 flex items-center shrink-0">
    <div class="flex items-center gap-3">
      <h1 class="font-bold text-lg">
        <router-link to="/" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          Kubishi Editor
        </router-link>
      </h1>
      <span v-if="dictionary.isLoaded" class="badge-blue">
        {{ dictionary.entryCount }} entries
      </span>
    </div>

    <nav class="ml-8 flex items-center gap-1">
      <router-link
        v-for="item in navItems.filter(n => n.show)"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === item.path
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'"
      >
        <component :is="item.icon" class="w-4 h-4" />
        {{ item.name }}
      </router-link>

      <button
        id="tour-save-btn"
        v-if="dictionary.isLoaded"
        @click="exportLift"
        :disabled="isExporting"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <Loader2 v-if="isExporting" class="w-4 h-4 animate-spin" />
        <Download v-else class="w-4 h-4" />
        Save!
      </button>
    </nav>

    <div class="ml-auto flex items-center gap-2">
      <span v-if="dictionary.isDirty" class="text-xs text-amber-600 dark:text-amber-400 font-medium">
        Unsaved changes
      </span>
      <button @click="toggleDark" class="btn-ghost btn-sm">
        <Moon v-if="!darkMode" class="w-4 h-4" />
        <Sun v-else class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>
