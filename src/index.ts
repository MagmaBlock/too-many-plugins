#!/usr/bin/env node
import { Command } from "commander";
import * as libraryManager from "./handlers/library/manager";
import * as serverManager from "./handlers/server/serverManager";
import * as pluginManager from "./handlers/server/pluginManager";

const program = new Command();

program
  .name("tmp")
  .description("Too Many Plugins - Minecraft server plugin manager")
  .version("1.0.0");

// Library commands
const libraryCommand = program.command("library");

libraryCommand
  .command("add <id> <path>")
  .description("Add a new plugin library")
  .action(async (id, path) => {
    try {
      const library = await libraryManager.addLibrary(id, path);
      console.log(`✅ Library added: ${library.id}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("remove <id>")
  .description("Remove a plugin library")
  .action(async (id) => {
    try {
      await libraryManager.removeLibrary(id);
      console.log(`✅ Library removed: ${id}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("list")
  .description("List all plugin libraries")
  .action(async () => {
    try {
      const libraries = await libraryManager.getAllLibraries();
      Object.entries(libraries).forEach(([id, library]) => {
        console.log(`${id}\n  ${library.path}`);
      });
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("list-plugin <id>")
  .description("List all plugins in a library")
  .action(async (id) => {
    try {
      const library = await libraryManager.getLibrary(id);
      library.plugins.forEach((plugin) => {
        console.log(
          `[${plugin.info.platform}] ${plugin.info.name} v${
            plugin.info.version
          } by ${plugin.info.authors.join(", ")}`
        );
      });
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("index [id]")
  .option("-r, --rebuild", "Rebuild the index")
  .description("Index all libraries or a specific library")
  .action(async (id, options) => {
    try {
      if (id) {
        await libraryManager.updateLibraryIndex(id, options.rebuild);
        console.log(`✅ Library indexed: ${id}`);
      } else {
        const libraries = await libraryManager.getAllLibraries();
        for (const [libraryId, _] of Object.entries(libraries)) {
          await libraryManager.updateLibraryIndex(libraryId, options.rebuild);
        }
        console.log("✅ All libraries indexed");
      }
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("search <query>")
  .option("-l, --library <id>", "Search in a specific library")
  .description("Search for a plugin")
  .action(async (query, options) => {
    try {
      const results = await libraryManager.findPlugin(query, options.library);
      results.forEach((result) => {
        console.log(
          `${result.plugin.info.name} (${result.plugin.info.version}) - ${result.libraryId}`
        );
      });
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("install")
  .requiredOption("-n, --name <name>", "Plugin name")
  .option("-v, --version <version>", "Plugin version")
  .option("-l, --latest", "Install latest version")
  .option("-lib, --library <id>", "Library to search in")
  .requiredOption("-s, --server <id>", "Server to install to")
  .description("Install a plugin to a server")
  .action(async (options) => {
    try {
      if (!options.version && !options.latest) {
        throw new Error("Either --version or --latest must be specified");
      }

      const results = await libraryManager.findPlugin(
        options.name,
        options.library
      );
      if (results.length === 0) {
        throw new Error("Plugin not found");
      }

      let pluginToInstall = results[0].plugin;
      if (options.version) {
        pluginToInstall = results.find(
          (r) => r.plugin.info.version === options.version
        )?.plugin!;
        if (!pluginToInstall) {
          throw new Error("Specified version not found");
        }
      } else if (options.latest) {
        pluginToInstall = results.reduce((latest, current) => {
          return libraryManager.sortVersions([
            latest.plugin.info.version,
            current.plugin.info.version,
          ])[0] === latest.plugin.info.version
            ? latest
            : current;
        }).plugin;
      }

      await pluginManager.installOrUpdatePlugin(
        options.server,
        pluginToInstall.jarPath
      );
      console.log(
        `✅ Plugin installed: ${pluginToInstall.info.name} (${pluginToInstall.info.version})`
      );
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

// Server commands
const serverCommand = program.command("server");

serverCommand
  .command("add <id> <path>")
  .requiredOption(
    "-p, --platform <platform>",
    "Server platform (BungeeCord, Bukkit, Velocity, Folia)"
  )
  .description("Add a new server")
  .action(async (id, path, options) => {
    try {
      const server = await serverManager.addServer(id, path, options.platform);
      console.log(`✅ Server added: ${server.id}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

serverCommand
  .command("remove <id>")
  .description("Remove a server")
  .action(async (id) => {
    try {
      await serverManager.removeServer(id);
      console.log(`✅ Server removed: ${id}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

serverCommand
  .command("update <id>")
  .option("-p, --path <path>", "New server path")
  .option("-plat, --platform <platform>", "New server platform")
  .description("Update server information")
  .action(async (id, options) => {
    try {
      const updates: any = {};
      if (options.path) updates.path = options.path;
      if (options.platform) updates.platform = options.platform;
      const updatedServer = await serverManager.updateServer(id, updates);
      console.log(`✅ Server updated: ${updatedServer.id}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

serverCommand
  .command("list")
  .description("List all servers")
  .action(async () => {
    try {
      const servers = await serverManager.getAllServers();
      Object.entries(servers).forEach(([id, server]) => {
        console.log(`${id} (${server.platform})\n  ${server.path}`);
      });
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

// 修改 Server plugin commands 部分
const pluginsCommand = serverCommand.command("plugins <serverId>");

pluginsCommand
  .command("install <pluginPath>")
  .description("Install or update a plugin from an external JAR file")
  .action(async (pluginPath, options) => {
    try {
      const plugin = await pluginManager.installOrUpdatePlugin(
        options.parent.args[0],
        pluginPath
      );
      console.log(
        `✅ Plugin installed/updated: ${plugin.info.name} (${plugin.info.version})`
      );
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

pluginsCommand
  .command("list")
  .description("List all plugins installed on the server")
  .action(async (options) => {
    try {
      const plugins = await pluginManager.listPlugins(options.parent.args[0]);
      plugins.forEach((plugin) => {
        console.log(`${plugin.info.name} (${plugin.info.version})`);
      });
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

pluginsCommand
  .command("remove <pluginId>")
  .description("Remove a plugin from the server")
  .action(async (pluginId, options) => {
    try {
      await pluginManager.removePlugin(options.parent.args[0], pluginId);
      console.log(`✅ Plugin removed: ${pluginId}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

pluginsCommand
  .command("info <pluginName>")
  .description("Get information about a specific plugin")
  .action(async (pluginName, options) => {
    try {
      const plugins = await pluginManager.listPlugins(options.parent.args[0]);
      const plugin = plugins.find(
        (p) => p.info.name === pluginName || p.jarPath.endsWith(pluginName)
      );
      if (plugin) {
        console.log(`Name: ${plugin.info.name}`);
        console.log(`Version: ${plugin.info.version}`);
        console.log(`Description: ${plugin.info.description || "N/A"}`);
        console.log(`Authors: ${plugin.info.authors.join(", ")}`);
        console.log(`Platforms: ${plugin.info.platform.join(", ")}`);
      } else {
        console.log(`Plugin not found: ${pluginName}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

program.parse(process.argv);
