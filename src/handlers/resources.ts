import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs-extra";
import * as path from "path";
import ConfigService from "../services/configService.js";
import { resourceLogger, logError } from "../utils/logger.js";

/**
 * 设置资源处理器
 */
export function setupResourceHandlers(server: Server): void {
  const configService = new ConfigService();

  // 列出可用资源
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const configExists = await configService.configExists();
      const resources = [
        {
          uri: "config://cursor/mcp.json",
          name: "Cursor MCP配置文件",
          mimeType: "application/json",
          description: "当前的Cursor MCP服务器配置"
        },
        {
          uri: "logs://combined.log",
          name: "综合日志",
          mimeType: "text/plain",
          description: "MCP部署管理器的综合日志"
        },
        {
          uri: "logs://deployment.log",
          name: "部署日志",
          mimeType: "text/plain",
          description: "MCP服务器部署操作日志"
        },
        {
          uri: "logs://error.log",
          name: "错误日志",
          mimeType: "text/plain",
          description: "错误和异常日志"
        },
        {
          uri: "system://status",
          name: "系统状态",
          mimeType: "application/json",
          description: "MCP部署管理器的当前状态"
        },
        {
          uri: "config://backup-list",
          name: "备份列表",
          mimeType: "application/json",
          description: "可用的配置备份列表"
        }
      ];

      // 如果配置文件存在，添加配置内容资源
      if (configExists) {
        resources.push({
          uri: "config://current",
          name: "当前配置内容",
          mimeType: "application/json",
          description: "解析后的当前配置内容"
        });
      }

      resourceLogger.debug("列出资源", { count: resources.length });
      return { resources };

    } catch (error) {
      logError(error as Error, "列出资源失败");
      return { resources: [] };
    }
  });

  // 读取资源内容
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    resourceLogger.debug("读取资源", { uri });

    try {
      switch (true) {
        case uri.startsWith("config://"):
          return await handleConfigResource(uri, configService);

        case uri.startsWith("logs://"):
          return await handleLogResource(uri);

        case uri.startsWith("system://"):
          return await handleSystemResource(uri, configService);

        default:
          throw new Error(`不支持的资源URI: ${uri}`);
      }
    } catch (error) {
      logError(error as Error, "读取资源失败", { uri });
      throw error;
    }
  });
}

/**
 * 处理配置相关资源
 */
async function handleConfigResource(uri: string, configService: ConfigService): Promise<any> {
  switch (uri) {
    case "config://cursor/mcp.json": {
      const configPath = configService.getConfigPath();
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, "utf-8");
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: content
          }]
        };
      } else {
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify({
              message: "配置文件不存在",
              path: configPath,
              suggestion: "使用 deploy_mcp_server 工具创建第一个服务器配置"
            }, null, 2)
          }]
        };
      }
    }

    case "config://current": {
      const currentConfig = await configService.readConfig();
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(currentConfig, null, 2)
        }]
      };
    }

    case "config://backup-list": {
      const backups = await configService.listBackups();
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            totalBackups: backups.length,
            backups
          }, null, 2)
        }]
      };
    }

    default:
      throw new Error(`未知的配置资源: ${uri}`);
  }
}

/**
 * 处理日志相关资源
 */
async function handleLogResource(uri: string): Promise<any> {
  const logFile = uri.replace("logs://", "");
  const logPath = path.join("logs", logFile);

  if (await fs.pathExists(logPath)) {
    // 读取最后1000行日志（避免文件过大）
    const content = await fs.readFile(logPath, "utf-8");
    const lines = content.split("\n");
    const recentLines = lines.slice(-1000).join("\n");

    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: recentLines
      }]
    };
  } else {
    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: `日志文件不存在: ${logPath}\n\n这通常意味着还没有相关的日志记录。`
      }]
    };
  }
}

/**
 * 处理系统相关资源
 */
async function handleSystemResource(uri: string, configService: ConfigService): Promise<any> {
  switch (uri) {
    case "system://status": {
      const configExists = await configService.configExists();
      const config = configExists ? await configService.readConfig() : { mcpServers: {} };
      const backups = await configService.listBackups();
      
      const servers = Object.values(config.mcpServers);
      const status = {
        timestamp: new Date().toISOString(),
        server: {
          name: "mcp-deployment-manager",
          version: "1.0.0",
          uptime: process.uptime(),
          platform: process.platform,
          nodeVersion: process.version
        },
        cursor: {
          configExists,
          configPath: configService.getConfigPath(),
          backupPath: configService.getBackupPath()
        },
        mcp: {
          totalServers: servers.length,
          activeServers: servers.filter(s => !s.disabled).length,
          disabledServers: servers.filter(s => s.disabled).length
        },
        backups: {
          totalBackups: backups.length,
          lastBackup: backups.length > 0 ? backups[0]?.timestamp : null
        },
        features: {
          tools: true,
          resources: true,
          prompts: true,
          sampling: false
        }
      };

      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(status, null, 2)
        }]
      };
    }

    default:
      throw new Error(`未知的系统资源: ${uri}`);
  }
}

export default setupResourceHandlers; 