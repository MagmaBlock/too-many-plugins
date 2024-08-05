# 📑too-many-plugins (tmp)

[中文](./README-zh-CN.md) | [English](./README.md)

## 概念介绍

too-many-plugins (tmp) 是一个 Minecraft 服务端插件包管理器，旨在为运维人员提供一种简单高效的方式来管理服务端插件。它支持创建插件库、管理服务器实例、安装/卸载/查询插件等功能。

## 使用教程

### 安装

```bash
npm install -g too-many-plugins
```

### 命令概览

```
tmp [command]

Commands:
  tmp library [options] [command]
  tmp server [options] [command]
  tmp server-plugin [options] [command]
```

- `library` 命令用于管理插件库
- `server` 命令用于管理服务器实例
- `server-plugin` 命令用于管理服务器中的插件

**如你有任何命令不清楚如何使用，增加 `--help` 选项可以获取命令的详细用法说明。**

### 插件库管理

```bash
# 添加新的插件库
tmp library add <id> <path>

# 移除插件库
tmp library remove <id>

# 列出所有插件库
tmp library list

# 列出插件库中的所有插件
tmp library list-plugin <id>

# 索引插件库
tmp library index [id]

# 搜索插件
tmp library search [options]

# 安装插件到服务器
tmp library install [options]
```

### 服务器管理

```bash
# 添加新的服务器
tmp server add <id> <path> --platform=<platform>

# 移除服务器
tmp server remove <id>

# 更新服务器信息
tmp server update <id> [options]

# 列出所有服务器
tmp server list
```

### 插件管理

```bash
# 从外部 JAR 文件安装/更新插件
tmp server-plugin install <serverId> <pluginPath>

# 列出服务器中的所有插件
tmp server-plugin list <serverId>

# 从服务器移除插件
tmp server-plugin remove <serverId> <pluginId>

# 获取插件详细信息
tmp server-plugin info <serverId> <pluginName>
```
