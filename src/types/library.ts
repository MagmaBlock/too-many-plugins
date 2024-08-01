import { PluginInfo } from "./plugin-info";

export interface PluginEntry {
  info: PluginInfo;
  hash: string;
  jarPath: string;
}

export interface Library {
  id: string;
  path: string;
  plugins: PluginEntry[];
}

export type Libraries = {
  [libraryId: string]: Library;
};
