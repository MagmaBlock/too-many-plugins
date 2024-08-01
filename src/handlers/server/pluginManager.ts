// pluginManager.ts

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { storage } from "../../db/db";
import { PluginCache, ServerEntry } from "../../types/server";
import { PluginEntry } from "../../types/library";
import { getJarFiles } from "../folder/get-jar-files";
import { PluginInfo } from "../../types/plugin-info";
import { getPluginInfo } from "../jar/get-plugin-info";
import { getServer } from "./serverManager";

const PLUGIN_CACHE_KEY = "tmp:pluginCache";

/**
 * 安装新插件
 * @param server 服务端对象
 * @param pluginPath 外部插件路径
 * @returns 安装的插件信息
 * @throws 如果插件已存在或安装失败
 */
export async function installPlugin(
  server: ServerEntry,
  pluginPath: string
): Promise<PluginEntry> {
  const pluginsDir = path.join(server.path, "plugins");
  const pluginName = path.basename(pluginPath);
  const targetPath = path.join(pluginsDir, pluginName);

  // 检查插件是否已存在
  try {
    await fs.access(targetPath);
    throw new Error("Plugin already exists");
  } catch (error) {
    if ((error as any)?.code !== "ENOENT") {
      throw error;
    }
  }

  // 复制插件
  await fs.copyFile(pluginPath, targetPath);

  // 获取插件信息
  const pluginInfo = await getPluginInfoWithCache(targetPath);
  const hash = await getFileHash(targetPath);

  return { info: pluginInfo, hash, jarPath: targetPath };
}

/**
 * 替换插件
 * @param server 服务端对象
 * @param pluginPath 外部插件路径
 * @returns 替换后的插件信息
 * @throws 如果插件不存在或替换失败
 */
export async function replacePlugin(
  serverId: string,
  pluginPath: string
): Promise<PluginEntry> {
  const server = await getServer(serverId);
  const pluginsDir = path.join(server.path, "plugins");
  const newPluginInfo = await getPluginInfoWithCache(pluginPath);
  const existingPlugins = await listPlugins(serverId);

  const existingPlugin = existingPlugins.find(
    (p) => p.info.name === newPluginInfo.name
  );
  if (!existingPlugin) {
    throw new Error("Plugin not found");
  }

  // 删除旧插件
  await fs.unlink(existingPlugin.jarPath);

  // 复制新插件
  const newPluginName = path.basename(pluginPath);
  const targetPath = path.join(pluginsDir, newPluginName);
  await fs.copyFile(pluginPath, targetPath);

  const hash = await getFileHash(targetPath);
  return { info: newPluginInfo, hash, jarPath: targetPath };
}

/**
 * 删除插件
 * @param server 服务端对象
 * @param pluginId 插件 ID（通常是插件名称）
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
 * @param server 服务端对象
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
    plugins.push({ info, hash, jarPath });
  }

  return plugins;
}

/**
 * 获取插件信息（使用缓存）
 * @param jarPath 插件 jar 文件路径
 * @returns 插件信息
 */
async function getPluginInfoWithCache(jarPath: string): Promise<PluginInfo> {
  const hash = await getFileHash(jarPath);
  const cache = await getPluginCache();

  if (cache[jarPath] && cache[jarPath].hash === hash) {
    return cache[jarPath].info;
  }

  const info = getPluginInfo(jarPath)[0]; // 假设每个 jar 只包含一个插件
  cache[jarPath] = { info, hash };
  await savePluginCache(cache);

  return info;
}

/**
 * 获取文件的 hash 值
 * @param filePath 文件路径
 * @returns 文件的 hash 值
 */
async function getFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

/**
 * 获取插件缓存
 * @returns 插件缓存对象
 */
async function getPluginCache(): Promise<PluginCache> {
  const cache = await storage.getItem(PLUGIN_CACHE_KEY);
  return (cache as PluginCache) || {};
}

/**
 * 保存插件缓存
 * @param cache 插件缓存对象
 */
async function savePluginCache(cache: PluginCache): Promise<void> {
  await storage.setItem(PLUGIN_CACHE_KEY, cache);
}

// 这些函数应该实现与 KV 存储的交互
async function getFromKV(key: string): Promise<any> {
  // 实现从 KV 存储获取数据的逻辑
}

async function saveToKV(key: string, value: any): Promise<void> {
  // 实现保存数据到 KV 存储的逻辑
}
