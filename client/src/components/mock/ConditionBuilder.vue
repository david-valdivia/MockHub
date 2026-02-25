<template>
  <div class="space-y-2">
    <div v-for="(condition, index) in modelValue" :key="index" class="flex items-center space-x-2">
      <input v-model="condition.field" placeholder="e.g. headers.authorization" class="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded" />
      <select v-model="condition.operator" class="px-2 py-1.5 text-xs border border-gray-300 rounded">
        <option value="equals">equals</option>
        <option value="not_equals">not equals</option>
        <option value="contains">contains</option>
        <option value="not_contains">not contains</option>
        <option value="exists">exists</option>
        <option value="not_exists">not exists</option>
        <option value="gt">></option>
        <option value="gte">>=</option>
        <option value="lt">&lt;</option>
        <option value="lte">&lt;=</option>
        <option value="matches">regex</option>
      </select>
      <input
        v-if="!['exists', 'not_exists'].includes(condition.operator)"
        v-model="condition.value" placeholder="value"
        class="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
      />
      <button @click="removeCondition(index)" class="p-1 text-gray-400 hover:text-red-600">
        <XMarkIcon class="h-4 w-4" />
      </button>
    </div>
    <p v-if="modelValue.length === 0" class="text-xs text-gray-400 italic">No conditions — this rule always matches (default)</p>
  </div>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])

function removeCondition(index) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}
</script>
