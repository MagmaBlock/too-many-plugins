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
          `${plugin.info.name} v${plugin.info.version} (${plugin.info.platform}) (${plugin.jarPath})`
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
        console.log(`✅ Library ${id} indexed`);
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
  .command("search")
  .option("-n, --name <name>", "Plugin name")
  .option("-v, --plugin-version <version>", "Plugin version")
  .option("-l, --latest", "Show only latest versions")
  .option("-p, --platform <platform>", "Filter by platform")
  .option("-lib, --library <id>", "Search in a specific library")
  .description("Search for a plugin")
  .action(async (options) => {
    try {
      const results = await libraryManager.findPlugin(options);
      if (results.length === 0) {
        console.log("No plugins found matching the criteria.");
      } else {
        results.forEach((plugin) => {
          console.log(
            `${plugin.info.name} v${
              plugin.info.version
            } (${plugin.info.platform.join(", ")}) (${plugin.jarPath})`
          );
        });
      }
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

libraryCommand
  .command("install")
  .requiredOption("-n, --name <name>", "Plugin name")
  .option("-v, --plugin-version <version>", "Plugin version")
  .option("-l, --latest", "Install latest version")
  .option("-lib, --library <id>", "Library to search in")
  .requiredOption("-s, --server <id>", "Server to install")
  .description("Install a plugin to a server")
  .action(async (options) => {
    try {
      if (!options.pluginVersion && !options.latest) {
        throw new Error(
          "Either --plugin-version or --latest must be specified"
        );
      }

      const server = await serverManager.getServer(options.server);
      const results = await libraryManager.findPlugin({
        name: options.name,
        pluginVersion: options.version,
        latest: options.latest,
        platform: server.platform,
        libraryId: options.library,
      });

      if (results.length === 0) {
        throw new Error("No matching plugins found");
      }

      if (results.length > 1) {
        console.log("Multiple matching plugins found:");
        results.forEach((plugin) => {
          console.log(
            `${plugin.info.name} v${
              plugin.info.version
            } (${plugin.info.platform.join(", ")}) (${plugin.jarPath})`
          );
        });
        throw new Error(
          "Please specify a more precise version or use --latest"
        );
      }

      const pluginToInstall = results[0];
      await pluginManager.installOrUpdatePlugin(
        options.server,
        pluginToInstall.jarPath
      );
      console.log(
        `✅ Plugin installed: ${pluginToInstall.info.name} v${
          pluginToInstall.info.version
        } (${pluginToInstall.info.platform.join(", ")})`
      );
      console.log(`Installed to server: ${server.id} (${server.platform})`);
      console.log(`Plugin path: ${pluginToInstall.jarPath}`);
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
  .description(
    'Add a new server, "path" is the parent directory of the "plugins" folder'
  )
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
  .option(
    "-p, --path <path>",
    'New server path, the parent directory of the "plugins" folder'
  )
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

const serverPluginCommand = program.command("server-plugin");

serverPluginCommand
  .command("install <serverId> <pluginPath>")
  .description("Install or update a plugin from an external JAR file")
  .action(async (serverId, pluginPath) => {
    try {
      const plugin = await pluginManager.installOrUpdatePlugin(
        serverId,
        pluginPath
      );
      console.log(
        `✅ Plugin installed/updated: ${plugin.info.name} (${plugin.info.version})`
      );
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

serverPluginCommand
  .command("list <serverId>")
  .description("List all plugins installed on the server")
  .action(async (serverId) => {
    try {
      const plugins = await pluginManager.listPlugins(serverId);
      plugins.forEach((plugin) => {
        console.log(`${plugin.info.name} (${plugin.info.version})`);
      });
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

serverPluginCommand
  .command("remove <serverId> <pluginId>")
  .description("Remove a plugin from the server")
  .action(async (serverId, pluginId) => {
    try {
      await pluginManager.removePlugin(serverId, pluginId);
      console.log(`✅ Plugin removed: ${pluginId}`);
    } catch (error) {
      console.error(`❌ Error: ${(error as any)?.message ?? error}`);
    }
  });

serverPluginCommand
  .command("info <serverId> <pluginName>")
  .description("Get information about a specific plugin")
  .action(async (serverId, pluginName) => {
    try {
      const plugins = await pluginManager.listPlugins(serverId);
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
