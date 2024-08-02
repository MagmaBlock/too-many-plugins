import { SupportedPlatform } from "./supported-platform";

export type PluginInfo = {
  name: string;
  version: string;
  description?: string;
  authors: string[];
  loadbefore: string[];
  softdepend: string[];
  platform: SupportedPlatform[];
};

export interface PluginCacheEntry {
  info: PluginInfo[];
  hash: string;
}

export interface PluginCache {
  [jarPath: string]: PluginCacheEntry;
}
