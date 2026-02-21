<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDictionaryStore } from '../stores/dictionary'
import { useUiStore } from '../stores/ui'
import { Download, FileText, FileOutput, Loader2 } from 'lucide-vue-next'
import { saveAs } from 'file-saver'

const router = useRouter()
const dictionary = useDictionaryStore()
const ui = useUiStore()

const isExportingLift = ref(false)
const isExportingPdf = ref(false)

// PDF options
const pdfOptions = ref({
  title: 'Owens Valley Paiute Dictionary',
  subtitle: '',
  includeExamples: true,
  pageSize: 'LETTER',
  fontSize: 9
})

onMounted(async () => {
  if (!dictionary.isLoaded) {
    await dictionary.loadFromDB()
    if (!dictionary.isLoaded) router.push('/')
  }
})

async function exportLift() {
  isExportingLift.value = true
  try {
    const xml = await dictionary.exportToLift()
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    saveAs(blob, 'dictionary.lift')
    ui.success('LIFT file exported successfully')
  } catch (err) {
    console.error('Export error:', err)
    ui.error('Export failed: ' + err.message)
  } finally {
    isExportingLift.value = false
  }
}

async function exportPdf() {
  isExportingPdf.value = true
  try {
    const { generateDictionaryPdf } = await import('../services/pdf-export.js')
    const entries = dictionary.entriesArray
    await generateDictionaryPdf(entries, pdfOptions.value)
    ui.success('PDF exported successfully')
  } catch (err) {
    console.error('PDF export error:', err)
    ui.error('PDF export failed: ' + err.message)
  } finally {
    isExportingPdf.value = false
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="flex items-center gap-3 mb-6">
        <Download class="w-6 h-6 text-green-500" />
        <h2 class="text-xl font-bold">Export Dictionary</h2>
      </div>

      <!-- LIFT Export -->
      <div class="card p-6">
        <div class="flex items-start gap-4">
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <FileText class="w-6 h-6 text-blue-500" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold">Export as LIFT XML</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Download the dictionary as a .lift file compatible with SIL FLEx and other tools.
              All edits will be included while preserving the original file structure.
            </p>
            <div class="text-xs text-gray-400 mt-2">
              {{ dictionary.entryCount }} entries &middot; {{ dictionary.senseCount }} senses &middot; {{ dictionary.exampleCount }} examples
            </div>
            <button @click="exportLift" :disabled="isExportingLift" class="btn-primary mt-4">
              <Loader2 v-if="isExportingLift" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              Download .lift
            </button>
          </div>
        </div>
      </div>

      <!-- PDF Export -->
      <div class="card p-6">
        <div class="flex items-start gap-4">
          <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <FileOutput class="w-6 h-6 text-red-500" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold">Export as PDF</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Generate a formatted dictionary PDF for printing or sharing.
            </p>

            <div class="mt-4 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label">Title</label>
                  <input v-model="pdfOptions.title" class="input" />
                </div>
                <div>
                  <label class="label">Subtitle</label>
                  <input v-model="pdfOptions.subtitle" class="input" />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="label">Page Size</label>
                  <select v-model="pdfOptions.pageSize" class="input">
                    <option value="LETTER">Letter</option>
                    <option value="A4">A4</option>
                  </select>
                </div>
                <div>
                  <label class="label">Font Size</label>
                  <input type="number" v-model.number="pdfOptions.fontSize" class="input" min="6" max="16" />
                </div>
                <div class="flex items-end pb-1">
                  <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="pdfOptions.includeExamples"
                           class="rounded border-gray-300 text-indigo-600" />
                    Include examples
                  </label>
                </div>
              </div>
            </div>

            <button @click="exportPdf" :disabled="isExportingPdf" class="btn-primary mt-4">
              <Loader2 v-if="isExportingPdf" class="w-4 h-4 animate-spin" />
              <Download v-else class="w-4 h-4" />
              Generate PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
