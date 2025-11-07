import ipaddr from "ipaddr.js";
import { get } from '@shell/utils/object';

function ipToLong(ip: string): number {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function getCidrRange(cidr: string): { start: number; end: number } | null {
  const parts = cidr.split("/");

  if (parts.length !== 2) {
    return null;
  }

  const [ip, prefString] = parts;
  const prefix = parseInt(prefString, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    return null; 
  }
  const ipParts = ip.split(".");

  if (ipParts.length !== 4 ) {
      return null;
  }
  for( let i= 0 ; i< ipParts.length ; i++){
    const part = ipParts[i];
    if(isNaN(parseInt(part, 10)) ||
      parseInt(part, 10) < 0 ||
      parseInt(part, 10) > 255){
        return null;
      }
  }

  const ipLong = ipToLong(ip);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;

  const start = ipLong & mask;
  const end = start | (~mask >>> 0);

  return { start, end };
}

export function doCidrOverlap(cidr1: string, cidr2: string): boolean {
  if (!isValidCIDR(cidr1) || !isValidCIDR(cidr2)) {
    return false;
  }
  if (!cidr1 || !cidr2) {
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
    const nameIsValid = name.match(/^[\w-]+$/);

    return !needsValidation(ctx) || nameIsValid ? undefined : ctx.t('validation.clusterName.clusterNameChars');
  };
};

export const clusterNameStart = (ctx: any) => {
  return () :string | undefined => {
    const { name = '' } = get(ctx, 'normanCluster');
    const nameIsValid = (!!name.match(/^[a-zA-Z0-9]/) || !name.length);

    return !needsValidation(ctx) || nameIsValid ? undefined : ctx.t('validation.clusterName.clusterNameStart');
  };
};

export const clusterNameLength = (ctx: any) => {
  return () : string | undefined => {
    const { clusterName = '' } = get(ctx, 'config');
    const isValid = clusterName.length <= 63;
    // The at least 1 case is covered by a separate check
    return isValid ? undefined : ctx.t('validation.clusterName.length');
  };
};