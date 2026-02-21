import { XMLBuilder } from 'fast-xml-parser'

const XML_BUILDER_CONFIG = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  indentBy: '',
  suppressEmptyNode: false
}

/**
 * Serialize entries and metadata back to a LIFT XML string.
 * Uses the _rawEntry from each entry for round-trip fidelity,
 * overlaying any edits from the structured model.
 */
export function serializeToLift(entries, metadata) {
  const builder = new XMLBuilder(XML_BUILDER_CONFIG)

  // Build the LIFT document
  const liftDoc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    lift: {
      '@_producer': 'KubishiDictionaryEditor/1.0 (based on ' + (metadata.liftAttributes?.producer || 'unknown') + ')',
      '@_version': metadata.liftAttributes?.version || '0.13',
    }
  }

  // Restore header if we have it
  if (metadata.header) {
    liftDoc.lift.header = metadata.header
  }

  // Build entries — use _rawEntry as base, overlay structured edits
  liftDoc.lift.entry = entries.map(entry => buildEntryXml(entry))

  return builder.build(liftDoc)
}

/**
 * Build a single entry's XML object.
 * If the entry has a _rawEntry (imported), start from that and overlay edits.
 * If new (no _rawEntry), build from scratch.
 */
function buildEntryXml(entry) {
  if (entry._rawEntry) {
    return overlayEditsOnRaw(entry)
  }
  return buildNewEntryXml(entry)
}

/**
 * Overlay structured model edits onto the original raw XML object.
 * This preserves any elements we don't explicitly model.
 */
function overlayEditsOnRaw(entry) {
  // Deep clone the raw entry to avoid mutating the original
  const raw = structuredClone(entry._rawEntry)

  // Update entry-level attributes
  raw['@_id'] = entry.entryId
  raw['@_guid'] = entry.guid
  raw['@_dateCreated'] = entry.dateCreated
  raw['@_dateModified'] = entry.dateModified
  if (entry.order !== undefined) {
    raw['@_order'] = entry.order
  }

  // Update lexical-unit forms
  if (entry.forms && Object.keys(entry.forms).length > 0) {
    raw['lexical-unit'] = {
      form: Object.entries(entry.forms).map(([lang, text]) => ({
        '@_lang': lang,
        text: text
      }))
    }
  }

  // Update traits
  if (entry.traits && entry.traits.length > 0) {
    raw.trait = entry.traits.map(t => ({
      '@_name': t.name,
      '@_value': t.value
    }))
  }

  // Update relations
  if (entry.relations && entry.relations.length > 0) {
    raw.relation = entry.relations.map(r => {
      const rel = {
        '@_type': r.type,
        '@_ref': r.ref
      }
      if (r.order !== undefined) rel['@_order'] = r.order
      if (r.traits && r.traits.length > 0) {
        rel.trait = r.traits.map(t => ({
          '@_name': t.name,
          '@_value': t.value
        }))
      }
      return rel
    })
  } else if (raw.relation) {
    // Relations were removed
    delete raw.relation
  }

  // Update senses
  if (entry.senses && entry.senses.length > 0) {
    raw.sense = entry.senses.map(sense => buildSenseXml(sense))
  }

  // Update entry-level notes
  if (entry.notes && entry.notes.length > 0) {
    raw.note = entry.notes.map(buildNoteXml)
  }

  return raw
}

function buildSenseXml(sense) {
  // If we have the raw sense, start from that
  const raw = sense._rawSense ? structuredClone(sense._rawSense) : {}

  raw['@_id'] = sense.id
  if (sense.order !== undefined) {
    raw['@_order'] = sense.order
  }

  // Grammatical info
  if (sense.grammaticalInfo?.value) {
    raw['grammatical-info'] = {
      '@_value': sense.grammaticalInfo.value
    }
    if (sense.grammaticalInfo.traits?.length > 0) {
      raw['grammatical-info'].trait = sense.grammaticalInfo.traits.map(t => ({
        '@_name': t.name,
        '@_value': t.value
      }))
    }
  } else {
    delete raw['grammatical-info']
  }

  // Glosses
  if (sense.glosses && Object.keys(sense.glosses).length > 0) {
    raw.gloss = Object.entries(sense.glosses).map(([lang, text]) => ({
      '@_lang': lang,
      text: text
    }))
  } else {
    delete raw.gloss
  }

  // Definitions
  if (sense.definitions && Object.keys(sense.definitions).length > 0) {
    raw.definition = {
      form: Object.entries(sense.definitions).map(([lang, text]) => ({
        '@_lang': lang,
        text: text
      }))
    }
  } else {
    delete raw.definition
  }

  // Examples
  if (sense.examples && sense.examples.length > 0) {
    raw.example = sense.examples.map(buildExampleXml)
  } else {
    delete raw.example
  }

  // Reversals
  if (sense.reversals && sense.reversals.length > 0) {
    raw.reversal = sense.reversals.map(rev => ({
      '@_type': rev.type,
      form: Object.entries(rev.forms).map(([lang, text]) => ({
        '@_lang': lang,
        text: text
      }))
    }))
  }
  // If reversals are from raw and not in model, leave them (they survive via _rawSense)

  return raw
}

function buildExampleXml(example) {
  const xml = {}

  if (example.source) {
    xml['@_source'] = example.source
  }

  // Forms
  if (example.forms && Object.keys(example.forms).length > 0) {
    xml.form = Object.entries(example.forms).map(([lang, text]) => ({
      '@_lang': lang,
      text: text
    }))
  }

  // Translations
  if (example.translations && example.translations.length > 0) {
    xml.translation = example.translations.map(trans => ({
      '@_type': trans.type,
      form: Object.entries(trans.forms).map(([lang, text]) => ({
        '@_lang': lang,
        text: text
      }))
    }))
  }

  // Notes
  if (example.notes && example.notes.length > 0) {
    xml.note = example.notes.map(buildNoteXml)
  }

  return xml
}

function buildNoteXml(note) {
  const xml = {}
  if (note.type) {
    xml['@_type'] = note.type
  }
  if (note.forms && Object.keys(note.forms).length > 0) {
    xml.form = Object.entries(note.forms).map(([lang, text]) => ({
      '@_lang': lang,
      text: text
    }))
  }
  return xml
}

/**
 * Build XML for a brand new entry (no _rawEntry).
 */
function buildNewEntryXml(entry) {
  const xml = {
    '@_dateCreated': entry.dateCreated,
    '@_dateModified': entry.dateModified,
    '@_id': entry.entryId,
    '@_guid': entry.guid
  }

  if (entry.order !== undefined) {
    xml['@_order'] = entry.order
  }

  // Lexical unit
  if (entry.forms && Object.keys(entry.forms).length > 0) {
    xml['lexical-unit'] = {
      form: Object.entries(entry.forms).map(([lang, text]) => ({
        '@_lang': lang,
        text: text
      }))
    }
  }

  // Traits
  if (entry.traits?.length > 0) {
    xml.trait = entry.traits.map(t => ({
      '@_name': t.name,
      '@_value': t.value
    }))
  }

  // Relations
  if (entry.relations?.length > 0) {
    xml.relation = entry.relations.map(r => {
      const rel = { '@_type': r.type, '@_ref': r.ref }
      if (r.order !== undefined) rel['@_order'] = r.order
      if (r.traits?.length > 0) {
        rel.trait = r.traits.map(t => ({ '@_name': t.name, '@_value': t.value }))
      }
      return rel
    })
  }

  // Senses
  if (entry.senses?.length > 0) {
    xml.sense = entry.senses.map(buildSenseXml)
  }

  // Notes
  if (entry.notes?.length > 0) {
    xml.note = entry.notes.map(buildNoteXml)
  }

  return xml
}
