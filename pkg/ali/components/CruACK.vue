<script>
import { mapGetters } from 'vuex';
import { defineComponent } from 'vue';
import semver from 'semver';
import Loading from '@shell/components/Loading.vue';
import CruResource from '@shell/components/CruResource.vue';
import SelectCredential from '@shell/edit/provisioning.cattle.io.cluster/SelectCredential.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import Labels from '@shell/components/form/Labels';
import Accordion from '@components/Accordion/Accordion.vue';
import Banner from '@components/Banner/Banner.vue';
import { _CREATE, _VIEW, _IMPORT } from '@shell/config/query-params';
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import Tab from '@shell/components/Tabbed/Tab.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import AgentConfiguration from '@shell/edit/provisioning.cattle.io.cluster/tabs/AgentConfiguration.vue';
import Import from './Import.vue';
import NodePool from './NodePool.vue';
import Networking from './Networking.vue';
import ClusterMembershipEditor, { canViewClusterMembershipEditor } from '@shell/components/form/Members/ClusterMembershipEditor.vue';
import cloneDeep from 'lodash/cloneDeep';
import { NORMAN, MANAGEMENT } from '@shell/config/types';
import { removeObject } from '@shell/utils/array';
import { randomStr } from '@shell/utils/string';
import { sortable } from '@shell/utils/version';
import { sortBy } from '@shell/utils/sort';
import { getAlibabaRegions, getAlibabaKubernetesVersions, getAllAlibabaInstanceTypes } from '../util/ack';
import {
  requiredInCluster,
  clusterNameChars,
  clusterNameStart,
  clusterNameLength,
  nodePoolNames,
  nodePoolNamesUnique,
  nodePoolCount,
  instanceTypeCount
} from '../util/validation';
import { SETTING } from '@shell/config/settings';
import { syncUpstreamConfig } from '@shell/utils/kontainer';
import { RadioGroup } from '@components/Form/Radio';
import { STATES_ENUM } from '@shell/plugins/dashboard-store/resource-class';

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_SERVICE_CIDR = '192.168.0.0/16';
const BASIC_CLUSTER_SPEC = 'ack.standard';
const PRO_CLUSTER_SPEC = 'ack.pro.small';

const importedDefaultAckConfig = {
  clusterName:    '',
  clusterId:      '',
  imported:       true,
  clusterType:    'ManagedKubernetes',
  regionId:    DEFAULT_REGION,
};

export const defaultAckConfig = {
  clusterName:          '',
  imported:             false,
  tags:                 {},
  clusterType:          'ManagedKubernetes',
  clusterSpec:          BASIC_CLUSTER_SPEC,
  serviceCidr:          DEFAULT_SERVICE_CIDR,
  snatEntry:            true,
  endpointPublicAccess: true,
  proxyMode:            'ipvs',
  addons:               [
    { name: 'terway-eniip' }
  ],
};

const defaultCluster = {
  labels:                              {},
  annotations:                         {},
  fleetAgentDeploymentCustomization: {
    overrideAffinity:             {},
    appendTolerations:            [],
    overrideResourceRequirements: {}
  },
  clusterAgentDeploymentCustomization: {
    overrideAffinity:             {},
    appendTolerations:            [],
    overrideResourceRequirements: {}
  },
};
const importedDefaultCluster = {
  labels:                  {},
  annotations:             {},
};

export const DEFAULT_NODE_GROUP_CONFIG = {
  name:          'nodePool-0',
  instanceTypes: [
    'ecs.g6.xlarge',
    'ecs.g7.xlarge',
    'ecs.u1-c1m4.xlarge',
    'ecs.g8i.xlarge'
  ],
  systemDiskCategory: 'cloud_essd',
  systemDiskSize:     20,
  dataDisks:          [
    {
      category:  'cloud_essd',
      size:      40,
      encrypted: 'false'
    }
  ],
  desiredSize:    3,
  imageId:        'aliyun_3_x64_20G_alibase_20241218.vhd',
  imageType:      'AliyunLinux3',
  runtime:        'containerd',
  runtimeVersion: '1.6.38',
  vswitchIds:     [],
  _validation:    {},
  _isNew:         true,
};

export default defineComponent({
  name:       'CruACK',
  emits:      ['validationChanged', 'error'],
  components: {
    SelectCredential,
    CruResource,
    LabeledSelect,
    LabeledInput,
    ClusterMembershipEditor,
    Labels,
    Accordion,
    Banner,
    Loading,
    Import,
    Networking,
    NodePool,
    Tabbed,
    Tab,
    AgentConfiguration,
    RadioGroup
  },

  mixins: [CreateEditView, FormValidation],

  props: {
    mode: {
      type:    String,
      default: _CREATE
    },
    value: {
      type:    Object,
      default: () => {
        return {};
      }
    }
  },
  data() {
    return {
      normanCluster:          { name: '', aliConfig: {} },
      originalVersion:        '',
      nodePools:              [],
      membershipUpdate:       {},
      locationOptions:        [],
      allVersions:            [],
      allImages:              {},
      allInstanceTypes:       {},
      loadingLocations:       false,
      loadingVersions:        false,
      loadingInstanceTypes:    false,
      loadingImages:          false,
      configUnreportedErrors: [],
      configIsValid:          true,
      zones:                  new Set(),
      fvFormRuleSets:         this.isImport ? [
        {
          path:  'name',
          rules: ['nameRequired', 'clusterNameChars', 'clusterNameStart', 'clusterNameLength'],
        },
        {
          path:  'clusterName',
          rules: ['importedName']
        },
      ] : [{
        path:  'name',
        rules: ['nameRequired', 'clusterNameChars', 'clusterNameStart', 'clusterNameLength'],
      },
      {
        path:  'poolName',
        rules: ['poolNames', 'poolNamesUnique']
      },
      {
        path:  'poolCount',
        rules: ['poolCount']
      },
      {
        path:  'instanceTypeCount',
        rules: ['instanceTypeCount']
      },
      ],

    };
  },

  created() {
    const registerAfterHook = this.registerAfterHook ;

    registerAfterHook(this.saveRoleBindings, 'save-role-bindings');
  },

  async fetch() {
    const store = this.$store;

    if (this.value.id) {
      const liveNormanCluster = await this.value.findNormanCluster();

      this.normanCluster = await store.dispatch(`rancher/clone`, { resource: liveNormanCluster });
      if (!(this.isNew || this.isInactive) ) {
        syncUpstreamConfig('ali', this.normanCluster);
      }

      // track original version on edit to ensure we don't offer k8s downgrades
      this.originalVersion = this.normanCluster?.aliConfig?.kubernetesVersion || '';
    } else {
      const base = !this.isImport ? defaultCluster : importedDefaultCluster ;

      this.normanCluster = await store.dispatch('rancher/create', { type: NORMAN.CLUSTER, ...base }, { root: true });
    }
    if (this.isImport) {
      this.normanCluster.aliConfig = cloneDeep(importedDefaultAckConfig);
    } else {
      if (!this.normanCluster.aliConfig) {
        this.normanCluster.aliConfig = { ...defaultAckConfig };
      }
      if (this.mode === _CREATE && (!this.normanCluster?.aliConfig?.nodePools || this.normanCluster?.aliConfig?.nodePools.length === 0)) {
        const pool = cloneDeep(DEFAULT_NODE_GROUP_CONFIG);

        pool._id = randomStr();
        this.normanCluster.aliConfig.nodePools = [pool];
      } else if (this.normanCluster.aliConfig.nodePools && this.normanCluster.aliConfig.nodePools.length > 0) {
        this.normanCluster.aliConfig.nodePools.forEach((pool) => {
          pool['_id'] = pool.nodePoolId || randomStr();
          pool['_isNew'] = this.isNew;
          pool['_validation'] = {};
        });
      }
      this.nodePools = this.normanCluster.aliConfig.nodePools || [];
    }
  },
  watch: {
    'config.alibabaCredentialSecret'(neu) {
      if (neu) {
        this.getLocations();
        if (!this.isImport) {
          this.getVersions();
          this.getAllInstanceTypes();
        }
      }
    },
    'config.regionId'(neu) {
      if (neu && !this.isImport) {
        this.getVersions();
        this.getAllInstanceTypes();
      }
    },
  },
  computed: {
    ...mapGetters({ t: 'i18n/t' }),
    CREATE() {
      return _CREATE;
    },

    VIEW() {
      return _VIEW;
    },
    isView() {
      return this.mode === _VIEW;
    },

    isImport() {
      return this.$route?.query?.mode === _IMPORT;
    },
    isNew() {
      return this.mode === _CREATE || this.mode === _IMPORT;
    },

    isInactive() {
      return !this.isNew && (!this.normanCluster?.aliStatus?.upstreamSpec || this.value.state !== STATES_ENUM.ACTIVE);
    },
    clusterSpecOptions() {
      return [
        {
          value:    BASIC_CLUSTER_SPEC,
          label:    this.t('ack.clusterSpec.options.basic'),
        },
        {
          value:    PRO_CLUSTER_SPEC,
          label:    this.t('ack.clusterSpec.options.pro'),
        },
      ];
    },

    supportedVersionRange() {
      return this.$store.getters['management/byId'](MANAGEMENT.SETTING, SETTING.UI_SUPPORTED_K8S_VERSIONS)?.value;
    },
    fvExtraRules() {
      return {
        nameRequired:            requiredInCluster(this, 'nameNsDescription.name.label', 'normanCluster.name'),
        clusterNameChars:        clusterNameChars(this),
        clusterNameStart:        clusterNameStart(this),
        clusterNameLength:       clusterNameLength(this),
        importedName:            requiredInCluster(this, 'ali.import.label', 'config.clusterName'),
        poolNames:               nodePoolNames(this),
        poolNamesUnique:         nodePoolNamesUnique(this),
        poolCount:               nodePoolCount(this),
        instanceTypeCount:       instanceTypeCount(this),
      };
    },

    hasCredential() {
      return !!this.config?.alibabaCredentialSecret;
    },
    canManageMembers() {
      return canViewClusterMembershipEditor(this.$store);
    },
    config: {
      get() {
        return this.normanCluster.aliConfig;
      },
      set(neu) {
        this.normanCluster.aliConfig = neu;
      }
    },

    // filter out versions outside ui-k8s-supported-versions-range global setting and versions < current version
    // sort versions, descending
    versionOptions() {
      const validVersions = this.allVersions;

      validVersions.forEach((v) => {
        v.sort = sortable(v.value);
      });

      const sorted = sortBy(validVersions, 'sort', true); // Descending order

      if (!this.config.kubernetesVersion) {
        const firstValid = sorted.find((v) => !v.disabled);

        this.config.kubernetesVersion = firstValid?.value;
      }

      return sorted;
    },
    allImagesForVersion() {
      const imagesForVersion = this.allImages[this.config?.kubernetesVersion] || [];
      const options = {};

      imagesForVersion.forEach((image) => {
        options[image.image_type] = {
          imageType: image.image_type, imageId: image.image_id, label: image.image_name
        };
      });

      return options;
    }
  },
  methods: {
    async getLocations() {
      if (!this.isNew) {
        return;
      }
      this.loadingLocations = true;

      const { alibabaCredentialSecret } = this.config;

      try {
        const res = await getAlibabaRegions(this.$store, alibabaCredentialSecret);

        this.locationOptions = (res?.Regions?.Region || []).map((r) => {
          return { value: r.RegionId, label: `${ r?.RegionId } - ${ r.LocalName }` };
        });

        if (this.locationOptions.find((r) => r.value === DEFAULT_REGION)) {
          this.config.regionId = DEFAULT_REGION;
        } else {
          this.config.regionId = this.locationOptions[0]?.value;
        }
      } catch (err) {
        const parsedError = err.error || '';
        const errors = this.errors;

        errors.push(this.t('ack.errors.regions', { e: parsedError || err }));
      }
      this.loadingLocations = false;
    },
    async getVersions() {
      this.loadingVersions = true;

      const { alibabaCredentialSecret, regionId } = this.config;

      try {
        // Get all versions here and get upgradable options later
        const res = await getAlibabaKubernetesVersions(this.$store, alibabaCredentialSecret, regionId, false, '' );
        const unprocessedVersions = (res || []).map((v) => {
          return {
            value: v.version, creatable: v.creatable, images: v.images
          };
        });

        this.allVersions = await this.processVersions(unprocessedVersions);
      } catch (err) {
        const parsedError = err.error || '';

        this.errors.push(this.t('ack.errors.versions', { e: parsedError || err }));
      }
      this.loadingVersions = false;
    },

    async processVersions(unprocessedVersions) {
      const newAllImages = {};
      const { alibabaCredentialSecret, regionId } = this.config;
      let upgradableVersions;

      if (this.isEdit) {
        const res = await getAlibabaKubernetesVersions(this.$store, alibabaCredentialSecret, regionId, this.isEdit, this.originalVersion );

        if (res && res.length > 0 && res[0].upgradable_versions) {
          upgradableVersions = new Set(res[0].upgradable_versions);
        }
      }
      const validVersions = (unprocessedVersions || []).reduce((versions, version) => {
        const coerced = semver.coerce(version.value);

        if (this.supportedVersionRange && !semver.satisfies(coerced, this.supportedVersionRange)) {
          return versions;
        }
        const isCurrentValue = !this.isCreate && version.value === this.originalVersion;
        const curImages = (this.config.nodePools || []).map((pool) => pool.imageType);
        const versionImages = new Set((version.images || []).map((image) => image.image_type));

        let canUpgradeTo = this.isEdit && !!upgradableVersions && upgradableVersions.has(version.value);
        let i = 0;

        while (canUpgradeTo && i < curImages.length) {
          if (!versionImages.has(curImages[i])) {
            canUpgradeTo = false;
          }
          i++;
        }

        if ((this.isCreate && version.creatable) || isCurrentValue || canUpgradeTo) {
          versions.push({ value: version.value, label: version.value });
          newAllImages[version.value] = version.images;
        }

        return versions;
      }, []);

      this.allImages = newAllImages;

      return validVersions;
    },

    cancelCredential() {
      if ( this.$refs.cruresource ) {
        (this.$refs.cruresource).emitOrRoute();
      }
    },
    onMembershipUpdate(update) {
      this['membershipUpdate'] = update;
    },
    async saveRoleBindings() {
      if (this.membershipUpdate.save) {
        await this.membershipUpdate.save(this.normanCluster.id);
      }
    },
    async actuallySave() {
      await this.normanCluster.save();

      return await this.normanCluster.waitForCondition('InitialRolesPopulated');
    },
    setClusterName(name) {
      this.normanCluster['name'] = name;

      if (!this.isImport) {
        this.config['clusterName'] = name;
      }
    },
    removePool(i) {
      const pool = this.nodePools[i];
      const lastAndExisting = this.nodePools.length === 1 && !this.isNew;

      if (!lastAndExisting) {
        removeObject(this.nodePools, pool);
      }
    },

    addPool() {
      const poolName = `nodePool-${ this.nodePools.length + 1 }`;
      const _id = randomStr();
      const neu = {
        ...cloneDeep(DEFAULT_NODE_GROUP_CONFIG), name: poolName, _id, _isNew: true, version: this.config.kubernetesVersion
      };

      this.nodePools.push(neu);

      this.$nextTick(() => {
        const pools = this.$refs.pools;

        if ( pools && pools.select ) {
          pools.select(poolName);
        }
      });
    },
    async getAllInstanceTypes() {
      this.loadingInstanceTypes = true;
      const { alibabaCredentialSecret, regionId } = this.config;

      try {
        this.allInstanceTypes = {};
        let nextToken;

        do {
          const res = await getAllAlibabaInstanceTypes(this.$store, alibabaCredentialSecret, regionId, nextToken);
          const fromRes = res?.InstanceTypes?.InstanceType || [];

          fromRes.forEach((type) => {
            if (type.InstanceTypeId) {
              this.allInstanceTypes[type.InstanceTypeId] = {
                instanceTypeFamily: type.InstanceTypeFamily,
                cpu:                type.CpuCoreCount,
                memory:             type.MemorySize,
              };
            }
          });
          nextToken = res?.NextToken;
        } while (nextToken);
      } catch (err) {
        const parsedError = err.error || '';

        this.errors.push(this.t('ack.errors.instanceTypes', { e: parsedError || err }));
      }
      this.loadingInstanceTypes = false;
    },
    poolIsValid(pool) {
      const poolValidation = pool?._validation || {};

      return !Object.values(poolValidation).includes(false);
    },
  }
});
</script>
<template>
  <Loading v-if="$fetchState.pending" />
  <CruResource
    v-else
    ref="cruresource"
    :resource="value"
    :mode="mode"
    :can-yaml="false"
    :done-route="doneRoute"
    :validation-passed="fvFormIsValid && configIsValid && !!config.regionId"
    :errors="fvUnreportedValidationErrors"
    @error="e=>errors=e"
    @finish="save"
  >
    <div
      v-if="hasCredential"
      class="row mb-20"
    >
      <div class="col span-4">
        <LabeledInput
          :value="normanCluster.name"
          :mode="mode"
          label-key="generic.name"
          required
          :rules="fvGetAndReportPathRules('name')"
          :disabled="!isCreate"
          @update:value="setClusterName"
        />
      </div>
      <div class="col span-4">
        <LabeledInput
          v-model:value="normanCluster.description"
          :mode="mode"
          label-key="nameNsDescription.description.label"
          :placeholder="t('nameNsDescription.description.placeholder')"
          :disabled="isView || isInactive"
        />
      </div>
    </div>
    <div
      :class="hasCredential ? 'row mb-20' : 'row creating-credential'"
    >
      <div :class="hasCredential ? 'col span-4' : 'col span-12'">
        <SelectCredential
          v-model:value="config.alibabaCredentialSecret"
          data-testid="cruack-select-credential"
          :mode="mode === CREATE ? CREATE : VIEW"
          provider="alibaba"
          :default-on-cancel="true"
          :showing-form="hasCredential"
          :cancel="cancelCredential"
        />
      </div>
      <div
        v-if="hasCredential"
        class="col span-4"
      >
        <LabeledSelect
          v-model:value="config.regionId"
          data-testid="cruack-regionId"
          :mode="mode"
          :options="locationOptions"
          label-key="ack.location.label"
          :loading="loadingLocations"
          required
          :rules="fvGetAndReportPathRules('regionId')"
          :disabled="!isNew"
        />
      </div>

      <div
        v-if="hasCredential && !isImport"
        class="col span-4"
      >
        <LabeledSelect
          v-model:value="config.kubernetesVersion"
          data-testid="cruack-kubernetesversion"
          :mode="mode"
          :options="versionOptions"
          label-key="ack.kubernetesVersion.label"
          option-key="value"
          option-label="label"
          :loading="loadingVersions"
          required
          :disabled="isView || isInactive"
        />
      </div>
    </div>

    <div
      v-if="hasCredential && !isImport"
      class="row mb-20"
    >
      <div

        class="col span-4"
      >
        <RadioGroup
          v-model:value="config.clusterSpec"
          name="cluster-spec"
          data-testid="cruack-clusterSpec"
          :mode="mode"
          :options="clusterSpecOptions"
          label-key="ack.clusterSpec.label"
          required
          :disabled="!isNew"
        />
      </div>
    </div>
    <div
      v-if="hasCredential"
      class="mt-10"
      data-testid="cruack-form"
    >
      <Accordion
        v-if="isImport"
        :open-initially="true"
        class="mb-20"
        title-key="ack.accordions.cluster"
      >
        <Import
          v-model:cluster-name="config.clusterName"
          v-model:cluster-id="config.clusterId"
          :region="config.regionId"
          :credential="config.alibabaCredentialSecret"
          :rules="{clusterName: fvGetAndReportPathRules('clusterName')}"
          :mode="mode"
          data-testid="cruack-import"
          @error="e=>errors.push(e)"
        />
      </Accordion>
      <div v-else>
        <Accordion
          :open-initially="true"
          class="mb-20"
          title-key="ack.accordions.networking"
        >
          <Networking
            v-model:resource-group-id="config.resourceGroupId"
            v-model:vpc-id="config.vpcId"
            v-model:vswitch-ids="config.vswitchIds"
            v-model:zone-ids="config.zoneIds"
            v-model:snat-entry="config.snatEntry"
            v-model:proxy-mode="config.proxyMode"
            v-model:service-cidr="config.serviceCidr"
            v-model:endpoint-public-access="config.endpointPublicAccess"
            v-model:container-cidr="config.containerCidr"
            v-model:node-cidr-mask="config.nodeCidrMask"
            v-model:pod-vswitch-ids="config.podVswitchIds"
            v-model:addons="config.addons"
            v-model:config-unreported-errors="configUnreportedErrors"
            v-model:config-is-valid="configIsValid"
            v-model:enable-network-policy="normanCluster.enableNetworkPolicy"
            :config="config"
            :value="value"
            :mode="mode"
            @error="e=>errors.push(e)"
            @zone-changed="(val)=>zones=val"
          />
        </Accordion>
        <div><h3>{{ t('ack.nodePools.title') }}</h3></div>
        <Tabbed
          ref="pools"
          class="node-pools mb-20"
          :side-tabs="true"
          :show-tabs-add-remove="!isView && !isInactive"
          :use-hash="false"
          @removeTab="removePool($event)"
          @addTab="addPool()"
        >
          <Tab
            v-for="(pool) in nodePools"
            :key="pool._id"
            :label="pool.name"
            :name="`${pool.name || t('ack.nodePool.unnamed')}`"
            :error="!poolIsValid(pool)"
          >
            <NodePool
              :mode="mode"
              :config="config"
              :pool="pool"
              :is-inactive="isInactive"
              :all-images="allImagesForVersion"
              :all-instance-types="allInstanceTypes"
              :loading-images="loadingImages"
              :loading-instance-types="loadingInstanceTypes"
              :zones="zones"
              :validation-rules="{
                name: fvGetAndReportPathRules('poolName'),
                count: fvGetAndReportPathRules('poolCount'),
                instanceTypeCount: fvGetAndReportPathRules('instanceTypeCount')
              }"
              @error="e=>errors.push(e)"
            />
          </Tab>
        </Tabbed>
      </div>
      <Accordion
        class="mb-20"
        title-key="members.memberRoles"
      >
        <Banner
          v-if="isEdit"
          color="info"
        >
          {{ t('cluster.memberRoles.removeMessage') }}
        </Banner>
        <ClusterMembershipEditor
          v-if="canManageMembers"
          :mode="mode"
          :parent-id="normanCluster.id ? normanCluster.id : null"
          @membership-update="onMembershipUpdate"
        />
      </Accordion>
      <Accordion
        class="mb-20"
        title-key="ack.accordions.labels"
      >
        <Labels
          v-model:value="normanCluster"
          :mode="mode"
        />
      </Accordion>
      <Accordion
        v-if="normanCluster.fleetAgentDeploymentCustomization ||
          normanCluster.clusterAgentDeploymentCustomization"
        class="mb-20"
        title-key="ack.accordions.advanced"
      >
        <h4>{{ t('cluster.agentConfig.tabs.cluster') }}</h4>
        <AgentConfiguration
          v-if="normanCluster.clusterAgentDeploymentCustomization"
          v-model:value="normanCluster.clusterAgentDeploymentCustomization"
          data-testid="rke2-cluster-agent-config"
          type="cluster"
          :mode="mode"
          :scheduling-customization-feature-enabled="false"
          class="mb-20"
        />
        <h4>{{ t('cluster.agentConfig.tabs.fleet') }}</h4>
        <AgentConfiguration
          v-if="normanCluster.fleetAgentDeploymentCustomization"
          v-model:value="normanCluster.fleetAgentDeploymentCustomization"
          data-testid="rke2-fleet-agent-config"
          type="fleet"
          :mode="mode"
        />
      </Accordion>
    </div>
    <template
      v-if="!hasCredential"
      #form-footer
    >
      <div />
    </template>
  </CruResource>
</template>

<style lang="scss" scoped>
.cru-ack-content-wrapper.no-credential {
  display: flex;
  flex-direction: column;
  height: 100%;

  > div {
    flex-grow: 1;
    display: flex;
    > .col {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
    }
  }
}

.node-pools > .tab-container {
  border-top-right-radius: 8px ;
  border-bottom-right-radius: 8px ;
}

.creating-credential,.creating-credential>div {
  display: flex;
  flex-direction: column;
  flex-grow: 1;

}

.node-pools :deep() .fixed-header-actions {
  grid-column-gap: 0px;

  .row {
    justify-content: flex-end;
  }

  .col {
    margin-left: 10px;
    margin-right: 0px;
  }

}
</style>
