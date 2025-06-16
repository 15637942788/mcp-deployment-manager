export interface SecurityScanResult {
    passed: boolean;
    score: number;
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
export declare class SecurityService {
    /**
     * 执行完整的安全扫描
     */
    scanMCPService(serverPath: string, projectRoot?: string): Promise<SecurityScanResult>;
    /**
     * 代码安全分析
     */
    private analyzeCode;
    /**
     * 分析单个文件
     */
    private analyzeFile;
    /**
     * 检查JavaScript/TypeScript危险代码
     */
    private checkJavaScriptDangers;
    /**
     * 检查Python危险代码
     */
    private checkPythonDangers;
    /**
     * 检查通用危险模式
     */
    private checkCommonDangers;
    /**
     * 获取项目中的代码文件
     */
    private getCodeFiles;
    /**
     * 检查依赖安全性
     */
    private checkDependencies;
    /**
     * 检查Node.js依赖
     */
    private checkNodeDependencies;
    /**
     * 检查Python依赖
     */
    private checkPythonDependencies;
    /**
     * 检查是否为已知有漏洞的Node.js包
     */
    private isKnownVulnerablePackage;
    /**
     * 检查是否为已知有漏洞的Python包
     */
    private isKnownVulnerablePythonPackage;
    /**
     * 检查配置安全性
     */
    private checkConfiguration;
    /**
     * 检查单个文件的配置
     */
    private checkFileConfiguration;
    /**
     * 检查文件权限和路径安全
     */
    private checkPermissions;
    /**
     * 计算安全评分
     */
    private calculateSecurityScore;
}
//# sourceMappingURL=securityService.d.ts.map