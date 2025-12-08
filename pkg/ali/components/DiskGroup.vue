<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import debounce from 'lodash/debounce';
import { _EDIT, _VIEW, _CREATE } from '@shell/config/query-params';
import { removeAt } from '@shell/utils/array';
import { clone } from '@shell/utils/object';
import DiskType from './DiskType.vue';
import { DEFAULT_DISK_VALUE } from '../util/shared';

const emit = defineEmits(['add', 'remove', 'update:value']);
const props = defineProps({
  value: {
    type:    Array,
    default: null,
  },
  mode: {
    type:    String,
    default: _EDIT,
  },
  removeAllowed: {
    type:    Boolean,
    default: true,
  },
  addDisabled: {
    type:    Boolean,
    default: false,
  },
  loading: {
    type:    Boolean,
    default: false
  },
  disabled: {
    type:    Boolean,
    default: false
  },
  options: {
    type:    Array,
    default: () => []
  },
});

const input = (Array.isArray(props.value) ? props.value : []).slice();
const rows = ref([]);

for ( const value of input ) {
  rows.value.push({ value });
}
if ( !rows.value.length ) {
  const value = clone(DEFAULT_DISK_VALUE);

  rows.value.push({ value });
}

const isView = computed(() => {
  return props.mode === _VIEW;
});

const isCreate = computed(() => {
  return props.mode === _CREATE;
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
    const value = row.value;

    if ( typeof value !== 'undefined' ) {
      out.push(value);
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
  () => props.value,
  () => {
    lastUpdateWasFromValue.value = true;
    rows.value = (props.value || []).map((v) => ({ value: v }));
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
function remove(row, index) {
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
          v-model:value="row.value"
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
