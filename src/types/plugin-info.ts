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
