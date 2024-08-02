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
 * @throws 如果服务端已存在、路径无效或平台类型不正确
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

  if (!Object.values(SupportedPlatform).includes(platform)) {
    throw new Error("Invalid platform type");
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
 * @throws 如果服务端不存在、路径无效或平台类型不正确
 */
export async function updateServer(
  id: string,
  updates: Partial<Omit<ServerEntry, "id">>
): Promise<ServerEntry> {
  const servers = await getAllServers();
  if (!servers[id]) {
    throw new Error("Server not found");
  }

  if (
    updates.platform &&
    !Object.values(SupportedPlatform).includes(updates.platform)
  ) {
    throw new Error("Invalid platform type");
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
