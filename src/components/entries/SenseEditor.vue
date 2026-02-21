<script setup>
import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { ref } from 'vue'
import MultilingualInput from '../shared/MultilingualInput.vue'
import PosSelect from '../shared/PosSelect.vue'
import ExampleEditor from './ExampleEditor.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  index: { type: Number, required: true }
})

const emit = defineEmits(['update:modelValue', 'remove'])

const expanded = ref(true)

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function updateGrammaticalInfo(value) {
  update('grammaticalInfo', {
    ...(props.modelValue.grammaticalInfo || {}),
    value,
    traits: props.modelValue.grammaticalInfo?.traits || []
  })
}

function updateExample(idx, example) {
  const examples = [...(props.modelValue.examples || [])]
  examples[idx] = example
  update('examples', examples)
}

function removeExample(idx) {
  const examples = [...(props.modelValue.examples || [])]
  examples.splice(idx, 1)
  update('examples', examples)
}

function addExample() {
  const examples = [...(props.modelValue.examples || [])]
  examples.push({
    source: '',
    forms: { mnr: '' },
    translations: [{ type: 'Free translation', forms: { en: '' } }],
    notes: []
  })
  update('examples', examples)
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Sense header -->
    <div
      class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/80 cursor-pointer"
      @click="expanded = !expanded"
    >
      <component :is="expanded ? ChevronDown : ChevronRight" class="w-4 h-4 text-gray-400" />
      <span class="text-sm font-medium">Sense {{ index + 1 }}</span>
      <span v-if="modelValue.grammaticalInfo?.value" class="badge-blue">
        {{ modelValue.grammaticalInfo.value }}
      </span>
      <span v-if="modelValue.glosses?.en" class="text-sm text-gray-500 dark:text-gray-400 truncate">
        — {{ modelValue.glosses.en }}
      </span>
      <div class="ml-auto">
        <button
          @click.stop="emit('remove')"
          class="btn-ghost btn-sm text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Sense body -->
    <div v-show="expanded" class="p-4 space-y-4">
      <!-- Part of Speech -->
      <div>
        <label class="label">Part of Speech</label>
        <PosSelect
          :modelValue="modelValue.grammaticalInfo?.value || ''"
          @update:modelValue="updateGrammaticalInfo"
        />
      </div>

      <!-- Gloss -->
      <div>
        <label class="label">Gloss</label>
        <MultilingualInput
          :modelValue="modelValue.glosses || {}"
          @update:modelValue="update('glosses', $event)"
          :languages="['en']"
          :labels="{ en: 'English' }"
          placeholder="Brief meaning..."
        />
      </div>

      <!-- Definition -->
      <div>
        <label class="label">Definition</label>
        <MultilingualInput
          :modelValue="modelValue.definitions || {}"
          @update:modelValue="update('definitions', $event)"
          :languages="['en']"
          :labels="{ en: 'English' }"
          placeholder="Full definition..."
          :multiline="true"
        />
      </div>

      <!-- Examples -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="label mb-0">Examples</label>
          <button @click="addExample" class="btn-ghost btn-sm">
            <Plus class="w-3.5 h-3.5" />
            Add Example
          </button>
        </div>
        <div class="space-y-3">
          <ExampleEditor
            v-for="(example, eidx) in (modelValue.examples || [])"
            :key="eidx"
            :modelValue="example"
            :index="eidx"
            @update:modelValue="updateExample(eidx, $event)"
            @remove="removeExample(eidx)"
          />
          <p v-if="!modelValue.examples?.length" class="text-sm text-gray-400 italic">
            No examples yet
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
