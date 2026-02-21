<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useDictionaryStore } from '../../stores/dictionary'
import { useUiStore } from '../../stores/ui'
import { RefreshCw, X, Loader2, Download } from 'lucide-vue-next'

const emit = defineEmits(['close'])

const dictionary = useDictionaryStore()
const ui = useUiStore()

const pdfUrl = ref(null)
const isGenerating = ref(false)
const generationTime = ref(null)

const pdfOptions = {
  title: 'Owens Valley Paiute Dictionary',
  subtitle: '',
  includeExamples: true,
  pageSize: 'LETTER',
  fontSize: 9
}

function revokeOldUrl() {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
}

async function regenerate() {
  if (isGenerating.value) return
  isGenerating.value = true
  generationTime.value = null

  const start = performance.now()
  try {
    const { generatePdfBlobUrl } = await import('../../services/pdf-export.js')
    const entries = dictionary.entriesArray
    const url = await generatePdfBlobUrl(entries, pdfOptions)

    revokeOldUrl()
    pdfUrl.value = url
    generationTime.value = ((performance.now() - start) / 1000).toFixed(1)
  } catch (err) {
    console.error('PDF preview error:', err)
    ui.error('Failed to generate PDF preview: ' + err.message)
  } finally {
    isGenerating.value = false
  }
}

async function downloadPdf() {
  try {
    const { generateDictionaryPdf } = await import('../../services/pdf-export.js')
    await generateDictionaryPdf(dictionary.entriesArray, pdfOptions)
    ui.success('PDF downloaded')
  } catch (err) {
    ui.error('Download failed: ' + err.message)
  }
}

// Generate on mount, clean up blob URL on unmount
onMounted(() => {
  regenerate()
})

onBeforeUnmount(() => {
  revokeOldUrl()
})
</script>

<template>
  <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
      <button
        @click="regenerate"
        :disabled="isGenerating"
        class="btn-primary btn-sm"
      >
        <Loader2 v-if="isGenerating" class="w-3.5 h-3.5 animate-spin" />
        <RefreshCw v-else class="w-3.5 h-3.5" />
        {{ isGenerating ? 'Generating...' : 'Regenerate' }}
      </button>

      <button @click="downloadPdf" :disabled="!pdfUrl || isGenerating" class="btn-secondary btn-sm">
        <Download class="w-3.5 h-3.5" />
      </button>

      <div class="flex-1" />

      <span v-if="generationTime" class="text-[10px] text-gray-400">
        {{ generationTime }}s
      </span>

      <button @click="emit('close')" class="btn-ghost btn-sm">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- PDF iframe -->
    <div class="flex-1 relative">
      <!-- Loading overlay -->
      <div
        v-if="isGenerating && !pdfUrl"
        class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900"
      >
        <div class="text-center">
          <Loader2 class="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">Generating PDF preview...</p>
          <p class="text-xs text-gray-400 mt-1">This may take a few seconds for {{ dictionary.entryCount }} entries</p>
        </div>
      </div>

      <!-- Generating overlay (when regenerating with existing preview) -->
      <div
        v-if="isGenerating && pdfUrl"
        class="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2"
      >
        <Loader2 class="w-3 h-3 animate-spin" />
        Regenerating...
      </div>

      <iframe
        v-if="pdfUrl"
        :src="pdfUrl"
        class="w-full h-full border-0"
        title="PDF Preview"
      />

      <!-- Empty state -->
      <div
        v-if="!pdfUrl && !isGenerating"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">Click "Regenerate" to preview the PDF</p>
        </div>
      </div>
    </div>
  </div>
</template>
