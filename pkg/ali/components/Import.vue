<script setup lang="ts">
import { ref, watch } from 'vue';
import { _EDIT } from '@shell/config/query-params';
import debounce from 'lodash/debounce';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { getAlibabaClusters } from '../util/ack';
import { useStore } from 'vuex';

interface Props {
  mode?: string;
  // name of cluster to be imported
  // this wont necessarily align with normanCluster.name as it would w/ provisioning
  clusterName?: string;
  clusterId?: string;
  credential?: string | null;
  region?: string;
  rules?: any;
}

const {
  mode = _EDIT,
  clusterName = '',
  clusterId = '',
  credential = null,
  region = '',
  rules = {}
} = defineProps<Props>();

const emit = defineEmits(['update:clusterName', 'update:clusterId', 'error']);
const store = useStore();
const loadingClusters = ref(false);
const clusters = ref([]);

function clusterChanged(val: any) {
  emit('update:clusterName', val?.name || '');
  emit('update:clusterId', val?.id || '');
};

async function listAckClusters() {
  if (!region || !credential) {
    return;
  }
  loadingClusters.value = true;
  try {
    const res = await getAlibabaClusters(store, credential, region );

    clusters.value = res?.map((c: any) => {
      return { name: c.name, id: c.cluster_id };
    }) || [];
  } catch (err) {
    emit('error', err);
  }

  loadingClusters.value = false;
};

const debouncedlistAckClusters = debounce(listAckClusters, 200);
debouncedlistAckClusters();

watch(() => region, debouncedlistAckClusters);
watch(() => credential, debouncedlistAckClusters);

</script>

<template>
  <div class="row mb-10 align-center">
    <div class="col span-6">
      <LabeledSelect
        v-if="clusters.length"
        :loading="loadingClusters"
        :mode="mode"
        :value="clusterName"
        :options="clusters"
        label-key="ali.import.label"
        option-label="name"
        :rules="rules.displayName"
        @selecting="clusterChanged"
      />
      <LabeledInput
        v-else
        label-key="ali.import.label"
        :value="clusterName"
        :rules="rules.displayName"
        @update:value="$emit('update:clusterName', $event)"
      />
    </div>
  </div>
</template>
