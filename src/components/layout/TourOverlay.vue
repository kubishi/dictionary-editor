<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ChevronRight, ChevronLeft, X } from 'lucide-vue-next'

const props = defineProps({
  steps: { type: Array, required: true }
})

const emit = defineEmits(['close'])

const currentStep = ref(0)
const targetRect = ref(null)

const step = computed(() => props.steps[currentStep.value])
const isFirst = computed(() => currentStep.value === 0)
const isLast = computed(() => currentStep.value === props.steps.length - 1)

function updateRect() {
  const el = document.querySelector(step.value.target)
  if (el) {
    const r = el.getBoundingClientRect()
    const pad = 8
    targetRect.value = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2
    }
  } else {
    targetRect.value = null
  }
}

function goNext() {
  if (isLast.value) {
    finish()
  } else {
    currentStep.value++
    nextTick(updateRect)
  }
}

function goBack() {
  if (!isFirst.value) {
    currentStep.value--
    nextTick(updateRect)
  }
}

function finish() {
  localStorage.setItem('kubishi_tour_seen', 'true')
  emit('close')
}

// Tooltip positioning: place it where there's the most space
const tooltipStyle = computed(() => {
  if (!targetRect.value) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  const r = targetRect.value
  const vw = window.innerWidth
  const tooltipW = 340
  const gap = 16

  // Prefer placing tooltip to the right of the target
  const spaceRight = vw - (r.left + r.width)
  const spaceLeft = r.left

  let left, top
  if (spaceRight > tooltipW + gap) {
    left = r.left + r.width + gap
    top = r.top
  } else if (spaceLeft > tooltipW + gap) {
    left = r.left - tooltipW - gap
    top = r.top
  } else {
    // Place below
    left = Math.max(16, Math.min(r.left, vw - tooltipW - 16))
    top = r.top + r.height + gap
  }

  // Clamp top so tooltip doesn't go off-screen
  top = Math.max(16, Math.min(top, window.innerHeight - 260))

  return { top: top + 'px', left: left + 'px' }
})

let resizeHandler
onMounted(() => {
  nextTick(() => setTimeout(updateRect, 100))
  resizeHandler = () => updateRect()
  window.addEventListener('resize', resizeHandler)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100]">
      <!-- Dark overlay with cutout -->
      <div class="absolute inset-0 bg-black/50" @click="finish" />

      <!-- Highlighted target cutout -->
      <div
        v-if="targetRect"
        class="absolute rounded-lg ring-2 ring-indigo-400 ring-offset-2 transition-all duration-300 ease-in-out"
        :class="step.variant === 'warning' ? 'ring-amber-400' : 'ring-indigo-400'"
        :style="{
          top: targetRect.top + 'px',
          left: targetRect.left + 'px',
          width: targetRect.width + 'px',
          height: targetRect.height + 'px',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
        }"
      />

      <!-- Tooltip card -->
      <div
        class="absolute w-[340px] transition-all duration-300 ease-in-out"
        :style="tooltipStyle"
      >
        <div
          class="rounded-xl shadow-2xl border p-5"
          :class="step.variant === 'warning'
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
            : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'"
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <h3
              class="font-semibold text-base"
              :class="step.variant === 'warning'
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-gray-900 dark:text-gray-100'"
            >
              {{ step.title }}
            </h3>
            <button
              @click="finish"
              class="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Message -->
          <p
            class="text-sm leading-relaxed"
            :class="step.variant === 'warning'
              ? 'text-amber-700 dark:text-amber-300/90'
              : 'text-gray-600 dark:text-gray-400'"
          >
            {{ step.message }}
          </p>

          <!-- Footer: step dots + nav buttons -->
          <div class="flex items-center justify-between mt-4">
            <!-- Step indicators -->
            <div class="flex gap-1.5">
              <div
                v-for="(_, i) in steps"
                :key="i"
                class="w-2 h-2 rounded-full transition-colors"
                :class="i === currentStep
                  ? (step.variant === 'warning' ? 'bg-amber-500' : 'bg-indigo-500')
                  : 'bg-gray-300 dark:bg-gray-600'"
              />
            </div>

            <!-- Nav buttons -->
            <div class="flex items-center gap-2">
              <button
                v-if="!isFirst"
                @click="goBack"
                class="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft class="w-3.5 h-3.5" />
                Back
              </button>
              <button
                @click="goNext"
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                :class="step.variant === 'warning'
                  ? 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'"
              >
                {{ isLast ? 'Got it!' : 'Next' }}
                <ChevronRight v-if="!isLast" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
