import fs from "node:fs/promises";
import path from "node:path";
import { PluginEntry } from "../../types/library";
import { getJarFiles } from "../folder/get-jar-files";
import { getFileHash, getPluginInfoWithCache } from "../jar/plugin-info-cache";
import { getServer } from "./serverManager";

/**
 * 安装或更新插件
 * @param serverId 服务端ID
 * @param pluginPath 外部插件路径
 * @returns 安装或更新的插件信息
 * @throws 如果安装或更新失败
 */
export async function installOrUpdatePlugin(
  serverId: string,
  pluginPath: string
): Promise<PluginEntry> {
  const server = await getServer(serverId);
  const pluginsDir = path.join(server.path, "plugins");
  const pluginName = path.basename(pluginPath);
  const targetPath = path.join(pluginsDir, pluginName);

  // 获取新插件信息
  const newPluginInfo = await getPluginInfoWithCache(pluginPath);
  const newPluginInfoThisPlatform =
    newPluginInfo.find((p) => p.platform.includes(server.platform)) ??
    newPluginInfo[0];

  // 查找并删除同名插件（如果存在）
  const existingPlugins = await listPlugins(serverId);
  const sameNamePlugin = existingPlugins.find(
    (p) => p.info.name === newPluginInfoThisPlatform.name
  );
  if (sameNamePlugin) {
    await fs.unlink(sameNamePlugin.jarPath);
  }

  // 复制新插件
  await fs.copyFile(pluginPath, targetPath);

  const hash = await getFileHash(targetPath);
  return { info: newPluginInfoThisPlatform, hash, jarPath: targetPath };
}

/**
 * 删除插件
 * @param serverId 服务端ID
 * @param pluginId 插件ID（通常是插件名称）
 * @returns 是否成功删除
 * @throws 如果插件不存在
 */
export async function removePlugin(
  serverId: string,
  pluginId: string
): Promise<boolean> {
  const plugins = await listPlugins(serverId);
  const plugin = plugins.find((p) => p.info.name === pluginId);
  if (!plugin) {
    throw new Error("Plugin not found");
  }

  await fs.unlink(plugin.jarPath);
  return true;
}

/**
 * 列出服务端的所有插件
 * @param serverId 服务端ID
 * @returns 插件信息数组
 */
export async function listPlugins(serverId: string): Promise<PluginEntry[]> {
  const server = await getServer(serverId);
  const pluginsDir = path.join(server.path, "plugins");
  const jarFiles = await getJarFiles(pluginsDir);

  const plugins: PluginEntry[] = [];
  for (const jarPath of jarFiles) {
    const info = await getPluginInfoWithCache(jarPath);
    const hash = await getFileHash(jarPath);
    const thisPlatformInfo =
      info.find((p) => p.platform.includes(server.platform)) ?? info[0];
    plugins.push({ info: thisPlatformInfo, hash, jarPath });
  }

  return plugins;
}
