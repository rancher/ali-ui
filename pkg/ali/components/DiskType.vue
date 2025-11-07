<script lang='ts'>
import { defineComponent, PropType } from 'vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import UnitInput from '@shell/components/form/UnitInput.vue';
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';
export default defineComponent({
  name: 'ACKDiskType',

  emits: ['update:value'],

  components: {
    LabeledSelect,
    LabeledInput,
    Checkbox,
    UnitInput
  },

  props: {
    mode: {
      type:    String,
      default: _CREATE
    },

    value: {
      type:     Object as PropType<any>,
      required: true
    },
    isNewOrUnprovisioned: {
      type:    Boolean,
      default: true
    },
    showEncrypted: {
      type:    Boolean,
      default: true
    }
  },

  computed: {
    categoryOptions(): Array<any> {
      return [
        {
          value:    'cloud',
          label:    this.t('ack.nodePool.diskCategory.options.cloud'),
        },
        {
          value:    'cloud_efficiency',
          label:    this.t('ack.nodePool.diskCategory.options.cloudEfficiency'),
        },
        {
          value:    'cloud_ssd',
          label:    this.t('ack.nodePool.diskCategory.options.cloudSsd'),
        },
        {
          value:    'cloud_essd',
          label:    this.t('ack.nodePool.diskCategory.options.cloudEssd'),
        },
        {
          value:    'cloud_auto',
          label:    this.t('ack.nodePool.diskCategory.options.cloudAuto'),
        },
        {
          value:    'cloud_essd_entry',
          label:    this.t('ack.nodePool.diskCategory.options.cloudEssdEntry'),
        },
        
      ];
    },
    category: {
      get() { return this.value.category; },
      set(neu: string) { this.$emit('update:value', { ...this.value, category: neu }); }
    },
    size: {
      get() { return this.value.size; },
      set(neu: string) { this.$emit('update:value', { ...this.value, size: neu }); }
    },
    encrypted: {
      get() { return this.value.encrypted; },
      set(neu: boolean) { this.$emit('update:value', { ...this.value, encrypted: neu }); }
    }

  },

});
</script>
<template>
  <div class="row mb-10 align-center" >
    <div class="col span-4">
    <LabeledSelect
        v-model:value="category"
        :mode="mode"
        :options="categoryOptions"
        :disabled="!isNewOrUnprovisioned"
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
        :disabled="!isNewOrUnprovisioned"
        required
    />
    </div>
    <div class="col span-1 mr-10">
        <Checkbox
            v-if="showEncrypted"
            v-model:value="encrypted"
            :mode="mode"
            label-key="ack.nodePool.diskEncrypted.label"
            :disabled="!isNewOrUnprovisioned"
        />
    </div>
    <div class="col span-2 mb-5 ml-30">
         <slot name="remove"/>
    </div>
  </div>
</template>
