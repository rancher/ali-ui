<script>
import { mapGetters } from 'vuex';
import { defineComponent } from 'vue';
import { _CREATE, _IMPORT } from '@shell/config/query-params';
import FormValidation from '@shell/mixins/form-validation';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import RadioGroup from '@components/Form/Radio/RadioGroup.vue';
import { doCidrOverlap, isValidCIDR } from '../util/validation';
import { getAlibabaResourceGroups, getAlibabaVpcs, getAlibabaZones, getAlibabaVSwitches } from '../util/ack';
import {
  FLANNEL,
  TERWAY,
  FLANNEL_ADDON,
  TERWAY_ADDON,
  MAX_NODE_CIDR_MASK,
  CONTAINER_CIDR_1,
  CONTAINER_CIDR_2,
  CONTAINER_CIDR_3,
  SERVICE_CIDR_1,
  SERVICE_CIDR_2,
  PROXY_MODE_IPVS,
  PROXY_MODE_IPTABLES,
  MAX_NODES,
  MIN_NODES,
} from '../util/shared';

export default defineComponent({
  name: 'Networking',

  emits: [
    'error',
    'update:enableNetworkPolicy',
    'update:configIsValid',
    'update:configUnreportedErrors',
    'zoneChanged',
    'update:resourceGroupId',
    'update:vpcId',
    'update:vswitchIds',
    'update:zoneIds',
    'update:snatEntry',
    'update:proxyMode',
    'update:serviceCidr',
    'update:endpointPublicAccess',
    'update:containerCidr',
    'update:podVswitchIds',
    'update:addons',
    'update:nodeCidrMask'],

  components: {
    LabeledSelect,
    LabeledInput,
    Checkbox,
    RadioGroup
  },

  mixins: [FormValidation],

  props: {
    mode: {
      type:    String,
      default: _CREATE
    },
    config: {
      type:     Object,
      required: true
    },
    configUnreportedErrors: {
      type:    Array,
      default: () => []
    },
    configIsValid: {
      type:    Boolean,
      default: true
    },
    // Needed for Validation mixin
    value: {
      type:     Object,
      required: true
    },
    resourceGroupId: {
      type:     String,
      default: ''
    },
    vpcId: {
      type:     String,
      default: ''
    },
    vswitchIds: {
      type:     Array,
      default: () => []
    },
    zoneIds: {
      type:     Array,
      default: () => []
    },
    snatEntry: {
      type:    Boolean,
      default: true
    },
    proxyMode: {
      type:    String,
      default: PROXY_MODE_IPVS
    },
    serviceCidr: {
      type:    String,
      default: ''
    },
    endpointPublicAccess: {
      type:    Boolean,
      default: true
    },
    containerCidr: {
      type:    String,
      default: null
    },
    podVswitchIds: {
      type:    Array,
      default: () => []
    },
    addons: {
      type:     Array,
      default: () => []
    },
    nodeCidrMask: {
      type:    Number,
      default: null
    }
  },

  data() {
    let networkPlugin = TERWAY;

    if (!!this.containerCidr) {
      networkPlugin = FLANNEL;
    }

    return {
      loadingResourceGroups:      false,
      loadingVPCs:              false,
      loadingAvailabilityZones: false,
      loadingVswitches:         false,
      allResourceGroups:          [],
      allAvailabilityZones:     [],
      allVPCs:                  {},
      allVSwitches:             {},
      chooseVPC:                !!this.vpcId,
      networkPlugin,
      fvFormRuleSets:             [
        {
          path:       'containerCidr',
          rootObject: this,
          rules:      ['containerCidrRequired', 'validCIDR', 'cidrCannotMatchVswitchIP', 'containerCidrCannotMatchServiceCidr']
        },
        {
          path:       'serviceCidr',
          rootObject: this,
          rules:      ['required', 'cidrCannotMatchVswitchIP', 'validCIDR']
        },
        {
          path:       'zoneIds',
          rootObject: this,
          rules:      ['zoneIdsRequired']
        },
        {
          path:       'vpcId',
          rootObject: this,
          rules:      ['vpcIdRequired']
        },
        {
          path:       'vswitchIds',
          rootObject: this,
          rules:      ['vswitchIdsCount']
        },
        {
          path:       'podVswitchIds',
          rootObject: this,
          rules:      ['podVswitchIdsRequired']
        },
      ],
    };
  },

  created() {
    this.getResourceGroups();
    this.getVPCs();
    this.getVswitches();
    this.getZonesAndUpdateZoneIds();
    this.zonesChanged();
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    alibabaCredentialSecret() {
      return this.config.alibabaCredentialSecret;
    },
    regionId() {
      return this.config.regionId;
    },
    isNew() {
      return this.mode === _CREATE || this.mode === _IMPORT;
    },
    fvExtraRules() {
      return {
        zoneIdsRequired: (val) => {
          return this.chooseVPC || (val && val.length > 0) ? undefined : this.t('validation.zoneIdsRequired');
        },
        vswitchIdsCount: () => {
          return !this.chooseVPC || (this.vswitchIds && this.vswitchIds.length > 0 && this.vswitchIds.length < 6) ? undefined : this.t('validation.vswitchIds');
        },
        podVswitchIdsRequired: () => {
          return !this.isNew || !this.chooseVPC || this.isFlannel || (this.podVswitchIds && this.podVswitchIds.length > 0) ? undefined : this.t('validation.podVswitchIds');
        },
        vpcIdRequired: () => {
          return !this.isNew || !this.chooseVPC || this.isFlannel || !!this.vpcId ? undefined : this.t('validation.vpcs');
        },
        containerCidrRequired: (val) => {
          return !this.isFlannel || !!val ? undefined : this.t('validation.containerCIDRRequired');
        },
        containerCidrCannotMatchServiceCidr: (val) => {
          const serviceCIDR = this.serviceCidr;

          return doCidrOverlap(val, serviceCIDR) ? this.t('validation.containerCIDROverlapService') : undefined;
        },

        validCIDR:       (val) => {
          return !val || isValidCIDR(val) ? undefined : this.t('validation.invalidCIDR');
        },
        cidrCannotMatchVswitchIP: (val) => {
          const vpcCidr = this.allVPCs[this.vpcId]?.cidr;

          return doCidrOverlap(val, vpcCidr) ? this.t('validation.serviceCIDR') : undefined;
        }
      };
    },
    networkPluginOptions() {
      return [
        {
          value: FLANNEL,
          label: this.t('ack.networking.networkPlugin.options.flannel'),
        },
        {
          value: TERWAY,
          label: this.t('ack.networking.networkPlugin.options.terway')
        }
      ];
    },
    proxyModeOptions() {
      return [
        {
          value:  PROXY_MODE_IPTABLES,
          label:  this.t('ack.networking.proxyMode.options.iptables'),
        },
        {
          value:  PROXY_MODE_IPVS,
          label:  this.t('ack.networking.proxyMode.options.ipvs')
        }
      ];
    },
    podsPerNodeOptions() {
      const out = [];
      let val = MAX_NODE_CIDR_MASK;

      for (let i = MIN_NODES; i <= MAX_NODES; i *= 2) {
        out.push({
          value:    val,
          label:    i,
        });
        val -= 1;
      }

      return out;
    },
    isFlannel() {
      return this.networkPlugin === FLANNEL;
    },
    isTerway() {
      return this.networkPlugin === TERWAY;
    },
    resourceGroupOptions() {
      const out = [{ value: '', label: this.t('ack.networking.resourceGroupId.default') }, ...this.allResourceGroups];

      return out;
    },
    vpcOptions() {
      return Object.keys(this.allVPCs).map((vpcId) => {
        return { value: vpcId, label: this.allVPCs[vpcId].label || '' };
      });
    },
    availabilityZoneOptions() {
      return this.allAvailabilityZones;
    },
    podVswitchIdOptions() {
      const unformatted = this.vswitchIds || [];

      return unformatted.map((vswitchId) => {
        return { value: vswitchId, label: this.allVSwitches[vswitchId]?.label || vswitchId };
      });
    },
    vswitchIdOptions() {
      return Object.keys(this.allVSwitches).map((vswitchId) => {
        return { value: vswitchId, label: this.allVSwitches[vswitchId]?.label || '' };
      });
    },
  },

  watch: {
    chooseVPC(val) {
      if (this.isNew) {
        if (val) {
          this.$emit('update:zoneIds', []);
          this.$emit('update:vpcId', this.vpcOptions[0]?.value || '');
        } else {
          this.emptyVPCSection();
          if (this.allAvailabilityZones.length) {
            this.$emit('update:zoneIds', this.allAvailabilityZones.map((z) => z.value));
          }
        }
      }
    },
    fvFormIsValid: {
      immediate: true,
      handler(neu) {
        this.$emit('update:configIsValid', neu);
      }
    },
    fvUnreportedValidationErrors: {
      immediate: true,
      handler(neu) {
        this.$emit('update:configUnreportedErrors', neu);
      }
    },

    'config.regionId': {
      handler() {
        this.getResourceGroups();
        this.getZonesAndUpdateZoneIds();
        this.zonesChanged();
        if (this.isNew) {
          this.$emit('update:resourceGroupId', '');
          this.$emit('update:zoneIds', []);
          this.selectFirstVPC();
        }
      },
      immediate: true
    },
    'config.alibabaCredentialSecret': {
      handler() {
        this.getResourceGroups();
        this.getZonesAndUpdateZoneIds();
        this.zonesChanged();
        if (this.isNew) {
          this.$emit('update:resourceGroupId', '');
          this.$emit('update:zoneIds', []);
          this.selectFirstVPC();
        }
      },
      immediate: true
    },
    resourceGroupId: {
      async handler() {
        if (this.chooseVPC) {
          if (this.isNew) {
            this.selectFirstVPC();
          }
        }
      },
      immediate: true
    },
    zoneIds: {
      handler() {
        this.zonesChanged();
      },
      immediate: true
    },
    vswitchIds: {
      handler(neu) {
        if (this.chooseVPC) {
          this.zonesChanged();
          if (this.isNew) {
            this.$emit('update:podVswitchIds', neu.length === 0 ? [] : [neu[0]]);
          }
        }
      },
      immediate: true
    },
    vpcId: {
      async handler(neu) {
        if (this.isNew) {
          if (doCidrOverlap(this.serviceCidr, this.allVPCs[neu]?.cidr)) {
            const serviceOverlapWithDefault = doCidrOverlap(SERVICE_CIDR_1, this.allVPCs[neu]?.cidr);

            if (!serviceOverlapWithDefault) {
              this.$emit('update:serviceCidr', SERVICE_CIDR_1);
            } else {
              this.$emit('update:serviceCidr', SERVICE_CIDR_2);
            }
          }
          if (this.isFlannel) {
            this.$emit('update:containerCidr', this.findContainerCidr());
          }

          this.$emit('update:vswitchIds', []);
          this.$emit('update:podVswitchIds', []);
          if (this.chooseVPC) {
            await this.getVswitches();
            this.zonesChanged();
            const firstVswitch = Object.keys(this.allVSwitches)[0];

            this.$emit('update:vswitchIds', !firstVswitch ? [] : [firstVswitch]);
          }
        }
      },
      immediate: true
    },
    'networkPlugin'(neu) {
      if (neu === FLANNEL) {
        this.$emit('update:containerCidr', this.findContainerCidr(CONTAINER_CIDR_1));
        this.$emit('update:podVswitchIds', []);
        this.$emit('update:addons', [{ name: FLANNEL_ADDON }]);
        this.$emit('update:nodeCidrMask', MAX_NODE_CIDR_MASK);
      } else {
        this.$emit('update:containerCidr', null);
        this.$emit('update:addons', [{ name: TERWAY_ADDON }]);
        this.$emit('update:podVswitchIds', this.podVswitchIdOptions.length === 0 ? [] : [this.podVswitchIdOptions[0]]);
        this.$emit('update:nodeCidrMask', null);
      }
    },
    serviceCidr() {
      if (this.isFlannel) {
        this.$emit('update:containerCidr', this.findContainerCidr());
      }
    },

  },

  methods: {
    // A workaround to avoid modifying shell's validation.
    // The original fvGetPathErrors does not run validation rules for a path if its value is an empty array.
    fvGetPathErrors(paths = []) {
      const messages = paths.reduce((acc, path) => {
        const pathErrors = [];
        const relevantRules = this.fvGetPathRules(path);
        let relevantValues = this.fvGetPathValues(path).map(this.fvGetValues);

        if (relevantValues.length === 0) {
          relevantValues = [undefined];
        }

        relevantRules.forEach((rule) => {
          relevantValues.forEach((value) => {
            pathErrors.push(rule(value));
          });
        });

        return [...acc, ...pathErrors].filter(Boolean);
      }, []);

      return messages;
    },
    async getResourceGroups() {
      this.loadingResourceGroups = true;
      this.allResourceGroups = [];
      try {
        const res = await getAlibabaResourceGroups(this.$store, this.alibabaCredentialSecret, this.regionId );

        this.allResourceGroups = (res || []).map((group) => {
          return { value: group.Id, label: group.Name };
        });
      } catch (err) {
        const parsedError = err.error || '';

        this.$emit('error', this.t('ack.errors.resourceGroups', { e: parsedError || err }));
      }
      this.loadingResourceGroups = false;
    },
    async getVPCs() {
      this.loadingVPCs = true;
      this.allVPCs = {};

      try {
        const res = await getAlibabaVpcs(this.$store, this.alibabaCredentialSecret, this.regionId, this.resourceGroupId );
        const vpcs = res || [];

        vpcs.forEach((vpc) => {
          let label = vpc.VpcName ? `${ vpc.VpcName } (${ vpc.VpcId })` : vpc.VpcId;

          if (vpc.CidrBlock) {
            label += ` - ${ vpc.CidrBlock }`;
          }

          this.allVPCs[vpc.VpcId] = { label, cidr: vpc.CidrBlock };
        });
      } catch (err) {
        const parsedError = err.error || '';

        this.$emit('error', this.t('ack.errors.vpcs', { e: parsedError || err }));
      }
      this.loadingVPCs = false;
    },
    async getVswitches() {
      this.loadingVswitches = true;
      this.allVSwitches = {};

      try {
        const res = await getAlibabaVSwitches(this.$store, this.alibabaCredentialSecret, this.regionId, this.vpcId, this.resourceGroupId );
        const vSwitches = res || [];

        vSwitches.forEach((vswitch) => {
          let label = vswitch.VSwitchName ? `${ vswitch.VSwitchName } (${ vswitch.VSwitchId })` : vswitch.VSwitchId;

          if (vswitch.ZoneId) {
            label += ` - ${ vswitch.ZoneId }`;
          }
          if (vswitch.CidrBlock) {
            label += ` - ${ vswitch.CidrBlock }`;
          }
          this.allVSwitches[vswitch.VSwitchId] = {
            label, cidr: vswitch.CidrBlock, zoneId: vswitch.ZoneId
          };
        });
      } catch (err) {
        const parsedError = err.error || '';

        this.$emit('error', this.t('ack.errors.vswitches', { e: parsedError || err }));
      }
      this.loadingVswitches = false;
    },
    async getZones() {
      this.loadingAvailabilityZones = true;
      this.allAvailabilityZones = [];
      try {
        const res = await getAlibabaZones(this.$store, this.alibabaCredentialSecret, this.regionId );
        const zones = (res?.Zones?.Zone || []).map((zone) => ({ value: zone.ZoneId, label: zone.LocalName }));

        this.allAvailabilityZones = zones;
      } catch (err) {
        const parsedError = err.error || '';

        this.$emit('error', this.t('ack.errors.zones', { e: parsedError || err }));
      }
      this.loadingAvailabilityZones = false;
    },
    async getZonesAndUpdateZoneIds() {
      await this.getZones();
      if (this.isNew && !this.chooseVPC) {
        this.$emit('update:zoneIds', this.allAvailabilityZones.map((z) => z.value));
      }
    },
    zonesChanged() {
      let zones = [];

      if (!this.chooseVPC) {
        zones = this.zoneIds;
      } else if (this.vswitchIds && this.allVSwitches && Object.keys(this.allVSwitches).length > 0) {
        this.vswitchIds.forEach((vswitchId) => {
          const vswitch = this.allVSwitches[vswitchId];

          if (vswitch ) {
            zones.push(vswitch.zoneId);
          }
        });
      }
      this.$emit('zoneChanged', new Set(zones));
    },
    findContainerCidr(val) {
      const cur = !val ? this.containerCidr : val;
      const vpcCidr = this.allVPCs[this.vpcId]?.cidr;
      const doesCurOverlapWVPC = doCidrOverlap(cur, vpcCidr);
      const doesCurOverlapWService = doCidrOverlap(cur, this.serviceCidr);

      if (!doesCurOverlapWVPC && !doesCurOverlapWService) {
        return cur;
      } else if (!doCidrOverlap(CONTAINER_CIDR_1, vpcCidr) && !doCidrOverlap(CONTAINER_CIDR_1, this.serviceCidr)) {
        return CONTAINER_CIDR_1;
      } else if (!doCidrOverlap(CONTAINER_CIDR_2, vpcCidr) && !doCidrOverlap(CONTAINER_CIDR_2, this.serviceCidr)) {
        return CONTAINER_CIDR_2;
      } else if (!doCidrOverlap(CONTAINER_CIDR_3, vpcCidr) && !doCidrOverlap(CONTAINER_CIDR_3, this.serviceCidr)) {
        return CONTAINER_CIDR_3;
      }

      return '';
    },
    emptyVPCSection() {
      this.$emit('update:vpcId', '');
      this.$emit('update:vswitchIds', []);
      this.$emit('update:podVswitchIds', []);
    },
    async selectFirstVPC() {
      this.emptyVPCSection();
      await this.getVPCs();
      if (this.chooseVPC) {
      // Need to wait for the VPC section to actually become empty
      // otherwise, watch might not get triggered if old value matches new value
        this.$nextTick(() => {
          const firstVpc = Object.keys(this.allVPCs)[0];

          if (firstVpc) {
            this.$emit('update:vpcId', firstVpc);
          }
        });
      }
    }
  }
});
</script>

<template>
  <div
    class="mt-10"
    data-testid="ack-networking"
  >
    <div
      class="row mb-10"
    >
      <div class="col span-4">
        <LabeledSelect
          :value="resourceGroupId"
          data-testid="ack-networking-resourceGroupId"
          :mode="mode"
          :options="resourceGroupOptions"
          label-key="ack.networking.resourceGroupId.label"
          option-key="value"
          option-label="label"
          :loading="loadingResourceGroups"
          :disabled="!isNew"
          @update:value="$emit('update:resourceGroupId', $event)"
        />
      </div>
    </div>
    <div class="mb-10">
      <div class="row mb-10 mt-20">
        <div
          class="col span-4"
        >
          <p class="mb-10">
            {{ t('ack.networking.vpc.title') }}
          </p>
          <RadioGroup
            v-if="isNew"
            v-model:value="chooseVPC"
            name="subnet-mode"
            :mode="mode"
            :options="[{label: t('ack.networking.vpc.default'), value: false},{label: t('ack.networking.vpc.useCustom'), value: true}]"
            :disabled="!isNew"
            class="hierarchy"
          />
        </div>
      </div>
      <div
        v-if="chooseVPC"
        class="row mb-10 hierarchy"
      >
        <div class="row span-12">
          <div class="col span-6">
            <LabeledSelect
              :value="vpcId"
              :disabled="!isNew"
              :mode="mode"
              label-key="ack.networking.vpc.label"
              :options="vpcOptions"
              :loading="loadingVPCs"
              option-key="value"
              :multiple="false"
              data-testid="ack-networking-vpcid-dropdown"
              required
              :rules="fvGetAndReportPathRules('vpcId')"
              @update:value="$emit('update:vpcId', $event)"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              :value="vswitchIds"
              :mode="mode"
              :options="vswitchIdOptions"
              :multiple="true"
              :loading="loadingVswitches"
              label-key="ack.networking.vpc.vswitchIds.label"
              :disabled="!isNew"
              data-testid="ack-networking-vswitchIds-input"
              required
              :rules="fvGetAndReportPathRules('vswitchIds')"
              @update:value="$emit('update:vswitchIds', $event)"
            />
          </div>
        </div>
      </div>
      <div
        v-else
        class="row mb-10 hierarchy"
      >
        <div class="col span-4">
          <LabeledSelect
            :value="zoneIds"
            :disabled="!isNew"
            :options="availabilityZoneOptions"
            :loading="loadingAvailabilityZones"
            label-key="ack.networking.vpc.availabilityZones.label"
            :mode="mode"
            :multiple="true"
            :taggable="true"
            required
            :rules="fvGetAndReportPathRules('zoneIds')"
            :requireDirty="false"
            @update:value="$emit('update:zoneIds', $event)"
          />
        </div>
      </div>
      <div class="row hierarchy">
        <Checkbox
          :value="snatEntry"
          :disabled="!isNew"
          :mode="mode"
          label-key="ack.networking.vpc.snatEntry.label"
          data-testid="ack-networking-vpc-snatEntry"
          @update:value="$emit('update:snatEntry', $event)"
        />
      </div>
    </div>

    <div class="row mb-10">
      <div class="col span-4">
        <LabeledSelect
          v-model:value="networkPlugin"
          :mode="mode"
          :options="networkPluginOptions"
          label-key="ack.networking.networkPlugin.label"
          :disabled="!isNew"
          data-testid="ack-networking-plugin-select"
        />
      </div>
      <div
        v-if="isFlannel"
        class="col span-6"
      >
        <div class="row">
          <div class="col span-6 mr-20">
            <LabeledInput
              :value="containerCidr"
              :mode="mode"
              label-key="ack.networking.containerCidr.label"
              :disabled="!isNew"
              data-testid="ack-networking-containerCidr-input"
              :rules="fvGetAndReportPathRules('containerCidr')"
              required
              @update:value="$emit('update:containerCidr', $event)"
            />
          </div>
          <div class="col span-4">
            <LabeledSelect
              :value="nodeCidrMask"
              :mode="mode"
              :options="podsPerNodeOptions"
              label-key="ack.networking.nodeCidrMask.label"
              :disabled="!isNew"
              data-testid="ack-networking-node-cidr-mask-select"
              @update:value="$emit('update:nodeCidrMask', $event)"
            />
          </div>
        </div>
        <p
          v-clean-html="t('ack.networking.containerCidr.info')"
          class="text-muted text-small mt-5"
        />
      </div>

      <div
        v-else-if="isTerway"
        class="col span-6"
      >
        <LabeledSelect
          v-if="chooseVPC"
          :value="podVswitchIds"
          :mode="mode"
          :options="podVswitchIdOptions"
          :multiple="true"
          :loading="loadingVswitches"
          label-key="ack.networking.podVswitchIds.label"
          :disabled="!isNew"
          data-testid="ack-networking-podVswitchIds-input"
          required
          :rules="fvGetAndReportPathRules('podVswitchIds')"
          @update:value="$emit('update:podVswitchIds', $event)"
        />
        <div
          v-else
          class="mt-20 align-center"
        >
          <label>{{ t("ack.networking.podVswitchIds.auto") }}</label>
        </div>
      </div>
    </div>
    <div class="row mb-10">
      <div class="col span-4">
        <LabeledSelect
          :value="proxyMode"
          :mode="mode"
          :options="proxyModeOptions"
          label-key="ack.networking.proxyMode.label"
          :disabled="!isNew"
          data-testid="ack-networking-proxyMode-select"
          @update:value="$emit('update:proxyMode', $event)"
        />
      </div>
      <div class="col span-6">
        <div class="col span-6">
          <LabeledInput
            :value="serviceCidr"
            :mode="mode"
            :disabled="!isNew"
            label-key="ack.networking.serviceCidr.label"
            placeholder-key="ack.networking.serviceCidr.placeholder"
            data-testid="ack-networking-serviceCidr-input"
            :rules="fvGetAndReportPathRules('serviceCidr')"
            required
            @update:value="$emit('update:serviceCidr', $event)"
          />
        </div>
        <p
          v-clean-html="t('ack.networking.serviceCidr.info')"
          class="text-muted text-small mt-5"
        />
      </div>
    </div>
    <div class="row mb-10">
      <Checkbox
        :value="endpointPublicAccess"
        :disabled="!isNew"
        :mode="mode"
        label-key="ack.networking.endpointPublicAccess.label"
        data-testid="ack-networking-endpointPublicAccess"
        @update:value="$emit('update:endpointPublicAccess', $event)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hierarchy{
  margin-left: 24px;
}
</style>
