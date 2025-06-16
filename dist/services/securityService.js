import * as fs from "fs-extra";
import * as path from "path";
import { logger } from "../utils/logger.js";
/**
 * MCP服务安全扫描服务
 */
export class SecurityService {
    /**
     * 执行完整的安全扫描
     */
    async scanMCPService(serverPath, projectRoot) {
        logger.info("开始安全扫描", { serverPath, projectRoot });
        const codeAnalysis = await this.analyzeCode(serverPath, projectRoot);
        const dependencyCheck = await this.checkDependencies(projectRoot || path.dirname(serverPath));
        const configurationCheck = await this.checkConfiguration(serverPath, projectRoot);
        const permissionCheck = await this.checkPermissions(serverPath);
        const allChecks = [codeAnalysis, dependencyCheck, configurationCheck, permissionCheck];
        const passed = allChecks.every(check => check.passed);
        // 计算安全评分
        const score = this.calculateSecurityScore(codeAnalysis, dependencyCheck, configurationCheck, permissionCheck);
        const warnings = [];
        const errors = [];
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
        const result = {
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
    async analyzeCode(serverPath, projectRoot) {
        const dangerousFunctions = [];
        const suspiciousPatterns = [];
        const maliciousCommands = [];
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
        }
        catch (error) {
            logger.error("代码分析失败", { error: error.message });
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
    async analyzeFile(filePath, dangerousFunctions, suspiciousPatterns, maliciousCommands) {
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
    checkJavaScriptDangers(content, filePath, dangerousFunctions, suspiciousPatterns, maliciousCommands) {
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
                }
                else if (type === "suspicious") {
                    suspiciousPatterns.push(`${message} 在 ${location}`);
                }
                else if (type === "malicious") {
                    maliciousCommands.push(`${message} 在 ${location}`);
                }
            }
        }
    }
    /**
     * 检查Python危险代码
     */
    checkPythonDangers(content, filePath, dangerousFunctions, suspiciousPatterns, maliciousCommands) {
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
                }
                else if (type === "suspicious") {
                    suspiciousPatterns.push(`${message} 在 ${location}`);
                }
                else if (type === "malicious") {
                    maliciousCommands.push(`${message} 在 ${location}`);
                }
            }
        }
    }
    /**
     * 检查通用危险模式
     */
    checkCommonDangers(content, filePath, suspiciousPatterns, maliciousCommands) {
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
                }
                else if (type === "malicious") {
                    maliciousCommands.push(`${message} 在 ${location}`);
                }
            }
        }
    }
    /**
     * 获取项目中的代码文件
     */
    async getCodeFiles(projectRoot) {
        const files = [];
        const codeExtensions = [".js", ".ts", ".py", ".mjs", ".jsx", ".tsx"];
        const scan = async (dir, depth = 0) => {
            if (depth > 3)
                return; // 限制扫描深度
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                    await scan(fullPath, depth + 1);
                }
                else if (entry.isFile() && codeExtensions.includes(path.extname(entry.name))) {
                    files.push(fullPath);
                }
            }
        };
        try {
            await scan(projectRoot);
        }
        catch (error) {
            logger.warn("扫描代码文件失败", { projectRoot, error: error.message });
        }
        return files;
    }
    /**
     * 检查依赖安全性
     */
    async checkDependencies(projectRoot) {
        const packageJsonPath = path.join(projectRoot, "package.json");
        const requirementsTxtPath = path.join(projectRoot, "requirements.txt");
        const hasPackageJson = await fs.pathExists(packageJsonPath);
        const hasRequirementsTxt = await fs.pathExists(requirementsTxtPath);
        const vulnerableDependencies = [];
        const unspecifiedVersions = [];
        // 检查 Node.js 依赖
        if (hasPackageJson) {
            try {
                const packageJson = await fs.readJson(packageJsonPath);
                this.checkNodeDependencies(packageJson, vulnerableDependencies, unspecifiedVersions);
            }
            catch (error) {
                logger.warn("读取package.json失败", { error: error.message });
            }
        }
        // 检查 Python 依赖
        if (hasRequirementsTxt) {
            try {
                const requirements = await fs.readFile(requirementsTxtPath, "utf-8");
                this.checkPythonDependencies(requirements, vulnerableDependencies, unspecifiedVersions);
            }
            catch (error) {
                logger.warn("读取requirements.txt失败", { error: error.message });
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
     * 检查Node.js依赖
     */
    checkNodeDependencies(packageJson, vulnerableDependencies, unspecifiedVersions) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        for (const [name, version] of Object.entries(deps)) {
            const versionStr = version;
            // 检查版本是否固定
            if (versionStr.startsWith("^") || versionStr.startsWith("~") || versionStr === "*") {
                unspecifiedVersions.push(`${name}@${versionStr}`);
            }
            // 简单的已知漏洞检查（在实际环境中应该使用npm audit或专业工具）
            if (this.isKnownVulnerablePackage(name, versionStr)) {
                vulnerableDependencies.push(`${name}@${versionStr}`);
            }
        }
    }
    /**
     * 检查Python依赖
     */
    checkPythonDependencies(requirements, vulnerableDependencies, unspecifiedVersions) {
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
    isKnownVulnerablePackage(name, version) {
        // 这里应该集成真实的漏洞数据库，目前只是示例
        const knownVulnerable = [
            "lodash", // 某些版本有原型污染漏洞
            "moment", // 已弃用
            "request", // 已弃用
        ];
        // TODO: 在实际实现中，应该根据具体版本检查漏洞
        // 目前简化处理，只检查包名
        return knownVulnerable.includes(name) || version.includes("beta") || version.includes("alpha");
    }
    /**
     * 检查是否为已知有漏洞的Python包
     */
    isKnownVulnerablePythonPackage(requirement) {
        // 这里应该集成真实的漏洞数据库，目前只是示例
        const knownVulnerable = [
            "pycrypto", // 已弃用，应使用pycryptodome
            "django", // 某些版本有安全漏洞
        ];
        return knownVulnerable.some(vuln => requirement.includes(vuln));
    }
    /**
     * 检查配置安全性
     */
    async checkConfiguration(serverPath, projectRoot) {
        const hardcodedSecrets = [];
        const insecureConfigs = [];
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
        }
        catch (error) {
            logger.warn("配置检查失败", { error: error.message });
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
    async checkFileConfiguration(filePath, hardcodedSecrets, insecureConfigs) {
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
    async checkPermissions(serverPath) {
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
                }
                else {
                    // 在Windows上，检查文件扩展名
                    const ext = path.extname(serverPath).toLowerCase();
                    isExecutable = [".exe", ".bat", ".cmd", ".js", ".py"].includes(ext);
                }
            }
            catch (error) {
                logger.warn("检查文件权限失败", { serverPath, error: error.message });
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
     * 计算安全评分
     */
    calculateSecurityScore(codeAnalysis, dependencyCheck, configurationCheck, permissionCheck) {
        let score = 100;
        // 代码安全（40分）
        if (!codeAnalysis.passed) {
            score -= codeAnalysis.dangerousFunctions.length * 15;
            score -= codeAnalysis.maliciousCommands.length * 20;
            score -= codeAnalysis.suspiciousPatterns.length * 5;
        }
        // 依赖安全（30分）
        if (!dependencyCheck.passed) {
            score -= dependencyCheck.vulnerableDependencies.length * 10;
            score -= dependencyCheck.unspecifiedVersions.length * 2;
        }
        // 配置安全（20分）
        if (!configurationCheck.passed) {
            score -= configurationCheck.hardcodedSecrets.length * 10;
            score -= configurationCheck.insecureConfigs.length * 5;
        }
        // 权限和路径安全（10分）
        if (!permissionCheck.passed) {
            if (!permissionCheck.fileExists)
                score -= 10;
            if (permissionCheck.pathTraversalRisk)
                score -= 10;
            if (!permissionCheck.isInSecurePath)
                score -= 3;
        }
        return Math.max(0, Math.min(100, score));
    }
}
//# sourceMappingURL=securityService.js.map