import { XMLParser } from 'fast-xml-parser'

// Shared config — must match lift-serializer.js for round-trip fidelity
export const XML_PARSER_CONFIG = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false, // Keep as strings for GUIDs, dates
  trimValues: false,
  isArray: (name) => {
    // Force these elements to always be arrays for consistent handling
    const arrayElements = [
      'entry', 'sense', 'form', 'example', 'note', 'trait',
      'relation', 'gloss', 'reversal', 'field', 'range'
    ]
    return arrayElements.includes(name)
  }
}

/**
 * Parse a LIFT XML string into structured data.
 * Returns { entries, metadata } where metadata contains everything needed for round-tripping.
 */
export function parseLiftXml(xmlString) {
  const parser = new XMLParser(XML_PARSER_CONFIG)
  const parsed = parser.parse(xmlString)
  const lift = parsed.lift

  if (!lift || !lift.entry) {
    throw new Error('Invalid .lift file: no <lift> root or <entry> elements found')
  }

  // Extract metadata for round-tripping
  const metadata = {
    liftAttributes: {
      producer: lift['@_producer'] || 'unknown',
      version: lift['@_version'] || '0.13'
    },
    header: lift.header || null
  }

  // Parse each entry
  const entries = lift.entry.map(rawEntry => parseEntry(rawEntry))

  return { entries, metadata }
}

/**
 * Parse a single <entry> XML object into the structured model.
 * Stores the original raw object as _rawEntry for round-tripping.
 */
function parseEntry(rawEntry) {
  const entry = {
    guid: rawEntry['@_guid'] || '',
    entryId: rawEntry['@_id'] || '',
    dateCreated: rawEntry['@_dateCreated'] || '',
    dateModified: rawEntry['@_dateModified'] || '',
    order: rawEntry['@_order'] || undefined,
    forms: {},
    word: '',
    traits: [],
    relations: [],
    senses: [],
    notes: [],
    sensePosList: [],
    _rawEntry: rawEntry
  }

  // Lexical unit forms
  if (rawEntry['lexical-unit']) {
    const forms = ensureArray(rawEntry['lexical-unit'].form)
    for (const form of forms) {
      const lang = form['@_lang']
      const text = extractText(form)
      if (lang && text) {
        entry.forms[lang] = text
      }
    }
  }

  // Primary word (first form value)
  entry.word = Object.values(entry.forms)[0] || ''

  // Traits (morph-type, etc.)
  if (rawEntry.trait) {
    entry.traits = ensureArray(rawEntry.trait).map(t => ({
      name: t['@_name'] || '',
      value: t['@_value'] || ''
    }))
  }

  // Relations
  if (rawEntry.relation) {
    entry.relations = ensureArray(rawEntry.relation).map(r => ({
      type: r['@_type'] || '',
      ref: r['@_ref'] || '',
      order: r['@_order'] || undefined,
      traits: r.trait ? ensureArray(r.trait).map(t => ({
        name: t['@_name'] || '',
        value: t['@_value'] || ''
      })) : []
    }))
  }

  // Entry-level notes
  if (rawEntry.note) {
    entry.notes = ensureArray(rawEntry.note).map(parseNote)
  }

  // Senses
  if (rawEntry.sense) {
    entry.senses = ensureArray(rawEntry.sense).map(parseSense)
  }

  // Compute POS index for Dexie multi-entry filtering
  entry.sensePosList = [...new Set(
    entry.senses
      .map(s => s.grammaticalInfo?.value)
      .filter(Boolean)
  )]

  return entry
}

function parseSense(rawSense) {
  const sense = {
    id: rawSense['@_id'] || '',
    order: rawSense['@_order'] || undefined,
    grammaticalInfo: null,
    glosses: {},
    definitions: {},
    examples: [],
    reversals: [],
    _rawSense: rawSense
  }

  // Grammatical info
  if (rawSense['grammatical-info']) {
    const gi = rawSense['grammatical-info']
    sense.grammaticalInfo = {
      value: gi['@_value'] || '',
      traits: gi.trait ? ensureArray(gi.trait).map(t => ({
        name: t['@_name'] || '',
        value: t['@_value'] || ''
      })) : []
    }
  }

  // Glosses
  if (rawSense.gloss) {
    for (const gloss of ensureArray(rawSense.gloss)) {
      const lang = gloss['@_lang']
      const text = extractText(gloss)
      if (lang && text) {
        sense.glosses[lang] = text
      }
    }
  }

  // Definitions
  if (rawSense.definition) {
    const def = rawSense.definition
    const defForms = def.form ? ensureArray(def.form) : []
    for (const form of defForms) {
      const lang = form['@_lang']
      const text = extractText(form)
      if (lang && text) {
        sense.definitions[lang] = text
      }
    }
  }

  // Examples
  if (rawSense.example) {
    sense.examples = ensureArray(rawSense.example).map(parseExample)
  }

  // Reversals
  if (rawSense.reversal) {
    sense.reversals = ensureArray(rawSense.reversal).map(rev => ({
      type: rev['@_type'] || '',
      forms: extractForms(rev.form)
    }))
  }

  return sense
}

function parseExample(rawExample) {
  const example = {
    source: rawExample['@_source'] || '',
    forms: {},
    translations: [],
    notes: []
  }

  // Example forms (the sentence in source language)
  if (rawExample.form) {
    example.forms = extractForms(rawExample.form)
  }

  // Translations
  if (rawExample.translation) {
    example.translations = ensureArray(rawExample.translation).map(trans => ({
      type: trans['@_type'] || '',
      forms: extractForms(trans.form)
    }))
  }

  // Notes
  if (rawExample.note) {
    example.notes = ensureArray(rawExample.note).map(parseNote)
  }

  return example
}

function parseNote(rawNote) {
  if (typeof rawNote === 'string') {
    return { type: '', forms: { en: rawNote } }
  }
  return {
    type: rawNote['@_type'] || '',
    forms: rawNote.form ? extractForms(rawNote.form) : {}
  }
}

// --- Helpers ---

function ensureArray(val) {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function extractText(formOrGloss) {
  if (!formOrGloss) return ''
  const text = formOrGloss.text
  if (!text) return ''
  if (typeof text === 'string') return text
  if (typeof text === 'object' && text['#text'] !== undefined) return String(text['#text'])
  return String(text)
}

function extractForms(rawForms) {
  const forms = {}
  if (!rawForms) return forms
  for (const form of ensureArray(rawForms)) {
    const lang = form['@_lang']
    const text = extractText(form)
    if (lang && text) {
      forms[lang] = text
    }
  }
  return forms
}
