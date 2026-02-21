<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/layout/AppHeader.vue'
import AppToast from './components/layout/AppToast.vue'
import { useDictionaryStore } from './stores/dictionary'

const route = useRoute()
const dictionary = useDictionaryStore()
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <AppHeader />
    <main class="flex-1 flex flex-col overflow-hidden">
      <router-view />
    </main>
    <AppToast />
  </div>
</template>
