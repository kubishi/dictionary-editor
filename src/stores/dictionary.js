import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import db from '../db/index.js'
import { parseLiftXml } from '../services/lift-parser.js'
import { serializeToLift } from '../services/lift-serializer.js'
import { searchEntries, filterByPOS, filterByMorphType, sortEntries } from '../services/search.js'

export const useDictionaryStore = defineStore('dictionary', () => {
  // --- State ---
  const entries = ref(new Map())
  const metadata = ref(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const isDirty = ref(false)

  // Browse state
  const searchQuery = ref('')
  const filterPOS = ref(null)
  const filterMorph = ref(null)
  const sortBy = ref('word')
  const sortDirection = ref('asc')
  const selectedGuid = ref(null)
  const selectedGuids = ref(new Set())

  // --- Getters ---
  const entriesArray = computed(() => Array.from(entries.value.values()))

  const filteredEntries = computed(() => {
    let result = entriesArray.value
    if (filterPOS.value) result = filterByPOS(result, filterPOS.value)
    if (filterMorph.value) result = filterByMorphType(result, filterMorph.value)
    if (searchQuery.value) result = searchEntries(result, searchQuery.value)
    else result = sortEntries(result, sortBy.value, sortDirection.value)
    return result
  })

  const entryCount = computed(() => entries.value.size)

  const senseCount = computed(() =>
    entriesArray.value.reduce((sum, e) => sum + (e.senses?.length || 0), 0)
  )

  const exampleCount = computed(() =>
    entriesArray.value.reduce((sum, e) =>
      sum + e.senses.reduce((s2, s) => s2 + (s.examples?.length || 0), 0), 0)
  )

  const uniquePOSValues = computed(() => {
    const posSet = new Set()
    for (const entry of entriesArray.value) {
      for (const sense of entry.senses || []) {
        if (sense.grammaticalInfo?.value) posSet.add(sense.grammaticalInfo.value)
      }
    }
    return [...posSet].sort()
  })

  const uniqueMorphTypes = computed(() => {
    const set = new Set()
    for (const entry of entriesArray.value) {
      for (const trait of entry.traits || []) {
        if (trait.name === 'morph-type') set.add(trait.value)
      }
    }
    return [...set].sort()
  })

  const selectedEntry = computed(() =>
    selectedGuid.value ? entries.value.get(selectedGuid.value) : null
  )

  // --- Actions ---

  async function loadFromDB() {
    isLoading.value = true
    try {
      const allEntries = await db.entries.toArray()
      const map = new Map()
      for (const e of allEntries) {
        map.set(e.guid, e)
      }
      entries.value = map

      const meta = await db.metadata.get('liftMetadata')
      if (meta) {
        metadata.value = meta.value
      }

      isLoaded.value = entries.value.size > 0
    } finally {
      isLoading.value = false
    }
  }

  async function importLift(xmlString) {
    isLoading.value = true
    try {
      const { entries: parsed, metadata: meta } = parseLiftXml(xmlString)

      // Clear existing data
      await db.entries.clear()
      await db.metadata.clear()

      // Store metadata
      await db.metadata.put({ key: 'liftMetadata', value: meta })
      metadata.value = meta

      // Bulk insert entries
      await db.entries.bulkPut(parsed)

      // Load into memory
      const map = new Map()
      for (const e of parsed) {
        map.set(e.guid, e)
      }
      entries.value = map
      isLoaded.value = true
      isDirty.value = false

      return parsed.length
    } finally {
      isLoading.value = false
    }
  }

  async function saveEntry(entry) {
    entry.dateModified = new Date().toISOString()
    entry.word = Object.values(entry.forms || {})[0] || ''
    entry.sensePosList = [...new Set(
      entry.senses.map(s => s.grammaticalInfo?.value).filter(Boolean)
    )]

    await db.entries.put(entry)
    entries.value.set(entry.guid, { ...entry })
    isDirty.value = true
  }

  async function deleteEntry(guid) {
    await db.entries.delete(guid)
    entries.value.delete(guid)
    if (selectedGuid.value === guid) selectedGuid.value = null
    isDirty.value = true
  }

  async function deleteEntries(guids) {
    await db.entries.bulkDelete([...guids])
    for (const guid of guids) {
      entries.value.delete(guid)
    }
    if (guids.has(selectedGuid.value)) selectedGuid.value = null
    selectedGuids.value.clear()
    isDirty.value = true
  }

  function createNewEntry() {
    const guid = crypto.randomUUID()
    const now = new Date().toISOString()
    return {
      guid,
      entryId: `new_${guid}`,
      dateCreated: now,
      dateModified: now,
      forms: { mnr: '' },
      word: '',
      traits: [{ name: 'morph-type', value: 'stem' }],
      relations: [],
      senses: [{
        id: crypto.randomUUID(),
        grammaticalInfo: { value: '', traits: [] },
        glosses: { en: '' },
        definitions: { en: '' },
        examples: [],
        reversals: []
      }],
      notes: [],
      sensePosList: [],
      _rawEntry: null
    }
  }

  async function exportToLift() {
    const allEntries = await db.entries.toArray()
    const meta = metadata.value || { liftAttributes: { producer: 'unknown', version: '0.13' } }
    return serializeToLift(allEntries, meta)
  }

  // Mass edit actions
  async function bulkSaveEntries(updatedEntries) {
    const now = new Date().toISOString()
    const toSave = updatedEntries.map(e => ({
      ...e,
      dateModified: now,
      word: Object.values(e.forms || {})[0] || '',
      sensePosList: [...new Set(e.senses.map(s => s.grammaticalInfo?.value).filter(Boolean))]
    }))

    await db.entries.bulkPut(toSave)
    for (const e of toSave) {
      entries.value.set(e.guid, e)
    }
    isDirty.value = true
    return toSave.length
  }

  async function clearAll() {
    await db.entries.clear()
    await db.metadata.clear()
    entries.value = new Map()
    metadata.value = null
    isLoaded.value = false
    isDirty.value = false
    selectedGuid.value = null
    selectedGuids.value.clear()
  }

  return {
    // State
    entries, metadata, isLoaded, isLoading, isDirty,
    searchQuery, filterPOS, filterMorph, sortBy, sortDirection,
    selectedGuid, selectedGuids,
    // Getters
    entriesArray, filteredEntries, entryCount, senseCount, exampleCount,
    uniquePOSValues, uniqueMorphTypes, selectedEntry,
    // Actions
    loadFromDB, importLift, saveEntry, deleteEntry, deleteEntries,
    createNewEntry, exportToLift, bulkSaveEntries, clearAll
  }
})
