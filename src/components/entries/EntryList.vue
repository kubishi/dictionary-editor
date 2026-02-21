<script setup>
import { ref, computed, watch } from 'vue'
import { useDictionaryStore } from '../../stores/dictionary'
import SearchInput from '../shared/SearchInput.vue'
import EntryListItem from './EntryListItem.vue'
import { Plus, ArrowUpDown, CheckSquare, Square } from 'lucide-vue-next'

const dictionary = useDictionaryStore()

const showCheckboxes = ref(false)
const visibleCount = ref(100)
const listContainer = ref(null)

// Load more entries as user scrolls
function onScroll(e) {
  const el = e.target
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
    visibleCount.value = Math.min(visibleCount.value + 100, dictionary.filteredEntries.length)
  }
}

// Reset visible count when filter changes
watch(() => dictionary.filteredEntries.length, () => {
  visibleCount.value = 100
})

const visibleEntries = computed(() =>
  dictionary.filteredEntries.slice(0, visibleCount.value)
)

function selectEntry(guid) {
  dictionary.selectedGuid = guid
}

function toggleCheck(guid) {
  if (dictionary.selectedGuids.has(guid)) {
    dictionary.selectedGuids.delete(guid)
  } else {
    dictionary.selectedGuids.add(guid)
  }
}

function toggleSort() {
  if (dictionary.sortBy === 'word' && dictionary.sortDirection === 'asc') {
    dictionary.sortDirection = 'desc'
  } else if (dictionary.sortBy === 'word' && dictionary.sortDirection === 'desc') {
    dictionary.sortBy = 'dateModified'
    dictionary.sortDirection = 'desc'
  } else {
    dictionary.sortBy = 'word'
    dictionary.sortDirection = 'asc'
  }
}

const sortLabel = computed(() => {
  if (dictionary.sortBy === 'word') return dictionary.sortDirection === 'asc' ? 'A-Z' : 'Z-A'
  return 'Recent'
})

function addNewEntry() {
  const entry = dictionary.createNewEntry()
  dictionary.saveEntry(entry).then(() => {
    dictionary.selectedGuid = entry.guid
  })
}

function selectAll() {
  for (const entry of dictionary.filteredEntries) {
    dictionary.selectedGuids.add(entry.guid)
  }
}

function deselectAll() {
  dictionary.selectedGuids.clear()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Search and controls -->
    <div class="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <SearchInput
        v-model="dictionary.searchQuery"
        placeholder="Search entries..."
      />

      <div class="flex items-center gap-2">
        <!-- POS filter -->
        <select v-model="dictionary.filterPOS" class="input text-xs py-1 flex-1">
          <option :value="null">All POS</option>
          <option v-for="pos in dictionary.uniquePOSValues" :key="pos" :value="pos">{{ pos }}</option>
        </select>

        <!-- Sort -->
        <button @click="toggleSort" class="btn-ghost btn-sm text-xs whitespace-nowrap">
          <ArrowUpDown class="w-3 h-3" /> {{ sortLabel }}
        </button>

        <!-- Multi-select toggle -->
        <button
          @click="showCheckboxes = !showCheckboxes; if (!showCheckboxes) deselectAll()"
          class="btn-ghost btn-sm"
          :class="showCheckboxes ? 'text-indigo-600' : ''"
        >
          <component :is="showCheckboxes ? CheckSquare : Square" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Selection bar -->
      <div v-if="showCheckboxes && dictionary.selectedGuids.size > 0"
           class="flex items-center gap-2 text-xs">
        <span class="text-indigo-600 dark:text-indigo-400 font-medium">
          {{ dictionary.selectedGuids.size }} selected
        </span>
        <button @click="selectAll" class="text-indigo-600 hover:underline">Select all</button>
        <button @click="deselectAll" class="text-gray-500 hover:underline">Clear</button>
      </div>
    </div>

    <!-- Entry count -->
    <div class="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between shrink-0">
      <span>{{ dictionary.filteredEntries.length }} entries</span>
      <button @click="addNewEntry" class="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
        <Plus class="w-3 h-3" /> New
      </button>
    </div>

    <!-- Scrollable list -->
    <div ref="listContainer" class="flex-1 overflow-y-auto" @scroll="onScroll">
      <EntryListItem
        v-for="entry in visibleEntries"
        :key="entry.guid"
        :entry="entry"
        :selected="dictionary.selectedGuid === entry.guid"
        :checked="dictionary.selectedGuids.has(entry.guid)"
        :showCheckbox="showCheckboxes"
        @select="selectEntry(entry.guid)"
        @toggle-check="toggleCheck(entry.guid)"
      />
      <div v-if="visibleCount < dictionary.filteredEntries.length"
           class="py-4 text-center text-xs text-gray-400">
        Showing {{ visibleCount }} of {{ dictionary.filteredEntries.length }}...
      </div>
      <div v-if="dictionary.filteredEntries.length === 0"
           class="py-12 text-center text-gray-400">
        <p>No entries found</p>
        <p v-if="dictionary.searchQuery" class="text-sm mt-1">Try a different search term</p>
      </div>
    </div>
  </div>
</template>
