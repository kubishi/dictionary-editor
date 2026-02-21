<script setup>
import { ref, onMounted, nextTick, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useDictionaryStore } from '../stores/dictionary'
import EntryList from '../components/entries/EntryList.vue'
import EntryEditor from '../components/entries/EntryEditor.vue'
import { FileOutput } from 'lucide-vue-next'
import TourOverlay from '../components/layout/TourOverlay.vue'

const PdfPreview = defineAsyncComponent(() =>
  import('../components/import-export/PdfPreview.vue')
)

const router = useRouter()
const dictionary = useDictionaryStore()

const showPdfPreview = ref(true)
const previewWidth = ref(500)
const isResizing = ref(false)
const containerRef = ref(null)
const showTour = ref(false)

const tourSteps = [
  {
    target: '#tour-entry-list',
    title: 'Entry List',
    message: 'Your imported entries appear here. Click any entry to start editing. Use search and filters to find specific entries.'
  },
  {
    target: '#tour-entry-editor',
    title: 'Entry Editor',
    message: 'Edit the selected entry here — headword, part of speech, glosses, definitions, and examples. Changes save to your browser automatically.'
  },
  {
    target: '#tour-save-btn',
    title: 'Save Your Work!',
    message: 'Important: Your changes are stored in the browser, but this shouldn\'t be relied on. Click "Save!" to download your .lift file regularly — especially before clearing browser data.',
    variant: 'warning'
  },
  {
    target: '#tour-pdf-preview',
    title: 'PDF Preview',
    message: 'See a live preview of your printed dictionary. Click "Regenerate" after making edits. Double-click any entry to jump to it in the editor.'
  }
]

onMounted(async () => {
  if (!dictionary.isLoaded) {
    await dictionary.loadFromDB()
    if (!dictionary.isLoaded) {
      router.push('/')
      return
    }
  }
  if (localStorage.getItem('kubishi_tour_pending') === 'true') {
    localStorage.removeItem('kubishi_tour_pending')
    await nextTick()
    showTour.value = true
  }
})

function selectEntryFromPdf(guid) {
  dictionary.selectedGuid = guid
}

function startResize(e) {
  e.preventDefault()
  isResizing.value = true

  const startX = e.clientX
  const startWidth = previewWidth.value

  function onMouseMove(e) {
    // Moving left = increasing preview width
    const delta = startX - e.clientX
    const newWidth = Math.max(300, Math.min(startWidth + delta, window.innerWidth - 500))
    previewWidth.value = newWidth
  }

  function onMouseUp() {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div ref="containerRef" class="flex-1 flex overflow-hidden relative">
    <!-- Left panel: entry list -->
    <div id="tour-entry-list" class="w-80 xl:w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden bg-white dark:bg-gray-800">
      <EntryList />
    </div>

    <!-- Center panel: entry editor -->
    <div id="tour-entry-editor" class="flex-1 flex flex-col bg-white dark:bg-gray-900 min-w-0 overflow-hidden">
      <EntryEditor />
    </div>

    <!-- PDF preview toggle floating button (positioned relative to outer container) -->
    <button
      v-if="!showPdfPreview"
      @click="showPdfPreview = true"
      class="fixed right-6 bottom-6 z-20 btn-secondary shadow-lg hover:shadow-xl transition-shadow"
      title="Show PDF preview"
    >
      <FileOutput class="w-4 h-4" />
      PDF Preview
    </button>

    <!-- Resize handle -->
    <div
      v-if="showPdfPreview"
      class="w-1.5 shrink-0 cursor-col-resize flex items-center justify-center group hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors relative z-10"
      :class="isResizing ? 'bg-indigo-200 dark:bg-indigo-800/40' : 'bg-gray-200 dark:bg-gray-700'"
      @mousedown="startResize"
    >
      <div
        class="w-0.5 h-8 rounded-full transition-colors"
        :class="isResizing ? 'bg-indigo-500' : 'bg-gray-400 group-hover:bg-indigo-400'"
      />
    </div>

    <!-- Right panel: PDF preview -->
    <div
      id="tour-pdf-preview"
      v-if="showPdfPreview"
      class="shrink-0 flex flex-col overflow-hidden"
      :style="{ width: previewWidth + 'px' }"
    >
      <PdfPreview @close="showPdfPreview = false" @select-entry="selectEntryFromPdf" />
    </div>

    <!-- Resize overlay to prevent iframe from stealing mouse events -->
    <div
      v-if="isResizing"
      class="fixed inset-0 z-50 cursor-col-resize"
    />

    <!-- First-time tour -->
    <TourOverlay v-if="showTour" :steps="tourSteps" @close="showTour = false" />
  </div>
</template>
