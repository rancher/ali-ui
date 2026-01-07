<script setup lang='ts'>
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import UnitInput from '@shell/components/form/UnitInput.vue';
import { _CREATE } from '@shell/config/query-params';

defineOptions({ name: 'ACKDiskType' });
interface Props {
  mode?: string;
  disabled?: boolean;
  showEncrypted?: boolean;
  options?: any[];
  loading?: boolean;
}

const {
  mode = _CREATE,
  disabled = false,
  showEncrypted = true,
  options = [],
  loading = false
} = defineProps<Props>();

const emit = defineEmits(['update:value']);
const category = defineModel('category', { default: 'cloud_essd'})
const size = defineModel('size', { default: 40 });
const encrypted = defineModel('encrypted');
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
