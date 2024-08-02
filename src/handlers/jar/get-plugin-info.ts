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
  // 检查类内容是否包含Bukkit相关类，如果是则认为是Bukkit平台
  if (classContent.includes("org/bukkit/Bukkit")) {
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
          if (platform === null) {
            consola.warn(
              `Unknown platform plugin from ${jarPath}, mark it as both Bukkit and BungeeCord.`
            );
            pluginInfo.platform.push(SupportedPlatform.Bukkit);
            pluginInfo.platform.push(SupportedPlatform.BungeeCord);
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
