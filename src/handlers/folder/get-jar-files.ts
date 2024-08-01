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
