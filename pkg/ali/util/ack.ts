import { addParams, QueryParams } from '@shell/utils/url';
import { Store } from 'vuex';

async function getACKOptions(
  store: any,
  alibabaCredentialSecret: string,
  regionId: string | undefined,
  resource: string,
  extra?: object,
  clusterId?: string,
): Promise<any> {
  if (!alibabaCredentialSecret) {
    return null;
  }

  let params: QueryParams = {
    cloudCredentialId: alibabaCredentialSecret,
    acceptLanguage: "en-US",
    regionId: "us-east-1",
  };

  if (!!regionId) {
    params.regionId = regionId;
  }
  if (!!clusterId) {
    params.clusterId = clusterId;
  }
  if (!!extra) {
    params = { ...params, ...extra };
  }

  const url = addParams(`/meta/${resource}`, params);

  return store.dispatch("cluster/request", { url });
}

async function getPaginatedACKOptions(store: any,
  alibabaCredentialSecret: string,
  regionId: string | undefined,
  resource: string,
  key: string,
  extra?: object,
  clusterId?: string) {

  if (!alibabaCredentialSecret) {
    return null;
  }

  let params: QueryParams = {
    cloudCredentialId: alibabaCredentialSecret,
    acceptLanguage: "en-US",
    regionId: "us-east-1",
  };

  if (!!regionId) {
    params.regionId = regionId;
  }
  if (!!clusterId) {
    params.clusterId = clusterId;
  }
  if (!!extra) {
    params = { ...params, ...extra };
  }

  let hasNext = true;
  const out: any = [];
  let pageNumber = 1;
  let curSize = 0;
  let totalItems = 0;
  const key1 = key.split('.')[0];
  const key2 = key.split('.')[1];
  while (hasNext) {
    params.pageNumber = pageNumber.toString();
    const url = addParams(`/meta/${resource}`, params);
    const res = await store.dispatch("cluster/request", { url });
    curSize += res?.PageSize ? res.PageSize: 1;
    totalItems = res?.PageSize ? res.TotalCount: 1;
    if(res[key1] && res[key1][key2] ){
      out.push(...res[key1][key2]);
    }
    
    if (curSize >= totalItems){
      hasNext = false;
    } else {
      pageNumber++;
    }

  }
  return out;
}

/**
 * The response format here is different from other requests, so creating a separate function for it
 */
async function getPaginatedClusters(store: any,
  alibabaCredentialSecret: string,
  regionId: string | undefined,
  resource: string,
  key: string,
  extra?: object,
  clusterId?: string) {

  if (!alibabaCredentialSecret) {
    return null;
  }

  let params: QueryParams = {
    cloudCredentialId: alibabaCredentialSecret,
    acceptLanguage: "en-US",
    regionId: "us-east-1",
  };

  if (!!regionId) {
    params.regionId = regionId;
  }
  if (!!clusterId) {
    params.clusterId = clusterId;
  }
  if (!!extra) {
    params = { ...params, ...extra };
  }

  let hasNext = true;
  const out: any = [];
  let pageNumber = 1;
  let curSize = 0;
  let totalItems = 0;
  while (hasNext) {
    params.pageNumber = pageNumber.toString();
    const url = addParams(`/meta/${resource}`, params);
    const res = await store.dispatch("cluster/request", { url });
    const pageInfo = res?.page_info;
    curSize += pageInfo?.page_size ? pageInfo.page_size: 1;
    totalItems = pageInfo?.total_count ? pageInfo.total_count: 1;
    if(res[key]){
      out.push(...res[key]);
    }
    
    if (curSize >= totalItems){
      hasNext = false;
    } else {
      pageNumber++;
    }

  }
  return out;
}

export async function getAlibabaRegions(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId?: string
): Promise<any> {
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaRegions"
  );
}

export async function getAlibabaKubernetesVersions(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string,
  isEdit: boolean,
  kubernetesVersion: string
): Promise<any> {
  const extra: any = { clusterType: "ManagedKubernetes", mode: "supported" };
  if (isEdit) {
    extra.getUpgradableVersions = true;
    extra.kubernetesVersion = kubernetesVersion;
  }
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaKubernetesVersions",
    extra
  );
}

export async function getAlibabaClusters(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId?: string
): Promise<any> {

  const extra: any = {pageSize: 50}
  return getPaginatedClusters(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaClusters",
    "clusters",
    extra
  );
}

export async function getAllAlibabaInstanceTypes(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId?: string,
  nextToken?: string
): Promise<any> {
  const extra = !nextToken ? {} : { nextToken };
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaInstanceTypes",
    extra
  );
}

export async function getAlibabaKeyPairs(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId?: string
): Promise<any> {
  let extra: any = {pageSize: 50};
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaKeyPairs",
    extra
  );
}

export async function getAlibabaResourceGroups(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId?: string
): Promise<any> {
  const extra = {pageSize: 100};
  return getPaginatedACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaResourceGroups",
    "ResourceGroups.ResourceGroup",
    extra
  );
}

export async function getAlibabaVpcs(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string,
  resourceGroupId?: string
): Promise<any> {
  const extra: any = {pageSize: 50};
  if(!!resourceGroupId) {
    extra.resourceGroupId = resourceGroupId;
  }
  return getPaginatedACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaVpcs",
    'Vpcs.Vpc',
    extra
  );
}

export async function getAlibabaZones(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string
): Promise<any> {
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaZones"
  );
}

export async function getAlibabaVSwitches(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string,
  vpcId?: string,
  resourceGroupId?: string
): Promise<any> {
  const extra: any = {pageSize: 50};
  if (!!vpcId) {
    extra.vpcId = vpcId;
  }
  if (!!resourceGroupId) {
    extra.resourceGroupId = resourceGroupId;
  }
  return getPaginatedACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaVSwitches",
    "VSwitches.VSwitch",
    extra
  );
}

export async function getAlibabaInstanceTypeFamilies(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string
): Promise<any> {
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaAvailableResources"
  );
}

export async function getAlibabaInstanceTypes(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string,
): Promise<any> {
  const extra: any = {
    destinationResource: "InstanceType",
    networkCategory: "vpc",
  };
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaAvailableResources",
    extra
  );
}

export async function getDataDisksForInstanceTypes(
  store: Store<any>,
  alibabaCredentialSecret: string,
  regionId: string,
  instanceType: string
): Promise<any> {
  const extra: any = {
    destinationResource: "DataDisk",
    resourceType: "disk",
    instanceType
  };
  return getACKOptions(
    store,
    alibabaCredentialSecret,
    regionId,
    "alibabaAvailableResources",
    extra
  );
}