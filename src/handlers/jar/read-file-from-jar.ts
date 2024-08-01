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
