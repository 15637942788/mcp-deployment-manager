import { ListToolsRequestSchema, CallToolRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import * as fs from "fs-extra";
import * as os from "os";
import ConfigService from "../services/configService.js";
import { SecurityService } from "../services/securityService.js";
import { toolLogger, logError, PerformanceTimer, configLogger } from "../utils/logger.js";
import { fileURLToPath } from 'url';
/**
 * 设置工具处理器
 */
export function setupToolHandlers(server) {
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
                    return await handleDeployServer(configService, args, timer);
                case "get_cursor_config_path":
                    return await handleGetConfigPath(configService, timer);
                case "list_mcp_servers":
                    return await handleListServers(configService, timer);
                case "remove_mcp_server":
                    return await handleRemoveServer(configService, args, timer);
                case "get_system_status":
                    return await handleGetSystemStatus(configService, timer);
                case "backup_config":
                    return await handleBackupConfig(configService, args, timer);
                case "restore_config":
                    return await handleRestoreConfig(configService, args, timer);
                case "validate_config":
                    return await handleValidateConfig(configService, timer);
                case "scan_mcp_servers":
                    return await handleScanServers(configService, args, timer);
                case "security_scan_mcp_service":
                    return await handleSecurityScan(args, timer);
                case "enforce_security_policy":
                    return await handleEnforceSecurityPolicy(args, timer);
                case "global_security_manager":
                    return await handleGlobalSecurityManager(args, timer);
                case "build_time_security_check":
                    return await handleBuildTimeSecurityCheck(args, timer);
                case "config_protection_manager":
                    return await handleConfigProtectionManager(configService, args, timer);
                default:
                    throw new Error(`未知工具: ${name}`);
            }
        }
        catch (error) {
            timer.end({ error: error.message });
            logError(error, `工具执行失败: ${name}`, { arguments: args });
            return {
                content: [{
                        type: "text",
                        text: `工具执行失败: ${error.message}`
                    }],
                isError: true
            };
        }
    });
}
/**
 * 处理部署服务器
 */
async function handleDeployServer(configService, args, timer) {
    const { name, serverPath, serverType, description, env, disabled, autoApprove, force = false } = args;
    // 验证服务器路径
    if (!(await fs.pathExists(serverPath))) {
        throw new Error(`服务器文件不存在: ${serverPath}`);
    }
    // 🔍 强制检查并确保项目级部署标准文件存在
    const deploymentRulesResult = await ensureDeploymentRules(serverPath);
    if (!deploymentRulesResult.success) {
        throw new Error(`项目级部署标准检查失败: ${deploymentRulesResult.message}`);
    }
    // 📋 使用全局安全策略 + 项目级标准文件的双重保护
    configLogger.info("项目级部署标准已确保存在，继续执行全局安全策略检查", {
        serverPath,
        projectStandardResult: deploymentRulesResult
    });
    // 构建服务器配置
    const serverConfig = {
        command: getCommandForServerType(serverType, serverPath),
        args: getArgsForServerType(serverType, serverPath),
        ...(env && { env }),
        ...(disabled !== undefined && { disabled }),
        ...(autoApprove && { autoApprove })
    };
    // 使用受保护的部署方法 - 强制安全检查和备份保护
    toolLogger.info("使用受保护的部署方法", { serverName: name, serverPath });
    const projectRoot = findProjectRoot(serverPath) || undefined;
    const result = await configService.addServerWithProtection(name, serverConfig, serverPath, projectRoot, force, false // 永远不跳过安全检查
    );
    timer.end({
        success: result.success,
        serverName: name,
        forced: force,
        securityScore: result.securityScan?.score || 0,
        backupCreated: !!result.backupInfo
    });
    // 如果部署失败，返回详细的错误信息和解决方案
    if (!result.success) {
        // 🚨 构建详细的解决方案指导
        const solutionSteps = [];
        const securityIssues = [];
        // 分析失败原因并提供对应解决方案
        if (result.errors) {
            result.errors.forEach(error => {
                if (error.includes("项目级部署标准检查失败")) {
                    solutionSteps.push("1. 📁 创建项目标准文件结构：");
                    solutionSteps.push("   mkdir -p .cursor/rules");
                    solutionSteps.push("   # 系统会自动复制标准文件到此目录");
                }
                if (error.includes("安全扫描失败") || error.includes("安全评分")) {
                    securityIssues.push(error);
                    solutionSteps.push("2. 🛡️ 修复安全问题：");
                }
                if (error.includes("危险函数")) {
                    solutionSteps.push("   - 移除危险函数调用（eval, exec, Function等）");
                }
                if (error.includes("恶意命令")) {
                    solutionSteps.push("   - 移除恶意系统命令（rm -rf, format等）");
                }
                if (error.includes("漏洞的依赖")) {
                    solutionSteps.push("   - 更新有漏洞的依赖包到安全版本");
                }
                if (error.includes("版本未固定")) {
                    solutionSteps.push("   - 在package.json中固定依赖版本（移除^和~）");
                }
                if (error.includes("硬编码")) {
                    solutionSteps.push("   - 移除硬编码的敏感信息，使用环境变量");
                }
                if (error.includes("路径遍历")) {
                    solutionSteps.push("   - 修复路径遍历风险，使用安全的文件路径");
                }
            });
        }
        // 添加通用解决步骤
        if (solutionSteps.length === 0) {
            solutionSteps.push("1. 📋 确保项目包含必要文件：");
            solutionSteps.push("   - .cursor/rules/mcp-部署标准.mdc（系统自动创建）");
            solutionSteps.push("   - package.json 或 requirements.txt");
            solutionSteps.push("   - README.md");
        }
        solutionSteps.push("3. 🔍 运行安全扫描验证：");
        solutionSteps.push("   使用 security_scan_mcp_service 工具验证修复效果");
        solutionSteps.push("4. 🚀 重新尝试部署：");
        solutionSteps.push("   修复所有问题后重新运行 deploy_mcp_server");
        // ⚠️ 防止绕过策略的警告
        const antiBypassWarning = [
            "🚨 重要警告：",
            "- 请勿尝试禁用全局安全策略绕过检查",
            "- 请勿尝试跳过项目级标准文件要求",
            "- 请勿使用不安全的force参数",
            "- 正确的做法是修复安全问题，而不是绕过安全检查",
            "",
            "✅ 推荐的解决路径：",
            "1. 根据上述步骤修复具体问题",
            "2. 确保代码符合MCP部署安全标准",
            "3. 通过安全扫描后正常部署"
        ];
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        message: result.message,
                        serverName: name,
                        configurationProtection: {
                            backupCreated: !!result.backupInfo,
                            backupFile: result.backupInfo?.filename,
                            originalConfigProtected: true,
                            protectionLevel: "强制备份与配置保护"
                        },
                        securityScan: result.securityScan ? {
                            passed: result.securityScan.passed,
                            score: result.securityScan.score,
                            errors: result.securityScan.errors,
                            warnings: result.securityScan.warnings
                        } : undefined,
                        securityDetails: result.securityScan?.details,
                        // 🎯 详细的解决方案指导
                        solutionGuide: {
                            title: "🔧 如何解决部署失败问题",
                            description: "请按照以下步骤修复问题，不要尝试绕过安全检查",
                            steps: solutionSteps,
                            antiBypassWarning: antiBypassWarning,
                            securityRequirements: [
                                "代码不能包含危险函数（eval, exec, Function等）",
                                "不能包含恶意系统命令（rm -rf, format等）",
                                "依赖包必须无已知漏洞且版本固定",
                                "不能硬编码敏感信息",
                                "必须包含项目级部署标准文件",
                                "文件路径必须安全，无遍历风险"
                            ],
                            nextSteps: [
                                "1. 修复上述安全问题",
                                "2. 运行 security_scan_mcp_service 验证",
                                "3. 确保安全评分 ≥ 70 分",
                                "4. 重新运行 deploy_mcp_server"
                            ]
                        },
                        recommendation: result.securityScan?.score && result.securityScan.score < 70
                            ? "请修复所有安全问题后重新尝试部署，不要尝试绕过安全检查"
                            : "请修复安全警告后重新部署，遵循MCP部署安全标准",
                        complianceInfo: {
                            globalSecurityPolicyEnforced: true,
                            securityStandardEnforced: true,
                            configurationProtectionEnabled: true,
                            minRequiredScore: 70,
                            recommendedScore: 85,
                            actualScore: result.securityScan?.score || 0,
                            bypassPrevention: {
                                cannotDisableGlobalPolicy: true,
                                cannotSkipProjectStandards: true,
                                cannotBypassSecurityScan: true,
                                message: "安全策略无法绕过，请修复问题而不是尝试绕过检查"
                            }
                        },
                        globalSecurityPolicy: {
                            enforced: true,
                            type: "global",
                            message: "使用全局安全策略，确保所有项目部署的一致性和安全性",
                            location: "全局配置（不依赖项目文件）",
                            cannotBeDisabled: "无法禁用，这是为了保护整个MCP生态系统的安全"
                        },
                        projectLevelStandard: {
                            required: deploymentRulesResult.projectStandardRequired || false,
                            exists: deploymentRulesResult.projectStandardExists || false,
                            synced: deploymentRulesResult.standardSynced || false,
                            message: deploymentRulesResult.message,
                            location: deploymentRulesResult.targetPath || "未知",
                            status: deploymentRulesResult.standardSynced ? "已同步最新标准" : "使用现有项目标准"
                        },
                        errors: result.errors,
                        warnings: result.warnings
                    }, null, 2)
                }]
        };
    }
    // 部署成功
    return {
        content: [{
                type: "text",
                text: JSON.stringify({
                    success: true,
                    message: result.message,
                    serverName: result.serverName,
                    serverConfig,
                    description,
                    force,
                    configurationProtection: {
                        backupCreated: !!result.backupInfo,
                        backupFile: result.backupInfo?.filename,
                        backupSize: result.backupInfo?.size,
                        originalServersCount: result.backupInfo?.configCount,
                        protectionLevel: "强制备份与配置保护已启用"
                    },
                    securityScan: result.securityScan ? {
                        passed: result.securityScan.passed,
                        score: result.securityScan.score,
                        warnings: result.securityScan.warnings
                    } : undefined,
                    complianceInfo: {
                        globalSecurityPolicyEnforced: true,
                        securityStandardEnforced: true,
                        configurationProtectionEnabled: true,
                        mcpDeploymentStandard: "所有部署均经过全局安全策略验证并强制备份保护"
                    },
                    globalSecurityPolicy: {
                        enforced: true,
                        type: "global",
                        message: "使用全局安全策略，确保所有项目部署的一致性和安全性",
                        location: "全局配置（不依赖项目文件）",
                        status: "全局强制执行"
                    },
                    projectLevelStandard: {
                        required: deploymentRulesResult.projectStandardRequired || false,
                        exists: deploymentRulesResult.projectStandardExists || false,
                        synced: deploymentRulesResult.standardSynced || false,
                        message: deploymentRulesResult.message,
                        location: deploymentRulesResult.targetPath || "未知",
                        status: deploymentRulesResult.standardSynced ? "已同步最新标准" : "使用现有项目标准"
                    },
                    ...(result.errors && { errors: result.errors }),
                    ...(result.warnings && { warnings: result.warnings })
                }, null, 2)
            }]
    };
}
/**
 * 确保部署规则文件存在（增强版）
 * 检查项目的.cursor/rules/目录下是否存在mcp-部署标准.mdc文件
 * 如果不存在，从源位置复制过来，并验证文件完整性
 */
async function ensureDeploymentRules(serverPath) {
    try {
        // 1. 找到项目根目录
        const projectRoot = findProjectRoot(serverPath);
        if (!projectRoot) {
            toolLogger.warn("无法确定项目根目录，跳过项目级标准检查", { serverPath });
            return {
                success: true,
                message: "无法确定项目根目录，跳过项目级标准检查",
                projectStandardRequired: false,
                projectStandardExists: false,
                standardSynced: false
            };
        }
        // 2. 确定目标目录和文件路径
        const targetDir = path.join(projectRoot, ".cursor", "rules");
        const targetPath = path.join(targetDir, "mcp-部署标准.mdc");
        // 修复：使用 import.meta.url 获取当前文件目录，然后构建正确的源文件路径
        const currentFileUrl = import.meta.url;
        const currentFileDir = path.dirname(fileURLToPath(currentFileUrl));
        // 从 dist/handlers 目录回到项目根目录，然后到 src/.cursor/rules
        const projectRootDir = path.resolve(currentFileDir, "..", "..");
        const sourcePath = path.join(projectRootDir, "src", ".cursor", "rules", "mcp-部署标准.mdc");
        toolLogger.info("检查项目级部署标准文件", {
            projectRoot,
            targetPath,
            sourcePath
        });
        // 3. 检查源文件是否存在
        if (!(await fs.pathExists(sourcePath))) {
            toolLogger.error("全局部署标准文件不存在", { sourcePath });
            return {
                success: false,
                message: `全局部署标准文件不存在: ${sourcePath}`,
                targetPath,
                sourcePath,
                projectStandardRequired: true,
                projectStandardExists: false,
                standardSynced: false
            };
        }
        // 4. 确保目标目录存在
        await fs.ensureDir(targetDir);
        toolLogger.info("确保.cursor/rules目录存在", { targetDir });
        let standardSynced = false;
        let projectStandardExists = await fs.pathExists(targetPath);
        // 5. 检查项目标准文件
        if (projectStandardExists) {
            // 验证现有文件的完整性
            try {
                const existingContent = await fs.readFile(targetPath, "utf-8");
                const sourceContent = await fs.readFile(sourcePath, "utf-8");
                // 检查文件是否需要更新（简单的内容长度和关键字检查）
                const needsUpdate = existingContent.length < 100 ||
                    !existingContent.includes("配置保护与备份要求") ||
                    !existingContent.includes("强制备份机制") ||
                    existingContent.length < sourceContent.length * 0.8;
                if (needsUpdate) {
                    // 备份原文件
                    const backupPath = `${targetPath}.backup.${Date.now()}`;
                    await fs.copy(targetPath, backupPath);
                    // 更新为最新版本
                    await fs.copy(sourcePath, targetPath);
                    standardSynced = true;
                    toolLogger.info("项目部署标准已更新为最新版本", {
                        targetPath,
                        backupPath,
                        reason: "文件不完整或版本过旧"
                    });
                }
            }
            catch (error) {
                // 如果读取失败，重新复制
                await fs.copy(sourcePath, targetPath);
                standardSynced = true;
                toolLogger.warn("重新创建项目部署标准文件", {
                    targetPath,
                    error: error.message
                });
            }
        }
        else {
            // 6. 复制全局标准到项目中
            await fs.copy(sourcePath, targetPath);
            standardSynced = true;
            projectStandardExists = true;
            toolLogger.info("已创建项目级部署标准文件", {
                sourcePath,
                targetPath
            });
        }
        // 7. 最终验证
        const finalExists = await fs.pathExists(targetPath);
        if (!finalExists) {
            return {
                success: false,
                message: "无法创建项目级部署标准文件",
                targetPath,
                sourcePath,
                projectStandardRequired: true,
                projectStandardExists: false,
                standardSynced
            };
        }
        const successMessage = standardSynced
            ? `项目部署标准已${projectStandardExists ? '更新' : '创建'}为最新版本（包含配置保护要求）${projectStandardExists ? '，原文件已备份' : ''}`
            : "使用现有项目部署标准文件";
        return {
            success: true,
            message: successMessage,
            targetPath,
            sourcePath,
            projectStandardRequired: true,
            projectStandardExists: true,
            standardSynced
        };
    }
    catch (error) {
        toolLogger.error("确保部署规则文件失败", {
            serverPath,
            error: error.message
        });
        return {
            success: false,
            message: `确保部署规则文件失败: ${error.message}`,
            projectStandardRequired: true,
            projectStandardExists: false,
            standardSynced: false
        };
    }
}
/**
 * 处理获取配置路径
 */
async function handleGetConfigPath(configService, timer) {
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
function getCommandForServerType(serverType, serverPath) {
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
function getArgsForServerType(serverType, serverPath) {
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
async function handleListServers(configService, timer) {
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
async function handleRemoveServer(configService, args, timer) {
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
async function handleGetSystemStatus(configService, timer) {
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
async function handleBackupConfig(configService, args, timer) {
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
async function handleRestoreConfig(configService, args, timer) {
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
async function handleValidateConfig(configService, timer) {
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
async function handleScanServers(configService, args, timer) {
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
 * 查找项目根目录
 * 从给定路径向上查找，寻找常见的项目标识文件
 */
function findProjectRoot(startPath) {
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
            }
            catch {
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
async function handleSecurityScan(args, timer) {
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
        }
        else if (scanResult.score >= 85) {
            securityLevel = "良好";
            recommendation = "安全性良好，可以部署";
        }
        else if (scanResult.score >= 70) {
            securityLevel = "一般";
            recommendation = "存在安全风险，建议修复后部署";
        }
        else if (scanResult.score >= 50) {
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
                                criticalIssues: scanResult.errors.filter(e => e.includes("危险函数") || e.includes("恶意命令") || e.includes("路径遍历")).length
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
    }
    catch (error) {
        timer.end({ success: false, error: error.message });
        toolLogger.error("安全扫描失败", { serverPath, error: error.message });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: `安全扫描失败: ${error.message}`,
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
async function handleEnforceSecurityPolicy(args, timer) {
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
    }
    catch (error) {
        timer.end({ success: false, error: error.message });
        toolLogger.error("安全策略操作失败", { action, error: error.message });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: `安全策略操作失败: ${error.message}`,
                        action
                    }, null, 2)
                }]
        };
    }
}
/**
 * 处理配置保护管理
 */
async function handleConfigProtectionManager(configService, args, timer) {
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
    }
    catch (error) {
        timer.end({ success: false, error: error.message });
        toolLogger.error("配置保护管理操作失败", { action, error: error.message });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: `配置保护管理操作失败: ${error.message}`,
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
async function handleBuildTimeSecurityCheck(args, timer) {
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
                buildResult = await new Promise((resolve, reject) => {
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
            }
            catch (error) {
                buildResult = {
                    success: false,
                    error: error.message
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
                                    success: buildResult.success,
                                    exitCode: buildResult.exitCode,
                                    hasErrors: buildResult.stderr && buildResult.stderr.length > 0
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
    }
    catch (error) {
        timer.end({ success: false, error: error.message });
        toolLogger.error("构建时安全检查失败", { projectPath, error: error.message });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: `构建时安全检查失败: ${error.message}`,
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
async function handleGlobalSecurityManager(args, timer) {
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
                // 🚨 防止绕过安全策略 - 拒绝禁用请求并提供解决方案
                timer.end({ action: "disable", blocked: true });
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                message: "拒绝禁用全局安全策略 - 这是为了保护MCP生态系统安全",
                                reason: "不允许通过禁用安全策略来绕过部署限制",
                                globalSecurityPolicy: {
                                    enforced: true,
                                    cannotBeDisabled: true,
                                    permanentlyEnabled: "全局安全策略已永久启用，无法禁用"
                                },
                                // 🎯 提供正确的解决方案指导
                                correctSolution: {
                                    title: "🔧 正确的解决方法",
                                    description: "请修复具体的安全问题，而不是尝试绕过安全检查",
                                    steps: [
                                        "1. 🔍 运行 security_scan_mcp_service 检查具体安全问题",
                                        "2. 🛠️ 根据扫描结果修复代码中的安全问题：",
                                        "   - 移除危险函数调用（eval, exec, Function等）",
                                        "   - 移除恶意系统命令（rm -rf, format等）",
                                        "   - 更新有漏洞的依赖包",
                                        "   - 固定package.json中的依赖版本",
                                        "   - 移除硬编码的敏感信息",
                                        "   - 修复路径遍历风险",
                                        "3. 📁 确保项目包含必要文件：",
                                        "   - .cursor/rules/mcp-部署标准.mdc（系统自动创建）",
                                        "   - package.json 或 requirements.txt",
                                        "   - README.md",
                                        "4. ✅ 重新运行 deploy_mcp_server 进行部署"
                                    ],
                                    securityRequirements: [
                                        "代码安全评分必须 ≥ 70 分",
                                        "不能包含危险函数和恶意命令",
                                        "依赖包必须无已知漏洞",
                                        "不能硬编码敏感信息",
                                        "必须遵循MCP部署安全标准"
                                    ]
                                },
                                // ⚠️ 防绕过警告
                                antiBypassWarning: {
                                    message: "🚨 请勿尝试以下绕过行为：",
                                    prohibitedActions: [
                                        "禁用全局安全策略",
                                        "跳过项目级标准文件检查",
                                        "强制部署不安全的代码",
                                        "修改安全配置文件",
                                        "使用不安全的force参数"
                                    ],
                                    correctApproach: "正确的做法是修复安全问题，确保代码符合安全标准"
                                },
                                helpfulTools: [
                                    "security_scan_mcp_service - 详细安全扫描",
                                    "deploy_mcp_server - 安全部署",
                                    "build_time_security_check - 构建时安全检查"
                                ]
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
    }
    catch (error) {
        timer.end({ success: false, error: error.message });
        toolLogger.error("全局安全管理器操作失败", { args, error: error.message });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: `全局安全管理器操作失败: ${error.message}`,
                        action: args.action
                    }, null, 2)
                }]
        };
    }
}
export default setupToolHandlers;
//# sourceMappingURL=tools.js.map