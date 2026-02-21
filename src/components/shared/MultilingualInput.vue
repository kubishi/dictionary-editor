<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  languages: { type: Array, default: () => ['mnr', 'en'] },
  labels: { type: Object, default: () => ({ mnr: 'Paiute', en: 'English' }) },
  placeholder: { type: String, default: '' },
  multiline: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

function updateLang(lang, value) {
  emit('update:modelValue', { ...props.modelValue, [lang]: value })
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="lang in languages" :key="lang" class="flex items-start gap-2">
      <span class="label mt-2 w-16 shrink-0 text-right">{{ labels[lang] || lang }}</span>
      <textarea
        v-if="multiline"
        :value="modelValue[lang] || ''"
        @input="updateLang(lang, $event.target.value)"
        :placeholder="placeholder"
        class="input min-h-[80px] resize-y"
        rows="3"
      />
      <input
        v-else
        type="text"
        :value="modelValue[lang] || ''"
        @input="updateLang(lang, $event.target.value)"
        :placeholder="placeholder"
        class="input"
      />
    </div>
  </div>
</template>
