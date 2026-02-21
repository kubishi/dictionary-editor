<script setup>
const props = defineProps({
  entry: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
  showCheckbox: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'toggle-check'])

const posDisplay = (entry) => {
  const poses = entry.senses
    ?.map(s => s.grammaticalInfo?.value)
    .filter(Boolean)
  return [...new Set(poses)].join(', ')
}

const glossDisplay = (entry) => {
  return entry.senses
    ?.map(s => s.glosses?.en)
    .filter(Boolean)
    .join('; ')
}
</script>

<template>
  <div
    class="flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-colors"
    :class="selected
      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
      : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-2 border-l-transparent'"
    @click="emit('select')"
  >
    <input
      v-if="showCheckbox"
      type="checkbox"
      :checked="checked"
      @click.stop
      @change="emit('toggle-check')"
      class="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 shrink-0"
    />

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-medium text-sm truncate">{{ entry.word || '(empty)' }}</span>
        <span v-if="posDisplay(entry)" class="badge-blue text-[10px] shrink-0">
          {{ posDisplay(entry) }}
        </span>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
        {{ glossDisplay(entry) || 'No gloss' }}
      </p>
    </div>

    <span class="text-[10px] text-gray-400 shrink-0">
      {{ entry.senses?.length || 0 }}s
    </span>
  </div>
</template>
