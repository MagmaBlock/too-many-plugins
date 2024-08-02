- src\handlers\folder\get-jar-files.ts
```typescript
import consola from "consola";
import fs from "fs";
import path from "path";

/**
 * 获取指定文件夹下所有的 .jar 文件列表，返回绝对路径
 * @param folderPath 要搜索的文件夹路径
 * @returns 包含所有 .jar 文件绝对路径的数组
 */
export async function getJarFiles(folderPath: string): Promise<string[]> {
  try {
    // 将输入的路径转换为绝对路径
    const absoluteFolderPath = path.resolve(folderPath);

    // 读取文件夹内容
    const files = await fs.promises.readdir(absoluteFolderPath);

    // 过滤出 .jar 文件并获取绝对路径
    const jarFiles = files
      .filter((file) => path.extname(file).toLowerCase() === ".jar")
      .map((file) => path.join(absoluteFolderPath, file));

    return jarFiles;
  } catch (error) {
    consola.error("嘎！读取文件夹时发生错误:", error);
    return [];
  }
}

```

- src\handlers\jar\get-plugin-info.ts
```typescript
import consola from "consola";
import { readFileFromJar } from "./read-file-from-jar";
import { load } from "js-yaml";
import { SupportedPlatform } from "../../types/supported-platform";
import { PluginInfo } from "../../types/plugin-info";

/**
 * 获取插件详情
 * @param jarPath Jar 文件的路径
 * @returns 插件详情数组（PluginInfo[]）
 */
export function getPluginInfo(jarPath: string): PluginInfo[] {
  const pluginInfos: PluginInfo[] = [];

  const velocityInfo = getVelocityPluginInfo(jarPath);
  if (velocityInfo) pluginInfos.push(velocityInfo);

  const bungeeInfo = getBungeePluginInfo(jarPath);
  if (bungeeInfo) pluginInfos.push(bungeeInfo);

  const commonInfo = getCommonPluginInfo(jarPath);
  if (commonInfo) pluginInfos.push(commonInfo);

  return pluginInfos;
}

/**
 * 检查类继承关系以确定支持的平台
 * 通过检查类内容中特定的类路径来判断
 *
 * @param classContent 类内容字符串，用于检查特定的类路径
 * @returns 返回SupportedPlatform的枚举值，表示支持的平台，如果无法识别则返回null
 */
function checkClassInheritance(classContent: string): SupportedPlatform | null {
  // 检查类内容是否包含BungeeCord相关类，如果是则认为是BungeeCord平台
  if (classContent.includes("net/md_5/bungee/api/plugin/Plugin")) {
    return SupportedPlatform.BungeeCord;
  }
  // 检查类内容是否包含Bukkit相关类，如果是则认为是Bukkit平台
  if (classContent.includes("org/bukkit/plugin/java/JavaPlugin")) {
    return SupportedPlatform.Bukkit;
  }
  // 如果无法识别平台，则返回null
  return null;
}

function ensureString(value: any): string {
  return typeof value === "string" ? value : String(value);
}

function parseYamlConfig(config: any): Partial<PluginInfo> {
  return {
    name: config.name,
    version: ensureString(config.version),
    description: config.description,
    authors: Array.isArray(config.authors) ? config.authors : [],
    loadbefore: Array.isArray(config.loadbefore) ? config.loadbefore : [],
    softdepend: Array.isArray(config.softdepend) ? config.softdepend : [],
  };
}

function parseJsonConfig(config: any): Partial<PluginInfo> {
  return {
    name: config.id,
    version: ensureString(config.version),
    description: config.description,
    authors: Array.isArray(config.authors) ? config.authors : [],
    loadbefore: [],
    softdepend: [],
  };
}

function getVelocityPluginInfo(jarPath: string): PluginInfo | null {
  try {
    const velocityConfig = readFileFromJar(jarPath, "velocity-plugin.json");
    if (velocityConfig) {
      const config = JSON.parse(velocityConfig);
      return {
        ...parseJsonConfig(config),
        platform: [SupportedPlatform.Velocity],
      } as PluginInfo;
    }
  } catch (error) {
    // 文件不存在
  }
  return null;
}

function getBungeePluginInfo(jarPath: string): PluginInfo | null {
  try {
    const bungeeConfig = readFileFromJar(jarPath, "bungee.yml");
    if (bungeeConfig) {
      const config = readYaml(bungeeConfig);
      return {
        ...parseYamlConfig(config),
        platform: [SupportedPlatform.BungeeCord],
      } as PluginInfo;
    }
  } catch (error) {
    // 文件不存在
  }
  return null;
}

function getCommonPluginInfo(jarPath: string): PluginInfo | null {
  try {
    const pluginYml = readFileFromJar(jarPath, "plugin.yml");
    if (pluginYml) {
      const config = readYaml(pluginYml);
      const pluginInfo: PluginInfo = {
        ...parseYamlConfig(config),
        platform: [],
      } as PluginInfo;

      if ("main" in config && typeof config.main === "string") {
        const mainClass = config.main;
        const classFilePath = mainClass.replace(/\./g, "/") + ".class";

        try {
          const classContent = readFileFromJar(jarPath, classFilePath);
          const platform = checkClassInheritance(classContent);
          if (platform) {
            pluginInfo.platform.push(platform);
          }
        } catch (error) {
          consola.error(`Error reading main class file: ${error}`);
        }
      }

      if ("folia-supported" in config && config["folia-supported"] === true) {
        pluginInfo.platform.push(SupportedPlatform.Folia);
      }

      return pluginInfo.platform.length > 0 ? pluginInfo : null;
    }
  } catch (error) {
    // 文件不存在
  }
  return null;
}

/**
 * 将 YAML 字符串解析为对象
 * @param yamlString YAML 格式的字符串
 * @returns 解析后的对象
 * @throws 如果解析失败会抛出错误
 */
function readYaml<T = any>(yamlString: string): T {
  try {
    const result = load(yamlString) as T;
    return result;
  } catch (error) {
    throw new Error(`Error parsing YAML: ${(error as Error).message}`);
  }
}

```

- src\handlers\jar\plugin-info-cache.ts
```typescript
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
): Promise<PluginInfo> {
  const hash = await getFileHash(jarPath);
  const cache =
    ((await storage.getItem(PLUGIN_CACHE_KEY)) as PluginCache) || {};

  if (cache[jarPath] && cache[jarPath].hash === hash) {
    return cache[jarPath].info;
  }

  const info = getPluginInfo(jarPath)[0]; // 假设每个jar只包含一个插件
  cache[jarPath] = { info, hash };
  await storage.setItem(PLUGIN_CACHE_KEY, cache);

  return info;
}

```

- src\handlers\jar\read-file-from-jar.ts
```typescript
import * as fs from "fs";
import AdmZip from "adm-zip";

/**
 * 从指定的 jar 文件中读取指定的文本文件内容
 * @param jarPath jar 文件的路径
 * @param filePath jar 包内文件的路径
 * @returns 文件内容as字符串
 * @throws 如果文件不存在或读取失败
 */
export function readFileFromJar(jarPath: string, filePath: string): string {
  try {
    // 检查 jar 文件是否存在
    if (!fs.existsSync(jarPath)) {
      throw new Error(`JAR file not found: ${jarPath}`);
    }

    // 创建 AdmZip 实例
    const zip = new AdmZip(jarPath);

    // 获取指定文件的 ZipEntry
    const zipEntry = zip.getEntry(filePath);

    if (!zipEntry) {
      throw new Error(`File not found in JAR: ${filePath}`);
    }

    // 读取文件内容
    const content = zip.readAsText(zipEntry);

    if (content === null) {
      throw new Error(`Failed to read file content: ${filePath}`);
    }

    return content;
  } catch (error) {
    throw new Error(`Error reading file from JAR: ${(error as Error).message}`);
  }
}

```

- src\handlers\library\manager.ts
```typescript
import fs from "node:fs";
import path from "node:path";
import { storage } from "../../db/db";
import { Libraries, Library, PluginEntry } from "../../types/library";
import { getJarFiles } from "../folder/get-jar-files";
import { getFileHash, getPluginInfoWithCache } from "../jar/plugin-info-cache";

const LIBRARIES_KEY = "tmp:plugin:libraries";

/**
 * 获取所有插件库
 * @returns 所有插件库的对象
 */
export async function getAllLibraries(): Promise<Libraries> {
  const libraries = (await storage.getItem(LIBRARIES_KEY)) as Libraries;
  return libraries || {};
}

/**
 * 添加新的插件库
 * @param id 插件库的唯一标识符
 * @param libraryPath 插件库的路径
 * @returns 添加的插件库对象
 * @throws 如果插件库已存在或路径无效
 */
export async function addLibrary(
  id: string,
  libraryPath: string
): Promise<Library> {
  const libraries = await getAllLibraries();

  if (libraries[id]) {
    throw new Error("嘎！插件库 ID 已存在");
  }

  const absolutePath = path.resolve(libraryPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error("嘎！指定路径不存在");
  }

  const library: Library = {
    id,
    path: absolutePath,
    plugins: [],
  };

  libraries[id] = library;
  await storage.setItem(LIBRARIES_KEY, libraries);

  // 自动索引新添加的插件库
  return await updateLibraryIndex(id);
}

/**
 * 删除指定的插件库
 * @param id 要删除的插件库的 ID
 * @returns 是否成功删除
 * @throws 如果插件库不存在
 */
export async function removeLibrary(id: string): Promise<boolean> {
  const libraries = await getAllLibraries();

  if (!libraries[id]) {
    throw new Error("嘎！插件库不存在");
  }

  delete libraries[id];
  await storage.setItem(LIBRARIES_KEY, libraries);

  return true;
}

/**
 * 获取指定插件库的信息
 * @param id 插件库的 ID
 * @returns 插件库对象
 * @throws 如果插件库不存在
 */
export async function getLibrary(id: string): Promise<Library> {
  const libraries = await getAllLibraries();

  if (!libraries[id]) {
    throw new Error("嘎！插件库不存在");
  }

  return libraries[id];
}

/**
 * 更新指定插件库的索引
 * @param id 插件库的 ID
 * @param rebuild 是否完全重建索引，默认为 false
 * @returns 更新后的插件库对象
 * @throws 如果插件库不存在
 */
export async function updateLibraryIndex(
  id: string,
  rebuild: boolean = false
): Promise<Library> {
  const libraries = await getAllLibraries();

  if (!libraries[id]) {
    throw new Error("嘎！插件库不存在");
  }

  const library = libraries[id];
  const jarFiles = await getJarFiles(library.path);

  if (rebuild) {
    library.plugins = [];
  }

  const existingHashes = new Set(library.plugins.map((plugin) => plugin.hash));
  const newPlugins: PluginEntry[] = [];
  const validJarPaths = new Set(jarFiles);

  for (const jarFile of jarFiles) {
    const hash = await getFileHash(jarFile);

    if (!rebuild && existingHashes.has(hash)) {
      // 文件已经被索引过，保留现有索引
      const existingPlugin = library.plugins.find(
        (plugin) => plugin.hash === hash
      );
      if (existingPlugin) {
        newPlugins.push(existingPlugin);
      }
      continue;
    }

    const info = await getPluginInfoWithCache(jarFile);
    newPlugins.push({
      info,
      hash,
      jarPath: jarFile,
    });
  }

  // 移除无效的索引
  if (!rebuild) {
    library.plugins = library.plugins.filter((plugin) =>
      validJarPaths.has(plugin.jarPath)
    );
  }

  // 添加新的索引
  library.plugins = [...library.plugins, ...newPlugins];

  await storage.setItem(LIBRARIES_KEY, libraries);

  return library;
}

/**
 * 在所有插件库中查找指定的插件
 * @param query 要查找的插件名称，大小写敏感
 * @returns 包含插件信息和所在库 ID 的对象数组
 */
export async function findPlugin(
  query: string
): Promise<Array<{ libraryId: string; plugin: PluginEntry }>> {
  const libraries = await getAllLibraries();
  const results = [];

  for (const [libraryId, library] of Object.entries(libraries)) {
    const matchedPlugins = library.plugins.filter((plugin) =>
      plugin.info.name.includes(query)
    );

    results.push(
      ...matchedPlugins.map((plugin) => ({
        libraryId,
        plugin,
      }))
    );
  }

  return results;
}

```

- src\handlers\server\pluginManager.ts
```typescript
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

  // 查找并删除同名插件（如果存在）
  const existingPlugins = await listPlugins(serverId);
  const existingPlugin = existingPlugins.find(
    (p) => p.info.name === newPluginInfo.name
  );
  if (existingPlugin) {
    await fs.unlink(existingPlugin.jarPath);
  }

  // 复制新插件
  await fs.copyFile(pluginPath, targetPath);

  const hash = await getFileHash(targetPath);
  return { info: newPluginInfo, hash, jarPath: targetPath };
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
    plugins.push({ info, hash, jarPath });
  }

  return plugins;
}

```

- src\handlers\server\serverManager.ts
```typescript
// serverManager.ts
import path from "node:path";
import fs from "node:fs/promises";
import { ServerEntry, ServerList } from "../../types/server";
import { SupportedPlatform } from "../../types/supported-platform";
import { storage } from "../../db/db";

const SERVER_LIST_KEY = "tmp:servers";

/**
 * 获取所有服务端列表
 * @returns 所有服务端的对象
 */
export async function getAllServers(): Promise<ServerList> {
  const servers = await storage.getItem(SERVER_LIST_KEY);
  return (servers as ServerList) || {};
}

/**
 * 添加新的服务端
 * @param id 服务端的唯一标识符
 * @param serverPath 服务端的路径
 * @param platform 服务端平台
 * @returns 添加的服务端对象
 * @throws 如果服务端已存在或路径无效
 */
export async function addServer(
  id: string,
  serverPath: string,
  platform: SupportedPlatform
): Promise<ServerEntry> {
  const servers = await getAllServers();
  if (servers[id]) {
    throw new Error("Server with this ID already exists");
  }

  const absolutePath = path.resolve(serverPath);
  try {
    await fs.access(absolutePath);
  } catch (error) {
    throw new Error("Invalid server path");
  }

  const newServer: ServerEntry = { id, platform, path: absolutePath };
  servers[id] = newServer;

  await storage.setItem(SERVER_LIST_KEY, servers);

  return newServer;
}

/**
 * 删除指定的服务端
 * @param id 要删除的服务端的 ID
 * @returns 是否成功删除
 * @throws 如果服务端不存在
 */
export async function removeServer(id: string): Promise<boolean> {
  const servers = await getAllServers();
  if (!servers[id]) {
    throw new Error("Server not found");
  }

  delete servers[id];
  await storage.setItem(SERVER_LIST_KEY, servers);
  return true;
}

/**
 * 更新服务端信息
 * @param id 服务端的 ID
 * @param updates 要更新的字段
 * @returns 更新后的服务端对象
 * @throws 如果服务端不存在
 */
export async function updateServer(
  id: string,
  updates: Partial<Omit<ServerEntry, "id">>
): Promise<ServerEntry> {
  const servers = await getAllServers();
  if (!servers[id]) {
    throw new Error("Server not found");
  }

  if (updates.path) {
    updates.path = path.resolve(updates.path);
    try {
      await fs.access(updates.path);
    } catch (error) {
      throw new Error("Invalid server path");
    }
  }

  servers[id] = { ...servers[id], ...updates };
  await storage.setItem(SERVER_LIST_KEY, servers);
  return servers[id];
}

/**
 * 获取指定服务端的信息
 * @param id 服务端的 ID
 * @returns 服务端对象
 * @throws 如果服务端不存在
 */
export async function getServer(id: string): Promise<ServerEntry> {
  const servers = await getAllServers();
  if (!servers[id]) {
    throw new Error("Server not found");
  }
  return servers[id];
}

/**
 * 列出所有服务端
 * @returns 所有服务端对象的数组
 */
export async function listServers(): Promise<ServerEntry[]> {
  const servers = await getAllServers();
  return Object.values(servers);
}

```

- src\index.ts
```typescript

```

- src\types\library.ts
```typescript
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

```

- src\types\plugin-info.ts
```typescript
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
  info: PluginInfo;
  hash: string;
}

export type PluginCache = Record<string, PluginCacheEntry>;

```

- src\types\server.ts
```typescript
// types.ts

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

```

- src\types\supported-platform.ts
```typescript
export enum SupportedPlatform {
  BungeeCord = "BungeeCord",
  Bukkit = "Bukkit",
  Velocity = "Velocity",
  Folia = "Folia",
}

```
