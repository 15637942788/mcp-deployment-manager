import * as fs from "fs-extra";
import * as path from "path";
import { logger } from "../utils/logger.js";
import { SecurityService } from "./securityService.js";
/**
 * 全局MCP安全策略管理器
 * 确保所有MCP服务部署都遵循统一的安全标准，无论从哪个项目调用
 */
export class GlobalSecurityManager {
    static instance;
    securityService;
    globalPolicyPath;
    globalStandardsPath;
    constructor() {
        this.securityService = new SecurityService();
        // 全局策略文件存储在MCP部署管理器目录中
        this.globalPolicyPath = path.join(process.cwd(), 'config', 'global-security-policy.json');
        this.globalStandardsPath = path.join(process.cwd(), 'config', 'global-security-standards.json');
    }
    static getInstance() {
        if (!GlobalSecurityManager.instance) {
            GlobalSecurityManager.instance = new GlobalSecurityManager();
        }
        return GlobalSecurityManager.instance;
    }
    /**
     * 初始化全局安全策略
     */
    async initialize() {
        logger.info("初始化全局安全策略管理器");
        // 确保配置目录存在
        await fs.ensureDir(path.dirname(this.globalPolicyPath));
        // 初始化默认策略
        await this.ensureDefaultPolicy();
        await this.ensureDefaultStandards();
        logger.info("全局安全策略管理器初始化完成");
    }
    /**
     * 强制执行全局安全检查 - 这是所有MCP部署的入口点
     */
    async enforceGlobalSecurity(serverPath, projectRoot) {
        logger.info("开始全局安全策略检查", { serverPath, projectRoot });
        // 1. 检查全局策略是否启用
        const policy = await this.getGlobalPolicy();
        if (!policy.enforced) {
            logger.warn("全局安全策略未启用，但仍将执行安全扫描");
        }
        // 2. 执行安全扫描
        const securityScan = await this.securityService.scanMCPService(serverPath, projectRoot);
        // 3. 根据全局策略评估结果
        const result = this.evaluateSecurityResult(securityScan, policy);
        logger.info("全局安全策略检查完成", {
            success: result.success,
            score: securityScan.score,
            policyEnforced: policy.enforced,
            strictMode: policy.strictMode
        });
        return {
            success: result.success,
            securityScan,
            policyEnforced: policy.enforced,
            message: result.message
        };
    }
    /**
     * 评估安全扫描结果是否符合全局策略
     */
    evaluateSecurityResult(securityScan, policy) {
        const { score, passed, errors } = securityScan;
        // 如果策略未强制执行，仅记录警告
        if (!policy.enforced) {
            return {
                success: true,
                message: `安全扫描完成（策略未强制执行）- 得分: ${score}/100, 建议${score >= policy.minimumScore ? '通过' : '修复安全问题'}`
            };
        }
        // 强制策略模式下的评估
        if (policy.strictMode) {
            // 严格模式：必须通过所有检查且达到最低分数
            if (!passed) {
                return {
                    success: false,
                    message: `严格模式下安全检查失败 - 必须修复所有安全问题。错误: ${errors.join('; ')}`
                };
            }
            if (score < policy.minimumScore) {
                return {
                    success: false,
                    message: `严格模式下安全评分不足 - 当前: ${score}/100, 要求: ${policy.minimumScore}/100`
                };
            }
        }
        else {
            // 标准模式：主要看分数
            if (score < policy.minimumScore) {
                if (policy.allowedBypass && score >= 70) {
                    return {
                        success: true,
                        message: `安全评分低于标准但允许绕过 - 当前: ${score}/100, 建议修复问题后重新部署`
                    };
                }
                return {
                    success: false,
                    message: `安全评分不足 - 当前: ${score}/100, 要求: ${policy.minimumScore}/100。主要问题: ${errors.slice(0, 3).join('; ')}`
                };
            }
        }
        return {
            success: true,
            message: `全局安全策略检查通过 - 得分: ${score}/100`
        };
    }
    /**
     * 获取全局安全策略
     */
    async getGlobalPolicy() {
        try {
            if (await fs.pathExists(this.globalPolicyPath)) {
                const content = await fs.readFile(this.globalPolicyPath, 'utf-8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            logger.error("读取全局安全策略失败", { error: error.message });
        }
        // 返回默认策略
        return this.getDefaultPolicy();
    }
    /**
     * 更新全局安全策略
     */
    async updateGlobalPolicy(updates) {
        const currentPolicy = await this.getGlobalPolicy();
        const newPolicy = {
            ...currentPolicy,
            ...updates,
            lastUpdated: new Date().toISOString()
        };
        await fs.outputFile(this.globalPolicyPath, JSON.stringify(newPolicy, null, 2), 'utf-8');
        logger.info("全局安全策略已更新", { updates });
    }
    /**
     * 获取全局安全标准
     */
    async getGlobalStandards() {
        try {
            if (await fs.pathExists(this.globalStandardsPath)) {
                const content = await fs.readFile(this.globalStandardsPath, 'utf-8');
                return JSON.parse(content);
            }
        }
        catch (error) {
            logger.error("读取全局安全标准失败", { error: error.message });
        }
        return this.getDefaultStandards();
    }
    /**
     * 启用全局安全策略强制执行
     */
    async enableGlobalSecurity(strictMode = false) {
        await this.updateGlobalPolicy({
            enforced: true,
            strictMode,
            minimumScore: strictMode ? 90 : 85
        });
        logger.info("全局安全策略已启用", { strictMode });
    }
    /**
     * 禁用全局安全策略强制执行（仅记录模式）
     */
    async disableGlobalSecurity() {
        await this.updateGlobalPolicy({
            enforced: false
        });
        logger.info("全局安全策略已禁用 - 仅记录模式");
    }
    /**
     * 获取安全策略状态
     */
    async getSecurityStatus() {
        return {
            globalPolicy: await this.getGlobalPolicy(),
            globalStandards: await this.getGlobalStandards(),
            managerVersion: "1.0.0",
            configPaths: {
                policyPath: this.globalPolicyPath,
                standardsPath: this.globalStandardsPath
            }
        };
    }
    /**
     * 确保默认策略文件存在
     */
    async ensureDefaultPolicy() {
        if (!(await fs.pathExists(this.globalPolicyPath))) {
            const defaultPolicy = this.getDefaultPolicy();
            await fs.outputFile(this.globalPolicyPath, JSON.stringify(defaultPolicy, null, 2), 'utf-8');
            logger.info("创建默认全局安全策略文件", { path: this.globalPolicyPath });
        }
    }
    /**
     * 确保默认标准文件存在
     */
    async ensureDefaultStandards() {
        if (!(await fs.pathExists(this.globalStandardsPath))) {
            const defaultStandards = this.getDefaultStandards();
            await fs.outputFile(this.globalStandardsPath, JSON.stringify(defaultStandards, null, 2), 'utf-8');
            logger.info("创建默认全局安全标准文件", { path: this.globalStandardsPath });
        }
    }
    /**
     * 获取默认安全策略
     */
    getDefaultPolicy() {
        return {
            enforced: true,
            minimumScore: 85,
            strictMode: false,
            allowedBypass: false,
            policyVersion: "1.0.0",
            lastUpdated: new Date().toISOString()
        };
    }
    /**
     * 获取默认安全标准
     */
    getDefaultStandards() {
        return {
            codeRules: {
                forbiddenFunctions: ["eval", "exec", "execSync", "spawn", "fork", "child_process"],
                forbiddenPatterns: ["rm -rf", "sudo", "chmod 777", "__import__", "getattr"],
                requiredPatterns: []
            },
            dependencyRules: {
                forbiddenPackages: ["malicious-package", "crypto-miner"],
                vulnerabilityToleranceLevel: "low",
                requireFixedVersions: true
            },
            configurationRules: {
                forbiddenSecrets: ["password", "secret", "key", "token", "api_key"],
                requiredValidations: ["input_validation", "output_sanitization"]
            },
            deploymentRules: {
                requiredBackup: true,
                allowForceDeployment: false,
                requireSecurityScan: true
            }
        };
    }
}
//# sourceMappingURL=globalSecurityManager.js.map