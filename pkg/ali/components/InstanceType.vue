
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import UnitInput from '@shell/components/form/UnitInput.vue';
import ArrayListOrdered from './ArrayListOrdered.vue';
import { _CREATE } from '@shell/config/query-params';
import { getAlibabaInstanceTypes } from '../util/ack';
import SortableTable from '@shell/components/SortableTable/index.vue';
import { STATUS_AVAILABLE, INSTANCE_TYPE, WITH_STOCK, WITHOUT_STOCK, INSTANCE_TYPE_COLUMNS } from '../util/shared';
defineOptions({ name: 'InstanceType' });
interface InstanceTypeRow {
  instanceFamily: string;
  vcpus: number | string;
  memory: number | string;
  stock: string;
  zones: string[];
  instanceType?: string;
}
interface Props {
  mode?: string;
  value: string[];
  config: Record<string, any>;
  disabled?: boolean;
  loadingInstanceTypes?: boolean;
  allInstanceTypes?: Record<string, any>;
  zones?: Set<string>;
  rules?: ((val: string[]) => string | undefined)[];
}
const {
  mode = _CREATE,
  value,
  config,
  disabled = false,
  loadingInstanceTypes = false,
  allInstanceTypes = {},
  zones = new Set(),
  rules = []
} = defineProps<Props>();

const emit = defineEmits(['update:value', 'error']);  
const store = useStore();
const { t } = useI18n(store);

const cpu = ref<number | undefined>(undefined);
const memory = ref<number | undefined>(undefined);
const instanceTypeOptions = ref<InstanceTypeRow[]>([]);
const typesDictionary = ref<Record<string, InstanceTypeRow>>({});
const localInstanceTypes = ref<any>([]);

const instanceTypesList = computed({
  get: () => { 
    return (value || []).map((instanceType: string) => {
      const fromDict = typesDictionary.value[instanceType];

      if (!fromDict) {
        return { label: instanceType, warning: true };
      }

      const labelParts = [instanceType];

      if (fromDict.vcpus && fromDict.vcpus !== '-') {
        labelParts.push(t('ack.nodePool.instanceTypes.table.labelParts.vcpus', { val: fromDict.vcpus }) );
      }
      if (fromDict.memory && fromDict.memory !== '-') {
        labelParts.push(t('ack.nodePool.instanceTypes.table.labelParts.memory', { val: fromDict.memory }) );
      }
      labelParts.push(fromDict.stock);
      labelParts.push(fromDict.zones.join(', '));
      const label = labelParts.join(' - ');

      return { label, warning: false };
    });
  },
  set: (neu: { label: string }[]) => {
    const newInstanceTypes = neu.map((instanceType: { label: string }) => {
      return instanceType.label.split(' - ')[0].trim();
    });
    emit('update:value', newInstanceTypes)
  }
});

const validationErrors = computed(() => {
  const ruleMessages = [];

  for (const rule of rules) {
    const message = rule(value);

    if (!!message ) {
      ruleMessages.push(message);
    }
  }

  return ruleMessages;
});

function toggleInstanceType(instanceType: string, add: boolean) {
  const isSelected = value.includes(instanceType);
  if (add && !isSelected) {
    const newInstanceTypes = [...value, instanceType];
    emit('update:value', newInstanceTypes);
  } else if (!add && isSelected) {
    const newInstanceTypes = value.filter((t) => t !== instanceType);
    emit('update:value', newInstanceTypes)
  }

};
function formatInstanceTypesForTable() {
  const typesDictionaryNew: Record<string, InstanceTypeRow> = {};

  const availableZones = localInstanceTypes.value?.AvailableZones?.AvailableZone || [];

  availableZones.forEach((zone: any) => {
    const zoneAllowed = zones.size === 0 || (zone.ZoneId && zones.has(zone.ZoneId)) || disabled;

    if (zoneAllowed && zone.Status === STATUS_AVAILABLE) {
      const availableResources = zone.AvailableResources?.AvailableResource || [];

      availableResources.forEach((resource: any) => {
        if (resource.Type === INSTANCE_TYPE) {
          const instanceTypes = resource.SupportedResources?.SupportedResource;

          instanceTypes.forEach((type: any) => {
            if (type.StatusCategory === WITH_STOCK || type.StatusCategory === WITHOUT_STOCK) {
              const typeValue = type.Value;

              if (typesDictionaryNew[typeValue]) {
                typesDictionaryNew[typeValue].zones.push(zone.ZoneId);
              } else {
                if (allInstanceTypes[typeValue]) {
                  const fromAll = allInstanceTypes[typeValue];
                  const cpuMatches = !cpu.value || (cpu.value && cpu.value === fromAll.cpu);
                  const memoryMatches = !memory.value || memory.value === fromAll.memory;

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
                } else if (!memory && !cpu) {
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
    val.instanceType = key;

    return val;
  });

  return { formatted, typesDictionaryNew };
};
async function getLocalInstanceTypes() {
  const { alibabaCredentialSecret, regionId } = config;

  try {
    instanceTypeOptions.value = [];
    localInstanceTypes.value = await getAlibabaInstanceTypes(store, alibabaCredentialSecret, regionId);
  } catch (err: any) {
    const parsedError = err.error || '';

    emit('error', t('ack.errors.instanceTypes', { e: parsedError || err }));
  }
};

function updateTable() {
  const { formatted, typesDictionaryNew } = formatInstanceTypesForTable();

  instanceTypeOptions.value = formatted;
  typesDictionary.value = typesDictionaryNew;
}
watch(() => config.alibabaCredentialSecret, (neu, old) => {
  if (neu && old && neu !== old) {
    getLocalInstanceTypes();
  }
});

watch(() => config.regionId, (neu, old) => {
  if (neu && old && neu !== old) {
    getLocalInstanceTypes();
  }
});

watch(() => zones, () => {
  getLocalInstanceTypes();
});

watch(cpu, updateTable);
watch(memory, updateTable);
watch(() => allInstanceTypes, updateTable, { deep: true });
watch(localInstanceTypes, updateTable);

getLocalInstanceTypes();
</script>

<template>
  <h4
    v-if="!disabled"
    class="mb-10"
  >
    {{ t('ack.nodePool.instanceTypes.table.title') }}
  </h4>
  <p
    v-if="!disabled"
    class="mb-10"
  >
    {{ t('ack.nodePool.instanceTypes.table.subtitle') }}
  </p>
  <SortableTable
    v-if="!disabled"
    :loading="loadingInstanceTypes"
    :rows="instanceTypeOptions"
    :headers="INSTANCE_TYPE_COLUMNS"
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
        :value="value.includes(row.instanceType)"
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
      :disabled="disabled"
      :types-dictionary="typesDictionary"
      class="col span-8"
    />
  </div>
  <p
    v-if="validationErrors.length > 0"
    class="mb-10 error"
  >
    {{ validationErrors.join(' ') }}
  </p>
</template>

<style lang="scss" scoped>
.error{
  color: var(--error);
}
</style>
