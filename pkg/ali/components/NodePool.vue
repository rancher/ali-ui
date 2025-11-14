<script>
import { defineComponent } from 'vue';
import { mapGetters } from 'vuex';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import InstanceType from './InstanceType.vue';
import DiskType from './DiskType.vue';
import DiskGroup from './DiskGroup.vue';
import { getDataDisksForInstanceTypes } from '../util/ack';

const STATUS_AVAILABLE = 'Available';
const DATA_DISK = 'DataDisk';

export default defineComponent({
  name: 'ACKNodePool',

  components: {
    LabeledInput,
    LabeledSelect,
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
    config: {
      type:     Object,
      required: true
    },
    allImages: {
      type:    Object,
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
    allInstanceTypes: {
      type:    Object,
      default: () => {}
    },
    zones: {
      type:    Object,
      default: () => new Set()
    },
  },
  emits: ['error'],

  data() {
    return {
      osDiskTypeOptions:       ['Managed', 'Ephemeral'],
      modeOptions:             ['User', 'System'],
      maxPools:                5000,
      loadingDiskTypes:        false,
      allDiskTypes:            [],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),
    isView() {
      return this.mode === _VIEW;
    },
    isEditingImported() {
      return this.config.imported && !this.pool._isNewOrUnprovisioned;
    },
    showInstanceTypes() {
      return this.pool.instanceTypes || this.pool._isNewOrUnprovisioned;
    },
    systemDisk: {
      get() {
        return { category: this.pool.systemDiskCategory, size: this.pool.systemDiskSize };
      },
      set(neu) {
        this.pool.systemDiskCategory = neu.category;
        this.pool.systemDiskSize = neu.size;
      }
    },
    imageOptions() {
      return Object.keys(this.allImages).map((image) => {
        return { value: image, label: this.allImages[image].label || '' };
      });
    },
    image: {
      get() {
        return this.pool.imageType;
      },
      set(neu) {
        this.pool.imageId = this.allImages[neu];
        this.pool.imageType = neu;
      }
    },
    showDesiredSize() {
      return this.pool._isNewOrUnprovisioned || !!this.pool.desiredSize;
    }
  },
  watch: {
    'pool.instanceTypes': {
      handler() {
        this.getDiskTypes();
      },
      immediate: true
    },
    'config.regionId': {
      handler() {
        this.getDiskTypes();
      },
      immediate: true
    },
    'config.alibabaCredentialSecret': {
      handler() {
        this.getDiskTypes();
      },
      immediate: true
    }
  },

  methods: {
    async getDiskTypes() {
      this.loadingDiskTypes = true;
      this.allDiskTypes = [];
      const { alibabaCredentialSecret, regionId } = this.config;

      try {
        const types = {};
        let maxCount = 0;
        const instanceTypesLength = this.pool?.instanceTypes?.length || 0;

        for (let i = 0; i < instanceTypesLength; i++) {
          const instanceType = this.pool.instanceTypes[i];
          const res = await getDataDisksForInstanceTypes(this.$store, alibabaCredentialSecret, regionId, instanceType );
          const availableZones = res?.AvailableZones?.AvailableZone || [];

          availableZones.forEach((zone) => {
            const zoneAllowed = this.zones.size === 0 || (zone.ZoneId && this.zones.has(zone.ZoneId)) || !this.isNewOrUnprovisioned;

            if (zoneAllowed && zone.Status === STATUS_AVAILABLE) {
              const availableResources = zone.AvailableResources?.AvailableResource;

              availableResources.forEach((resource) => {
                if (resource.Type === DATA_DISK) {
                  const dataDisks = resource.SupportedResources?.SupportedResource;

                  dataDisks.forEach((disk) => {
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
        // I will use min and max for validation later
        const out = [];

        for (const type in types) {
          // Checking against the most seen disks instead of the length of instance types in case some types are invalid
          if (types[type].counter === maxCount) {
            out.push({ value: type, label: this.t( `ack.nodePool.diskCategory.options.${ type }`) });
          }
        }
        this.allDiskTypes = out;
      } catch (err) {
        const parsedError = err.error || '';

        this.$emit('error', this.t('ack.errors.diskTypes', { e: parsedError || err }));
      }
      this.loadingDiskTypes = false;
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
      <div
        v-if="showDesiredSize"
        class="col span-3"
      >
        <LabeledInput
          v-model:value.number="pool.desiredSize"
          :disabled="isView || isEditingImported"
          type="number"
          :mode="mode"
          label-key="ack.nodePool.desiredSize.label"
          :min="1"
          :max="maxPools"
          data-testid="ack-pool-count-input"
          required
        />
      </div>
      <div
        v-else
        class="row span-12"
      >
        <div class="col span-2">
          <LabeledInput
            v-model:value.number="pool.minInstances"
            :disabled="true"
            type="number"
            :mode="mode"
            label-key="ack.nodePool.minInstances.label"
            data-testid="ack-pool-min-instances-input"
          />
        </div>
        <div class="col span-2">
          <LabeledInput
            v-model:value.number="pool.maxInstances"
            :disabled="true"
            type="number"
            :mode="mode"
            label-key="ack.nodePool.maxInstances.label"
            data-testid="ack-pool-max-instances-input"
          />
        </div>
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
    <div
      v-if="showInstanceTypes"
      class="col mb-30"
    >
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
  <p class="mb-10">
    {{ t('ack.nodePool.systemDisk.title') }}
  </p>
  <DiskType
    v-model:value="systemDisk"
    :mode="mode"
    :is-new-or-unprovisioned="pool._isNewOrUnprovisioned"
    :show-encrypted="false"
    :options="allDiskTypes"
    :loading="loadingDiskTypes"
  />
  <p class="mb-10">
    {{ t('ack.nodePool.dataDisks.title') }}
  </p>
  <DiskGroup
    v-model:value="pool.dataDisks"
    :mode="mode"
    :is-new-or-unprovisioned="pool._isNewOrUnprovisioned"
    :add-disabled="!pool._isNewOrUnprovisioned"
    :options="allDiskTypes"
    :loading="loadingDiskTypes"
  />
</template>
