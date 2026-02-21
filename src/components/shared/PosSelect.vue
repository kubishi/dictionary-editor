<script setup>
import { computed } from 'vue'
import { useDictionaryStore } from '../../stores/dictionary'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const dictionary = useDictionaryStore()

const COMMON_POS = [
  'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun',
  'Postposition', 'Conjunction', 'Interjection', 'Particle',
  'Classifier', 'Place', 'Idiom', 'Instrumental Prefix'
]

const allOptions = computed(() => {
  const set = new Set(COMMON_POS)
  for (const pos of dictionary.uniquePOSValues) {
    set.add(pos)
  }
  return [...set].sort()
})
</script>

<template>
  <select
    :value="modelValue"
    @change="emit('update:modelValue', $event.target.value)"
    class="input"
  >
    <option value="">— No POS —</option>
    <option v-for="pos in allOptions" :key="pos" :value="pos">{{ pos }}</option>
  </select>
</template>
