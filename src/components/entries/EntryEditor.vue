<script setup>
import { ref, watch, computed, toRaw } from 'vue'
import { useDictionaryStore } from '../../stores/dictionary'
import { useUiStore } from '../../stores/ui'
import { Save, RotateCcw, Trash2, Plus, Clock, Hash } from 'lucide-vue-next'
import MultilingualInput from '../shared/MultilingualInput.vue'
import SenseEditor from './SenseEditor.vue'
import ConfirmDialog from '../shared/ConfirmDialog.vue'

const dictionary = useDictionaryStore()
const ui = useUiStore()

// Local working copy of the selected entry
const localEntry = ref(null)
const hasChanges = ref(false)

// Watch for selected entry changes and create a working copy
watch(() => dictionary.selectedEntry, (entry) => {
  if (entry) {
    localEntry.value = JSON.parse(JSON.stringify(toRaw(entry)))
    hasChanges.value = false
  } else {
    localEntry.value = null
  }
}, { immediate: true })

// Track changes
function markDirty() {
  hasChanges.value = true
}

function updateForms(forms) {
  localEntry.value.forms = forms
  markDirty()
}

function updateSense(idx, sense) {
  localEntry.value.senses[idx] = sense
  markDirty()
}

function removeSense(idx) {
  localEntry.value.senses.splice(idx, 1)
  markDirty()
}

function addSense() {
  localEntry.value.senses.push({
    id: crypto.randomUUID(),
    grammaticalInfo: { value: '', traits: [] },
    glosses: { en: '' },
    definitions: { en: '' },
    examples: [],
    reversals: []
  })
  markDirty()
}

function updateMorphType(value) {
  const traits = localEntry.value.traits || []
  const morphTrait = traits.find(t => t.name === 'morph-type')
  if (morphTrait) {
    morphTrait.value = value
  } else {
    traits.push({ name: 'morph-type', value })
  }
  localEntry.value.traits = traits
  markDirty()
}

const morphType = computed(() =>
  localEntry.value?.traits?.find(t => t.name === 'morph-type')?.value || ''
)

async function save() {
  if (!localEntry.value) return
  try {
    await dictionary.saveEntry(localEntry.value)
    hasChanges.value = false
    ui.success('Entry saved')
  } catch (err) {
    ui.error('Failed to save: ' + err.message)
  }
}

function revert() {
  if (dictionary.selectedEntry) {
    localEntry.value = JSON.parse(JSON.stringify(toRaw(dictionary.selectedEntry)))
    hasChanges.value = false
  }
}

async function deleteEntry() {
  const confirmed = await ui.confirm(
    'Delete Entry',
    `Are you sure you want to delete "${localEntry.value.word}"? This cannot be undone.`
  )
  if (confirmed) {
    await dictionary.deleteEntry(localEntry.value.guid)
    ui.success('Entry deleted')
  }
}
</script>

<template>
  <ConfirmDialog />

  <div v-if="!localEntry" class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
    <div class="text-center">
      <p class="text-lg">Select an entry to edit</p>
      <p class="text-sm mt-1">Choose from the list on the left</p>
    </div>
  </div>

  <div v-else class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
      <button @click="save" :disabled="!hasChanges" class="btn-primary btn-sm">
        <Save class="w-3.5 h-3.5" /> Save
      </button>
      <button @click="revert" :disabled="!hasChanges" class="btn-secondary btn-sm">
        <RotateCcw class="w-3.5 h-3.5" /> Revert
      </button>
      <div class="flex-1" />
      <button @click="deleteEntry" class="btn-ghost btn-sm text-red-500">
        <Trash2 class="w-3.5 h-3.5" /> Delete
      </button>
    </div>

    <!-- Editor form (scrollable) -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <!-- Metadata bar -->
      <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span class="flex items-center gap-1" :title="localEntry.guid">
          <Hash class="w-3 h-3" /> {{ localEntry.guid.substring(0, 8) }}...
        </span>
        <span class="flex items-center gap-1" v-if="localEntry.dateCreated">
          <Clock class="w-3 h-3" /> Created {{ new Date(localEntry.dateCreated).toLocaleDateString() }}
        </span>
        <span class="flex items-center gap-1" v-if="localEntry.dateModified">
          <Clock class="w-3 h-3" /> Modified {{ new Date(localEntry.dateModified).toLocaleDateString() }}
        </span>
      </div>

      <!-- Lexical Unit (headword) -->
      <div>
        <label class="label">Headword</label>
        <MultilingualInput
          :modelValue="localEntry.forms"
          @update:modelValue="updateForms"
          :languages="Object.keys(localEntry.forms).length > 0 ? Object.keys(localEntry.forms) : ['mnr']"
          :labels="{ mnr: 'Paiute', en: 'English' }"
          placeholder="Enter word..."
        />
      </div>

      <!-- Morph Type -->
      <div>
        <label class="label">Morph Type</label>
        <select :value="morphType" @change="updateMorphType($event.target.value)" class="input">
          <option value="">— None —</option>
          <option value="stem">stem</option>
          <option value="prefix">prefix</option>
          <option value="suffix">suffix</option>
          <option value="phrase">phrase</option>
          <option value="particle">particle</option>
          <option value="clitic">clitic</option>
          <option value="bound stem">bound stem</option>
          <option value="root">root</option>
        </select>
      </div>

      <!-- Relations -->
      <div v-if="localEntry.relations?.length > 0">
        <label class="label">Relations</label>
        <div class="space-y-1">
          <div
            v-for="(rel, idx) in localEntry.relations"
            :key="idx"
            class="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5"
          >
            <span class="badge-gray">{{ rel.type }}</span>
            <span class="text-gray-600 dark:text-gray-400 truncate">{{ rel.ref }}</span>
            <span v-for="t in rel.traits" :key="t.name" class="badge-blue">{{ t.value }}</span>
          </div>
        </div>
      </div>

      <!-- Senses -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="label mb-0">Senses</label>
          <button @click="addSense" class="btn-secondary btn-sm">
            <Plus class="w-3.5 h-3.5" /> Add Sense
          </button>
        </div>
        <div class="space-y-4">
          <SenseEditor
            v-for="(sense, sidx) in localEntry.senses"
            :key="sense.id || sidx"
            :modelValue="sense"
            :index="sidx"
            @update:modelValue="updateSense(sidx, $event)"
            @remove="removeSense(sidx)"
          />
        </div>
      </div>

      <!-- Entry-level notes -->
      <div v-if="localEntry.notes?.length > 0">
        <label class="label">Notes</label>
        <div class="space-y-2">
          <div v-for="(note, nidx) in localEntry.notes" :key="nidx"
               class="text-sm bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-2 text-amber-800 dark:text-amber-300">
            {{ note.forms?.en || note.type || JSON.stringify(note) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
