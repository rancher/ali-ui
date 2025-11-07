<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { mapGetters } from 'vuex';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import Banner from '@components/Banner/Banner.vue';
import InstanceType from './InstanceType.vue';
import DiskType from './DiskType.vue';
import DiskGroup from './DiskGroup.vue';

export default defineComponent({
  name: 'ACKNodePool',

  components: {
    LabeledInput,
    LabeledSelect,
    Banner,
    InstanceType,
    DiskType,
    DiskGroup
  },

  props: {
    mode: {
      type:    String,
      default: _CREATE
    },

    pool: {
      type:     Object,
      required: true
    },
    config:{
      type:     Object,
      required: true
    },
    allImages: {
      type:   Object,
      default: () => {}
    },
    loadingImages: {
      type:    Boolean,
      default: false
    },
    loadingInstanceTypes: {
      type:    Boolean,
      default: false
    },
    allInstanceTypes:{
      type:   Object,
      default: () => {}
    },
    zones:{
      type:   Object,
      default: () => new Set()
    },
  },

  data() {
    return {
      osDiskTypeOptions:       ['Managed', 'Ephemeral'],
      modeOptions:             ['User', 'System'],
      maxPools:                5000

    };
  },

  watch: {},

  computed: {
    ...mapGetters({ t: 'i18n/t' }),
    systemDisk:{
      get() {
        return {category: this.pool.systemDiskCategory, size:this.pool.systemDiskSize };
      },
      set(neu: {category: string, size?: string, encrypted?: boolean}) {
        this.pool.systemDiskCategory = neu.category;
        this.pool.systemDiskSize = neu.size;
      }
    },
    imageOptions(): Array<any> {
      return Object.keys(this.allImages).map((image) => {
        return { value: image, label: this.allImages[image].label || ''};
      });
    },
    image:{
      get() {
        return this.pool.imageType;
      },
      set(neu: string) {
        this.pool.imageId = this.allImages[neu];
        this.pool.imageType = neu;
      }
    }
  },
  
});
</script>

<template>
  <div
    class="pool"
  >
    <div class="row mb-10">
      <div class="col span-3">
        <LabeledInput
          v-model:value="pool.name"
          :mode="mode"
          label-key="ack.nodePool.name.label"
          required
          :disabled="!pool._isNewOrUnprovisioned"
        />
      </div>
      <div class="col span-3">
        <LabeledInput
          v-model:value.number="pool.desiredSize"
          :disabled="!pool._isNewOrUnprovisioned"
          type="number"
          :mode="mode"
          label-key="ack.nodePool.desiredSize.label"
          :min="1"
          :max="maxPools"
          data-testid="ack-pool-count-input"
          required
        />
      </div>
    </div>
    <div class="row mb-20">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="image"
          :mode="mode"
          :loading="loadingImages"
          :options="imageOptions"
          option-key="value"
          label-key="ack.nodePool.imageId.label"
          required
          :disabled="!pool._isNewOrUnprovisioned"
        />
      </div>
    </div>
    <div class="col mb-30">
      <InstanceType 
        v-model:value="pool.instanceTypes"
        :config="config"
        :mode="mode"
        :is-new-or-unprovisioned="pool._isNewOrUnprovisioned"
        :all-instance-types="allInstanceTypes"
        :loading-instance-types="loadingInstanceTypes"
        :zones="zones"
      />
    </div>
  </div>
  <p class="mb-10">{{ t('ack.nodePool.systemDisk.title')}}</p>
  <DiskType 
    v-model:value="systemDisk"
    :mode="mode"
    :is-new-or-unprovisioned="pool._isNewOrUnprovisioned"
    :show-encrypted="false"
    
  />
  <p class="mb-10">{{ t('ack.nodePool.dataDisks.title')}}</p>
  <DiskGroup 
    v-model:value="pool.dataDisks"
    :mode="mode"
    :is-new-or-unprovisioned="pool._isNewOrUnprovisioned"
    :add-disabled="!pool._isNewOrUnprovisioned"
  />
</template>

