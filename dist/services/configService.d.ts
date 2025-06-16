import { SecurityScanResult } from "./securityService.js";
import { CursorMCPConfig, MCPServerConfig, BackupInfo, ValidationResult, DeploymentResult } from "../types/index.js";
/**
 * Cursor配置文件管理服务
 */
export declare class ConfigService {
    private cursorConfigPath;
    private backupDir;
    private globalSecurityManager;
    constructor();
    /**
     * 初始化服务
     */
    private initialize;
    /**
     * 确保备份目录存在
     */
    private ensureBackupDirectory;
    /**
     * 检查配置文件是否存在
     */
    configExists(): Promise<boolean>;
    /**
     * 读取当前配置
     */
    readConfig(): Promise<CursorMCPConfig>;
    /**
     * 写入配置
     */
    writeConfig(config: CursorMCPConfig): Promise<void>;
    /**
     * 创建配置备份
     */
    createBackup(): Promise<BackupInfo>;
    /**
     * 清理旧备份文件
     */
    private cleanupOldBackups;
    /**
     * 列出所有备份
     */
    listBackups(): Promise<BackupInfo[]>;
    /**
     * 从备份恢复配置
     */
    restoreFromBackup(backupFilename: string): Promise<void>;
    /**
     * 验证配置文件格式
     */
    validateConfig(config: CursorMCPConfig): ValidationResult;
    /**
     * 验证单个服务器配置
     */
    private validateServerConfig;
    /**
     * 检查内容是否包含危险字符或模式
     */
    private containsDangerousContent;
    /**
     * 检查是否看起来像敏感数据
     */
    private looksLikeSensitiveData;
    /**
     * 添加或更新服务器配置（带强制安全检查）
     */
    addServer(name: string, serverConfig: MCPServerConfig, force?: boolean): Promise<DeploymentResult>;
    /**
     * 强制备份和配置保护的添加服务器方法
     * 确保原有配置安全且强制备份
     */
    addServerWithProtection(name: string, serverConfig: MCPServerConfig, serverPath: string, projectRoot?: string, force?: boolean, _skipSecurity?: boolean): Promise<DeploymentResult & {
        securityScan?: SecurityScanResult;
        backupInfo?: BackupInfo;
    }>;
    /**
     * 受保护的服务器添加方法
     * 在确保备份和检查完成后执行实际的添加操作
     */
    private addServerProtected;
    /**
     * 添加服务器配置（带安全检查的安全方法）
     * 强制要求所有部署都经过安全扫描
     */
    addServerWithSecurity(name: string, serverConfig: MCPServerConfig, serverPath: string, projectRoot?: string, force?: boolean, skipSecurity?: boolean): Promise<DeploymentResult & {
        securityScan?: SecurityScanResult;
    }>;
    /**
     * 移除服务器配置
     */
    removeServer(name: string): Promise<DeploymentResult>;
    /**
     * 获取配置路径（用于存储）
     */
    getConfigPath(): string;
    /**
     * 获取备份目录路径
     */
    getBackupPath(): string;
    /**
     * 列出所有服务器
     */
    listServers(): Promise<Array<{
        name: string;
        config: MCPServerConfig;
    }>>;
    /**
     * 获取系统状态
     */
    getSystemStatus(): Promise<any>;
    /**
     * 创建配置备份（带注释）
     */
    createBackupWithResult(_comment?: string): Promise<{
        success: boolean;
        message: string;
        backupPath?: string;
        errors?: string[];
    }>;
    /**
     * 从备份恢复配置（返回结果）
     */
    restoreFromBackupWithResult(backupFile: string): Promise<{
        success: boolean;
        message: string;
        errors?: string[];
    }>;
    /**
     * 验证当前配置文件
     */
    validateCurrentConfig(): Promise<ValidationResult>;
    /**
     * 扫描目录查找MCP服务器
     */
    scanDirectory(directory: string): Promise<{
        servers: Array<{
            name: string;
            path: string;
            type: string;
        }>;
    }>;
}
export default ConfigService;
//# sourceMappingURL=configService.d.ts.map