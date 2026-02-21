<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useDictionaryStore } from '../../stores/dictionary'
import { useUiStore } from '../../stores/ui'
import { RefreshCw, X, Loader2, Download, ZoomIn, ZoomOut } from 'lucide-vue-next'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const GUID_RE = /\u00A7([^\u00A7]+)\u00A7/

const emit = defineEmits(['close', 'select-entry'])
const dictionary = useDictionaryStore()
const ui = useUiStore()

const isGenerating = ref(false)
const generationTime = ref(null)
const viewerRef = ref(null)
const pageCount = ref(0)
const scale = ref(1.0)
const pages = ref([])

let pdfDoc = null
let pdfBlobUrl = null
let observer = null
const renderedPages = new Set()

const pdfOptions = {
  title: 'Owens Valley Paiute Dictionary',
  subtitle: '',
  includeExamples: true,
  pageSize: 'LETTER',
  fontSize: 9
}

function cleanup() {
  if (observer) { observer.disconnect(); observer = null }
  if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null }
  if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); pdfBlobUrl = null }
  renderedPages.clear()
  pages.value = []
  pageCount.value = 0
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

    cleanup()
    pdfBlobUrl = url

    pdfDoc = await pdfjsLib.getDocument(url).promise
    pageCount.value = pdfDoc.numPages

    const pageInfos = []
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const vp = page.getViewport({ scale: 1.0 })
      pageInfos.push({ num: i, width: vp.width, height: vp.height })
    }
    pages.value = pageInfos
    generationTime.value = ((performance.now() - start) / 1000).toFixed(1)

    await nextTick()
    fitScale()
    await nextTick()
    setupObserver()
  } catch (err) {
    console.error('PDF preview error:', err)
    ui.error('Failed to generate PDF preview: ' + err.message)
  } finally {
    isGenerating.value = false
  }
}

function fitScale() {
  if (!viewerRef.value || pages.value.length === 0) return
  const containerWidth = viewerRef.value.clientWidth - 24
  const pageWidth = pages.value[0].width
  scale.value = Math.min(containerWidth / pageWidth, 2.0)
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.15, 3.0)
  rerenderAll()
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.15, 0.3)
  rerenderAll()
}

function rerenderAll() {
  renderedPages.clear()
  if (viewerRef.value) {
    viewerRef.value.querySelectorAll('.pdf-page canvas').forEach(c => {
      c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
      c.width = 0
      c.height = 0
    })
    viewerRef.value.querySelectorAll('.pdf-page .textLayer').forEach(t => {
      t.innerHTML = ''
    })
  }
  nextTick(() => setupObserver())
}

function setupObserver() {
  if (observer) observer.disconnect()
  if (!viewerRef.value) return

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const pageNum = parseInt(entry.target.dataset.page)
        if (!renderedPages.has(pageNum)) renderPage(pageNum)
      }
    }
  }, { root: viewerRef.value, rootMargin: '400px' })

  viewerRef.value.querySelectorAll('.pdf-page').forEach(el => observer.observe(el))
}

async function renderPage(pageNum) {
  if (!pdfDoc || renderedPages.has(pageNum)) return
  renderedPages.add(pageNum)

  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale: scale.value })
  const dpr = window.devicePixelRatio || 1

  const container = viewerRef.value?.querySelector(`[data-page="${pageNum}"]`)
  if (!container) return

  // -- Canvas: render at full device resolution --
  const canvas = container.querySelector('canvas')
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = Math.floor(viewport.width) + 'px'
  canvas.style.height = Math.floor(viewport.height) + 'px'

  const ctx = canvas.getContext('2d')
  await page.render({
    canvasContext: ctx,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
  }).promise

  // -- Text layer: uses CSS-based positioning (no DPI scaling) --
  const textContent = await page.getTextContent()
  const textLayerDiv = container.querySelector('.textLayer')
  textLayerDiv.innerHTML = ''

  const textLayer = new TextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport
  })
  await textLayer.render()
}

// Double-click: find the nearest GUID marker by concatenating all text layer text
// GUID markers (§guid§) may be split across multiple spans by pdf.js, so we can't
// search individual spans. Instead, concatenate all span text in DOM order (which
// matches reading order, including across columns) and search the full string.
function onDoubleClick(event) {
  const span = event.target.closest('.textLayer span')
  if (!span) return

  const guid = findNearestGuid(span)
  if (guid) emit('select-entry', guid)
}

function findNearestGuid(clickedSpan) {
  const textLayer = clickedSpan.closest('.textLayer')
  if (!textLayer) return null

  const allSpans = Array.from(textLayer.querySelectorAll('span'))

  // Concatenate all span text and find the clicked span's offset
  let fullText = ''
  let clickedOffset = -1

  for (const span of allSpans) {
    if (span === clickedSpan) clickedOffset = fullText.length
    fullText += span.textContent || ''
  }

  if (clickedOffset === -1) return null

  // Search the full concatenated text for GUID markers
  const guidRe = /\u00A7([^\u00A7]+)\u00A7/g
  let best = null
  let match

  while ((match = guidRe.exec(fullText)) !== null) {
    if (match.index > clickedOffset) break
    best = match[1]
  }

  if (best) return best

  // Not found on this page — check previous pages
  const page = textLayer.closest('.pdf-page')
  let prevPage = page?.previousElementSibling
  while (prevPage) {
    const prevTextLayer = prevPage.querySelector('.textLayer')
    if (prevTextLayer) {
      let prevText = ''
      for (const span of prevTextLayer.querySelectorAll('span')) {
        prevText += span.textContent || ''
      }
      const prevRe = /\u00A7([^\u00A7]+)\u00A7/g
      let lastGuid = null
      while ((match = prevRe.exec(prevText)) !== null) {
        lastGuid = match[1]
      }
      if (lastGuid) return lastGuid
    }
    prevPage = prevPage.previousElementSibling
  }

  return null
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

onMounted(() => { regenerate() })
onBeforeUnmount(() => { cleanup() })
</script>

<template>
  <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
      <button @click="regenerate" :disabled="isGenerating" class="btn-primary btn-sm">
        <Loader2 v-if="isGenerating" class="w-3.5 h-3.5 animate-spin" />
        <RefreshCw v-else class="w-3.5 h-3.5" />
        {{ isGenerating ? 'Generating...' : 'Regenerate' }}
      </button>

      <button @click="downloadPdf" :disabled="!pdfDoc || isGenerating" class="btn-secondary btn-sm">
        <Download class="w-3.5 h-3.5" />
      </button>

      <button @click="zoomOut" :disabled="!pdfDoc || scale <= 0.3" class="btn-ghost btn-sm">
        <ZoomOut class="w-3.5 h-3.5" />
      </button>
      <span class="text-[10px] text-gray-400 w-8 text-center">{{ Math.round(scale * 100) }}%</span>
      <button @click="zoomIn" :disabled="!pdfDoc || scale >= 3.0" class="btn-ghost btn-sm">
        <ZoomIn class="w-3.5 h-3.5" />
      </button>

      <div class="flex-1" />
      <span v-if="generationTime" class="text-[10px] text-gray-400">{{ generationTime }}s &middot; {{ pageCount }}p</span>
      <button @click="emit('close')" class="btn-ghost btn-sm"><X class="w-3.5 h-3.5" /></button>
    </div>

    <!-- PDF viewer -->
    <div ref="viewerRef" class="flex-1 overflow-y-auto" @dblclick="onDoubleClick">
      <div v-if="isGenerating && pages.length === 0" class="flex items-center justify-center h-full">
        <div class="text-center">
          <Loader2 class="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p class="text-sm text-gray-500 dark:text-gray-400">Generating PDF preview...</p>
          <p class="text-xs text-gray-400 mt-1">This may take a few seconds for {{ dictionary.entryCount }} entries</p>
        </div>
      </div>

      <div v-if="isGenerating && pages.length > 0" class="sticky top-2 z-10 flex justify-center pointer-events-none">
        <div class="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
          <Loader2 class="w-3 h-3 animate-spin" /> Regenerating...
        </div>
      </div>

      <div
        v-for="page in pages"
        :key="page.num"
        :data-page="page.num"
        class="pdf-page relative mx-auto my-3 shadow-md bg-white"
        :style="{ width: Math.floor(page.width * scale) + 'px', height: Math.floor(page.height * scale) + 'px' }"
      >
        <canvas class="absolute top-0 left-0" />
        <div class="textLayer"></div>
      </div>

      <div v-if="!isGenerating && pages.length === 0" class="flex items-center justify-center h-full">
        <p class="text-sm text-gray-500 dark:text-gray-400">Click "Regenerate" to preview the PDF</p>
      </div>
    </div>
  </div>
</template>

<style>
/* pdf.js 5.x text layer — extracted from pdfjs-dist/web/pdf_viewer.css */
.textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: clip;
  opacity: 1;
  line-height: 1;
  -webkit-text-size-adjust: none;
  -moz-text-size-adjust: none;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  caret-color: CanvasText;
  z-index: 0;
}

.textLayer {
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}

.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}

.textLayer > :not(.markedContent),
.textLayer .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}

.textLayer .markedContent {
  display: contents;
}

.textLayer ::selection {
  background: rgba(0, 0, 255, 0.25);
}

.textLayer br::selection {
  background: transparent;
}

.textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: 0;
  cursor: default;
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
}
</style>
