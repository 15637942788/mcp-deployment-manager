import { SecurityScanResult } from "./securityService.js";
/**
 * 全局安全策略配置
 */
export interface GlobalSecurityPolicy {
    enforced: boolean;
    minimumScore: number;
    strictMode: boolean;
    allowedBypass: boolean;
    policyVersion: string;
    lastUpdated: string;
}
/**
 * 全局安全标准规则
 */
export interface GlobalSecurityStandards {
    codeRules: {
        forbiddenFunctions: string[];
        forbiddenPatterns: string[];
        requiredPatterns: string[];
    };
    dependencyRules: {
        forbiddenPackages: string[];
        vulnerabilityToleranceLevel: string;
        requireFixedVersions: boolean;
    };
    configurationRules: {
        forbiddenSecrets: string[];
        requiredValidations: string[];
    };
    deploymentRules: {
        requiredBackup: boolean;
        allowForceDeployment: boolean;
        requireSecurityScan: boolean;
    };
}
/**
 * 全局MCP安全策略管理器
 * 确保所有MCP服务部署都遵循统一的安全标准，无论从哪个项目调用
 */
export declare class GlobalSecurityManager {
    private static instance;
    private securityService;
    private readonly globalPolicyPath;
    private readonly globalStandardsPath;
    constructor();
    static getInstance(): GlobalSecurityManager;
    /**
     * 初始化全局安全策略
     */
    initialize(): Promise<void>;
    /**
     * 强制执行全局安全检查 - 这是所有MCP部署的入口点
     */
    enforceGlobalSecurity(serverPath: string, projectRoot?: string): Promise<{
        success: boolean;
        securityScan: SecurityScanResult;
        policyEnforced: boolean;
        message: string;
    }>;
    /**
     * 评估安全扫描结果是否符合全局策略
     */
    private evaluateSecurityResult;
    /**
     * 获取全局安全策略
     */
    getGlobalPolicy(): Promise<GlobalSecurityPolicy>;
    /**
     * 更新全局安全策略
     */
    updateGlobalPolicy(updates: Partial<GlobalSecurityPolicy>): Promise<void>;
    /**
     * 获取全局安全标准
     */
    getGlobalStandards(): Promise<GlobalSecurityStandards>;
    /**
     * 启用全局安全策略强制执行
     */
    enableGlobalSecurity(strictMode?: boolean): Promise<void>;
    /**
     * 禁用全局安全策略强制执行（仅记录模式）
     */
    disableGlobalSecurity(): Promise<void>;
    /**
     * 获取安全策略状态
     */
    getSecurityStatus(): Promise<{
        globalPolicy: GlobalSecurityPolicy;
        globalStandards: GlobalSecurityStandards;
        managerVersion: string;
        configPaths: {
            policyPath: string;
            standardsPath: string;
        };
    }>;
    /**
     * 确保默认策略文件存在
     */
    private ensureDefaultPolicy;
    /**
     * 确保默认标准文件存在
     */
    private ensureDefaultStandards;
    /**
     * 获取默认安全策略
     */
    private getDefaultPolicy;
    /**
     * 获取默认安全标准
     */
    private getDefaultStandards;
}
//# sourceMappingURL=globalSecurityManager.d.ts.map