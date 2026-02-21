<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDictionaryStore } from '../stores/dictionary'
import { useUiStore } from '../stores/ui'
import { Upload, BookOpen, Wand2, Download, FileText, Hash, MessageSquare } from 'lucide-vue-next'

const router = useRouter()
const dictionary = useDictionaryStore()
const ui = useUiStore()

const isDragging = ref(false)
const isImporting = ref(false)
const fileInput = ref(null)

onMounted(() => {
  dictionary.loadFromDB()
})

function onDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function onDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) await importFile(file)
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) await importFile(file)
  e.target.value = '' // reset so same file can be re-selected
}

async function importFile(file) {
  if (!file.name.endsWith('.lift')) {
    ui.error('Please select a .lift file')
    return
  }

  isImporting.value = true
  try {
    const text = await file.text()
    const count = await dictionary.importLift(text)
    ui.success(`Imported ${count} entries from ${file.name}`)
    if (!localStorage.getItem('kubishi_tour_seen')) {
      localStorage.setItem('kubishi_tour_pending', 'true')
    }
    router.push('/browse')
  } catch (err) {
    console.error('Import error:', err)
    ui.error('Failed to import: ' + err.message)
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center p-8">
    <!-- If no data loaded: import prompt -->
    <div v-if="!dictionary.isLoaded" class="max-w-lg w-full">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Kubishi Dictionary Editor</h2>
        <p class="mt-2 text-gray-500 dark:text-gray-400">
          Import a .lift file to get started editing your dictionary.
        </p>
      </div>

      <!-- Drop zone -->
      <div
        class="card p-12 border-2 border-dashed cursor-pointer transition-all duration-200"
        :class="isDragging
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800'"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @click="openFilePicker"
      >
        <div class="text-center">
          <Upload v-if="!isImporting" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <div v-else class="w-12 h-12 mx-auto mb-4 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />

          <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
            {{ isImporting ? 'Importing...' : 'Drop your .lift file here' }}
          </p>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            or click to browse files
          </p>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".lift"
        class="hidden"
        @change="onFileSelected"
      />
    </div>

    <!-- If data loaded: dashboard stats -->
    <div v-else class="max-w-3xl w-full space-y-8">
      <div class="text-center">
        <h2 class="text-2xl font-bold">Dictionary Loaded</h2>
        <p class="mt-1 text-gray-500 dark:text-gray-400">
          Your dictionary is ready to edit
        </p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="card p-4 text-center">
          <BookOpen class="w-6 h-6 mx-auto text-indigo-500 mb-2" />
          <div class="text-2xl font-bold">{{ dictionary.entryCount }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Entries</div>
        </div>
        <div class="card p-4 text-center">
          <Hash class="w-6 h-6 mx-auto text-green-500 mb-2" />
          <div class="text-2xl font-bold">{{ dictionary.senseCount }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Senses</div>
        </div>
        <div class="card p-4 text-center">
          <MessageSquare class="w-6 h-6 mx-auto text-amber-500 mb-2" />
          <div class="text-2xl font-bold">{{ dictionary.exampleCount }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">Examples</div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-3 gap-4">
        <router-link to="/browse" class="card p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
          <FileText class="w-5 h-5 text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
          <div class="font-medium text-sm">Browse & Edit</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">View and edit entries</div>
        </router-link>
        <router-link to="/mass-edit" class="card p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
          <Wand2 class="w-5 h-5 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
          <div class="font-medium text-sm">Mass Edit</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Bulk find & replace</div>
        </router-link>
        <router-link to="/export" class="card p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group">
          <Download class="w-5 h-5 text-green-500 mb-2 group-hover:scale-110 transition-transform" />
          <div class="font-medium text-sm">Export</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Download LIFT or PDF</div>
        </router-link>
      </div>

      <!-- Import new file -->
      <div class="text-center">
        <button @click="openFilePicker" class="btn-secondary">
          <Upload class="w-4 h-4" /> Import Different File
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".lift"
          class="hidden"
          @change="onFileSelected"
        />
        <p class="text-xs text-gray-400 mt-2">This will replace the current dictionary data</p>
      </div>
    </div>
  </div>
</template>
