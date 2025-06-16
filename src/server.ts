import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupToolHandlers } from "./handlers/tools.js";
import { setupResourceHandlers } from "./handlers/resources.js";
import { setupPromptHandlers } from "./handlers/prompts.js";
import { logger, logError, logSuccess } from "./utils/logger.js";
import { config } from "./config/index.js";
import fs from "fs-extra";
import * as path from "path";

/**
 * MCP服务部署管理器主服务器
 */
class MCPDeploymentServer {
  private server: Server;

  constructor() {
    // 创建MCP服务器实例
    this.server = new Server({
      name: config.server.name,
      version: config.server.version
    }, {
      capabilities: {
        resources: config.features.resources ? {
          subscribe: true,
          listChanged: true
        } : undefined,
        tools: config.features.tools ? {
          listChanged: true
        } : undefined,
        prompts: config.features.prompts ? {
          listChanged: true
        } : undefined,
        sampling: config.features.sampling ? {} : undefined,
        logging: {}
      }
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  /**
   * 设置请求处理器
   */
  private setupHandlers(): void {
    try {
      // 调试：输出配置信息
      logger.info("🔍 配置调试信息", {
        features: config.features,
        env: {
          ENABLE_TOOLS: process.env.ENABLE_TOOLS,
          ENABLE_RESOURCES: process.env.ENABLE_RESOURCES,
          ENABLE_PROMPTS: process.env.ENABLE_PROMPTS
        }
      });

      // 设置工具处理器（核心功能）
      if (config.features.tools) {
        setupToolHandlers(this.server);
        logger.info("✅ 工具处理器已加载");
      } else {
        logger.warn("⚠️ 工具处理器未加载 - config.features.tools = false");
      }

      // 设置资源处理器
      if (config.features.resources) {
        setupResourceHandlers(this.server);
        logger.info("✅ 资源处理器已加载");
      }

      // 设置提示词处理器
      if (config.features.prompts) {
        setupPromptHandlers(this.server);
        logger.info("✅ 提示词处理器已加载");
      }

    } catch (error) {
      logError(error as Error, "设置处理器失败");
      throw error;
    }
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logError(error, "MCP服务器运行时错误");
    };

    // 处理进程级别的错误
    process.on('uncaughtException', (error) => {
      logError(error, "未捕获的异常");
      this.shutdown(1);
    });

    process.on('unhandledRejection', (reason) => {
      logError(new Error(String(reason)), "未处理的Promise拒绝");
      this.shutdown(1);
    });

    // 优雅关闭处理
    process.on('SIGINT', () => {
      logger.info("接收到SIGINT信号，正在关闭服务器...");
      this.shutdown(0);
    });

    process.on('SIGTERM', () => {
      logger.info("接收到SIGTERM信号，正在关闭服务器...");
      this.shutdown(0);
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    try {
      // 确保日志目录存在
      await this.ensureLogDirectory();

      // 验证配置
      await this.validateConfiguration();

      // 创建传输层
      const transport = new StdioServerTransport();
      
      // 连接服务器
      await this.server.connect(transport);
      
      logSuccess("MCP服务部署管理器启动成功", {
        name: config.server.name,
        version: config.server.version,
        cursorConfigPath: config.cursor.configPath,
        features: {
          tools: config.features.tools,
          resources: config.features.resources,
          prompts: config.features.prompts,
          sampling: config.features.sampling
        }
      });

      // 输出使用说明
      this.printUsageInstructions();
      
    } catch (error) {
      logError(error as Error, "服务器启动失败");
      throw error;
    }
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.ensureDir("logs");
      logger.debug("日志目录已确保存在");
    } catch (error) {
      throw new Error(`无法创建日志目录: ${(error as Error).message}`);
    }
  }

  /**
   * 验证配置
   */
  private async validateConfiguration(): Promise<void> {
    // 检查Cursor配置目录是否存在
    const configDir = path.dirname(config.cursor.configPath);
    if (!(await fs.pathExists(configDir))) {
      logger.warn("Cursor配置目录不存在，将在首次使用时创建", { 
        configDir 
      });
      // 创建目录
      await fs.ensureDir(configDir);
    }

    logger.info("配置验证通过", {
      cursorConfigPath: config.cursor.configPath,
      backupEnabled: config.cursor.backupEnabled
    });
  }

  /**
   * 打印使用说明
   */
  private printUsageInstructions(): void {
    logger.info(`
🚀 MCP服务部署管理器已就绪！

📋 主要功能：
- 部署MCP服务器到Cursor全局配置
- 管理现有的MCP服务器配置
- 创建和恢复配置备份
- 验证配置文件格式
- 扫描目录查找MCP服务器

🛠️  可用工具：
- deploy_mcp_server: 部署新的MCP服务器
- remove_mcp_server: 移除MCP服务器
- list_mcp_servers: 列出所有服务器
- get_system_status: 获取系统状态
- backup_config: 创建配置备份
- scan_mcp_servers: 扫描MCP服务器

📁 配置路径：${config.cursor.configPath}
📁 备份目录：${path.join(path.dirname(config.cursor.configPath), "mcp-backups")}

💡 提示：所有操作都会自动创建备份（如果启用）
    `);
  }

  /**
   * 关闭服务器
   */
  private async shutdown(exitCode: number): Promise<void> {
    try {
      logger.info("正在关闭MCP服务器...");
      
      // 可以在这里添加清理逻辑
      // 例如：保存状态、关闭数据库连接等
      
      logger.info("MCP服务器已关闭");
      process.exit(exitCode);
    } catch (error) {
      logError(error as Error, "关闭服务器时发生错误");
      process.exit(1);
    }
  }
}

/**
 * 主入口函数
 */
async function main(): Promise<void> {
  try {
    const server = new MCPDeploymentServer();
    await server.start();
  } catch (error) {
    logError(error as Error, "启动MCP部署管理器失败");
    process.exit(1);
  }
}

// 如果直接运行此文件，启动服务器
if (import.meta.url.includes('server.js') || import.meta.url.includes('server.ts')) {
  main().catch((error) => {
    console.error("❌ 启动失败:", error.message);
    process.exit(1);
  });
}

export default MCPDeploymentServer; 