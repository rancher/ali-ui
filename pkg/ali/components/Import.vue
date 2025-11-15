<script>
import { _EDIT } from '@shell/config/query-params';
import debounce from 'lodash/debounce';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import { getAlibabaClusters } from '../util/ack';
export default {
  name: 'ImportACK',

  emits: ['update:clusterName', 'update:clusterId', 'error'],

  components: { LabeledSelect, LabeledInput },

  props: {
    mode: {
      type:    String,
      default: _EDIT
    },

    // name of cluster to be imported
    // this wont necessarily align with normanCluster.name as it would w/ provisioning
    clusterName: {
      type:    String,
      default: ''
    },
    clusterId: {
      type:    String,
      default: ''
    },

    credential: {
      type:    String,
      default: null
    },

    region: {
      type:    String,
      default: ''
    },

    rules: {
      type:    Object,
      default: () => {
        return {};
      }
    }
  },

  created() {
    this.debouncedlistAckClusters = debounce(this.listAckClusters, 200);
    this.debouncedlistAckClusters();
  },

  data() {
    return { loadingClusters: false, clusters: [] };
  },

  watch: {
    region() {
      this.debouncedlistAckClusters();
    },
    cloudCredentialId() {
      this.debouncedlistAckClusters();
    }
  },

  methods: {
    clusterChanged(val) {
      this.$emit('update:clusterName', val?.name || '');
      this.$emit('update:clusterId', val?.id || '');
    },
    async listAckClusters() {
      if (!this.region || !this.credential) {
        return;
      }
      this.loadingClusters = true;
      try {
        const res = await getAlibabaClusters(this.$store, this.credential, this.region );

        this.clusters = res?.map((c) => {
          return { name: c.name, id: c.cluster_id };
        }) || [];
      } catch (err) {
        this.$emit('error', err);
      }

      this.loadingClusters = false;
    }
  }
};
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
