import consola from "consola";
import { addLibrary, findPlugin } from "./handlers/library/manager";
import { listPlugins, replacePlugin } from "./handlers/server/pluginManager";
import { addServer } from "./handlers/server/serverManager";
import { SupportedPlatform } from "./types/supported-platform";

async function main() {
  const viaVersion = await findPlugin("ViaVersion");
  const pluginPath = viaVersion.find((plugin) =>
    plugin.plugin.info.platform.includes(SupportedPlatform.Bukkit)
  );
  if (pluginPath) {
    consola.success("找到了: ", pluginPath);
    await replacePlugin("lobby", pluginPath.plugin.jarPath);
  }
}

main();
