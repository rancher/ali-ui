import { IClusterProvisioner, ClusterProvisionerContext } from '@shell/core/types';
import { mapDriver } from '@shell/store/plugins';
import { isProviderEnabled } from "@shell/utils/settings";
import type { Component } from 'vue';
import CruACK from "./components/CruACK.vue";
import { isRancherPrime } from '@shell/config/version';
export class ACKProvisioner implements IClusterProvisioner {
  static ID = "alibaba";

  constructor(private context: ClusterProvisionerContext) {
    mapDriver(this.id, "alibaba");
  }

  get id(): string {
    return ACKProvisioner.ID;
  }

  get icon(): any {
    return require("./icon.svg");
  }

  get image(): any {
    return require("./icon.svg");
  }

  get group(): string {
    return "hosted";
  }

  get label(): string {
    return this.context.t("ali.label");
  }
  get component(): Component {
    return CruACK;
  }

  get hidden(): boolean {
    return !isProviderEnabled(this.context, this.id) || !isRancherPrime();
  }
  
  get prime(): boolean {
    return true;
  }

  get detailTabs(): any {
    return {
      machines: false,
      logs: false,
      registration: false,
      snapshots: false,
      related: true,
      events: false,
      conditions: false,
    };
  }

  get showImport(): boolean {
    return true;
  }
  get description(): string {
    return this.context.t('ali.description');
  }
}
