import ipaddr from "ipaddr.js";
import { get, set } from '@shell/utils/object';
import { MAX_NODES_BASIC, MAX_NODES_PRO, MAX_NODES_EDIT } from "./shared";
// Converts ip into 32 long integer by breaking it down into octets,
// shifting existing value by 8 bits and adding new octet converted to base 10
// In the end, we need to do a zero fill right shift to ensure final value is treated 
// as unsigned 32-bit integer

function ipToLong(ip: string): number {
  return (
    ip.split(".").reduce((cur, octet) => (cur << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function getCidrRange(cidr: string): { start: number; end: number } | null {
  try {
    const [ip, prefix] = ipaddr.parseCIDR(cidr);

    if (ip.kind() !== 'ipv4') {
      return null;
    }

    const ipLong = ipToLong(ip.toString());
    // Create a subnet mask
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    // Get a start of the ip range
    const start = ipLong & mask;
    // Get an end of the ip range
    const end = start | (~mask >>> 0);

    return { start, end };
  } catch (e) {
    //We can swallow this error
    return null;  
  }
}

function nameLength(name: string): boolean {
  return name.length <= 63;
}

function nameChars(name: string): boolean {   
  return !!name.match(/^[\w-]+$/);
}

function nameStart(name: string): boolean {
  return !!name.match(/^[a-zA-Z0-9]/);
}

export function doCidrOverlap(cidr1: string, cidr2: string): boolean {
  if (!isValidCIDR(cidr1) || !isValidCIDR(cidr2)) {
    return false;
  }
  const range1 = getCidrRange(cidr1);
  const range2 = getCidrRange(cidr2);

  if (!range1 || !range2) {
    return false;
  }
  return range1.start <= range2.end && range2.start <= range1.end;
}

// no need to try to validate any fields if the user is still selecting a credential and the rest of the form isn't visible
export const needsValidation = (ctx: any): Boolean => {
  return !!ctx.config.alibabaCredentialSecret && !!ctx.config.regionId;
};
export const requiredTranslation = (ctx: any, labelKey = 'Value'): String => {
  return ctx.t('validation.required', { key: ctx.t(labelKey) });
};

export function isValidCIDR(cidr: string) {
  return ipaddr.isValidCIDR(cidr);
}
export const requiredInCluster = (ctx: any, labelKey: string, clusterPath: string) => {
  return () :String | undefined => {
    return needsValidation(ctx) && clusterPath && !get(ctx, clusterPath) ? requiredTranslation(ctx, labelKey) : undefined;
  };
};

export const clusterNameChars = (ctx: any ) => {
  return () :string | undefined => {
    const { name = '' } = get(ctx, 'normanCluster');

    return !needsValidation(ctx) || nameChars(name) ? undefined : ctx.t('validation.clusterName.clusterNameChars');
  };
};

export const clusterNameStart = (ctx: any) => {
  return () :string | undefined => {
    const { name = '' } = get(ctx, 'normanCluster');
    const nameIsValid = (nameStart(name) || !name.length);

    return !needsValidation(ctx) || nameIsValid ? undefined : ctx.t('validation.clusterName.clusterNameStart');
  };
};

export const clusterNameLength = (ctx: any) => {
  return () : string | undefined => {
    const { clusterName = '' } = get(ctx, 'config');
    const isValid = nameLength(clusterName);
    // The at least 1 case is covered by a separate check
    return isValid ? undefined : ctx.t('validation.clusterName.length');
  };
};

export const nodePoolNames = (ctx: any) => {
  return (poolName:string) :string | undefined => {
    let allAvailable = true;

    const isValid = (name:string) =>nameLength(name) && nameChars(name) && nameStart(name);

    if (poolName || poolName === '') {
      return isValid(poolName) ? undefined : ctx.t('validation.poolName');
    } else {
      ctx.nodePools.forEach((pool: any) => {
        const name = pool.name || '';

        if (!isValid(name)) {
          set(pool._validation, '_validName', false);

          allAvailable = false;
        } else {
          set(pool._validation, '_validName', true);
        }
      });
      if (!allAvailable) {
        return ctx.t('validation.poolName');
      }
    }
  };
};

export const nodePoolNamesUnique = (ctx: any) => {
  return () :string | undefined => {
    const poolNames = (ctx.nodePools || []).map((pool: any) => pool.name);

    const hasDuplicates = poolNames.some((name: string, idx: number) => poolNames.indexOf(name) !== idx);

    if (hasDuplicates) {
      return ctx.t('validation.poolNamesUnique');
    }
  };
};

export const nodePoolCount = (ctx:any) => {
  return (desiredSize?: number, _isNew = false) => {
    if(!!desiredSize && (!Number.isInteger(+desiredSize) || `${ desiredSize }`.match(/\.+/g))){
      return ctx.t('validation.nodeCountNumeric');
    }
    const config = get(ctx, 'config');
    const type = config.clusterSpec;
    
    const isBasic = type === 'ack.standard';
    let errMsg = !isBasic? ctx.t('validation.nodeCountPro'): ctx.t('validation.nodeCountBasic');
    const min = 0;

    if (desiredSize || desiredSize === 0) {
       const max = !_isNew ? MAX_NODES_EDIT : ( isBasic ? MAX_NODES_BASIC : MAX_NODES_PRO );
      return desiredSize >= min && desiredSize <= max ? undefined : errMsg;
    } else {
      let allValid = true;

      ctx.nodePools.forEach((pool: any) => {
        if (pool.enableAutoScaling) {
          pool._validation['_validCount'] = true;
          return;
        }
        const { desiredSize, _isNew } = pool;
        if((!desiredSize && desiredSize !== 0) || !Number.isInteger(+desiredSize) || `${ desiredSize }`.match(/\.+/g)){
          pool._validation['_validCount'] = false;
          allValid = false;
          return;
        }
        
         const max = !_isNew ? MAX_NODES_EDIT : ( isBasic ? MAX_NODES_BASIC : MAX_NODES_PRO );

        if (desiredSize < min || desiredSize > max) {
          pool._validation['_validCount'] = false;
          allValid = false;
        } else {
          pool._validation['_validCount'] = true;
        }
      });

      return allValid ? undefined : errMsg;
    }
  };
};

export const instanceTypeCount = (ctx:any) => {
  return (instanceTypes?: Array<string>) => {  
    if(instanceTypes){
      return instanceTypes.length > 0 && instanceTypes.length <= 20 ? undefined : ctx.t('validation.instanceTypeCount');
    } else {
      let allValid = true;

      ctx.nodePools.forEach((pool: any) => {
        const { instanceTypes = [] } = pool;
        if(pool._isNew && !(instanceTypes.length > 0 && instanceTypes.length <= 20)){
          pool._validation['_validInstanceTypeCount'] = false;
          allValid = false;
        } else {
          pool._validation['_validInstanceTypeCount'] = true;
        }
      });

      return allValid ? undefined : ctx.t('validation.instanceTypeCount');
    }
  }
};

export const minInstances = (ctx:any) => {
  return (minInstances?: number, maxInstances = 0) => {
    if(!!minInstances && (!Number.isInteger(+minInstances) || `${ minInstances }`.match(/\.+/g))){
      return ctx.t('validation.instancesNumeric');
    }

    let errMsg = ctx.t('validation.minInstances');
    const min = 0;

    if (minInstances || minInstances === 0) {
      if(!maxInstances){
        return minInstances >= min ? undefined : errMsg;
      }
      return minInstances >= min && minInstances <= maxInstances ? undefined : errMsg;
    } else {
      let allValid = true;

      ctx.nodePools.forEach((pool: any) => {
        if (!pool.enableAutoScaling) {
          pool._validation['_validMinInstances'] = true;
          return;
        }
        const { minInstances, maxInstances } = pool;
        if((!minInstances && minInstances !== 0) || !Number.isInteger(+minInstances) || `${ minInstances }`.match(/\.+/g)){
          pool._validation['_validMinInstances'] = false;
          allValid = false;
          return;
        }

        if (minInstances < min || !((maxInstances || maxInstances === 0) && minInstances <= maxInstances)) {
          pool._validation['_validMinInstances'] = false;
          allValid = false;
        } else {
          pool._validation['_validMinInstances'] = true;
        }
      });

      return allValid ? undefined : errMsg;
    }
  };
};
export const maxInstances = (ctx:any) => {
  return (maxInstances?: number, minInstances = 0) => {
    if(!!maxInstances && (!Number.isInteger(+maxInstances) || `${ maxInstances }`.match(/\.+/g))){
      return ctx.t('validation.instancesNumeric');
    }

    let errMsg = ctx.t('validation.maxInstances');
    let min = !minInstances ? 0 : minInstances;

    if (maxInstances || maxInstances === 0) {
      return maxInstances >= min ? undefined : errMsg;
    } else {
      let allValid = true;

      ctx.nodePools.forEach((pool: any) => {
        if (!pool.enableAutoScaling) {
          pool._validation['_validMaxInstances'] = true;
          return;
        }
        const { minInstances, maxInstances } = pool;
        let min = !minInstances ? 0 : minInstances;
        if((!maxInstances && maxInstances !== 0) || !Number.isInteger(+maxInstances) || `${ maxInstances }`.match(/\.+/g)){
          pool._validation['_validMaxInstances'] = false;
          allValid = false;
          return;
        }

        if (maxInstances < min) {
          pool._validation['_validMaxInstances'] = false;
          allValid = false;
        } else {
          pool._validation['_validMaxInstances'] = true;
        }
      });

      return allValid ? undefined : errMsg;
    }
  };
};
