import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Libraries, Library, PluginEntry } from "../../types/library";
import { storage } from "../../db/db";
import { getJarFiles } from "../folder/get-jar-files";
import { getPluginInfo } from "../jar/get-plugin-info";

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

    const pluginInfos = getPluginInfo(jarFile);
    for (const info of pluginInfos) {
      newPlugins.push({
        info,
        hash,
        jarPath: jarFile,
      });
    }
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

/**
 * 获取文件的 SHA256 哈希值
 * @param filePath 文件路径
 * @returns 文件的 SHA256 哈希值
 */
async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
