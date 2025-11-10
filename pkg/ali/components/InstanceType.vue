<script>
import { defineComponent } from 'vue';
import { mapGetters } from 'vuex';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import UnitInput from '@shell/components/form/UnitInput.vue';
import ArrayListOrdered from './ArrayListOrdered.vue';
import { _CREATE } from '@shell/config/query-params';
import { getAlibabaInstanceTypes } from '../util/ack';
import SortableTable from '@shell/components/SortableTable/index.vue';

const STATUS_AVAILABLE = 'Available';
const INSTANCE_TYPE = 'InstanceType';
const WITH_STOCK = 'WithStock';
const WITHOUT_STOCK = 'WithoutStock';

export default defineComponent({
  name:  'InstanceType',
  emits: ['update:value', 'error'],

  components: {
    Checkbox,
    UnitInput,
    SortableTable,
    ArrayListOrdered
  },

  props: {
    mode: {
      type:    String,
      default: _CREATE
    },

    value: {
      type:     Array,
      required: true
    },
    config: {
      type:     Object,
      required: true
    },
    isNewOrUnprovisioned: {
      type:    Boolean,
      default: true
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

  data() {
    return {
      cpu:                 undefined,
      memory:              undefined,
      instanceTypeOptions: [],
      typesDictionary:     {},
      localInstanceTypes:  []
    };
  },
  created() {
    this.getLocalInstanceTypes();
  },

  watch: {
    'config.alibabaCredentialSecret': {
      handler(neu, old) {
        if (!!neu && !!old && neu !== old) {
          this.getLocalInstanceTypes();
        }
      },
      immediate: true
    },
    'config.regionId': {
      handler(neu, old) {
        if (!!neu && !!old && neu !== old) {
          this.getLocalInstanceTypes();
        }
      },
      immediate: true
    },
    zones() {
      this.getLocalInstanceTypes();
    },
    cpu() {
      this.instanceTypeOptions = this.formatInstanceTypesForTable();
    },
    memory() {
      this.instanceTypeOptions = this.formatInstanceTypesForTable();
    },
    allInstanceTypes: {
      handler() {
        const formatted = this.formatInstanceTypesForTable();

        this.instanceTypeOptions = formatted;
      },
      deep: true
    },
    localInstanceTypes() {
      const formatted = this.formatInstanceTypesForTable();

      this.instanceTypeOptions = formatted;
    }
  },
  computed: {
    ...mapGetters({ t: 'i18n/t' }),
    instanceTypeColumns() {
      return [
        {
          name:  'selected',
          label: ' ',
          width: 40,
          align: 'center',
        },
        {
          name:     'instanceFamily',
          labelKey: 'ack.nodePool.instanceTypes.table.columns.instanceFamily',
          value:    `instanceFamily`,
          sort:     `instanceFamily`,
          search:   `instanceFamily`,
        }, {
          name:     'instanceType',
          labelKey: 'ack.nodePool.instanceTypes.table.columns.instanceType',
          value:    `instanceType`,
        }, {
          name:     'vcpus',
          labelKey: 'ack.nodePool.instanceTypes.table.columns.vcpus',
          value:    `vcpus`,
          sort:     `vcpus`,
          search:   `vcpus`,
        }, {
          name:     'memory',
          labelKey: 'ack.nodePool.instanceTypes.table.columns.memory',
          value:    `memory`,
          sort:     `memory`,
          search:   `memory`,
        }, {
          name:     'stock',
          labelKey: 'ack.nodePool.instanceTypes.table.columns.stock',
          value:    `stock`,
          sort:     `stock`,
          search:   `stock`,
        }, {
          name:     'zones',
          labelKey: 'ack.nodePool.instanceTypes.table.columns.zones',
          value:    `zones`,
          sort:     `zones`,
          search:   `zones`,
        }
      ];
    },
    instanceTypes: {
      get() {
        return this.value;
      },
      set(neu) {
        this.$emit('update:value', neu);
      }
    },
    instanceTypesList: {
      get() {
        return (this.instanceTypes || []).map((instanceType) => {
          const fromDict = this.typesDictionary[instanceType];

          if (!fromDict) {
            return { label: instanceType, warning: true };
          }

          const labelParts = [instanceType];

          if (fromDict.vcpus && fromDict.vcpus !== '-') {
            labelParts.push(this.t('ack.nodePool.instanceTypes.table.labelParts.vcpus', { val: fromDict.vcpus }) );
          }
          if (fromDict.memory && fromDict.memory !== '-') {
            labelParts.push(this.t('ack.nodePool.instanceTypes.table.labelParts.memory', { val: fromDict.memory }) );
          }
          labelParts.push(fromDict.stock);
          labelParts.push(fromDict.zones.join(', '));
          const label = labelParts.join(' - ');

          return { label, warning: false };
        });
      },
      set(neu) {
        this.instanceTypes = neu.map((instanceType) => {
          return instanceType.label.split(' - ')[0].trim();
        });
      }
    },

  },
  methods: {
    toggleInstanceType(instanceType, add) {
      const isSelected = this.instanceTypes.includes(instanceType);

      if (add && !isSelected) {
        this.instanceTypes = [...this.instanceTypes, instanceType];
      } else if (!add && isSelected) {
        this.instanceTypes = this.instanceTypes.filter((t) => t !== instanceType);
      }
    },
    formatInstanceTypesForTable() {
      const typesDictionaryNew = {};
      const availableZones = this.localInstanceTypes?.AvailableZones?.AvailableZone || [];

      availableZones.forEach((zone) => {
        const zoneAllowed = this.zones.size === 0 || (zone.ZoneId && this.zones.has(zone.ZoneId)) || !this.isNewOrUnprovisioned;

        if (zoneAllowed && zone.Status === STATUS_AVAILABLE) {
          const availableResources = zone.AvailableResources?.AvailableResource;

          availableResources.forEach((resource) => {
            if (resource.Type === INSTANCE_TYPE) {
              const instanceTypes = resource.SupportedResources?.SupportedResource;

              instanceTypes.forEach((type) => {
                if (type.StatusCategory === WITH_STOCK || type.StatusCategory === WITHOUT_STOCK) {
                  const typeValue = type.Value;

                  if (typesDictionaryNew[typeValue]) {
                    typesDictionaryNew[typeValue].zones.push(zone.ZoneId);
                  } else {
                    if (this.allInstanceTypes[typeValue]) {
                      const fromAll = this.allInstanceTypes[typeValue];
                      const cpuMatches = !this.cpu || (this.cpu && this.cpu === fromAll.cpu);
                      const memoryMatches = !this.memory || this.memory === fromAll.memory;

                      if (cpuMatches && memoryMatches) {
                        typesDictionaryNew[typeValue] = {
                          instanceFamily: fromAll.instanceTypeFamily,
                          vcpus:          fromAll.cpu,
                          memory:         fromAll.memory,
                          stock:          type.StatusCategory,
                          zones:          [zone.ZoneId]
                        };
                      }

                      // If we are filtering by CPU or memory and we do not know them for the instance type, don't add them
                    } else if (!this.memory && !this.cpu) {
                      const typeSplit = typeValue.split('.');
                      const family = `${ typeSplit[0] }.${ typeSplit[1] }`;

                      typesDictionaryNew[typeValue] = {
                        instanceFamily: family,
                        vcpus:          '-',
                        memory:         '-',
                        stock:          type.StatusCategory,
                        zones:          [zone.ZoneId]
                      };
                    }
                  }
                }
              });
            }
          });
        }
      });
      const formatted = Object.entries(typesDictionaryNew).map(([key, val]) => {
        (val).instanceType = key;

        return val;
      });

      this.typesDictionary = typesDictionaryNew;

      return formatted;
    },

    async getLocalInstanceTypes() {
      const { alibabaCredentialSecret, regionId } = this.config;

      try {
        this.instanceTypeOptions = [];
        this.localInstanceTypes = await getAlibabaInstanceTypes(this.$store, alibabaCredentialSecret, regionId);
      } catch (err) {
        const parsedError = err.error || '';

        this.$emit('error', this.t('ack.errors.instanceTypes', { e: parsedError || err }));
      }
    },
  }
});
</script>
<template>
  <h4
    v-if="isNewOrUnprovisioned"
    class="mb-10"
  >
    {{ t('ack.nodePool.instanceTypes.table.title') }}
  </h4>
  <p
    v-if="isNewOrUnprovisioned"
    class="mb-10"
  >
    {{ t('ack.nodePool.instanceTypes.table.subtitle') }}
  </p>
  <SortableTable
    v-if="isNewOrUnprovisioned"
    :loading="loadingInstanceTypes"
    :rows="instanceTypeOptions"
    :headers="instanceTypeColumns"
    :table-actions="false"
    :row-actions="false"
    :rows-per-page="10"
    :paging="true"
    key-field="instanceType"

    class="mb-30"
  >
    <template #header-left>
      <div class="row">
        <div class="col span-3">
          <UnitInput
            v-model:value="cpu"
            :mode="mode"
            placeholder-key="ack.nodePool.instanceTypes.cpu.label"
            suffix="vCPU"
            type="number"
          />
        </div>
        <div class="col span-3">
          <UnitInput
            v-model:value="memory"
            type="number"
            :mode="mode"
            placeholder-key="ack.nodePool.instanceTypes.memory.label"
            suffix="GiB"
          />
        </div>
      </div>
    </template>
    <template #cell:selected="{ row }">
      <Checkbox
        :value="instanceTypes.includes(row.instanceType)"
        @update:value="toggleInstanceType(row.instanceType, $event)"
      />
    </template>
  </SortableTable>

  <h4 class="mb-10">
    {{ t('ack.nodePool.instanceTypes.list.title') }}
  </h4>
  <p class="mb-10">
    {{ t('ack.nodePool.instanceTypes.list.subtitle') }}
  </p>
  <div class="row">
    <ArrayListOrdered
      v-model:value="instanceTypesList"
      :mode="mode"
      :disabled="!isNewOrUnprovisioned"
      :types-dictionary="typesDictionary"
      class="col span-8"
    />
  </div>
</template>
