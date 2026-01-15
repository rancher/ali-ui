export const DEFAULT_REGION = 'us-east-1';
export const DEFAULT_SERVICE_CIDR = '192.168.0.0/16';
export const BASIC_CLUSTER_SPEC = 'ack.standard';
export const PRO_CLUSTER_SPEC = 'ack.pro.small';
export const SERVICE_CIDR_1 = '172.16.0.0/16';
export const SERVICE_CIDR_2 = '192.168.0.0/16';

export const CONTAINER_CIDR_1 = '172.16.0.0/12';
export const CONTAINER_CIDR_2 = '192.168.0.0/16';
export const CONTAINER_CIDR_3 = '10.0.0.0/8';

export const PROXY_MODE_IPTABLES = 'iptables';
export const PROXY_MODE_IPVS = 'ipvs';

export const FLANNEL = 'flannel';
export const TERWAY = 'terway';
export const FLANNEL_ADDON = 'flannel';
export const TERWAY_ADDON = 'terway-eniip';

export const MAX_NODE_CIDR_MASK = 28;
export const MIN_NODES = 16;
export const MAX_NODES = 256;
export const DATA_DISK = 'DataDisk';
export const STATUS_AVAILABLE = 'Available';
export const INSTANCE_TYPE = 'InstanceType';
export const WITH_STOCK = 'WithStock';
export const WITHOUT_STOCK = 'WithoutStock';

export const MAX_NODES_EDIT = 500;
export const MAX_NODES_BASIC = 10;
export const MAX_NODES_PRO = 5000;
export const DEFAULT_NODES = 1;
export const DEFAULT_MIN_NODES_SCALING = 1;
export const DEFAULT_MAX_NODES_SCALING = 10;

export const DEFAULT_DISK_VALUE = {
  category:  'cloud_essd',
  size:      40,
  encrypted: 'false'
};

export const IMPORTED_DEFAULT_ACK_CONFIG = {
  clusterName:    '',
  clusterId:      '',
  imported:       true,
  clusterType:    'ManagedKubernetes',
  regionId:    DEFAULT_REGION,
};

export const DEFAULT_ACK_CONFIG = {
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
    { name: TERWAY_ADDON }
  ],
};

export const DEFAULT_CLUSTER = {
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
export const IMPORTED_DEFAULT_CLUSTER = {
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

export const INSTANCE_TYPE_COLUMNS = [
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
