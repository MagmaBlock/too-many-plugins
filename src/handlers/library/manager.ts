import fs from "node:fs";
import path from "node:path";
import semver from "semver";
import { storage } from "../../db/db";
import { Libraries, Library, PluginEntry } from "../../types/library";
import { getJarFiles } from "../folder/get-jar-files";
import { getFileHash, getPluginInfoWithCache } from "../jar/plugin-info-cache";
import { SupportedPlatform } from "../../types/supported-platform";

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
  if (
    !fs.existsSync(absolutePath) ||
    !fs.statSync(absolutePath).isDirectory()
  ) {
    throw new Error("嘎！指定文件夹不存在");
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
      const existingPlugins = library.plugins.filter(
        (plugin) => plugin.hash === hash
      );
      if (existingPlugins.length > 0) {
        newPlugins.push(...existingPlugins);
      }
      continue;
    }

    const infoList = await getPluginInfoWithCache(jarFile);
    for (const info of infoList) {
      newPlugins.push({
        info,
        hash,
        jarPath: jarFile,
      });
    }
  }

  // 移除无效的索引
  library.plugins = library.plugins.filter((plugin) =>
    validJarPaths.has(plugin.jarPath)
  );

  // 使用新的索引替换旧的索引
  library.plugins = newPlugins;

  await storage.setItem(LIBRARIES_KEY, libraries);

  return library;
}

/**
 * 插件过滤
 * @param filters 查询过滤器
 * @param filters.name 插件名称，大小写不敏感，match 匹配。
 * @param filters.version 插件版本，全等匹配
 * @param filters.latest 是否只返回最新版本
 * @param filters.platform 只返回指定平台
 * @param filters.libraryId 只在指定插件库中寻找
 * @returns 包含插件信息和所在库 ID 的对象数组
 */
export async function findPlugin(filters: {
  name?: string;
  pluginVersion?: string;
  latest?: boolean;
  platform?: SupportedPlatform;
  libraryId?: string;
}): Promise<PluginEntry[]> {
  const libraries = await getAllLibraries();
  const results: PluginEntry[] = [];

  const searchLibraries = filters.libraryId
    ? { [filters.libraryId]: libraries[filters.libraryId] }
    : libraries;

  if (filters.libraryId && !searchLibraries[filters.libraryId]) {
    throw new Error(`Library with ID "${filters.libraryId}" not found.`);
  }

  for (const library of Object.values(searchLibraries)) {
    let filteredPlugins = library.plugins;

    if (filters.name) {
      const lowercaseName = filters.name.toLowerCase();
      filteredPlugins = filteredPlugins.filter((plugin) =>
        plugin.info.name.toLowerCase().includes(lowercaseName)
      );
    }

    if (filters.pluginVersion) {
      filteredPlugins = filteredPlugins.filter(
        (plugin) => plugin.info.version === filters.pluginVersion
      );
    }

    if (filters.platform) {
      filteredPlugins = filteredPlugins.filter((plugin) =>
        plugin.info.platform.includes(filters.platform!)
      );
    }

    results.push(...filteredPlugins);
  }

  if (filters.latest) {
    const latestVersions = new Map<string, PluginEntry>();
    for (const plugin of results) {
      const currentLatest = latestVersions.get(plugin.info.name);
      if (
        !currentLatest ||
        sortVersions([plugin.info.version, currentLatest.info.version])[0] ===
          plugin.info.version
      ) {
        latestVersions.set(plugin.info.name, plugin);
      }
    }
    return Array.from(latestVersions.values());
  }

  return results;
}

/**
 * 对版本号数组进行排序，从新到旧
 * @param versions 版本号数组
 * @returns 排序后的版本号数组
 */
export function sortVersions(versions: string[]): string[] {
  return versions.sort((a, b) => {
    const cleanA = semver.valid(semver.coerce(a));
    const cleanB = semver.valid(semver.coerce(b));

    if (cleanA && cleanB) {
      const compareResult = semver.rcompare(cleanA, cleanB);
      if (compareResult !== 0) {
        return compareResult;
      }
    }

    // 如果版本号相同或无法比较，将非 SNAPSHOT 版本排在前面
    const aIsSnapshot = a.includes("SNAPSHOT");
    const bIsSnapshot = b.includes("SNAPSHOT");
    if (aIsSnapshot && !bIsSnapshot) {
      return 1;
    }
    if (!aIsSnapshot && bIsSnapshot) {
      return -1;
    }

    // 如果都是 SNAPSHOT 或都不是 SNAPSHOT，保持原有顺序
    return 0;
  });
}
