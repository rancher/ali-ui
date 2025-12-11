<script setup lang='ts'>
import {  computed, PropType } from 'vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import UnitInput from '@shell/components/form/UnitInput.vue';
import { _CREATE } from '@shell/config/query-params';

defineOptions({ name: 'ACKDiskType' });

const emit = defineEmits(['update:value']);
const props = defineProps({
  mode: {
    type:    String,
    default: _CREATE
  },

  value: {
    type:     Object as PropType<any>,
    required: true
  },
  disabled: {
    type:    Boolean,
    default: false
  },
  showEncrypted: {
    type:    Boolean,
    default: true
  },
  options: {
    type:    Array,
    default: () => []
  },
  loading: {
    type:    Boolean,
    default: false
  }
});

const category = computed({
  get: () => props.value.category,
  set: (neu: string) => emit('update:value', { ...props.value, category: neu })
});
const size = computed({
  get: () => props.value.size,
  set: (neu: string) => emit('update:value', { ...props.value, size: neu })
});
const encrypted = computed ({
  get: () => props.value.encrypted,
  set: (neu: boolean) => emit('update:value', { ...props.value, encrypted: neu })
});
</script>

<template>
  <div class="row mb-10 align-center" >
    <div class="col span-4">
      <LabeledSelect
        v-model:value="category"
        :mode="mode"
        :options="options"
        :disabled="disabled"
        label-key="ack.nodePool.diskCategory.label"
        option-key="value"
        option-label="label"
        required
      />
    </div>
    <div class="col span-4">
      <UnitInput
        v-model:value="size"
        :mode="mode"
        label-key="ack.nodePool.diskSize.label"
        suffix="GiB"
        :disabled="disabled"
        required
      />
    </div>
    <div class="col span-1 mr-10">
      <Checkbox
        v-if="showEncrypted"
        v-model:value="encrypted"
        :mode="mode"
        label-key="ack.nodePool.diskEncrypted.label"
        :disabled="disabled"
      />
    </div>
    <div class="col span-2 mb-5 ml-30">
      <slot name="remove"/>
    </div>
  </div>
</template>
