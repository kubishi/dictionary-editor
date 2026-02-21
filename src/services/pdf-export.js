import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs

// POS abbreviations for compact display
const POS_ABBREV = {
  'Noun': 'n',
  'Verb': 'v',
  'Adjective': 'adj',
  'Adverb': 'adv',
  'Pronoun': 'prn',
  'Postposition': 'pp',
  'Conjunction': 'conj',
  'Interjection': 'interj',
  'Particle': 'part',
  'Classifier': 'clf',
  'Idiom': 'idm',
  'Place': 'place',
  'Instrumental Prefix': 'instr pfx'
}

// Morph type abbreviations
const MORPH_ABBREV = {
  'stem': '',
  'prefix': 'pfx',
  'suffix': 'sfx',
  'phrase': 'phr',
  'particle': 'part',
  'clitic': 'clt',
  'bound stem': 'bd stm',
  'root': 'rt'
}

/**
 * Build the pdfmake document definition for the dictionary.
 * Shared by both download and preview functions.
 */
function buildDocDefinition(entries, options = {}) {
  const {
    title = 'Dictionary',
    subtitle = '',
    includeExamples = true,
    pageSize = 'LETTER',
    fontSize = 9
  } = options

  const HANGING_INDENT = 10
  const COL_GAP = 18
  const PAGE_MARGINS = [36, 45, 36, 36]

  // Sort entries alphabetically
  const sorted = [...entries].sort((a, b) =>
    (a.word || '').localeCompare(b.word || '')
  )

  // Group entries by first letter
  const letterGroups = new Map()
  for (const entry of sorted) {
    const letter = getFirstAlpha(entry.word || '').toUpperCase() || '#'
    if (!letterGroups.has(letter)) letterGroups.set(letter, [])
    letterGroups.get(letter).push(entry)
  }

  // Build content
  const content = []

  // --- Title page ---
  content.push(
    { text: title, fontSize: fontSize + 16, bold: true, alignment: 'center', margin: [0, 140, 0, 8] },
    { text: subtitle, fontSize: fontSize + 4, color: '#444', alignment: 'center', margin: [0, 0, 0, 16] },
    {
      canvas: [{ type: 'line', x1: 180, y1: 0, x2: 360, y2: 0, lineWidth: 0.5, lineColor: '#999' }],
      margin: [0, 0, 0, 16]
    },
    { text: `${sorted.length} entries`, alignment: 'center', fontSize: fontSize, color: '#666' },
    { text: `Generated ${new Date().toLocaleDateString()}`, alignment: 'center', fontSize: fontSize - 1, color: '#999', margin: [0, 6, 0, 0] },
    { text: '', pageBreak: 'after' }
  )

  // --- Letter sections ---
  let isFirstLetter = true
  for (const [letter, letterEntries] of letterGroups) {
    // Page break before each new letter (except first)
    if (!isFirstLetter) {
      content.push({ text: '', pageBreak: 'after' })
    }
    isFirstLetter = false

    // Centered letter header: "A a"
    content.push({
      text: `${letter} ${letter.toLowerCase()}`,
      fontSize: fontSize + 10,
      alignment: 'center',
      margin: [0, 10, 0, 12]
    })

    // Build all entry blocks for this letter as flat pdfmake nodes
    const entryBlocks = []
    for (const entry of letterEntries) {
      const block = buildEntryBlock(entry, { includeExamples, fontSize, HANGING_INDENT })
      entryBlocks.push(block)
    }

    // Split entries into two columns by estimated height
    const { left, right } = splitIntoColumns(entryBlocks, fontSize)

    content.push({
      columns: [
        { width: '*', stack: left },
        { width: '*', stack: right }
      ],
      columnGap: COL_GAP
    })
  }

  return {
    pageSize,
    pageMargins: PAGE_MARGINS,
    header: (currentPage, pageCount) => {
      if (currentPage <= 1) return null // skip title page
      return {
        columns: [
          {
            text: String(currentPage),
            fontSize: fontSize - 1,
            margin: [PAGE_MARGINS[0], 18, 0, 0]
          },
          {
            text: title.toLowerCase(),
            fontSize: fontSize - 1,
            alignment: 'right',
            margin: [0, 18, PAGE_MARGINS[2], 0]
          }
        ]
      }
    },
    footer: null,
    content,
    defaultStyle: {
      font: 'Roboto',
      fontSize: fontSize,
      lineHeight: 1.2
    }
  }
}

/**
 * Generate and download a dictionary PDF.
 */
export async function generateDictionaryPdf(entries, options = {}) {
  const docDefinition = buildDocDefinition(entries, options)
  const title = options.title || 'Dictionary'
  pdfMake.createPdf(docDefinition).download(
    `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`
  )
}

/**
 * Generate a PDF and return a blob URL for iframe preview.
 * Uses blob URLs instead of data URLs — far more efficient for large PDFs.
 * Returns a Promise<string> with the blob URL.
 * Caller is responsible for revoking the URL when done.
 */
export function generatePdfBlobUrl(entries, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const docDefinition = buildDocDefinition(entries, options)
      pdfMake.createPdf(docDefinition).getBlob((blob) => {
        const url = URL.createObjectURL(blob)
        resolve(url)
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Build a single dictionary entry as a pdfmake stack with hanging indent.
 *
 * Format matches professional dictionaries:
 *   headword  POS  1) Definition text continues
 *     here with hanging indent.  Example sentence
 *     in italic.  Translation.  Source 01/01/05
 */
function buildEntryBlock(entry, { includeExamples, fontSize, HANGING_INDENT }) {
  const morphType = entry.traits?.find(t => t.name === 'morph-type')?.value || ''
  const morphAbbr = MORPH_ABBREV[morphType] || ''
  const senses = entry.senses || []
  const hasRelations = entry.relations?.length > 0

  // Build inline text array for the entire entry
  const textParts = []

  // Invisible GUID marker for pdf.js click-to-navigate
  if (entry.guid) {
    textParts.push({ text: `\u00A7${entry.guid}\u00A7`, fontSize: 0.5, color: '#FFFFFF' })
  }

  // Headword (bold)
  textParts.push({ text: entry.word || '(empty)', bold: true })

  // If it's a variant/relation-only entry (no senses), show the relation
  if (senses.length === 0 && hasRelations) {
    const rel = entry.relations[0]
    const variantType = rel.traits?.find(t => t.name === 'variant-type')?.value || ''
    const refWord = (rel.ref || '').split('_')[0] // Extract word from "word_guid" ref
    const typeAbbr = variantType === 'Free Variant' ? 'fr. var.' :
                     variantType === 'Dialectal Variant' ? 'dial. var.' :
                     variantType === 'Spelling Variant' ? 'sp. var.' :
                     variantType ? variantType.toLowerCase() : 'var.'
    textParts.push({ text: `  ${typeAbbr} of ` })
    textParts.push({ text: refWord, bold: true })

    return {
      text: textParts,
      margin: [HANGING_INDENT, 2.5, 0, 2.5],
      leadingIndent: -HANGING_INDENT,
      fontSize
    }
  }

  // For entries with senses
  for (let si = 0; si < senses.length; si++) {
    const sense = senses[si]
    const pos = sense.grammaticalInfo?.value || ''
    const posAbbr = POS_ABBREV[pos] || pos.toLowerCase()

    // POS + morph type (italic) — only on first sense or if POS differs
    if (si === 0) {
      const posStr = [posAbbr, morphAbbr].filter(Boolean).join(' ')
      if (posStr) {
        textParts.push({ text: `  ${posStr}`, italics: true })
      }
    } else {
      // Additional sense: show POS if different from first sense
      if (posAbbr) {
        textParts.push({ text: `  ${posAbbr}`, italics: true })
      }
    }

    // Sense number (bold) — only if multiple senses
    if (senses.length > 1) {
      textParts.push({ text: `  ${si + 1})`, bold: true })
    }

    // Definition or gloss
    const def = sense.definitions?.en || ''
    const gloss = sense.glosses?.en || ''

    if (def) {
      textParts.push({ text: `  ${def}` })
    } else if (gloss) {
      // Capitalize first letter of gloss for display
      const display = gloss.charAt(0).toUpperCase() + gloss.slice(1)
      textParts.push({ text: `  ${display}` })
    }

    // Examples (inline, italic sentence + regular translation + source)
    if (includeExamples && sense.examples?.length > 0) {
      for (const ex of sense.examples) {
        const exText = ex.forms?.mnr || Object.values(ex.forms || {})[0] || ''
        if (exText) {
          textParts.push({ text: `  ${exText}`, italics: true })
        }

        // Translation
        for (const trans of ex.translations || []) {
          const transText = trans.forms?.en || Object.values(trans.forms || {})[0] || ''
          if (transText) {
            textParts.push({ text: `   ${transText}` })
          }
        }

        // Source citation
        if (ex.source) {
          // Extract just the name and date from source like "nn 03/08/05 cd1 19:50"
          const source = formatSource(ex.source)
          if (source) {
            textParts.push({ text: `  ${source}`, fontSize: fontSize - 1.5, color: '#555' })
          }
        }
      }
    }
  }

  // Relations (cross-references) shown after senses
  if (hasRelations && senses.length > 0) {
    for (const rel of entry.relations) {
      const variantType = rel.traits?.find(t => t.name === 'variant-type')?.value || ''
      const refWord = (rel.ref || '').split('_')[0]
      if (refWord) {
        const typeAbbr = variantType === 'Free Variant' ? 'fr. var.' :
                         variantType === 'Dialectal Variant' ? 'dial. var.' :
                         variantType === 'Spelling Variant' ? 'sp. var.' :
                         variantType ? variantType.toLowerCase() : 'var.'
        textParts.push({ text: `  ${typeAbbr} of ` })
        textParts.push({ text: refWord, bold: true })
      }
    }
  }

  return {
    text: textParts,
    margin: [HANGING_INDENT, 2.5, 0, 2.5],
    leadingIndent: -HANGING_INDENT,
    fontSize
  }
}

/**
 * Split an array of entry blocks into two columns of roughly equal height.
 * Uses a line-count heuristic based on text length.
 */
function splitIntoColumns(blocks, fontSize) {
  // Estimate height of each block based on text content length
  const heights = blocks.map(block => estimateBlockHeight(block, fontSize))
  const totalHeight = heights.reduce((a, b) => a + b, 0)
  const targetHeight = totalHeight / 2

  const left = []
  const right = []
  let leftHeight = 0

  for (let i = 0; i < blocks.length; i++) {
    if (leftHeight < targetHeight) {
      left.push(blocks[i])
      leftHeight += heights[i]
    } else {
      right.push(blocks[i])
    }
  }

  return { left, right }
}

/**
 * Estimate the rendered height of a block in approximate line units.
 * This is a heuristic — not pixel-perfect, but good enough for column balancing.
 */
function estimateBlockHeight(block, fontSize) {
  // Extract all text content from the block
  let totalChars = 0
  if (block.text) {
    if (typeof block.text === 'string') {
      totalChars = block.text.length
    } else if (Array.isArray(block.text)) {
      totalChars = block.text.reduce((sum, part) => {
        if (typeof part === 'string') return sum + part.length
        if (part.text) return sum + part.text.length
        return sum
      }, 0)
    }
  }

  // Approximate characters per line in a single column
  // At ~9pt font, roughly 45-50 chars per column line on letter paper with two columns
  const charsPerLine = 48
  const lines = Math.max(1, Math.ceil(totalChars / charsPerLine))

  // Each line is roughly fontSize * 1.3 points tall, plus margin
  const marginTop = block.margin?.[1] || 0
  const marginBottom = block.margin?.[3] || 0
  return lines * (fontSize * 1.3) + marginTop + marginBottom
}

/**
 * Format a source citation string for compact display.
 * Input: "nn 03/08/05 cd1 19:50" or "nn lesson 14 with Laura Grant"
 * Output: "Norma Nelson 03/08/05" (or simplified form)
 */
function formatSource(source) {
  if (!source) return ''
  // Just return the source as-is but trimmed — the data already has readable sources
  return source.trim()
}

function getFirstAlpha(text) {
  const match = text.match(/[a-zA-ZüÜŵŴ]/u)
  return match ? match[0] : '#'
}

function buildLetterPageHint(letterGroups) {
  // Placeholder for future guide-word tracking
  return {}
}
