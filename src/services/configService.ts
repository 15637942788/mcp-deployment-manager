import fs from "fs-extra";
import * as path from "path";
import { config } from "../config/index.js";
import { configLogger, auditLog, logError, logSuccess } from "../utils/logger.js";
import { SecurityService, SecurityScanResult } from "./securityService.js";
import { GlobalSecurityManager } from "./globalSecurityManager.js";
import { 
  CursorMCPConfig, 
  MCPServerConfig, 
  BackupInfo, 
  ValidationResult,
  ConfigurationError,
  ValidationError,
  DeploymentResult
} from "../types/index.js";

/**
 * Cursor配置文件管理服务
 */
export class ConfigService {
  private cursorConfigPath: string;
  private backupDir: string;
  private globalSecurityManager: GlobalSecurityManager;

  constructor() {
    this.cursorConfigPath = config.cursor.configPath;
    this.backupDir = path.join(path.dirname(this.cursorConfigPath), "mcp-backups");
    this.globalSecurityManager = GlobalSecurityManager.getInstance();
    
    // 确保备份目录存在并初始化全局安全策略
    this.initialize();
  }

  /**
   * 初始化服务
   */
  private async initialize(): Promise<void> {
    await this.ensureBackupDirectory();
    await this.globalSecurityManager.initialize();
  }

  /**
   * 确保备份目录存在
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.backupDir);
      configLogger.debug("备份目录已创建", { path: this.backupDir });
    } catch (error) {
      logError(error as Error, "创建备份目录失败", { path: this.backupDir });
      throw new ConfigurationError("无法创建备份目录", this.backupDir);
    }
  }

  /**
   * 检查配置文件是否存在
   */
  async configExists(): Promise<boolean> {
    try {
      const exists = await fs.pathExists(this.cursorConfigPath);
      configLogger.debug("检查配置文件存在性", { 
        path: this.cursorConfigPath, 
        exists 
      });
      return exists;
    } catch (error) {
      logError(error as Error, "检查配置文件失败");
      return false;
    }
  }

  /**
   * 读取当前配置
   */
  async readConfig(): Promise<CursorMCPConfig> {
    try {
      if (!(await this.configExists())) {
        // 如果配置文件不存在，创建默认配置
        const defaultConfig: CursorMCPConfig = { mcpServers: {} };
        await this.writeConfig(defaultConfig);
        configLogger.info("创建了默认配置文件", { path: this.cursorConfigPath });
        return defaultConfig;
      }

      const content = await fs.readFile(this.cursorConfigPath, "utf-8");
      const config = JSON.parse(content) as CursorMCPConfig;
      
      configLogger.debug("成功读取配置文件", { 
        serversCount: Object.keys(config.mcpServers || {}).length 
      });
      
      return config;
    } catch (error) {
      logError(error as Error, "读取配置文件失败", { path: this.cursorConfigPath });
      throw new ConfigurationError("无法读取Cursor配置文件", this.cursorConfigPath);
    }
  }

  /**
   * 写入配置
   */
  async writeConfig(config: CursorMCPConfig, skipValidation: boolean = false): Promise<void> {
    try {
      // 验证配置
      const validation = this.validateConfig(config, skipValidation);
      if (!validation.valid && !skipValidation) {
        throw new ValidationError("配置验证失败", validation.errors);
      }

      // 确保目录存在
      await fs.ensureDir(path.dirname(this.cursorConfigPath));

      // 写入配置文件
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(this.cursorConfigPath, content, "utf-8");
      
      configLogger.info("配置文件写入成功", { 
        path: this.cursorConfigPath,
        serversCount: Object.keys(config.mcpServers || {}).length
      });

      auditLog("config_updated", {
        configPath: this.cursorConfigPath,
        serversCount: Object.keys(config.mcpServers || {}).length
      });

    } catch (error) {
      logError(error as Error, "写入配置文件失败", { path: this.cursorConfigPath });
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ConfigurationError("无法写入Cursor配置文件", this.cursorConfigPath);
    }
  }

  /**
   * 创建配置备份
   */
  async createBackup(): Promise<BackupInfo> {
    try {
      if (!(await this.configExists())) {
        throw new ConfigurationError("配置文件不存在，无法创建备份");
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFilename = `mcp-config-backup-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFilename);

      // 复制配置文件
      await fs.copy(this.cursorConfigPath, backupPath);

      // 获取文件信息
      const stats = await fs.stat(backupPath);
      const config = await this.readConfig();

      const backupInfo: BackupInfo = {
        timestamp: new Date().toISOString(),
        filename: backupFilename,
        size: stats.size,
        configCount: Object.keys(config.mcpServers || {}).length
      };

      configLogger.info("配置备份创建成功", backupInfo);
      auditLog("backup_created", backupInfo);

      // 清理旧备份
      await this.cleanupOldBackups();

      return backupInfo;
    } catch (error) {
      logError(error as Error, "创建配置备份失败");
      throw new ConfigurationError("无法创建配置备份");
    }
  }

  /**
   * 清理旧备份文件
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith("mcp-config-backup-") && file.endsWith(".json"))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 保留最新的N个备份
      const maxBackups = config.cursor.maxBackups;
      if (backupFiles.length > maxBackups) {
        const filesToDelete = backupFiles.slice(maxBackups);
        for (const file of filesToDelete) {
          await fs.remove(file.path);
          configLogger.debug("删除旧备份文件", { filename: file.name });
        }
      }
    } catch (error) {
      configLogger.warn("清理旧备份文件失败", { error: (error as Error).message });
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.startsWith("mcp-config-backup-") && file.endsWith(".json")) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          // 尝试读取备份文件获取配置数量
          let configCount = 0;
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const config = JSON.parse(content) as CursorMCPConfig;
            configCount = Object.keys(config.mcpServers || {}).length;
          } catch {
            // 忽略解析错误
          }

          backups.push({
            timestamp: stats.mtime.toISOString(),
            filename: file,
            size: stats.size,
            configCount
          });
        }
      }

      return backups.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      logError(error as Error, "列出备份文件失败");
      return [];
    }
  }

  /**
   * 从备份恢复配置
   */
  async restoreFromBackup(backupFilename: string): Promise<void> {
    try {
      const backupPath = path.join(this.backupDir, backupFilename);
      
      if (!(await fs.pathExists(backupPath))) {
        throw new ConfigurationError(`备份文件不存在: ${backupFilename}`);
      }

      // 先创建当前配置的备份
      await this.createBackup();

      // 恢复备份
      await fs.copy(backupPath, this.cursorConfigPath);

      configLogger.info("从备份恢复配置成功", { backupFilename });
      auditLog("config_restored", { backupFilename });

    } catch (error) {
      logError(error as Error, "从备份恢复配置失败", { backupFilename });
      throw new ConfigurationError("无法从备份恢复配置");
    }
  }

  /**
   * 验证配置文件格式
   */
  validateConfig(config: CursorMCPConfig, skipValidation: boolean = false): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 检查基本结构
      if (!config || typeof config !== "object") {
        errors.push("配置必须是有效的JSON对象");
        return { valid: false, errors, warnings };
      }

      if (!config.mcpServers) {
        warnings.push("缺少mcpServers字段，将创建空配置");
        config.mcpServers = {};
      }

      if (typeof config.mcpServers !== "object") {
        errors.push("mcpServers必须是对象");
        return { valid: false, errors, warnings };
      }

      // 验证每个服务器配置
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        const serverErrors = this.validateServerConfig(serverName, serverConfig, skipValidation);
        errors.push(...serverErrors);
      }

      const valid = errors.length === 0;
      
      configLogger.debug("配置验证完成", { 
        valid, 
        errors: errors.length, 
        warnings: warnings.length 
      });

      return { valid, errors, warnings };

    } catch (error) {
      errors.push(`配置验证异常: ${(error as Error).message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * 验证单个服务器配置
   */
  private validateServerConfig(name: string, config: MCPServerConfig, skipValidation: boolean = false): string[] {
    const errors: string[] = [];

    if (!config.command || typeof config.command !== "string") {
      errors.push(`服务器 "${name}": command字段必须是非空字符串`);
    } else if (!skipValidation) {
      // 安全检查：验证命令是否为允许的类型
      const allowedCommands = ["node", "python", "npx", "python3", "cmd", "docker", "java", "go", "rust"];
      const isAbsolutePath = /^[A-Z]:\\|^\//.test(config.command);
      
      if (!allowedCommands.includes(config.command) && !isAbsolutePath) {
        errors.push(`服务器 "${name}": 不允许的命令类型 "${config.command}"，只允许: ${allowedCommands.join(", ")} 或绝对路径`);
      }

      // 检查真正危险的命令 - 移除 cmd 和 docker，添加更合理的检查
      const dangerousCommands = ["powershell", "bash", "sh", "eval", "exec"];
      if (dangerousCommands.includes(config.command.toLowerCase())) {
        errors.push(`服务器 "${name}": 检测到危险命令 "${config.command}"，可能存在安全风险`);
      }
    }

    if (!Array.isArray(config.args)) {
      errors.push(`服务器 "${name}": args字段必须是数组`);
    } else if (!skipValidation) {
      config.args.forEach((arg, index) => {
        if (typeof arg !== "string") {
          errors.push(`服务器 "${name}": args[${index}]必须是字符串`);
        } else {
          // 安全检查：检查参数中是否包含危险内容 - 但排除常见的容器参数
          if (this.containsDangerousContent(arg) && !this.isDockerParameter(arg)) {
            errors.push(`服务器 "${name}": args[${index}]包含潜在危险内容`);
          }

          // 路径遍历检查 - 但允许合法的相对路径
          if ((arg.includes("..") || arg.includes("~")) && !this.isLegitimateRelativePath(arg)) {
            errors.push(`服务器 "${name}": args[${index}]包含路径遍历字符，存在安全风险`);
          }
        }
      });
    }

    if (config.env && typeof config.env !== "object") {
      errors.push(`服务器 "${name}": env字段必须是对象`);
    } else if (config.env && !skipValidation) {
      // 安全检查：验证环境变量
      for (const [key, value] of Object.entries(config.env)) {
        if (typeof value !== "string") {
          errors.push(`服务器 "${name}": 环境变量 ${key} 的值必须是字符串`);
        }

        // 检查是否包含敏感信息模式 - 但允许开发环境的常见模式
        if (this.looksLikeSensitiveData(key, value) && !this.isCommonDevEnvVar(key)) {
          errors.push(`服务器 "${name}": 环境变量 ${key} 疑似包含敏感信息，建议通过安全方式传递`);
        }

        // 检查危险的环境变量名称 - 放松限制
        const dangerousEnvVars = ["LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"];
        if (dangerousEnvVars.includes(key.toUpperCase())) {
          errors.push(`服务器 "${name}": 环境变量 ${key} 可能影响系统安全，不建议设置`);
        }
      }
    }

    if (config.disabled !== undefined && typeof config.disabled !== "boolean") {
      errors.push(`服务器 "${name}": disabled字段必须是布尔值`);
    }

    if (config.autoApprove && !Array.isArray(config.autoApprove)) {
      errors.push(`服务器 "${name}": autoApprove字段必须是数组`);
    } else if (config.autoApprove) {
      // 安全检查：限制自动批准的工具
      const dangerousTools = ["exec", "eval", "system", "shell", "file_delete", "admin"];
      config.autoApprove.forEach((tool, index) => {
        if (typeof tool !== "string") {
          errors.push(`服务器 "${name}": autoApprove[${index}]必须是字符串`);
        } else if (dangerousTools.some(dangerous => tool.toLowerCase().includes(dangerous))) {
          errors.push(`服务器 "${name}": autoApprove包含潜在危险工具 "${tool}"，不建议自动批准`);
        }
      });
    }

    return errors;
  }

  /**
   * 检查内容是否包含危险字符或模式
   */
  private containsDangerousContent(content: string): boolean {
    const dangerousPatterns = [
      /[;&|`$(){}[\]]/,  // Shell特殊字符
      /\b(rm|del|format|mkfs|dd)\b/i,  // 危险命令
      /\b(eval|exec|system)\b/i,  // 代码执行函数
      /(\.\.\/|\.\.\\)/,  // 路径遍历
      /\b(sudo|su|runas)\b/i,  // 权限提升
    ];

    return dangerousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否为合法的 Docker 参数
   */
  private isDockerParameter(arg: string): boolean {
    const dockerParams = [
      /^-[a-zA-Z]$/, // 单字符参数 -i, -t 等
      /^--[a-zA-Z-]+$/, // 长参数 --rm, --env 等
      /^[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$/, // 镜像名:标签
      /^ghcr\.io\//, // GitHub Container Registry
      /^docker\.io\//, // Docker Hub
      /^[A-Z_]+=[^;|&`$]*$/, // 环境变量格式
    ];

    return dockerParams.some(pattern => pattern.test(arg));
  }

  /**
   * 检查是否为合法的相对路径
   */
  private isLegitimateRelativePath(arg: string): boolean {
    // 允许的相对路径模式
    const legitimatePatterns = [
      /^\.\/[a-zA-Z0-9._/-]+$/, // ./relative/path
      /^\.\.\/[a-zA-Z0-9._/-]+$/, // ../relative/path (一级向上)
      /^~\/[a-zA-Z0-9._/-]+$/, // ~/home/path
    ];

    // 不允许的危险模式
    const dangerousPatterns = [
      /\.\.\/\.\.\//, // 多级向上遍历
      /~\/\.\.\//, // 从家目录向上遍历
    ];

    const isLegitimate = legitimatePatterns.some(pattern => pattern.test(arg));
    const isDangerous = dangerousPatterns.some(pattern => pattern.test(arg));

    return isLegitimate && !isDangerous;
  }

  /**
   * 检查是否看起来像敏感数据
   */
  private looksLikeSensitiveData(key: string, value: string): boolean {
    const sensitiveKeyPatterns = [
      /password/i,
      /passwd/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
    ];

    const looksLikeSecret = value.length > 16 && /^[A-Za-z0-9+/=]+$/.test(value); // Base64-like
    const looksLikeApiKey = value.length > 20 && /^[A-Za-z0-9_-]+$/.test(value);
    const containsSensitiveKeyword = sensitiveKeyPatterns.some(pattern => pattern.test(key));

    return containsSensitiveKeyword && (looksLikeSecret || looksLikeApiKey);
  }

  /**
   * 检查是否为常见的开发环境变量
   */
  private isCommonDevEnvVar(key: string): boolean {
    const commonDevEnvVars = [
      'NODE_ENV',
      'LOG_LEVEL', 
      'DEBUG',
      'PORT',
      'HOST',
      'PATH',
      'NODE_OPTIONS',
      'GITHUB_PERSONAL_ACCESS_TOKEN', // GitHub token 在开发中很常见
      'OPENAI_API_KEY', // OpenAI API Key 在AI项目中常见
    ];

    return commonDevEnvVars.some(envVar => key.toUpperCase().includes(envVar.toUpperCase()));
  }

  /**
   * 添加或更新服务器配置（带强制安全检查）
   */
  async addServer(name: string, serverConfig: MCPServerConfig, force: boolean = false): Promise<DeploymentResult> {
    try {
      // 读取当前配置
      const currentConfig = await this.readConfig();

      // 检查名称冲突 - 新增保护机制
      if (currentConfig.mcpServers[name] && !force) {
        configLogger.warn("服务器名称已存在，拒绝覆盖", { serverName: name });
        
        return {
          success: false,
          message: `服务器 "${name}" 已存在，拒绝覆盖。如果确实要覆盖，请使用 force 选项`,
          errors: [`服务器名称冲突: "${name}" 已经存在于配置中`],
          warnings: [
            "为了安全起见，系统拒绝覆盖现有的MCP服务器配置",
            "如果确实需要更新此服务器，请先使用 remove_mcp_server 移除现有配置",
            "或者在部署参数中设置 force: true 来强制覆盖"
          ]
        };
      }

      // 创建备份（在确认可以部署后再备份）
      if (config.cursor.backupEnabled) {
        await this.createBackup();
      }

      // 记录是否为覆盖操作
      const isOverwrite = !!currentConfig.mcpServers[name];
      
      if (isOverwrite && force) {
        configLogger.warn("强制覆盖现有服务器配置", { serverName: name });
      }

      // 添加新服务器
      currentConfig.mcpServers[name] = serverConfig;

      // 写入配置
      await this.writeConfig(currentConfig);

      const message = isOverwrite 
        ? `服务器 "${name}" 已强制覆盖更新` 
        : `服务器 "${name}" 部署成功`;

      logSuccess(`MCP服务器${isOverwrite ? '覆盖' : '部署'}成功`, { 
        serverName: name, 
        command: serverConfig.command,
        isOverwrite,
        forced: force 
      });

      auditLog(isOverwrite ? "server_overwritten" : "server_deployed", {
        serverName: name,
        config: serverConfig,
        forced: force
      });

      return {
        success: true,
        message,
        serverName: name,
        ...(isOverwrite && { warnings: [`已覆盖现有服务器 "${name}" 的配置`] })
      };

    } catch (error) {
      logError(error as Error, "添加服务器配置失败", { serverName: name });
      
      return {
        success: false,
        message: `部署服务器失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 强制备份和配置保护的添加服务器方法
   * 确保原有配置安全且强制备份
   */
  async addServerWithProtection(
    name: string, 
    serverConfig: MCPServerConfig, 
    serverPath: string,
    projectRoot?: string,
    force: boolean = false,
    _skipSecurity: boolean = false, // 已弃用：现在总是执行全局安全检查
    skipValidation: boolean = false // 跳过配置验证
  ): Promise<DeploymentResult & { securityScan?: SecurityScanResult; backupInfo?: BackupInfo }> {
    try {
      configLogger.info("开始受保护的服务器部署", { serverName: name, serverPath });

      // 读取当前配置状态
      const currentConfig = await this.readConfig();
      const hasExistingServer = !!currentConfig.mcpServers[name];

      // 🔒 强制备份机制 - 无论配置如何都必须备份
      let backupInfo: BackupInfo;
      try {
        configLogger.info("强制创建配置备份", { serverName: name });
        backupInfo = await this.createBackup();
        configLogger.info("配置备份创建成功", { 
          backupFile: backupInfo.filename,
          existingServers: backupInfo.configCount
        });
      } catch (error) {
        configLogger.error("强制备份失败，拒绝部署", { 
          serverName: name, 
          error: (error as Error).message 
        });
        return {
          success: false,
          message: "创建配置备份失败，为保护现有配置拒绝部署",
          errors: [
            "无法创建配置备份",
            (error as Error).message,
            "部署已被阻止以保护现有配置的安全"
          ]
        };
      }

      // 🛡️ 原有配置保护检查
      if (hasExistingServer && !force) {
        configLogger.warn("检测到现有服务器配置，执行保护机制", { 
          serverName: name,
          existingConfig: currentConfig.mcpServers[name] 
        });

        return {
          success: false,
          message: `服务器 "${name}" 已存在，为保护原有配置拒绝覆盖`,
          errors: [
            `服务器 "${name}" 在当前配置中已存在`,
            "原有配置受到保护，不允许意外覆盖"
          ],
          warnings: [
            "这是一个安全保护机制，防止意外覆盖重要的服务器配置",
            "如果确实需要更新此服务器，请执行以下步骤：",
            "1. 使用 remove_mcp_server 先移除现有配置",
            "2. 重新部署新的服务器配置",
            "3. 或者在部署参数中设置 force: true 来强制覆盖（谨慎使用）"
          ],
          backupInfo
        };
      }

      // 🔍 强制执行全局安全策略检查（永远不能跳过）
      configLogger.info("执行全局安全策略检查", { serverName: name, serverPath });
      const globalSecurityResult = await this.globalSecurityManager.enforceGlobalSecurity(serverPath, projectRoot);

      if (!globalSecurityResult.success) {
        configLogger.error("全局安全策略检查失败，拒绝部署", { 
          serverName: name, 
          score: globalSecurityResult.securityScan.score,
          policyEnforced: globalSecurityResult.policyEnforced,
          message: globalSecurityResult.message
        });

        return {
          success: false,
          message: `全局安全策略检查失败: ${globalSecurityResult.message}`,
          errors: [
            "未通过全局MCP安全策略检查",
            globalSecurityResult.message,
            ...globalSecurityResult.securityScan.errors
          ],
          warnings: globalSecurityResult.securityScan.warnings,
          securityScan: globalSecurityResult.securityScan,
          backupInfo
        };
      }

      configLogger.info("全局安全策略检查通过，允许部署", { 
        serverName: name, 
        score: globalSecurityResult.securityScan.score,
        policyEnforced: globalSecurityResult.policyEnforced
      });

      // 🚀 执行受保护的服务器添加
      const result = await this.addServerProtected(name, serverConfig, force, hasExistingServer, skipValidation);
      
      return {
        ...result,
        securityScan: globalSecurityResult.securityScan,
        backupInfo
      };

    } catch (error) {
      logError(error as Error, "受保护的服务器部署失败", { serverName: name, serverPath });
      
      return {
        success: false,
        message: `受保护的服务器部署失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 受保护的服务器添加方法
   * 在确保备份和检查完成后执行实际的添加操作
   */
  private async addServerProtected(
    name: string, 
    serverConfig: MCPServerConfig, 
    force: boolean, 
    isOverwrite: boolean,
    skipValidation: boolean = false
  ): Promise<DeploymentResult> {
    try {
      // 读取当前配置
      const currentConfig = await this.readConfig();

      // 记录操作前的状态
      const preOperationState = {
        serverCount: Object.keys(currentConfig.mcpServers).length,
        serverExists: !!currentConfig.mcpServers[name],
        timestamp: new Date().toISOString()
      };

      configLogger.info("执行受保护的服务器添加", { 
        serverName: name,
        isOverwrite,
        forced: force,
        preState: preOperationState
      });

      // 执行配置更新
      currentConfig.mcpServers[name] = serverConfig;

      // 📝 原子性写入配置
      await this.writeConfig(currentConfig, skipValidation);

      // 验证写入结果
      const postConfig = await this.readConfig();
      if (!postConfig.mcpServers[name]) {
        throw new Error("配置写入验证失败，服务器配置未正确保存");
      }

      const message = isOverwrite 
        ? `服务器 "${name}" 已安全更新（原配置已备份）` 
        : `服务器 "${name}" 已安全部署`;

      logSuccess(`MCP服务器${isOverwrite ? '安全更新' : '安全部署'}成功`, { 
        serverName: name, 
        command: serverConfig.command,
        isOverwrite,
        forced: force,
        protected: true
      });

      auditLog(isOverwrite ? "server_protected_update" : "server_protected_deploy", {
        serverName: name,
        config: serverConfig,
        forced: force,
        preOperationState,
        postOperationState: {
          serverCount: Object.keys(postConfig.mcpServers).length,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        message,
        serverName: name,
        ...(isOverwrite && { 
          warnings: [`已安全覆盖现有服务器 "${name}" 的配置，原配置已备份`] 
        })
      };

    } catch (error) {
      logError(error as Error, "受保护的服务器添加失败", { serverName: name });
      
      return {
        success: false,
        message: `受保护的服务器添加失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 添加服务器配置（带安全检查的安全方法）
   * 强制要求所有部署都经过安全扫描
   */
  async addServerWithSecurity(
    name: string, 
    serverConfig: MCPServerConfig, 
    serverPath: string,
    projectRoot?: string,
    force: boolean = false,
    skipSecurity: boolean = false
  ): Promise<DeploymentResult & { securityScan?: SecurityScanResult }> {
    try {
      configLogger.info("开始安全部署流程", { serverName: name, serverPath, skipSecurity });

      // 除非明确跳过，否则强制执行安全检查
      if (!skipSecurity) {
        const securityService = new SecurityService();
        
        configLogger.info("执行强制安全扫描", { serverName: name, serverPath });
        const securityScanResult = await securityService.scanMCPService(serverPath, projectRoot);

        // 严格的安全门禁检查
        if (!securityScanResult.passed) {
          configLogger.error("安全扫描失败，拒绝部署", { 
            serverName: name, 
            score: securityScanResult.score,
            errors: securityScanResult.errors 
          });

          return {
            success: false,
            message: "安全扫描失败，根据MCP部署安全标准拒绝部署此服务",
            errors: [
              "服务未通过安全扫描",
              ...securityScanResult.errors
            ],
            warnings: securityScanResult.warnings,
            securityScan: securityScanResult
          };
        }

        // 如果安全评分较低且未强制部署，则拒绝
        if (securityScanResult.score < 70) {
          configLogger.warn("安全评分过低，拒绝部署", { 
            serverName: name, 
            score: securityScanResult.score 
          });

          return {
            success: false,
            message: `安全评分过低 (${securityScanResult.score}/100)，不符合MCP部署安全标准`,
            errors: [
              `安全评分 ${securityScanResult.score} 低于最低要求 70 分`,
              "服务存在严重安全风险，禁止部署"
            ],
            warnings: securityScanResult.warnings,
            securityScan: securityScanResult
          };
        }

        // 评分较低但可以强制部署
        if (securityScanResult.score < 85 && !force) {
          configLogger.warn("安全评分较低，建议修复后部署", { 
            serverName: name, 
            score: securityScanResult.score 
          });

          return {
            success: false,
            message: `安全评分较低 (${securityScanResult.score}/100)，建议修复安全问题后再部署。如确需部署，请使用 force: true 参数`,
            warnings: [
              `安全评分 ${securityScanResult.score} 低于推荐值 85 分`,
              "建议修复安全警告后重新部署",
              ...securityScanResult.warnings
            ],
            securityScan: securityScanResult
          };
        }

        configLogger.info("安全扫描通过，允许部署", { 
          serverName: name, 
          score: securityScanResult.score 
        });

        // 执行实际的服务器添加
        const result = await this.addServer(name, serverConfig, force);
        
        return {
          ...result,
          securityScan: securityScanResult
        };

      } else {
        configLogger.warn("跳过安全检查，直接部署", { serverName: name });
        // 如果跳过安全检查，直接调用原有方法
        return await this.addServer(name, serverConfig, force);
      }

    } catch (error) {
      logError(error as Error, "安全部署失败", { serverName: name, serverPath });
      
      return {
        success: false,
        message: `安全部署失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 移除服务器配置
   */
  async removeServer(name: string): Promise<DeploymentResult> {
    try {
      // 创建备份
      if (config.cursor.backupEnabled) {
        await this.createBackup();
      }

      // 读取当前配置
      const currentConfig = await this.readConfig();

      if (!currentConfig.mcpServers[name]) {
        return {
          success: false,
          message: `服务器 "${name}" 不存在`,
          warnings: [`服务器 "${name}" 未在配置中找到`]
        };
      }

      // 删除服务器
      delete currentConfig.mcpServers[name];

      // 写入配置
      await this.writeConfig(currentConfig);

      logSuccess("MCP服务器移除成功", { serverName: name });

      auditLog("server_removed", { serverName: name });

      return {
        success: true,
        message: `服务器 "${name}" 已移除`,
        serverName: name
      };

    } catch (error) {
      logError(error as Error, "移除服务器配置失败", { serverName: name });
      
      return {
        success: false,
        message: `移除服务器失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 获取配置路径（用于存储）
   */
  getConfigPath(): string {
    return this.cursorConfigPath;
  }

  /**
   * 获取备份目录路径
   */
  getBackupPath(): string {
    return this.backupDir;
  }

  /**
   * 列出所有服务器
   */
  async listServers(): Promise<Array<{name: string, config: MCPServerConfig}>> {
    try {
      const config = await this.readConfig();
      return Object.entries(config.mcpServers).map(([name, serverConfig]) => ({
        name,
        config: serverConfig
      }));
    } catch (error) {
      logError(error as Error, "列出服务器失败");
      return [];
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<any> {
    try {
      const configExists = await this.configExists();
      const config = configExists ? await this.readConfig() : { mcpServers: {} };
      const backups = await this.listBackups();

      return {
        cursorConfigPath: this.cursorConfigPath,
        configExists,
        serversCount: Object.keys(config.mcpServers).length,
        backupsCount: backups.length,
                 lastBackup: backups.length > 0 ? backups[0]?.timestamp : null,
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logError(error as Error, "获取系统状态失败");
      throw error;
    }
  }

  /**
   * 创建配置备份（带注释）
   */
  async createBackupWithResult(_comment?: string): Promise<{ success: boolean, message: string, backupPath?: string, errors?: string[] }> {
    try {
      const backupInfo = await this.createBackup();
      const backupPath = path.join(this.backupDir, backupInfo.filename);
      
      return {
        success: true,
        message: `备份创建成功: ${backupInfo.filename}`,
        backupPath
      };
    } catch (error) {
      return {
        success: false,
        message: `创建备份失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 从备份恢复配置（返回结果）
   */
  async restoreFromBackupWithResult(backupFile: string): Promise<{ success: boolean, message: string, errors?: string[] }> {
    try {
      await this.restoreFromBackup(backupFile);
      return {
        success: true,
        message: `从备份 ${backupFile} 恢复配置成功`
      };
    } catch (error) {
      return {
        success: false,
        message: `恢复配置失败: ${(error as Error).message}`,
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * 验证当前配置文件
   */
  async validateCurrentConfig(): Promise<ValidationResult> {
    try {
      const config = await this.readConfig();
      return this.validateConfig(config);
    } catch (error) {
      return {
        valid: false,
        errors: [`读取配置失败: ${(error as Error).message}`],
        warnings: []
      };
    }
  }

  /**
   * 扫描目录查找MCP服务器
   */
  async scanDirectory(directory: string): Promise<{ servers: Array<{name: string, path: string, type: string}> }> {
    try {
      const servers: Array<{name: string, path: string, type: string}> = [];
      
      if (!(await fs.pathExists(directory))) {
        return { servers };
      }

      const files = await fs.readdir(directory, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(directory, file.name);
          const ext = path.extname(file.name);
          
          // 检查是否是潜在的MCP服务器
          if (ext === '.js' && (file.name.includes('server') || file.name.includes('mcp'))) {
            servers.push({
              name: path.basename(file.name, ext),
              path: filePath,
              type: 'node'
            });
          } else if (ext === '.py' && (file.name.includes('server') || file.name.includes('mcp'))) {
            servers.push({
              name: path.basename(file.name, ext),
              path: filePath,
              type: 'python'
            });
          }
        }
      }

      return { servers };
    } catch (error) {
      logError(error as Error, "扫描目录失败", { directory });
      return { servers: [] };
    }
  }
}

export default ConfigService; 