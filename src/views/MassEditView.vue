<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDictionaryStore } from '../stores/dictionary'
import { useUiStore } from '../stores/ui'
import { Wand2, Search, ArrowRight, Check, Eye } from 'lucide-vue-next'

const router = useRouter()
const dictionary = useDictionaryStore()
const ui = useUiStore()

onMounted(async () => {
  if (!dictionary.isLoaded) {
    await dictionary.loadFromDB()
    if (!dictionary.isLoaded) router.push('/')
  }
})

// Step tracking
const step = ref(1)

// Step 1: Selection
const selectionMode = ref('all') // 'all', 'filtered', 'selected'
const targetEntries = computed(() => {
  if (selectionMode.value === 'selected') {
    return dictionary.entriesArray.filter(e => dictionary.selectedGuids.has(e.guid))
  }
  if (selectionMode.value === 'filtered') {
    return dictionary.filteredEntries
  }
  return dictionary.entriesArray
})

// Step 2: Operation
const operation = ref('find-replace')

// Step 3: Configuration
const findText = ref('')
const replaceText = ref('')
const targetField = ref('all')
const useRegex = ref(false)
const caseSensitive = ref(false)

// Change POS
const fromPOS = ref('')
const toPOS = ref('')

// Step 4: Preview
const previewResults = ref([])
const isPreviewReady = ref(false)

function generatePreview() {
  previewResults.value = []

  for (const entry of targetEntries.value) {
    const changes = computeChanges(entry)
    if (changes.length > 0) {
      previewResults.value.push({ entry, changes })
    }
  }

  isPreviewReady.value = true
  step.value = 4
}

function computeChanges(entry) {
  const changes = []

  if (operation.value === 'find-replace') {
    const findPattern = useRegex.value
      ? new RegExp(findText.value, caseSensitive.value ? 'g' : 'gi')
      : null

    const matchAndReplace = (text, fieldLabel) => {
      if (!text) return null
      if (useRegex.value) {
        if (findPattern.test(text)) {
          findPattern.lastIndex = 0
          return { field: fieldLabel, before: text, after: text.replace(findPattern, replaceText.value) }
        }
      } else {
        const searchText = caseSensitive.value ? text : text.toLowerCase()
        const searchFind = caseSensitive.value ? findText.value : findText.value.toLowerCase()
        if (searchText.includes(searchFind)) {
          const regex = new RegExp(escapeRegex(findText.value), caseSensitive.value ? 'g' : 'gi')
          return { field: fieldLabel, before: text, after: text.replace(regex, replaceText.value) }
        }
      }
      return null
    }

    // Search through fields
    if (targetField.value === 'all' || targetField.value === 'word') {
      for (const [lang, text] of Object.entries(entry.forms || {})) {
        const change = matchAndReplace(text, `Word (${lang})`)
        if (change) changes.push(change)
      }
    }
    if (targetField.value === 'all' || targetField.value === 'definitions') {
      for (const sense of entry.senses || []) {
        for (const [lang, text] of Object.entries(sense.definitions || {})) {
          const change = matchAndReplace(text, `Definition (${lang})`)
          if (change) changes.push(change)
        }
      }
    }
    if (targetField.value === 'all' || targetField.value === 'glosses') {
      for (const sense of entry.senses || []) {
        for (const [lang, text] of Object.entries(sense.glosses || {})) {
          const change = matchAndReplace(text, `Gloss (${lang})`)
          if (change) changes.push(change)
        }
      }
    }
    if (targetField.value === 'all' || targetField.value === 'examples') {
      for (const sense of entry.senses || []) {
        for (const ex of sense.examples || []) {
          for (const [lang, text] of Object.entries(ex.forms || {})) {
            const change = matchAndReplace(text, `Example (${lang})`)
            if (change) changes.push(change)
          }
          for (const trans of ex.translations || []) {
            for (const [lang, text] of Object.entries(trans.forms || {})) {
              const change = matchAndReplace(text, `Translation (${lang})`)
              if (change) changes.push(change)
            }
          }
        }
      }
    }
  }

  if (operation.value === 'change-pos') {
    for (const sense of entry.senses || []) {
      const currentPOS = sense.grammaticalInfo?.value || ''
      if (!fromPOS.value || currentPOS === fromPOS.value) {
        if (currentPOS !== toPOS.value) {
          changes.push({ field: 'POS', before: currentPOS || '(none)', after: toPOS.value })
        }
      }
    }
  }

  return changes
}

async function applyChanges() {
  const entriesToSave = []

  for (const { entry } of previewResults.value) {
    const modified = structuredClone(entry)

    if (operation.value === 'find-replace') {
      applyFindReplace(modified)
    } else if (operation.value === 'change-pos') {
      applyPOSChange(modified)
    }

    entriesToSave.push(modified)
  }

  const count = await dictionary.bulkSaveEntries(entriesToSave)
  ui.success(`Updated ${count} entries`)
  step.value = 1
  isPreviewReady.value = false
  previewResults.value = []
}

function applyFindReplace(entry) {
  const findPattern = useRegex.value
    ? new RegExp(findText.value, caseSensitive.value ? 'g' : 'gi')
    : new RegExp(escapeRegex(findText.value), caseSensitive.value ? 'g' : 'gi')

  const replaceInObj = (obj) => {
    if (!obj) return
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(findPattern, replaceText.value)
      }
    }
  }

  if (targetField.value === 'all' || targetField.value === 'word') {
    replaceInObj(entry.forms)
    entry.word = Object.values(entry.forms || {})[0] || ''
  }
  for (const sense of entry.senses || []) {
    if (targetField.value === 'all' || targetField.value === 'definitions') {
      replaceInObj(sense.definitions)
    }
    if (targetField.value === 'all' || targetField.value === 'glosses') {
      replaceInObj(sense.glosses)
    }
    if (targetField.value === 'all' || targetField.value === 'examples') {
      for (const ex of sense.examples || []) {
        replaceInObj(ex.forms)
        for (const trans of ex.translations || []) {
          replaceInObj(trans.forms)
        }
      }
    }
  }
}

function applyPOSChange(entry) {
  for (const sense of entry.senses || []) {
    const currentPOS = sense.grammaticalInfo?.value || ''
    if (!fromPOS.value || currentPOS === fromPOS.value) {
      if (!sense.grammaticalInfo) sense.grammaticalInfo = { value: '', traits: [] }
      sense.grammaticalInfo.value = toPOS.value
    }
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function reset() {
  step.value = 1
  isPreviewReady.value = false
  previewResults.value = []
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <Wand2 class="w-6 h-6 text-purple-500" />
        <h2 class="text-xl font-bold">Mass Edit</h2>
      </div>

      <!-- Step indicators -->
      <div class="flex items-center gap-2 mb-8">
        <button
          v-for="s in [
            { n: 1, label: 'Select' },
            { n: 2, label: 'Operation' },
            { n: 3, label: 'Configure' },
            { n: 4, label: 'Preview & Apply' }
          ]"
          :key="s.n"
          @click="s.n < step ? step = s.n : null"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
          :class="step === s.n
            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
            : step > s.n
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'"
        >
          <Check v-if="step > s.n" class="w-3.5 h-3.5" />
          <span v-else>{{ s.n }}</span>
          {{ s.label }}
        </button>
      </div>

      <!-- Step 1: Selection -->
      <div v-if="step === 1" class="card p-6 space-y-4">
        <h3 class="font-semibold">Which entries to edit?</h3>
        <div class="space-y-2">
          <label class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                 :class="selectionMode === 'all' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''">
            <input type="radio" v-model="selectionMode" value="all" class="text-indigo-600" />
            <div>
              <div class="font-medium text-sm">All entries</div>
              <div class="text-xs text-gray-500">{{ dictionary.entryCount }} entries</div>
            </div>
          </label>
          <label v-if="dictionary.filteredEntries.length !== dictionary.entryCount"
                 class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                 :class="selectionMode === 'filtered' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''">
            <input type="radio" v-model="selectionMode" value="filtered" class="text-indigo-600" />
            <div>
              <div class="font-medium text-sm">Filtered entries</div>
              <div class="text-xs text-gray-500">{{ dictionary.filteredEntries.length }} entries matching current filter</div>
            </div>
          </label>
          <label v-if="dictionary.selectedGuids.size > 0"
                 class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                 :class="selectionMode === 'selected' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''">
            <input type="radio" v-model="selectionMode" value="selected" class="text-indigo-600" />
            <div>
              <div class="font-medium text-sm">Selected entries</div>
              <div class="text-xs text-gray-500">{{ dictionary.selectedGuids.size }} entries selected from browse</div>
            </div>
          </label>
        </div>
        <div class="flex justify-end">
          <button @click="step = 2" class="btn-primary">
            Next <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Step 2: Operation -->
      <div v-if="step === 2" class="card p-6 space-y-4">
        <h3 class="font-semibold">Choose operation</h3>
        <div class="grid grid-cols-2 gap-3">
          <label class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                 :class="operation === 'find-replace' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''">
            <input type="radio" v-model="operation" value="find-replace" class="hidden" />
            <Search class="w-5 h-5 text-indigo-500 mb-2" />
            <div class="font-medium text-sm">Find & Replace</div>
            <div class="text-xs text-gray-500 mt-1">Search and replace text across entries</div>
          </label>
          <label class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                 :class="operation === 'change-pos' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''">
            <input type="radio" v-model="operation" value="change-pos" class="hidden" />
            <Wand2 class="w-5 h-5 text-purple-500 mb-2" />
            <div class="font-medium text-sm">Change POS</div>
            <div class="text-xs text-gray-500 mt-1">Change Part of Speech values</div>
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="step = 1" class="btn-secondary">Back</button>
          <button @click="step = 3" class="btn-primary">
            Next <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Step 3: Configure -->
      <div v-if="step === 3" class="card p-6 space-y-4">
        <h3 class="font-semibold">Configure operation</h3>

        <!-- Find & Replace config -->
        <div v-if="operation === 'find-replace'" class="space-y-4">
          <div>
            <label class="label">Target field</label>
            <select v-model="targetField" class="input">
              <option value="all">All text fields</option>
              <option value="word">Headword</option>
              <option value="glosses">Glosses</option>
              <option value="definitions">Definitions</option>
              <option value="examples">Examples & Translations</option>
            </select>
          </div>
          <div>
            <label class="label">Find</label>
            <input v-model="findText" class="input" placeholder="Text to find..." />
          </div>
          <div>
            <label class="label">Replace with</label>
            <input v-model="replaceText" class="input" placeholder="Replacement text..." />
          </div>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="useRegex" class="rounded border-gray-300 text-indigo-600" />
              Use regex
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="caseSensitive" class="rounded border-gray-300 text-indigo-600" />
              Case sensitive
            </label>
          </div>
        </div>

        <!-- Change POS config -->
        <div v-if="operation === 'change-pos'" class="space-y-4">
          <div>
            <label class="label">From POS (leave empty for any)</label>
            <select v-model="fromPOS" class="input">
              <option value="">Any POS</option>
              <option v-for="pos in dictionary.uniquePOSValues" :key="pos" :value="pos">{{ pos }}</option>
            </select>
          </div>
          <div>
            <label class="label">To POS</label>
            <select v-model="toPOS" class="input">
              <option value="">— Select —</option>
              <option v-for="pos in dictionary.uniquePOSValues" :key="pos" :value="pos">{{ pos }}</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button @click="step = 2" class="btn-secondary">Back</button>
          <button
            @click="generatePreview"
            class="btn-primary"
            :disabled="(operation === 'find-replace' && !findText) || (operation === 'change-pos' && !toPOS)"
          >
            <Eye class="w-4 h-4" /> Preview Changes
          </button>
        </div>
      </div>

      <!-- Step 4: Preview -->
      <div v-if="step === 4" class="space-y-4">
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold">
              Preview — {{ previewResults.length }} entries will be modified
            </h3>
            <span class="text-sm text-gray-500">
              out of {{ targetEntries.length }} checked
            </span>
          </div>

          <div v-if="previewResults.length === 0" class="text-center py-8 text-gray-400">
            No matches found. Try adjusting your search.
          </div>

          <div v-else class="space-y-3 max-h-[60vh] overflow-y-auto">
            <div v-for="{ entry, changes } in previewResults.slice(0, 100)" :key="entry.guid"
                 class="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div class="font-medium text-sm mb-2">{{ entry.word }}</div>
              <div v-for="(change, cidx) in changes" :key="cidx" class="text-xs space-y-0.5 ml-4">
                <span class="text-gray-500">{{ change.field }}:</span>
                <div class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded line-through">{{ change.before }}</div>
                <div class="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">{{ change.after }}</div>
              </div>
            </div>
            <div v-if="previewResults.length > 100" class="text-center text-sm text-gray-400 py-2">
              ... and {{ previewResults.length - 100 }} more entries
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button @click="reset" class="btn-secondary">Cancel</button>
          <button @click="step = 3" class="btn-secondary">Back</button>
          <button
            @click="applyChanges"
            class="btn-primary"
            :disabled="previewResults.length === 0"
          >
            <Check class="w-4 h-4" /> Apply {{ previewResults.length }} Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
