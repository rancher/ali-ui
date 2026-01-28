<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import RadioGroup from '@components/Form/Radio/RadioGroup.vue';
import InstanceType from './InstanceType.vue';
import DiskType from './DiskType.vue';
import DiskGroup from './DiskGroup.vue';
import { getDataDisksForInstanceTypes } from '../util/ack';
import { STATUS_AVAILABLE, DATA_DISK, MAX_NODES_BASIC, MAX_NODES_EDIT, MAX_NODES_PRO, DEFAULT_NODES, DEFAULT_MIN_NODES_SCALING, DEFAULT_MAX_NODES_SCALING } from '../util/shared';

defineOptions({ name: 'ACKNodePool' });

interface Props {
  mode?: string;
  pool: any;
  config: any;
  allImages?: any;
  loadingImages?: boolean;
  loadingInstanceTypes?: boolean;
  allInstanceTypes?: any;
  zones?: any;
  isInactive?: boolean;
  validationRules?: any;
}

const {
  mode = _CREATE,
  pool,
  config,
  allImages = {},
  loadingImages = false,
  loadingInstanceTypes = false,
  allInstanceTypes = {},
  zones = new Set(),
  isInactive = false,
  validationRules = {}
} = defineProps<Props>();

const emit = defineEmits(['error']);
const store = useStore();
const t = store.getters['i18n/t'];

const loadingDiskTypes = ref(false);
const allDiskTypes = ref<any[]>([]);

const isView = computed(() => mode === _VIEW);

const showInstanceTypes = computed(() => pool.instanceTypes || pool._isNew);

const maxPools = computed(() => {
  const isBasic = config.clusterSpec === 'ack.standard';

  return !pool._isNew ? MAX_NODES_EDIT : ( isBasic ? MAX_NODES_BASIC : MAX_NODES_PRO );
});

const systemDisk = reactive({
  category: computed({
    get() {
      return pool.systemDiskCategory;
    },
    set(neu) {
      pool.systemDiskCategory = neu;
    }
  }),
  size: computed({
    get() {
      return pool.systemDiskSize;
    },
    set(neu) {
      pool.systemDiskSize = neu;
    }
  }),
  encrypted: ref(false)
});

const imageOptions = computed(() => {
  return Object.keys(allImages).map((image) => {
    return { value: image, label: allImages[image].label || '' };
  });
});

const image = computed({
  get() {
    return pool.imageType;
  },
  set(neu) {
    pool.imageId = allImages[neu];
    pool.imageType = neu;
  }
});

const scalingModeOptions = ref([{label: t('ack.nodePool.scalingMode.manual'), value: false},{label: t('ack.nodePool.scalingMode.auto'), value: true}]);

const getDiskTypes = async() => {
  loadingDiskTypes.value = true;
  allDiskTypes.value = [];
  const { alibabaCredentialSecret, regionId } = config;

  try {
    const types: any = {};
    let maxCount = 0;
    const instanceTypesLength = pool?.instanceTypes?.length || 0;

    for (let i = 0; i < instanceTypesLength; i++) {
      const instanceType = pool.instanceTypes[i];
      const res = await getDataDisksForInstanceTypes(store, alibabaCredentialSecret, regionId, instanceType );
      const availableZones = res?.AvailableZones?.AvailableZone || [];

      availableZones.forEach((zone: any) => {
        const zoneAllowed = zones.size === 0 || (zone.ZoneId && zones.has(zone.ZoneId)) || !pool._isNew;

        if (zoneAllowed && zone.Status === STATUS_AVAILABLE) {
          const availableResources = zone.AvailableResources?.AvailableResource || [];

          availableResources.forEach((resource: any) => {
            if (resource.Type === DATA_DISK) {
              const dataDisks = resource.SupportedResources?.SupportedResource;

              dataDisks.forEach((disk: any) => {
                if (!types[disk.Value]) {
                  types[disk.Value] = {
                    min:      disk.Min,
                    max:      disk.Max,
                    counter:  1,
                    lastType: instanceType
                  };
                } else {
                  const cur = types[disk.Value];
                  const shouldIncrement = cur.lastType !== instanceType;

                  types[disk.Value] = {
                    min:      Math.min(types[disk.Value].min, disk.Min),
                    max:      Math.max(cur.max, disk.Max),
                    counter:  !shouldIncrement ? cur.counter : cur.counter + 1,
                    lastType: instanceType
                  };
                }
                maxCount = Math.max(maxCount, types[disk.Value].counter);
              });
            }
          });
        }
      });
    }
    const out = [];

    for (const type in types) {
      // Checking against the most seen disks instead of the length of instance types in case some types are invalid
      if (types[type].counter === maxCount) {
        out.push({ value: type, label: t( `ack.nodePool.diskCategory.options.${ type }`) });
      }
    }
    allDiskTypes.value = out;
  } catch (err: any) {
    const parsedError = err.error || '';

    emit('error', t('ack.errors.diskTypes', { e: parsedError || err }));
  }
  loadingDiskTypes.value = false;
};

watch(
  [
    () => pool.instanceTypes,
    () => config.regionId,
    () => config.alibabaCredentialSecret
  ],
  () => {
    getDiskTypes();
  },
  { immediate: true }
);

function handleEnablingAutoscaling(val: boolean) {
  if(!val){
    pool.minInstances = null;
    pool.maxInstances = null;
    pool.desiredSize = DEFAULT_NODES;
  } else {
    pool.minInstances = DEFAULT_MIN_NODES_SCALING;
    pool.maxInstances = DEFAULT_MAX_NODES_SCALING;
    pool.desiredSize = null;
  }
  
}

function poolSizeValidator() {
  const _isNew = pool._isNew;

  return (val: any) => validationRules?.count?.[0](val, _isNew);
}

function minInstancesValidator() {
  const maxInstances = pool.maxInstances;

  return (val: any) => validationRules?.minInstances?.[0](val, maxInstances);
}

function maxInstancesValidator() {
  const minInstances = pool.minInstances;

  return (val: any) => validationRules?.maxInstances?.[0](val, minInstances);
}

</script>

<template>
  <div
    class="pool"
  >
      <div class="col span-3 mb-30">
        <LabeledInput
          v-model:value="pool.name"
          :mode="mode"
          label-key="ack.nodePool.name.label"
          required
          :disabled="!pool._isNew"
          :rules="validationRules.name"
        />
      </div>
      <div class="mb-30">
        <h4 class="mb-10">{{ t("ack.nodePool.scalingMode.label") }}</h4>
      <div class="col span-3 mb-10">
        <RadioGroup
            v-model:value="pool.enableAutoScaling"
            name="node-autoscaling"
            :mode="mode"
            :options="scalingModeOptions"
            :row="true"
            :disabled="isView || isInactive"
            @update:value="handleEnablingAutoscaling"
          />
      </div>
      
        <div
          v-if="!pool.enableAutoScaling"
          class="col span-3"
        >
          <LabeledInput
            v-model:value="pool.desiredSize"
            :disabled="isView || isInactive"
            :mode="mode"
            label-key="ack.nodePool.desiredSize.label"
            :min="1"
            :max="maxPools"
            data-testid="ack-pool-count-input"
            required
            :rules="[poolSizeValidator()]"
          />
        </div>
        <div
          v-else
          class="row span-12"
        >
          <div class="col span-4">
            <LabeledInput
              v-model:value.number="pool.minInstances"
              type="number"
              :mode="mode"
              label-key="ack.nodePool.minInstances.label"
              data-testid="ack-pool-min-instances-input"
              :disabled="isView || isInactive"
              :rules="[minInstancesValidator()]"
              required
            />
          </div>
          <div class="col span-4">
            <LabeledInput
              v-model:value.number="pool.maxInstances"
              type="number"
              :mode="mode"
              label-key="ack.nodePool.maxInstances.label"
              data-testid="ack-pool-max-instances-input"
              :disabled="isView || isInactive"
              :rules="[maxInstancesValidator()]"
              required
            />
          </div>
        </div>
      </div>
      <div class="col span-6 mb-30">
        <LabeledSelect
          v-model:value="image"
          :mode="mode"
          :loading="loadingImages"
          :options="imageOptions"
          option-key="value"
          label-key="ack.nodePool.imageId.label"
          required
          :disabled="!pool._isNew"
        />
      </div>
    <div
      v-if="showInstanceTypes"
      class="col mb-30"
    >
      <InstanceType
        v-model:value="pool.instanceTypes"
        :config="config"
        :mode="mode"
        :disabled="!pool._isNew"
        :all-instance-types="allInstanceTypes"
        :loading-instance-types="loadingInstanceTypes"
        :zones="zones"
        :rules="validationRules.instanceTypeCount"
      />
    </div>
  </div>
  <p class="mb-10">
    {{ t('ack.nodePool.systemDisk.title') }}
  </p>
  <DiskType
    v-model:category="systemDisk.category"
    v-model:size="systemDisk.size"
    v-model:encrypted="systemDisk.encrypted"
    :mode="mode"
    :disabled="!pool._isNew"
    :show-encrypted="false"
    :options="allDiskTypes"
    :loading="loadingDiskTypes"
    class="mb-30"
  />
  <p class="mb-10">
    {{ t('ack.nodePool.dataDisks.title') }}
  </p>
  <DiskGroup
    v-model:value="pool.dataDisks"
    :mode="mode"
    :disabled="!pool._isNew"
    :options="allDiskTypes"
    :loading="loadingDiskTypes"
  />
</template>
