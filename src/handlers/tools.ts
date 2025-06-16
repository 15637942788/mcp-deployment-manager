import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as fs from "fs-extra";
import * as os from "os";
import ConfigService from "../services/configService.js";
import { SecurityService } from "../services/securityService.js";
import { toolLogger, logError, PerformanceTimer, configLogger } from "../utils/logger.js";
import {
  DeployServerRequest,
  MCPServerConfig
} from "../types/index.js";

/**
 * 设置工具处理器
 */
export function setupToolHandlers(server: Server): void {
  const configService = new ConfigService();

  // 列出可用工具
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "deploy_mcp_server",
          description: "部署新的MCP服务器到Cursor配置中。使用全局安全策略，自动执行安全检查，无需依赖项目本地标准文件",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "服务器名称（唯一标识符）"
              },
              serverPath: {
                type: "string",
                description: "服务器文件的绝对路径"
              },
              serverType: {
                type: "string",
                enum: ["node", "python", "npm", "executable"],
                description: "服务器类型"
              },
              description: {
                type: "string",
                description: "服务器描述（可选）"
              },
              env: {
                type: "object",
                description: "环境变量（可选）",
                additionalProperties: {
                  type: "string"
                }
              },
              disabled: {
                type: "boolean",
                description: "是否禁用服务器（默认false）"
              },
              autoApprove: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "自动批准的工具列表（可选）"
              },
              force: {
                type: "boolean",
                description: "是否强制覆盖现有同名服务器（默认false，建议谨慎使用）"
              }
            },
            required: ["name", "serverPath", "serverType"]
          }
        },
        {
          name: "get_cursor_config_path",
          description: "获取当前系统的Cursor配置文件路径",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "list_mcp_servers",
          description: "列出所有已配置的MCP服务器",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "remove_mcp_server",
          description: "移除现有的MCP服务器",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "要移除的服务器名称"
              }
            },
            required: ["name"]
          }
        },
        {
          name: "get_system_status",
          description: "获取系统状态和统计信息",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "backup_config",
          description: "创建Cursor配置的备份",
          inputSchema: {
            type: "object",
            properties: {
              comment: {
                type: "string",
                description: "备份注释（可选）"
              }
            }
          }
        },
        {
          name: "restore_config",
          description: "从备份恢复配置",
          inputSchema: {
            type: "object",
            properties: {
              backupFile: {
                type: "string",
                description: "备份文件路径"
              }
            },
            required: ["backupFile"]
          }
        },
        {
          name: "validate_config",
          description: "验证配置文件的有效性",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "scan_mcp_servers",
          description: "扫描目录查找潜在的MCP服务器",
          inputSchema: {
            type: "object",
            properties: {
              directory: {
                type: "string",
                description: "要扫描的目录路径"
              }
            },
            required: ["directory"]
          }
        },
        {
          name: "security_scan_mcp_service",
          description: "对MCP服务进行安全扫描，检查代码安全性、依赖漏洞、配置安全等",
          inputSchema: {
            type: "object",
            properties: {
              serverPath: {
                type: "string",
                description: "MCP服务器文件的绝对路径"
              },
              projectRoot: {
                type: "string",
                description: "项目根目录路径（可选）"
              }
            },
            required: ["serverPath"]
          }
        },
        {
          name: "enforce_security_policy",
          description: "强制执行MCP部署安全策略，确保所有服务部署都经过安全检查",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["enable", "disable", "status"],
                description: "操作类型：启用/禁用/查看状态"
              },
              strictMode: {
                type: "boolean",
                description: "是否启用严格模式（最高安全标准）"
              }
            },
            required: ["action"]
          }
        },
        {
          name: "global_security_manager",
          description: "管理全局MCP安全策略，替代项目级别的标准文件依赖",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["status", "enable", "disable", "update_policy", "get_standards"],
                description: "操作类型：状态/启用/禁用/更新策略/获取标准"
              },
              strictMode: {
                type: "boolean",
                description: "是否启用严格模式（仅用于enable操作）"
              },
              minimumScore: {
                type: "number",
                description: "最低安全分数要求（仅用于update_policy操作）"
              }
            },
            required: ["action"]
          }
        },
        {
          name: "build_time_security_check",
          description: "在MCP服务构建/编译时执行安全检查，确保代码安全性",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: {
                type: "string",
                description: "项目根目录路径"
              },
              buildCommand: {
                type: "string",
                description: "构建命令（可选，如 'npm run build'）"
              },
              outputPath: {
                type: "string",
                description: "构建输出路径（可选）"
              }
            },
            required: ["projectPath"]
          }
        },
        {
          name: "config_protection_manager",
          description: "管理MCP配置保护策略，确保配置安全和备份机制",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["enable", "disable", "status", "list_backups", "emergency_restore"],
                description: "操作类型：启用/禁用/状态/列出备份/紧急恢复"
              },
              protectionLevel: {
                type: "string",
                enum: ["standard", "strict", "maximum"],
                description: "保护级别：标准/严格/最大（可选）"
              },
              backupFile: {
                type: "string",
                description: "备份文件名（用于紧急恢复）"
              }
            },
            required: ["action"]
          }
        }
      ]
    };
  });

  // 处理工具调用
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const timer = new PerformanceTimer(`tool_${name}`);

    try {
      toolLogger.info(`执行工具: ${name}`, { arguments: args });

      switch (name) {
        case "deploy_mcp_server":
          return await handleDeployServer(configService, args as unknown as DeployServerRequest, timer);

        case "get_cursor_config_path":
          return await handleGetConfigPath(configService, timer);

        case "list_mcp_servers":
          return await handleListServers(configService, timer);

        case "remove_mcp_server":
          return await handleRemoveServer(configService, args as { name: string }, timer);

        case "get_system_status":
          return await handleGetSystemStatus(configService, timer);

        case "backup_config":
          return await handleBackupConfig(configService, args as { comment?: string }, timer);

        case "restore_config":
          return await handleRestoreConfig(configService, args as { backupFile: string }, timer);

        case "validate_config":
          return await handleValidateConfig(configService, timer);

        case "scan_mcp_servers":
          return await handleScanServers(configService, args as { directory: string }, timer);

        case "security_scan_mcp_service":
          return await handleSecurityScan(args as { serverPath: string, projectRoot?: string }, timer);

        case "enforce_security_policy":
          return await handleEnforceSecurityPolicy(args as { action: string, strictMode?: boolean }, timer);

        case "global_security_manager":
          return await handleGlobalSecurityManager(args as { action: string, strictMode?: boolean, minimumScore?: number }, timer);

        case "build_time_security_check":
          return await handleBuildTimeSecurityCheck(args as { projectPath: string, buildCommand?: string, outputPath?: string }, timer);

        case "config_protection_manager":
          return await handleConfigProtectionManager(configService, args as { action: string, protectionLevel?: string, backupFile?: string }, timer);

        default:
          throw new Error(`未知工具: ${name}`);
      }
    } catch (error) {
      timer.end({ error: (error as Error).message });
      logError(error as Error, `工具执行失败: ${name}`, { arguments: args });
      
      return {
        content: [{
          type: "text",
          text: `工具执行失败: ${(error as Error).message}`
        }],
        isError: true
      };
    }
  });
}

/**
 * 处理部署服务器
 */
export async function handleDeployServer(
  configService: ConfigService,
  args: DeployServerRequest,
  timer: PerformanceTimer
): Promise<any> {
  // ... existing code ...
}

/**
 * 处理获取配置路径
 */
async function handleGetConfigPath(
  configService: ConfigService,
  timer: PerformanceTimer
): Promise<any> {
  const configPath = configService.getConfigPath();
  const backupPath = configService.getBackupPath();
  const configExists = await configService.configExists();
  
  timer.end({ configExists });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        cursorConfigPath: configPath,
        backupDirectory: backupPath,
        configExists,
        platform: process.platform,
        userHome: os.homedir()
      }, null, 2)
    }]
  };
}

/**
 * 根据服务器类型获取命令
 */
function getCommandForServerType(serverType: string, serverPath: string): string {
  switch (serverType) {
    case "node":
      return "node";
    case "python":
      return "python";
    case "npm":
      return "npx";
    case "executable":
      return serverPath;
    default:
      throw new Error(`不支持的服务器类型: ${serverType}`);
  }
}

/**
 * 根据服务器类型获取参数
 */
function getArgsForServerType(serverType: string, serverPath: string): string[] {
  switch (serverType) {
    case "node":
    case "python":
      return [serverPath];
    case "npm":
      const packageName = path.basename(serverPath);
      return ["-y", packageName];
    case "executable":
      return [];
    default:
      throw new Error(`不支持的服务器类型: ${serverType}`);
  }
}

/**
 * 处理列出服务器
 */
async function handleListServers(
  configService: ConfigService,
  timer: PerformanceTimer
): Promise<any> {
  const servers = await configService.listServers();
  timer.end({ serverCount: servers.length });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        servers,
        totalCount: servers.length,
        message: `找到 ${servers.length} 个MCP服务器`
      }, null, 2)
    }]
  };
}

/**
 * 处理移除服务器
 */
async function handleRemoveServer(
  configService: ConfigService,
  args: { name: string },
  timer: PerformanceTimer
): Promise<any> {
  const result = await configService.removeServer(args.name);
  timer.end({ success: result.success, serverName: args.name });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.success,
        message: result.message,
        serverName: args.name,
        ...(result.errors && { errors: result.errors })
      }, null, 2)
    }]
  };
}

/**
 * 处理获取系统状态
 */
async function handleGetSystemStatus(
  configService: ConfigService,
  timer: PerformanceTimer
): Promise<any> {
  const status = await configService.getSystemStatus();
  timer.end({ status: "success" });

  return {
    content: [{
      type: "text",
      text: JSON.stringify(status, null, 2)
    }]
  };
}

/**
 * 处理备份配置
 */
async function handleBackupConfig(
  configService: ConfigService,
  args: { comment?: string },
  timer: PerformanceTimer
): Promise<any> {
  const result = await configService.createBackupWithResult(args.comment);
  timer.end({ success: result.success });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.success,
        message: result.message,
        backupPath: result.backupPath,
        ...(result.errors && { errors: result.errors })
      }, null, 2)
    }]
  };
}

/**
 * 处理恢复配置
 */
async function handleRestoreConfig(
  configService: ConfigService,
  args: { backupFile: string },
  timer: PerformanceTimer
): Promise<any> {
  const result = await configService.restoreFromBackupWithResult(args.backupFile);
  timer.end({ success: result.success });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: result.success,
        message: result.message,
        ...(result.errors && { errors: result.errors })
      }, null, 2)
    }]
  };
}

/**
 * 处理验证配置
 */
async function handleValidateConfig(
  configService: ConfigService,
  timer: PerformanceTimer
): Promise<any> {
  const result = await configService.validateCurrentConfig();
  timer.end({ valid: result.valid });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        message: result.valid ? "配置验证通过" : "配置验证失败"
      }, null, 2)
    }]
  };
}

/**
 * 处理扫描服务器
 */
async function handleScanServers(
  configService: ConfigService,
  args: { directory: string },
  timer: PerformanceTimer
): Promise<any> {
  const result = await configService.scanDirectory(args.directory);
  timer.end({ foundCount: result.servers.length });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        directory: args.directory,
        servers: result.servers,
        totalFound: result.servers.length,
        message: `在 ${args.directory} 中发现 ${result.servers.length} 个潜在的MCP服务器`
      }, null, 2)
    }]
  };
}

/**
 * 确保部署规则文件存在（增强版）
 * 检查项目的.cursor/rules/目录下是否存在mcp-部署标准.mdc文件
 * 如果不存在，从源位置复制过来，并验证文件完整性
 */


/**
 * 查找项目根目录
 * 从给定路径向上查找，寻找常见的项目标识文件
 */
function findProjectRoot(startPath: string): string | null {
  let currentPath = path.dirname(startPath);
  const root = path.parse(currentPath).root;

  // 向上查找的常见项目标识文件
  const projectMarkers = [
    'package.json',
    'tsconfig.json',
    'pyproject.toml',
    'requirements.txt',
    'Cargo.toml',
    '.git',
    '.gitignore',
    'README.md',
    'readme.md'
  ];

  while (currentPath !== root) {
    // 检查是否存在项目标识文件
    for (const marker of projectMarkers) {
      const markerPath = path.join(currentPath, marker);
      try {
        if (fs.existsSync(markerPath)) {
          return currentPath;
        }
      } catch {
        // 忽略访问错误，继续向上查找
      }
    }

    // 向上一级目录
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break; // 已到达根目录
    }
    currentPath = parentPath;
  }

  // 如果没找到项目根目录，返回服务器文件所在目录
  return path.dirname(startPath);
}

/**
 * 处理安全扫描
 */
export async function handleSecurityScan(
  args: { serverPath: string, projectRoot?: string },
  timer: PerformanceTimer
): Promise<any> {
  const { serverPath, projectRoot } = args;
  const securityService = new SecurityService();

  try {
    // 验证服务器路径
    if (!(await fs.pathExists(serverPath))) {
      throw new Error(`服务器文件不存在: ${serverPath}`);
    }

    toolLogger.info("开始独立安全扫描", { serverPath, projectRoot });
    
    // 执行安全扫描
    const scanResult = await securityService.scanMCPService(serverPath, projectRoot);
    
    timer.end({ 
      success: scanResult.passed, 
      score: scanResult.score,
      errorCount: scanResult.errors.length,
      warningCount: scanResult.warnings.length
    });

    // 计算安全等级
    let securityLevel = "危险";
    let recommendation = "严重安全问题，禁止部署";
    
    if (scanResult.score >= 95) {
      securityLevel = "优秀";
      recommendation = "安全性优秀，可以安全部署";
    } else if (scanResult.score >= 85) {
      securityLevel = "良好";
      recommendation = "安全性良好，可以部署";
    } else if (scanResult.score >= 70) {
      securityLevel = "一般";
      recommendation = "存在安全风险，建议修复后部署";
    } else if (scanResult.score >= 50) {
      securityLevel = "较差";
      recommendation = "安全风险较多，强烈建议修复后部署";
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          securityScanResult: {
            serverPath,
            projectRoot,
            scanTime: new Date().toISOString(),
            overall: {
              passed: scanResult.passed,
              score: scanResult.score,
              level: securityLevel,
              recommendation
            },
            summary: {
              totalErrors: scanResult.errors.length,
              totalWarnings: scanResult.warnings.length,
              criticalIssues: scanResult.errors.filter(e => 
                e.includes("危险函数") || e.includes("恶意命令") || e.includes("路径遍历")
              ).length
            },
            errors: scanResult.errors,
            warnings: scanResult.warnings,
            detailedAnalysis: {
              codeAnalysis: {
                passed: scanResult.details.codeAnalysis.passed,
                dangerousFunctions: scanResult.details.codeAnalysis.dangerousFunctions,
                suspiciousPatterns: scanResult.details.codeAnalysis.suspiciousPatterns,
                maliciousCommands: scanResult.details.codeAnalysis.maliciousCommands
              },
              dependencyCheck: {
                passed: scanResult.details.dependencyCheck.passed,
                hasPackageJson: scanResult.details.dependencyCheck.hasPackageJson,
                hasRequirementsTxt: scanResult.details.dependencyCheck.hasRequirementsTxt,
                vulnerableDependencies: scanResult.details.dependencyCheck.vulnerableDependencies,
                unspecifiedVersions: scanResult.details.dependencyCheck.unspecifiedVersions
              },
              configurationCheck: {
                passed: scanResult.details.configurationCheck.passed,
                hardcodedSecrets: scanResult.details.configurationCheck.hardcodedSecrets,
                insecureConfigs: scanResult.details.configurationCheck.insecureConfigs
              },
              permissionCheck: {
                passed: scanResult.details.permissionCheck.passed,
                fileExists: scanResult.details.permissionCheck.fileExists,
                isExecutable: scanResult.details.permissionCheck.isExecutable,
                isInSecurePath: scanResult.details.permissionCheck.isInSecurePath,
                pathTraversalRisk: scanResult.details.permissionCheck.pathTraversalRisk
              }
            },
            complianceInfo: {
              mcpDeploymentStandard: "已检查MCP部署安全标准合规性",
              securityFramework: "基于OWASP安全标准",
              scanEngine: "MCP安全扫描引擎 v1.0"
            }
          }
        }, null, 2)
      }]
    };

  } catch (error) {
    timer.end({ success: false, error: (error as Error).message });
    toolLogger.error("安全扫描失败", { serverPath, error: (error as Error).message });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `安全扫描失败: ${(error as Error).message}`,
          serverPath,
          scanTime: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
}

/**
 * 处理安全策略强制执行
 */
async function handleEnforceSecurityPolicy(
  args: { action: string, strictMode?: boolean },
  timer: PerformanceTimer
): Promise<any> {
  const { action, strictMode = false } = args;

  try {
    toolLogger.info("处理安全策略强制执行", { action, strictMode });

    const securityPolicyFile = path.join(process.cwd(), '.mcp-security-policy.json');
    
    switch (action) {
      case "enable":
        const policy = {
          enabled: true,
          strictMode,
          minSecurityScore: strictMode ? 90 : 70,
          requiredChecks: [
            "codeAnalysis",
            "dependencyCheck", 
            "configurationCheck",
            "permissionCheck"
          ],
          enforcement: {
            blockDeployment: true,
            requireApproval: !strictMode,
            auditLog: true
          },
          lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(securityPolicyFile, JSON.stringify(policy, null, 2));
        
        timer.end({ success: true, action: "enabled" });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `MCP安全策略已启用 (${strictMode ? '严格模式' : '标准模式'})`,
              policy: {
                enabled: true,
                mode: strictMode ? 'strict' : 'standard',
                minSecurityScore: policy.minSecurityScore,
                enforcement: policy.enforcement
              },
              effect: "所有后续的MCP服务部署都将强制经过安全检查",
              policyFile: securityPolicyFile
            }, null, 2)
          }]
        };

      case "disable":
        if (await fs.pathExists(securityPolicyFile)) {
          await fs.remove(securityPolicyFile);
        }
        
        timer.end({ success: true, action: "disabled" });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "MCP安全策略已禁用",
              warning: "⚠️ 禁用安全策略将允许未经安全检查的服务部署，存在安全风险",
              recommendation: "建议重新启用安全策略以保护系统安全"
            }, null, 2)
          }]
        };

      case "status":
        let currentPolicy = null;
        let enabled = false;
        
        if (await fs.pathExists(securityPolicyFile)) {
          currentPolicy = JSON.parse(await fs.readFile(securityPolicyFile, 'utf-8'));
          enabled = currentPolicy.enabled === true;
        }
        
        timer.end({ success: true, action: "status", enabled });
        
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              securityPolicy: {
                enabled,
                currentPolicy,
                status: enabled ? '✅ 安全策略已启用' : '❌ 安全策略已禁用',
                ...(enabled && {
                  mode: currentPolicy?.strictMode ? 'strict' : 'standard',
                  minSecurityScore: currentPolicy?.minSecurityScore || 70,
                  lastUpdated: currentPolicy?.lastUpdated
                })
              },
              systemStatus: {
                securityEnforcement: enabled ? '强制执行' : '未启用',
                deploymentProtection: enabled ? '已保护' : '无保护',
                auditLogging: enabled && currentPolicy?.enforcement?.auditLog ? '已启用' : '未启用'
              }
            }, null, 2)
          }]
        };

      default:
        throw new Error(`未知操作: ${action}`);
    }

  } catch (error) {
    timer.end({ success: false, error: (error as Error).message });
    toolLogger.error("安全策略操作失败", { action, error: (error as Error).message });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `安全策略操作失败: ${(error as Error).message}`,
          action
        }, null, 2)
      }]
    };
  }
}

/**
 * 处理配置保护管理
 */
export async function handleConfigProtectionManager(
  configService: ConfigService,
  args: { action: string, protectionLevel?: string, backupFile?: string },
  timer: PerformanceTimer
): Promise<any> {
  const { action, protectionLevel = "standard", backupFile } = args;

  try {
    toolLogger.info("处理配置保护管理", { action, protectionLevel, backupFile });

    const protectionConfigFile = path.join(process.cwd(), '.mcp-config-protection.json');
    
    switch (action) {
      case "enable":
        const protectionConfig = {
          enabled: true,
          level: protectionLevel,
          forceBackup: true,
          preventOverwrite: protectionLevel !== "standard",
          requireConfirmation: protectionLevel === "maximum",
          autoBackupInterval: protectionLevel === "maximum" ? 1 : 5, // 小时
          lastUpdated: new Date().toISOString(),
          settings: {
            maxBackups: protectionLevel === "maximum" ? 50 : protectionLevel === "strict" ? 20 : 10,
            backupBeforeEveryChange: true,
            validateAfterWrite: true,
            auditAllChanges: true
          }
        };
        
        await fs.writeFile(protectionConfigFile, JSON.stringify(protectionConfig, null, 2));
        
        timer.end({ success: true, action: "enabled", level: protectionLevel });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `MCP配置保护已启用 (${protectionLevel === "standard" ? "标准" : protectionLevel === "strict" ? "严格" : "最大"}模式)`,
              protection: {
                enabled: true,
                level: protectionLevel,
                features: {
                  forceBackup: "每次部署前强制创建备份",
                  preventOverwrite: protectionLevel !== "standard" ? "防止意外覆盖现有配置" : "允许覆盖但需确认",
                  requireConfirmation: protectionLevel === "maximum" ? "最高级操作需要确认" : "自动处理",
                  auditLogging: "完整的操作审计日志"
                },
                settings: protectionConfig.settings
              },
              effect: "所有后续的MCP服务部署都将应用配置保护机制",
              protectionFile: protectionConfigFile
            }, null, 2)
          }]
        };

      case "disable":
        if (await fs.pathExists(protectionConfigFile)) {
          await fs.remove(protectionConfigFile);
        }
        
        timer.end({ success: true, action: "disabled" });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "MCP配置保护已禁用",
              warning: "⚠️ 禁用配置保护将允许直接修改配置而不进行备份，存在数据丢失风险",
              recommendation: "建议重新启用配置保护以保障配置文件安全"
            }, null, 2)
          }]
        };

      case "status":
        let currentProtection = null;
        let enabled = false;
        
        if (await fs.pathExists(protectionConfigFile)) {
          currentProtection = JSON.parse(await fs.readFile(protectionConfigFile, 'utf-8'));
          enabled = currentProtection.enabled === true;
        }
        
        // 获取备份统计
        const backups = await configService.listBackups();
        const recentBackups = backups.filter(backup => {
          const backupTime = new Date(backup.timestamp);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return backupTime > dayAgo;
        });
        
        timer.end({ success: true, action: "status", enabled });
        
        return {
          content: [{
            type: "text", 
            text: JSON.stringify({
              configurationProtection: {
                enabled,
                currentProtection,
                status: enabled ? '✅ 配置保护已启用' : '❌ 配置保护已禁用',
                ...(enabled && {
                  level: currentProtection?.level || 'standard',
                  lastUpdated: currentProtection?.lastUpdated
                })
              },
              backupStatus: {
                totalBackups: backups.length,
                recentBackups: recentBackups.length,
                latestBackup: backups[0]?.timestamp || "无备份",
                backupStorage: configService.getBackupPath()
              },
              systemStatus: {
                configProtection: enabled ? '已保护' : '无保护',
                forceBackup: enabled && currentProtection?.forceBackup ? '已启用' : '未启用',
                overwriteProtection: enabled && currentProtection?.preventOverwrite ? '已启用' : '未启用'
              }
            }, null, 2)
          }]
        };

      case "list_backups":
        const allBackups = await configService.listBackups();
        
        timer.end({ success: true, action: "list_backups", count: allBackups.length });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              configurationBackups: {
                totalCount: allBackups.length,
                backupPath: configService.getBackupPath(),
                backups: allBackups.map(backup => ({
                  filename: backup.filename,
                  timestamp: backup.timestamp,
                  size: backup.size,
                  serversCount: backup.configCount,
                  age: `${Math.floor((Date.now() - new Date(backup.timestamp).getTime()) / (1000 * 60 * 60 * 24))} 天前`
                }))
              },
              usage: {
                restore: "使用 emergency_restore 操作恢复指定备份",
                manage: "系统自动管理备份文件数量和清理"
              }
            }, null, 2)
          }]
        };

      case "emergency_restore":
        if (!backupFile) {
          throw new Error("紧急恢复需要指定备份文件名");
        }
        
        const restoreResult = await configService.restoreFromBackupWithResult(backupFile);
        
        timer.end({ 
          success: restoreResult.success, 
          action: "emergency_restore", 
          backupFile 
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              emergencyRestore: {
                success: restoreResult.success,
                message: restoreResult.message,
                backupFile,
                timestamp: new Date().toISOString(),
                ...(restoreResult.errors && { errors: restoreResult.errors })
              },
              warning: restoreResult.success ? 
                "配置已从备份恢复，请重启相关服务以应用更改" : 
                "紧急恢复失败，请检查备份文件并重试",
              nextSteps: restoreResult.success ? [
                "验证恢复后的配置是否正确",
                "重启使用MCP服务的应用程序",
                "检查所有MCP服务器是否正常工作"
              ] : [
                "检查备份文件是否存在且有效",
                "确认备份文件名拼写正确",
                "如问题持续，请联系系统管理员"
              ]
            }, null, 2)
          }]
        };

      default:
        throw new Error(`未知配置保护操作: ${action}`);
    }

  } catch (error) {
    timer.end({ success: false, error: (error as Error).message });
    toolLogger.error("配置保护管理操作失败", { action, error: (error as Error).message });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `配置保护管理操作失败: ${(error as Error).message}`,
          action,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
}

/**
 * 处理构建时安全检查
 */
async function handleBuildTimeSecurityCheck(
  args: { projectPath: string, buildCommand?: string, outputPath?: string },
  timer: PerformanceTimer
): Promise<any> {
  const { projectPath, buildCommand, outputPath } = args;
  const securityService = new SecurityService();

  try {
    toolLogger.info("开始构建时安全检查", { projectPath, buildCommand, outputPath });

    // 验证项目路径
    if (!(await fs.pathExists(projectPath))) {
      throw new Error(`项目路径不存在: ${projectPath}`);
    }

    // 查找项目中的主要服务器文件
    const potentialServerFiles = [
      path.join(projectPath, 'server.js'),
      path.join(projectPath, 'server.ts'),
      path.join(projectPath, 'index.js'),
      path.join(projectPath, 'index.ts'),
      path.join(projectPath, 'src', 'server.js'),
      path.join(projectPath, 'src', 'server.ts'),
      path.join(projectPath, 'src', 'index.js'),
      path.join(projectPath, 'src', 'index.ts'),
      path.join(projectPath, 'dist', 'server.js'),
      path.join(projectPath, 'dist', 'index.js')
    ];

    const serverFiles = [];
    for (const file of potentialServerFiles) {
      if (await fs.pathExists(file)) {
        serverFiles.push(file);
      }
    }

    if (serverFiles.length === 0) {
      throw new Error("未找到MCP服务器文件，请确保项目包含 server.js 或 index.js 等入口文件");
    }

    // 执行构建前安全检查
    const preBuildResults = [];
    for (const serverFile of serverFiles) {
      const scanResult = await securityService.scanMCPService(serverFile, projectPath);
      preBuildResults.push({
        file: serverFile,
        ...scanResult
      });
    }

    // 如果提供了构建命令，执行构建
    let buildResult = null;
    if (buildCommand) {
      try {
        toolLogger.info("执行构建命令", { buildCommand, projectPath });
        
        const { spawn } = await import('child_process');
        const buildProcess = spawn(buildCommand, { 
          shell: true, 
          cwd: projectPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

                 buildResult = await new Promise<any>((resolve, reject) => {
           let stdout = '';
           let stderr = '';
           
           buildProcess.stdout?.on('data', (data) => {
             stdout += data.toString();
           });
           
           buildProcess.stderr?.on('data', (data) => {
             stderr += data.toString();
           });
           
           buildProcess.on('close', (code) => {
             resolve({
               exitCode: code,
               stdout,
               stderr,
               success: code === 0
             });
           });
           
           buildProcess.on('error', (error) => {
             reject(error);
           });
           
           // 10分钟超时
           setTimeout(() => {
             buildProcess.kill();
             reject(new Error('构建超时'));
           }, 600000);
         });

      } catch (error) {
        buildResult = {
          success: false,
          error: (error as Error).message
        };
      }
    }

    // 执行构建后安全检查（如果指定了输出路径）
    let postBuildResults = [];
    if (outputPath && await fs.pathExists(outputPath)) {
      const outputFiles = await fs.readdir(outputPath);
      const jsFiles = outputFiles.filter(file => file.endsWith('.js'));
      
      for (const file of jsFiles.slice(0, 3)) { // 限制检查前3个文件
        const fullPath = path.join(outputPath, file);
        const scanResult = await securityService.scanMCPService(fullPath, projectPath);
        postBuildResults.push({
          file: fullPath,
          ...scanResult
        });
      }
    }

    // 计算总体安全评分
    const allResults = [...preBuildResults, ...postBuildResults];
    const averageScore = allResults.reduce((sum, result) => sum + result.score, 0) / allResults.length;
    const overallPassed = allResults.every(result => result.passed);
    
    timer.end({ 
      success: true,
      overallPassed,
      averageScore,
      checkedFiles: allResults.length
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          buildTimeSecurityCheck: {
            projectPath,
            buildCommand,
            outputPath,
            checkTime: new Date().toISOString(),
            overall: {
              passed: overallPassed,
              averageScore: Math.round(averageScore),
              totalFilesChecked: allResults.length,
                             buildSuccess: buildResult ? buildResult.success !== false : true
            },
            preBuildSecurity: {
              filesChecked: preBuildResults.length,
              results: preBuildResults.map(result => ({
                file: path.basename(result.file),
                passed: result.passed,
                score: result.score,
                errorCount: result.errors.length,
                warningCount: result.warnings.length
              }))
            },
                         ...(buildResult && {
               buildProcess: {
                 success: (buildResult as any).success,
                 exitCode: (buildResult as any).exitCode,
                 hasErrors: (buildResult as any).stderr && (buildResult as any).stderr.length > 0
               }
             }),
            ...(postBuildResults.length > 0 && {
              postBuildSecurity: {
                filesChecked: postBuildResults.length,
                results: postBuildResults.map(result => ({
                  file: path.basename(result.file),
                  passed: result.passed,
                  score: result.score,
                  errorCount: result.errors.length,
                  warningCount: result.warnings.length
                }))
              }
            }),
            recommendations: [
              ...(averageScore < 70 ? ["修复所有安全问题后再进行部署"] : []),
              ...(averageScore < 85 ? ["建议提升代码安全性以达到更高标准"] : []),
              "确保所有依赖包版本固定且无已知漏洞",
              "移除任何硬编码的敏感信息",
              "在部署前使用 deploy_mcp_server 工具进行最终安全验证"
            ],
            complianceInfo: {
              mcpDeploymentStandard: "已按照MCP部署安全标准执行检查",
              buildTimeSecurity: "构建时安全检查已完成",
              nextStep: overallPassed ? "可以进行部署" : "需要修复安全问题"
            }
          }
        }, null, 2)
      }]
    };

  } catch (error) {
    timer.end({ success: false, error: (error as Error).message });
    toolLogger.error("构建时安全检查失败", { projectPath, error: (error as Error).message });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `构建时安全检查失败: ${(error as Error).message}`,
          projectPath,
          checkTime: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
}

/**
 * 处理全局安全管理器操作
 */
async function handleGlobalSecurityManager(
  args: { action: string, strictMode?: boolean, minimumScore?: number },
  timer: PerformanceTimer
): Promise<any> {
  try {
    const { GlobalSecurityManager } = await import("../services/globalSecurityManager.js");
    const globalSecurityManager = GlobalSecurityManager.getInstance();

    switch (args.action) {
      case "status":
        const status = await globalSecurityManager.getSecurityStatus();
        timer.end({ action: "status", enforced: status.globalPolicy.enforced });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              globalSecurityStatus: {
                ...status,
                message: "全局安全策略状态",
                configurationInfo: {
                  type: "global",
                  dependsOnProjectFiles: false,
                  enforceAcrossAllProjects: status.globalPolicy.enforced
                }
              }
            }, null, 2)
          }]
        };

      case "enable":
        await globalSecurityManager.enableGlobalSecurity(args.strictMode || false);
        timer.end({ action: "enable", strictMode: args.strictMode });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `全局安全策略已启用${args.strictMode ? ' (严格模式)' : ''}`,
              globalSecurityPolicy: {
                enforced: true,
                strictMode: args.strictMode || false,
                appliesTo: "所有MCP服务部署",
                independentOfProjectFiles: true
              }
            }, null, 2)
          }]
        };

      case "disable":
        await globalSecurityManager.disableGlobalSecurity();
        timer.end({ action: "disable" });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "全局安全策略已禁用 - 仅记录模式",
              warning: "安全检查仍会执行但不会阻止部署",
              globalSecurityPolicy: {
                enforced: false,
                mode: "logging_only"
              }
            }, null, 2)
          }]
        };

      case "update_policy":
        if (args.minimumScore) {
          await globalSecurityManager.updateGlobalPolicy({
            minimumScore: args.minimumScore
          });
        }
        timer.end({ action: "update_policy", minimumScore: args.minimumScore });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "全局安全策略已更新",
              updatedSettings: {
                minimumScore: args.minimumScore
              }
            }, null, 2)
          }]
        };

      case "get_standards":
        const standards = await globalSecurityManager.getGlobalStandards();
        timer.end({ action: "get_standards" });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              globalSecurityStandards: standards,
              message: "全局安全标准配置",
              note: "这些标准适用于所有项目的MCP服务部署"
            }, null, 2)
          }]
        };

      default:
        throw new Error(`未知操作: ${args.action}`);
    }

  } catch (error) {
    timer.end({ success: false, error: (error as Error).message });
    toolLogger.error("全局安全管理器操作失败", { args, error: (error as Error).message });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: `全局安全管理器操作失败: ${(error as Error).message}`,
          action: args.action
        }, null, 2)
      }]
    };
  }
}

export {
  handleDeployServer,
  handleListServers,
  handleRemoveServer,
  handleBackupConfig,
  handleRestoreConfig,
  handleValidateConfig
};

setupToolHandlers; 