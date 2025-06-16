import fs from "fs-extra";
import * as path from "path";
import { logger } from "../utils/logger.js";

export interface SecurityScanResult {
  passed: boolean;
  score: number; // 0-100 安全评分
  warnings: string[];
  errors: string[];
  details: {
    codeAnalysis: CodeAnalysisResult;
    dependencyCheck: DependencyCheckResult;
    configurationCheck: ConfigurationCheckResult;
    permissionCheck: PermissionCheckResult;
  };
}

export interface CodeAnalysisResult {
  passed: boolean;
  dangerousFunctions: string[];
  suspiciousPatterns: string[];
  maliciousCommands: string[];
}

export interface DependencyCheckResult {
  passed: boolean;
  hasPackageJson: boolean;
  hasRequirementsTxt: boolean;
  vulnerableDependencies: string[];
  unspecifiedVersions: string[];
}

export interface ConfigurationCheckResult {
  passed: boolean;
  hardcodedSecrets: string[];
  insecureConfigs: string[];
}

export interface PermissionCheckResult {
  passed: boolean;
  fileExists: boolean;
  isExecutable: boolean;
  isInSecurePath: boolean;
  pathTraversalRisk: boolean;
}

/**
 * MCP服务安全扫描服务
 */
export class SecurityService {
  
  /**
   * 执行完整的安全扫描
   */
  async scanMCPService(serverPath: string, projectRoot?: string): Promise<SecurityScanResult> {
    logger.info("开始安全扫描", { serverPath, projectRoot });

    const codeAnalysis = await this.analyzeCode(serverPath, projectRoot);
    const dependencyCheck = await this.checkDependencies(projectRoot || path.dirname(serverPath));
    const configurationCheck = await this.checkConfiguration(serverPath, projectRoot);
    const permissionCheck = await this.checkPermissions(serverPath);

    const allChecks = [codeAnalysis, dependencyCheck, configurationCheck, permissionCheck];
    const passed = allChecks.every(check => check.passed);
    
    // 计算安全评分
    const score = this.calculateSecurityScore(codeAnalysis, dependencyCheck, configurationCheck, permissionCheck);

    const warnings: string[] = [];
    const errors: string[] = [];

    if (!codeAnalysis.passed) {
      errors.push("代码安全检查失败");
      if (codeAnalysis.dangerousFunctions.length > 0) {
        errors.push(`发现危险函数: ${codeAnalysis.dangerousFunctions.join(", ")}`);
      }
      if (codeAnalysis.maliciousCommands.length > 0) {
        errors.push(`发现恶意命令: ${codeAnalysis.maliciousCommands.join(", ")}`);
      }
    }

    if (!dependencyCheck.passed) {
      if (dependencyCheck.vulnerableDependencies.length > 0) {
        errors.push(`发现有漏洞的依赖: ${dependencyCheck.vulnerableDependencies.join(", ")}`);
      }
      if (dependencyCheck.unspecifiedVersions.length > 0) {
        warnings.push(`依赖版本未固定: ${dependencyCheck.unspecifiedVersions.join(", ")}`);
      }
    }

    if (!configurationCheck.passed) {
      if (configurationCheck.hardcodedSecrets.length > 0) {
        errors.push("发现硬编码的敏感信息");
      }
    }

    if (!permissionCheck.passed) {
      if (!permissionCheck.fileExists) {
        errors.push("服务器文件不存在");
      }
      if (permissionCheck.pathTraversalRisk) {
        errors.push("检测到路径遍历风险");
      }
      if (!permissionCheck.isInSecurePath) {
        warnings.push("服务器文件不在安全路径中");
      }
    }

    const result: SecurityScanResult = {
      passed,
      score,
      warnings,
      errors,
      details: {
        codeAnalysis,
        dependencyCheck,
        configurationCheck,
        permissionCheck
      }
    };

    logger.info("安全扫描完成", { 
      passed, 
      score, 
      warningsCount: warnings.length, 
      errorsCount: errors.length 
    });

    return result;
  }

  /**
   * 代码安全分析
   */
  private async analyzeCode(serverPath: string, projectRoot?: string): Promise<CodeAnalysisResult> {
    const dangerousFunctions: string[] = [];
    const suspiciousPatterns: string[] = [];
    const maliciousCommands: string[] = [];

    try {
      // 分析主文件
      await this.analyzeFile(serverPath, dangerousFunctions, suspiciousPatterns, maliciousCommands);

      // 如果有项目根目录，分析项目中的其他文件
      if (projectRoot && await fs.pathExists(projectRoot)) {
        const files = await this.getCodeFiles(projectRoot);
        for (const file of files) {
          await this.analyzeFile(file, dangerousFunctions, suspiciousPatterns, maliciousCommands);
        }
      }

    } catch (error) {
      logger.error("代码分析失败", { error: (error as Error).message });
      return {
        passed: false,
        dangerousFunctions: ["代码分析失败"],
        suspiciousPatterns: [],
        maliciousCommands: []
      };
    }

    const passed = dangerousFunctions.length === 0 && maliciousCommands.length === 0;

    return {
      passed,
      dangerousFunctions,
      suspiciousPatterns,
      maliciousCommands
    };
  }

  /**
   * 分析单个文件
   */
  private async analyzeFile(filePath: string, dangerousFunctions: string[], suspiciousPatterns: string[], maliciousCommands: string[]): Promise<void> {
    if (!await fs.pathExists(filePath)) {
      return;
    }

    const content = await fs.readFile(filePath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();

    // JavaScript/TypeScript 危险函数检查
    if ([".js", ".ts", ".mjs"].includes(ext)) {
      this.checkJavaScriptDangers(content, filePath, dangerousFunctions, suspiciousPatterns, maliciousCommands);
    }

    // Python 危险函数检查
    if ([".py"].includes(ext)) {
      this.checkPythonDangers(content, filePath, dangerousFunctions, suspiciousPatterns, maliciousCommands);
    }

    // 通用危险模式检查
    this.checkCommonDangers(content, filePath, suspiciousPatterns, maliciousCommands);
  }

  /**
   * 检查JavaScript/TypeScript危险代码
   */
  private checkJavaScriptDangers(content: string, filePath: string, dangerousFunctions: string[], suspiciousPatterns: string[], maliciousCommands: string[]): void {
    const jsPatterns = [
      { pattern: /\beval\s*\(/, message: "eval()函数", type: "dangerous" },
      { pattern: /new\s+Function\s*\(/, message: "Function()构造器", type: "dangerous" },
      { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/, message: "child_process模块", type: "suspicious" },
      { pattern: /\.exec\s*\(/, message: "exec()方法", type: "suspicious" },
      { pattern: /\.spawn\s*\(/, message: "spawn()方法", type: "suspicious" },
      { pattern: /process\.exit\s*\(/, message: "process.exit()", type: "suspicious" },
      { pattern: /fs\.unlinkSync|fs\.rmSync|fs\.rmdirSync/, message: "文件删除操作", type: "suspicious" },
      { pattern: /rm\s+-rf|del\s+\/s|format\s+c:/i, message: "危险系统命令", type: "malicious" }
    ];

    for (const { pattern, message, type } of jsPatterns) {
      if (pattern.test(content)) {
        const location = `${path.basename(filePath)}`;
        if (type === "dangerous") {
          dangerousFunctions.push(`${message} 在 ${location}`);
        } else if (type === "suspicious") {
          suspiciousPatterns.push(`${message} 在 ${location}`);
        } else if (type === "malicious") {
          maliciousCommands.push(`${message} 在 ${location}`);
        }
      }
    }
  }

  /**
   * 检查Python危险代码
   */
  private checkPythonDangers(content: string, filePath: string, dangerousFunctions: string[], suspiciousPatterns: string[], maliciousCommands: string[]): void {
    const pythonPatterns = [
      { pattern: /\beval\s*\(/, message: "eval()函数", type: "dangerous" },
      { pattern: /\bexec\s*\(/, message: "exec()函数", type: "dangerous" },
      { pattern: /os\.system\s*\(/, message: "os.system()", type: "suspicious" },
      { pattern: /subprocess\.call.*shell\s*=\s*True/, message: "subprocess with shell=True", type: "suspicious" },
      { pattern: /import\s+subprocess/, message: "subprocess模块", type: "suspicious" },
      { pattern: /rm\s+-rf|del\s+\/s|format\s+c:/i, message: "危险系统命令", type: "malicious" }
    ];

    for (const { pattern, message, type } of pythonPatterns) {
      if (pattern.test(content)) {
        const location = `${path.basename(filePath)}`;
        if (type === "dangerous") {
          dangerousFunctions.push(`${message} 在 ${location}`);
        } else if (type === "suspicious") {
          suspiciousPatterns.push(`${message} 在 ${location}`);
        } else if (type === "malicious") {
          maliciousCommands.push(`${message} 在 ${location}`);
        }
      }
    }
  }

  /**
   * 检查通用危险模式
   */
  private checkCommonDangers(content: string, filePath: string, suspiciousPatterns: string[], maliciousCommands: string[]): void {
    const commonPatterns = [
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]|api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, message: "硬编码密码或API密钥", type: "suspicious" },
      { pattern: /nmap|masscan|sqlmap|nikto/i, message: "网络扫描工具", type: "malicious" },
      { pattern: /ddos|flood|attack/i, message: "攻击相关代码", type: "malicious" },
      { pattern: /\/etc\/passwd|\/etc\/shadow|C:\\Windows\\System32/i, message: "访问系统文件", type: "malicious" }
    ];

    for (const { pattern, message, type } of commonPatterns) {
      if (pattern.test(content)) {
        const location = `${path.basename(filePath)}`;
        if (type === "suspicious") {
          suspiciousPatterns.push(`${message} 在 ${location}`);
        } else if (type === "malicious") {
          maliciousCommands.push(`${message} 在 ${location}`);
        }
      }
    }
  }

  /**
   * 获取项目中的代码文件
   */
  private async getCodeFiles(projectRoot: string): Promise<string[]> {
    const files: string[] = [];
    const codeExtensions = [".js", ".ts", ".py", ".mjs", ".jsx", ".tsx"];

    const scan = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 3) return; // 限制扫描深度

      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          await scan(fullPath, depth + 1);
        } else if (entry.isFile() && codeExtensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    };

    try {
      await scan(projectRoot);
    } catch (error) {
      logger.warn("扫描代码文件失败", { projectRoot, error: (error as Error).message });
    }

    return files;
  }

  /**
   * 检查依赖安全性
   */
  private async checkDependencies(projectRoot: string): Promise<DependencyCheckResult> {
    const packageJsonPath = path.join(projectRoot, "package.json");
    const requirementsTxtPath = path.join(projectRoot, "requirements.txt");

    const hasPackageJson = await fs.pathExists(packageJsonPath);
    const hasRequirementsTxt = await fs.pathExists(requirementsTxtPath);

    const vulnerableDependencies: string[] = [];
    const unspecifiedVersions: string[] = [];

    // 检查 Node.js 依赖
    if (hasPackageJson) {
      try {
        const packageJson = await fs.readJson(packageJsonPath);
        this.checkNodeDependencies(packageJson, vulnerableDependencies, unspecifiedVersions);
      } catch (error) {
        logger.warn("读取package.json失败", { error: (error as Error).message });
      }
    }

    // 检查 Python 依赖
    if (hasRequirementsTxt) {
      try {
        const requirements = await fs.readFile(requirementsTxtPath, "utf-8");
        this.checkPythonDependencies(requirements, vulnerableDependencies, unspecifiedVersions);
      } catch (error) {
        logger.warn("读取requirements.txt失败", { error: (error as Error).message });
      }
    }

    const passed = vulnerableDependencies.length === 0 && unspecifiedVersions.length === 0;

    return {
      passed,
      hasPackageJson,
      hasRequirementsTxt,
      vulnerableDependencies,
      unspecifiedVersions
    };
  }

  /**
   * 检查 Node.js 依赖
   */
  private checkNodeDependencies(packageJson: any, vulnerableDependencies: string[], unspecifiedVersions: string[]): void {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    for (const [name, version] of Object.entries(dependencies)) {
      const versionStr = version as string;
      
      // 检查版本是否固定
      if (versionStr.startsWith('^') || versionStr.startsWith('~') || versionStr === '*' || versionStr === 'latest') {
        unspecifiedVersions.push(`${name}@${versionStr}`);
      }
      
      // 检查已知的有漏洞包
      if (this.isKnownVulnerablePackage(name, versionStr)) {
        vulnerableDependencies.push(`${name}@${versionStr}`);
      }
    }
  }

  /**
   * 检查Python依赖
   */
  private checkPythonDependencies(requirements: string, vulnerableDependencies: string[], unspecifiedVersions: string[]): void {
    const lines = requirements.split("\n").filter(line => line.trim() && !line.startsWith("#"));
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.includes(">=") || cleanLine.includes(">") || !cleanLine.includes("==")) {
        unspecifiedVersions.push(cleanLine);
      }

      // 简单的已知漏洞检查
      if (this.isKnownVulnerablePythonPackage(cleanLine)) {
        vulnerableDependencies.push(cleanLine);
      }
    }
  }

  /**
   * 检查是否为已知有漏洞的Node.js包
   */
  private isKnownVulnerablePackage(name: string, version: string): boolean {
    // 这里应该集成真实的漏洞数据库，目前只是示例
    const knownVulnerable = [
      "lodash",  // 某些版本有原型污染漏洞
      "moment",  // 已弃用
      "request", // 已弃用
    ];

    // TODO: 在实际实现中，应该根据具体版本检查漏洞
    // 目前简化处理，只检查包名
    return knownVulnerable.includes(name) || version.includes("beta") || version.includes("alpha");
  }

  /**
   * 检查是否为已知有漏洞的Python包
   */
  private isKnownVulnerablePythonPackage(requirement: string): boolean {
    // 这里应该集成真实的漏洞数据库，目前只是示例
    const knownVulnerable = [
      "pycrypto", // 已弃用，应使用pycryptodome
      "django",   // 某些版本有安全漏洞
    ];

    return knownVulnerable.some(vuln => requirement.includes(vuln));
  }

  /**
   * 检查配置安全性
   */
  private async checkConfiguration(serverPath: string, projectRoot?: string): Promise<ConfigurationCheckResult> {
    const hardcodedSecrets: string[] = [];
    const insecureConfigs: string[] = [];

    try {
      // 检查主文件
      await this.checkFileConfiguration(serverPath, hardcodedSecrets, insecureConfigs);

      // 检查项目配置文件
      if (projectRoot) {
        const configFiles = [
          path.join(projectRoot, ".env"),
          path.join(projectRoot, "config.json"),
          path.join(projectRoot, "config.js"),
          path.join(projectRoot, "config.ts")
        ];

        for (const configFile of configFiles) {
          if (await fs.pathExists(configFile)) {
            await this.checkFileConfiguration(configFile, hardcodedSecrets, insecureConfigs);
          }
        }
      }

    } catch (error) {
      logger.warn("配置检查失败", { error: (error as Error).message });
    }

    const passed = hardcodedSecrets.length === 0 && insecureConfigs.length === 0;

    return {
      passed,
      hardcodedSecrets,
      insecureConfigs
    };
  }

  /**
   * 检查单个文件的配置
   */
  private async checkFileConfiguration(filePath: string, hardcodedSecrets: string[], insecureConfigs: string[]): Promise<void> {
    const content = await fs.readFile(filePath, "utf-8");
    
    // 检查硬编码的敏感信息
    const secretPatterns = [
      /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{16,}['"]/i,
      /(?:secret|token)\s*[:=]\s*['"][^'"]{16,}['"]/i,
      /(?:access[_-]?key|accesskey)\s*[:=]\s*['"][^'"]{16,}['"]/i,
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        hardcodedSecrets.push(`发现硬编码敏感信息在 ${path.basename(filePath)}`);
      }
    }

    // 检查不安全的配置
    const insecurePatterns = [
      { pattern: /ssl\s*[:=]\s*false/i, message: "SSL禁用" },
      { pattern: /verify\s*[:=]\s*false/i, message: "证书验证禁用" },
      { pattern: /debug\s*[:=]\s*true/i, message: "调试模式启用" },
    ];

    for (const { pattern, message } of insecurePatterns) {
      if (pattern.test(content)) {
        insecureConfigs.push(`${message} 在 ${path.basename(filePath)}`);
      }
    }
  }

  /**
   * 检查文件权限和路径安全
   */
  private async checkPermissions(serverPath: string): Promise<PermissionCheckResult> {
    const fileExists = await fs.pathExists(serverPath);
    let isExecutable = false;
    let isInSecurePath = false;
    let pathTraversalRisk = false;

    if (fileExists) {
      try {
        const stats = await fs.stat(serverPath);
        // 在Unix系统上检查执行权限
        if (process.platform !== "win32") {
          isExecutable = !!(stats.mode & parseInt("111", 8));
        } else {
          // 在Windows上，检查文件扩展名
          const ext = path.extname(serverPath).toLowerCase();
          isExecutable = [".exe", ".bat", ".cmd", ".js", ".py"].includes(ext);
        }
      } catch (error) {
        logger.warn("检查文件权限失败", { serverPath, error: (error as Error).message });
      }
    }

    // 检查路径安全性
    const normalizedPath = path.normalize(serverPath);
    
    // 检查路径遍历风险
    if (normalizedPath.includes("..") || normalizedPath.includes("~")) {
      pathTraversalRisk = true;
    }

    // 检查是否在安全路径中
    const securePathPrefixes = [
      "C:\\Users\\",
      "E:\\mcp\\",
      "/home/",
      "/opt/",
      "/usr/local/"
    ];

    isInSecurePath = securePathPrefixes.some(prefix => normalizedPath.startsWith(prefix));

    const passed = fileExists && !pathTraversalRisk;

    return {
      passed,
      fileExists,
      isExecutable,
      isInSecurePath,
      pathTraversalRisk
    };
  }

  /**
   * 计算安全评分 (0-100)
   */
  private calculateSecurityScore(
    codeAnalysis: CodeAnalysisResult,
    dependencyCheck: DependencyCheckResult,
    configurationCheck: ConfigurationCheckResult,
    permissionCheck: PermissionCheckResult
  ): number {
    let score = 100;

    // 代码安全检查 (40分权重)
    if (!codeAnalysis.passed) {
      score -= Math.min(40, codeAnalysis.dangerousFunctions.length * 10 + codeAnalysis.maliciousCommands.length * 15);
    }

    // 依赖安全检查 (30分权重)
    if (!dependencyCheck.passed) {
      // 有漏洞的依赖扣分更严重
      score -= Math.min(20, dependencyCheck.vulnerableDependencies.length * 10);
      
      // 未固定版本的依赖扣分相对较轻，但仍需要关注
      const versionPenalty = Math.min(15, Math.floor(dependencyCheck.unspecifiedVersions.length / 3) * 5);
      score -= versionPenalty;
      
      // 如果依赖版本未固定但没有已知漏洞，给予一定的宽容度
      if (dependencyCheck.vulnerableDependencies.length === 0 && dependencyCheck.unspecifiedVersions.length > 0) {
        score += Math.min(5, Math.floor(dependencyCheck.unspecifiedVersions.length / 5)); // 适当回调部分分数
      }
    }

    // 配置安全检查 (20分权重)
    if (!configurationCheck.passed) {
      score -= Math.min(20, configurationCheck.hardcodedSecrets.length * 15 + configurationCheck.insecureConfigs.length * 5);
    }

    // 权限检查 (10分权重)
    if (!permissionCheck.passed) {
      if (!permissionCheck.fileExists) {
        score -= 10;
      } else {
        score -= Math.min(10, 
          (!permissionCheck.isInSecurePath ? 5 : 0) + 
          (permissionCheck.pathTraversalRisk ? 5 : 0)
        );
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * 修复依赖版本问题
   */
  async fixDependencyVersions(projectPath: string, autoFix: boolean = false, createBackup: boolean = true): Promise<{
    success: boolean;
    message: string;
    backupPath?: string;
    fixedDependencies?: string[];
    suggestions?: string[];
  }> {
    logger.info("开始修复依赖版本问题", { projectPath, autoFix, createBackup });

    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      
      if (!await fs.pathExists(packageJsonPath)) {
        throw new Error("未找到 package.json 文件");
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const originalPackageJson = JSON.parse(JSON.stringify(packageJson));

      // 创建备份
      let backupPath: string | undefined;
      if (createBackup) {
        backupPath = path.join(projectPath, `package.json.backup.${Date.now()}`);
        await fs.writeFile(backupPath, JSON.stringify(originalPackageJson, null, 2));
        logger.info("已创建 package.json 备份", { backupPath });
      }

      const fixedDependencies: string[] = [];
      const suggestions: string[] = [];

      // 处理生产依赖
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          const versionStr = version as string;
          if (versionStr.startsWith('^') || versionStr.startsWith('~') || versionStr === '*' || versionStr === 'latest') {
            const suggestion = `${name}: 建议固定版本 ${versionStr} -> 具体版本号`;
            suggestions.push(suggestion);
            
            if (autoFix) {
              // 这里可以添加实际的版本解析逻辑
              // 暂时保持原版本但移除前缀符号
              const fixedVersion = versionStr.replace(/^[\^~]/, '');
              if (fixedVersion !== versionStr) {
                packageJson.dependencies[name] = fixedVersion;
                fixedDependencies.push(`${name}@${fixedVersion}`);
              }
            }
          }
        }
      }

      // 处理开发依赖
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          const versionStr = version as string;
          if (versionStr.startsWith('^') || versionStr.startsWith('~') || versionStr === '*' || versionStr === 'latest') {
            const suggestion = `${name}: 建议固定开发依赖版本 ${versionStr} -> 具体版本号`;
            suggestions.push(suggestion);
            
            if (autoFix) {
              const fixedVersion = versionStr.replace(/^[\^~]/, '');
              if (fixedVersion !== versionStr) {
                packageJson.devDependencies[name] = fixedVersion;
                fixedDependencies.push(`${name}@${fixedVersion} (dev)`);
              }
            }
          }
        }
      }

      // 添加构建脚本优化建议
      if (packageJson.scripts && packageJson.scripts.build) {
        const buildScript = packageJson.scripts.build;
        if (buildScript.includes('&&') && process.platform === 'win32') {
          suggestions.push("构建脚本: 检测到使用 && 分隔符，在 Windows 环境下可能有兼容性问题");
          suggestions.push("建议: 考虑使用 npm-run-all 或分别定义脚本来改善跨平台兼容性");
          
          if (autoFix) {
            // 添加 PowerShell 兼容的构建脚本
            packageJson.scripts['build:win'] = buildScript.replace(/&&/g, ';');
            fixedDependencies.push("添加了 Windows 兼容的构建脚本: build:win");
          }
        }
      }

      // 保存修改后的 package.json
      if (autoFix && fixedDependencies.length > 0) {
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        logger.info("已更新 package.json", { fixedCount: fixedDependencies.length });
      }

      // 生成 shrinkwrap 建议
      if (suggestions.length > 0) {
        suggestions.push("建议执行 'npm shrinkwrap' 来锁定所有依赖版本");
        suggestions.push("或者执行 'npm ci' 来确保使用 package-lock.json 中的确切版本");
      }

      const message = autoFix 
        ? `已修复 ${fixedDependencies.length} 个依赖版本问题，${suggestions.length} 个建议`
        : `发现 ${suggestions.length} 个依赖版本问题和优化建议`;

      const result: {
        success: boolean;
        message: string;
        backupPath?: string;
        fixedDependencies?: string[];
        suggestions?: string[];
      } = {
        success: true,
        message
      };

      if (backupPath) {
        result.backupPath = backupPath;
      }

      if (fixedDependencies.length > 0) {
        result.fixedDependencies = fixedDependencies;
      }

      if (suggestions.length > 0) {
        result.suggestions = suggestions;
      }

      return result;

    } catch (error) {
      logger.error("修复依赖版本问题失败", { error: (error as Error).message });
      return {
        success: false,
        message: `修复失败: ${(error as Error).message}`
      };
    }
  }
} 