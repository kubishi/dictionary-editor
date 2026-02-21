/**
 * Client-side search and filter for dictionary entries.
 * Searches across word forms, glosses, and definitions.
 */

export function searchEntries(entries, query) {
  if (!query || !query.trim()) return entries

  const terms = query.toLowerCase().trim().split(/\s+/)

  const scored = entries.map(entry => {
    let score = 0
    const wordLower = (entry.word || '').toLowerCase()
    const queryLower = query.toLowerCase().trim()

    // Exact word match — highest boost
    if (wordLower === queryLower) {
      score += 100
    }
    // Word starts with query
    else if (wordLower.startsWith(queryLower)) {
      score += 50
    }
    // Word contains query
    else if (wordLower.includes(queryLower)) {
      score += 25
    }

    // Search across all text fields for each term
    for (const term of terms) {
      // Forms
      for (const formText of Object.values(entry.forms || {})) {
        if (formText.toLowerCase().includes(term)) score += 10
      }

      // Senses
      for (const sense of entry.senses || []) {
        for (const def of Object.values(sense.definitions || {})) {
          if (def.toLowerCase().includes(term)) score += 8
        }
        for (const gloss of Object.values(sense.glosses || {})) {
          if (gloss.toLowerCase().includes(term)) score += 8
          // Exact gloss match
          if (gloss.toLowerCase() === term) score += 20
        }
        // Examples
        for (const ex of sense.examples || []) {
          for (const text of Object.values(ex.forms || {})) {
            if (text.toLowerCase().includes(term)) score += 3
          }
          for (const trans of ex.translations || []) {
            for (const text of Object.values(trans.forms || {})) {
              if (text.toLowerCase().includes(term)) score += 3
            }
          }
        }
      }
    }

    return { entry, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.entry)
}

export function filterByPOS(entries, pos) {
  if (!pos) return entries
  return entries.filter(entry =>
    entry.senses?.some(s => s.grammaticalInfo?.value === pos)
  )
}

export function filterByMorphType(entries, morphType) {
  if (!morphType) return entries
  return entries.filter(entry =>
    entry.traits?.some(t => t.name === 'morph-type' && t.value === morphType)
  )
}

export function sortEntries(entries, sortBy, direction = 'asc') {
  const sorted = [...entries]
  const dir = direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'word':
        return dir * (a.word || '').localeCompare(b.word || '')
      case 'dateModified':
        return dir * ((a.dateModified || '').localeCompare(b.dateModified || ''))
      case 'dateCreated':
        return dir * ((a.dateCreated || '').localeCompare(b.dateCreated || ''))
      default:
        return 0
    }
  })

  return sorted
}
