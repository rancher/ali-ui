<script setup lang="ts">
import { MAX_NODES_BASIC, MAX_NODES_EDIT, MAX_NODES_PRO, DEFAULT_NODES, DEFAULT_MIN_NODES_SCALING, DEFAULT_MAX_NODES_SCALING } from '../util/shared';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import RadioGroup from '@components/Form/Radio/RadioGroup.vue';

  interface Props {
    mode?: string;
    value: any;
    config: any;
    isInactive?: boolean;
    validationRules?: any;
  }

  const {
    mode = _CREATE,
    value,
    config,
    isInactive = false,
    validationRules = {}
  } = defineProps<Props>();

  const store = useStore();
  const t = store.getters['i18n/t'];

  const isView = computed(() => mode === _VIEW);
  const maxPools = computed(() => {
  const isBasic = config.clusterSpec === 'ack.standard';

  return !value._isNew ? MAX_NODES_EDIT : ( isBasic ? MAX_NODES_BASIC : MAX_NODES_PRO );
  });
  const scalingModeOptions = ref([{label: t('ack.nodePool.scalingMode.manual'), value: false},{label: t('ack.nodePool.scalingMode.auto'), value: true}]);


  function poolSizeValidator() {
      const _isNew = value._isNew;

      return (val: any) => validationRules?.count?.[0](val, _isNew);
  }

  function minInstancesValidator() {
    const maxInstances = value.maxInstances;

    return (val: any) => validationRules?.minInstances?.[0](val, maxInstances);
  }

  function maxInstancesValidator() {
    const minInstances = value.minInstances;

    return (val: any) => validationRules?.maxInstances?.[0](val, minInstances);
  }

  function handleEnablingAutoscaling(val: boolean) {
    if(!val){
      value.minInstances = null;
      value.maxInstances = null;
      value.desiredSize = DEFAULT_NODES;
    } else {
      value.minInstances = DEFAULT_MIN_NODES_SCALING;
      value.maxInstances = DEFAULT_MAX_NODES_SCALING;
      value.desiredSize = null;
    }
    
  }
</script>

<template>
  <div class="mb-30">
    <h4 class="mb-10">{{ t("ack.nodePool.scalingMode.label") }}</h4>
    <div class="col span-3 mb-10">
      <RadioGroup
        v-model:value="value.enableAutoScaling"
        name="node-autoscaling"
        :mode="mode"
        :options="scalingModeOptions"
        :row="true"
        :disabled="isView || isInactive"
        @update:value="handleEnablingAutoscaling"
      />
    </div>
    <div
      v-if="!value.enableAutoScaling"
      class="col span-3"
    >
      <LabeledInput
        v-model:value="value.desiredSize"
        :disabled="isView || isInactive"
        :mode="mode"
        type="number"
        label-key="ack.nodePool.desiredSize.label"
        :min="1"
        :max="maxPools"
        data-testid="ack-value-count-input"
        required
        :require-dirty="false"
        :rules="[poolSizeValidator()]"
      />
    </div>
    <div
      v-else
      class="row span-12"
    >
      <div class="col span-4">
        <LabeledInput
          v-model:value.number="value.minInstances"
          type="number"
          :mode="mode"
          label-key="ack.nodePool.minInstances.label"
          data-testid="ack-value-min-instances-input"
          :disabled="isView || isInactive"
          :rules="[minInstancesValidator()]"
          :require-dirty="false"
          required
        />
      </div>
      <div class="col span-4">
        <LabeledInput
          v-model:value.number="value.maxInstances"
          type="number"
          :mode="mode"
          label-key="ack.nodePool.maxInstances.label"
          data-testid="ack-value-max-instances-input"
          :disabled="isView || isInactive"
          :rules="[maxInstancesValidator()]"
          :require-dirty="false"
          required
        />
      </div>
    </div>
  </div>
</template>