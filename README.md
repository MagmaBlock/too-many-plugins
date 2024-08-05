# 📑too-many-plugins (tmp)

[中文](./README-zh-CN.md) | [English](./README.md)

## Introduction

too-many-plugins (tmp) is a Minecraft server plugin package manager designed to provide administrators with a simple and efficient way to manage server plugins. It supports creating plugin libraries, managing server instances, installing/uninstalling/querying plugins, and more.

## Usage Guide

### Installation

```bash
npm install -g too-many-plugins
```

### Command Overview

```
tmp [command]

Commands:
  tmp library [options] [command]
  tmp server [options] [command]
  tmp server-plugin [options] [command]
```

- The `library` command is used for managing plugin libraries.
- The `server` command is used for managing server instances.
- The `server-plugin` command is used for managing plugins on servers.

**If you don't know how to use a command, add the `--help` option to get detailed usage instructions.**

### Plugin Library Management

```bash
# Add a new plugin library
tmp library add <id> <path>

# Remove a plugin library
tmp library remove <id>

# List all plugin libraries
tmp library list

# List all plugins in a library
tmp library list-plugin <id>

# Index a plugin library
tmp library index [id]

# Search for a plugin
tmp library search [options]

# Install a plugin to a server
tmp library install [options]
```

### Server Management

```bash
# Add a new server
tmp server add <id> <path> --platform=<platform>

# Remove a server
tmp server remove <id>

# Update server information
tmp server update <id> [options]

# List all servers
tmp server list
```

### Plugin Management

```bash
# Install/update a plugin from an external JAR file
tmp server-plugin install <serverId> <pluginPath>

# List all plugins installed on a server
tmp server-plugin list <serverId>

# Remove a plugin from a server
tmp server-plugin remove <serverId> <pluginId>

# Get information about a specific plugin
tmp server-plugin info <serverId> <pluginName>
```
