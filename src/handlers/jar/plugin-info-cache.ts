import crypto from "node:crypto";
import fs from "node:fs/promises";
import { storage } from "../../db/db";
import { PluginCache, PluginInfo } from "../../types/plugin-info";
import { getPluginInfo } from "../jar/get-plugin-info";

const PLUGIN_CACHE_KEY = "tmp:plugin:info-cache";

/**
 * 获取文件的hash值
 * @param filePath 文件路径
 * @returns 文件的hash值
 */
export async function getFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

/**
 * 获取插件信息（使用缓存）
 * @param jarPath 插件jar文件路径
 * @returns 插件信息
 */
export async function getPluginInfoWithCache(
  jarPath: string
): Promise<PluginInfo[]> {
  const hash = await getFileHash(jarPath);
  const cache =
    ((await storage.getItem(PLUGIN_CACHE_KEY)) as PluginCache) || {};

  if (cache[jarPath] && cache[jarPath].hash === hash) {
    return cache[jarPath].info;
  }

  const info = getPluginInfo(jarPath);
  cache[jarPath] = { info, hash };
  await storage.setItem(PLUGIN_CACHE_KEY, cache);

  return info;
}
