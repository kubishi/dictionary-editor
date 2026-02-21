<script setup>
import { Trash2, GripVertical } from 'lucide-vue-next'
import MultilingualInput from '../shared/MultilingualInput.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  index: { type: Number, required: true }
})

const emit = defineEmits(['update:modelValue', 'remove'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function updateTranslation(idx, field, value) {
  const translations = [...(props.modelValue.translations || [])]
  translations[idx] = { ...translations[idx], [field]: value }
  update('translations', translations)
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/50">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <GripVertical class="w-4 h-4 text-gray-400 cursor-grab" />
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Example {{ index + 1 }}</span>
      </div>
      <button @click="emit('remove')" class="btn-ghost btn-sm text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="space-y-3">
      <!-- Source sentence -->
      <div>
        <label class="label">Sentence</label>
        <MultilingualInput
          :modelValue="modelValue.forms || {}"
          @update:modelValue="update('forms', $event)"
          :languages="['mnr']"
          :labels="{ mnr: 'Paiute' }"
          placeholder="Enter example sentence..."
        />
      </div>

      <!-- Translations -->
      <div v-for="(trans, tidx) in (modelValue.translations || [])" :key="tidx">
        <label class="label">Translation</label>
        <MultilingualInput
          :modelValue="trans.forms || {}"
          @update:modelValue="updateTranslation(tidx, 'forms', $event)"
          :languages="['en']"
          :labels="{ en: 'English' }"
          placeholder="Enter translation..."
        />
      </div>

      <!-- Source / citation -->
      <div>
        <label class="label">Source</label>
        <input
          type="text"
          :value="modelValue.source || ''"
          @input="update('source', $event.target.value)"
          class="input"
          placeholder="Citation source..."
        />
      </div>
    </div>
  </div>
</template>
