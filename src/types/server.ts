import { PluginInfo } from "./plugin-info";
import { SupportedPlatform } from "./supported-platform";

export interface ServerEntry {
  id: string;
  platform: SupportedPlatform;
  path: string;
}

export interface ServerList {
  [serverId: string]: ServerEntry;
}

export interface PluginCacheEntry {
  info: PluginInfo;
  hash: string;
}

export interface PluginCache {
  [pluginPath: string]: PluginCacheEntry;
}
