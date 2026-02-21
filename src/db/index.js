import Dexie from 'dexie'

const db = new Dexie('KubishiDictionaryEditor')

db.version(1).stores({
  // Entries indexed by guid, word (for alphabetical), dateModified, and POS values
  entries: 'guid, word, dateModified, *sensePosList',
  // Metadata: header, ranges, fields, lift attributes, raw XML
  metadata: 'key'
})

export default db
