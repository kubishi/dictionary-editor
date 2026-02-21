import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  // Toast notifications
  const toasts = ref([])
  let toastId = 0

  function addToast(message, type = 'info', duration = 4000) {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(message) { return addToast(message, 'success') }
  function error(message) { return addToast(message, 'error', 8000) }
  function info(message) { return addToast(message, 'info') }
  function warning(message) { return addToast(message, 'warning', 6000) }

  // Confirm dialog
  const confirmDialog = ref(null)

  function confirm(title, message) {
    return new Promise(resolve => {
      confirmDialog.value = { title, message, resolve }
    })
  }

  function resolveConfirm(result) {
    if (confirmDialog.value) {
      confirmDialog.value.resolve(result)
      confirmDialog.value = null
    }
  }

  return {
    toasts, addToast, removeToast, success, error, info, warning,
    confirmDialog, confirm, resolveConfirm
  }
})
