<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import debounce from 'lodash/debounce';
import { _EDIT, _VIEW, _CREATE } from '@shell/config/query-params';
import { removeAt } from '@shell/utils/array';
import { clone } from '@shell/utils/object';
import DiskType from './DiskType.vue';
import { DEFAULT_DISK_VALUE } from '../util/shared';
interface DiskRow {
  value: any;
}
interface Props {
  value?: any[] | null;
  mode?: string;
  removeAllowed?: boolean;
  addDisabled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  options?: any[];
}

const {
  value = null,
  mode = _EDIT,
  removeAllowed = true,
  addDisabled = false,
  loading = false,
  disabled = false,
  options = []
} = defineProps<Props>();

const emit = defineEmits(['add', 'remove', 'update:value']);
const input = (Array.isArray(value) ? value : []).slice();
const rows = ref<DiskRow[]>([]);

for ( const val of input ) {
  rows.value.push({ value: val });
}
if ( !rows.value.length ) {
  const val = clone(DEFAULT_DISK_VALUE);

  rows.value.push({ value: val });
}

const isView = computed(() => {
  return mode === _VIEW;
});

const isCreate = computed(() => {
  return mode === _CREATE;
});

/**
* Cleanup rows and emit input
*/
const update = () => {
  if ( isView.value ) {
    return;
  }
  const out = [];

  for ( const row of rows.value ) {
    const val = row.value;

    if ( typeof val !== 'undefined' ) {
      out.push(val);
    }
  }
  emit('update:value', out);
};

const lastUpdateWasFromValue = ref(false);
const queueUpdate = debounce(update, 50);

watch(
  rows,
  () => {
    // lastUpdateWasFromValue is used to break a cycle where when rows are updated
    // this was called which then forced rows to updated again
    if (!lastUpdateWasFromValue.value) {
      queueUpdate();
    }
    lastUpdateWasFromValue.value = false;
  },
  { deep: true }
);

watch(
  () => value,
  () => {
    lastUpdateWasFromValue.value = true;
    rows.value = (value || []).map((v) => ({ value: v }));
  },
  { deep: true }
);

function add() {
  rows.value.push({ value: clone(DEFAULT_DISK_VALUE) });
  if (DEFAULT_DISK_VALUE) {
    queueUpdate();
  }
  emit('add');
}

/**
 * Remove item and emits removed row and its own index value
 */
function remove(row: DiskRow, index: number) {
  emit('remove', { row, index });
  removeAt(rows.value, index);
  queueUpdate();
}

</script>
<template>
  <div>
    <template v-if="rows.length">
      <div
        v-for="(row, idx) in rows"
        :key="idx"
        :data-testid="`ack-disk-group-box${ idx }`"
        role="group"
      >
        <DiskType
          :key="idx"
          v-model:category="row.value.category"
          v-model:size="row.value.size"
          v-model:encrypted="row.value.encrypted"
          :mode="mode"
          :disabled="disabled"
          :options="options"
          :loading="loading"
        >
          <template #remove>
            <div
              v-if="removeAllowed && isCreate"
            >
              <button
                type="button"
                :disabled="disabled"
                class="btn role-link"
                :data-testid="`ack-disk-group-remove-item-${idx}`"
                :aria-label="t('generic.ariaLabel.remove', {index: idx+1})"
                role="button"
                @click="remove(row, idx)"
              >
                {{ t('ack.nodePool.diskGroup.remove') }}
              </button>
            </div>
          </template>
        </DiskType>
      </div>
    </template>
    <div v-else>
      <div
        v-if="isView"
        class="text-muted"
      >
        &mdash;
      </div>
    </div>
    <div
      v-if="isCreate"
      class="footer mmt-6"
    >
      <button
        type="button"
        class="btn role-tertiary add"
        :disabled="loading || addDisabled || disabled"
        :data-testid="`ack-disk-group-add-button`"
        :aria-label="'ack.nodePool.diskGroup.add'"
        role="button"
        @click="add()"
      >
        <i
          class="mr-5 icon"
          :class="loading ? ['icon-lg', 'icon-spinner','icon-spin']: ['icon-plus']"
        />
        {{ t('ack.nodePool.diskGroup.add') }}
      </button>
    </div>
  </div>
</template>
