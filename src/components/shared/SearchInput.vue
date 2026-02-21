<script setup>
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search...' },
  debounce: { type: Number, default: 200 }
})

const emit = defineEmits(['update:modelValue'])

const localValue = ref(props.modelValue)

const debouncedEmit = useDebounceFn((val) => {
  emit('update:modelValue', val)
}, props.debounce)

watch(localValue, (val) => debouncedEmit(val))
watch(() => props.modelValue, (val) => { localValue.value = val })

function clear() {
  localValue.value = ''
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="relative">
    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      v-model="localValue"
      type="text"
      :placeholder="placeholder"
      class="input pl-9 pr-8"
    />
    <button
      v-if="localValue"
      @click="clear"
      class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>
