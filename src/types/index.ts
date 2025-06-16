/**
 * MCP服务器配置类型定义
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

/**
 * Cursor MCP配置文件结构
 */
export interface CursorMCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * 服务器部署请求
 */
export interface DeployServerRequest {
  name: string;
  serverPath: string;
  serverType: "node" | "python" | "npm" | "executable";
  description?: string;
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
  force?: boolean;
}

/**
 * 服务器信息
 */
export interface ServerInfo {
  name: string;
  config: MCPServerConfig;
  status: "active" | "disabled" | "error";
  lastDeployed?: string;
  description?: string;
}

/**
 * 部署操作结果
 */
export interface DeploymentResult {
  success: boolean;
  message: string;
  serverName?: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * 备份信息
 */
export interface BackupInfo {
  timestamp: string;
  filename: string;
  size: number;
  configCount: number;
}

/**
 * 系统状态
 */
export interface SystemStatus {
  cursorConfigExists: boolean;
  cursorConfigPath: string;
  totalServers: number;
  activeServers: number;
  disabledServers: number;
  lastBackup?: string;
  errors?: string[];
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 服务器扫描结果
 */
export interface ServerScanResult {
  path: string;
  type: "node" | "python" | "npm" | "executable";
  name: string;
  description?: string;
  version?: string;
  hasPackageJson?: boolean;
  hasPythonRequirements?: boolean;
}

/**
 * 工具调用参数类型
 */
export interface ToolCallParams {
  [key: string]: unknown;
}

/**
 * 资源内容类型
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

/**
 * MCP协议相关类型
 */
export interface MCPCapabilities {
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  sampling?: {};
  logging?: {};
}

/**
 * 错误类型定义
 */
export class MCPDeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "MCPDeploymentError";
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public configPath?: string,
    public details?: any
  ) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public validationErrors: string[]
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * 日志级别类型
 */
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * 事件类型
 */
export type EventType = 
  | "server_deployed"
  | "server_removed" 
  | "config_updated"
  | "backup_created"
  | "validation_failed"
  | "system_error";

/**
 * 事件数据
 */
export interface EventData {
  type: EventType;
  timestamp: string;
  details: any;
  userId?: string;
}

/**
 * 操作状态
 */
export type OperationStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * 操作上下文
 */
export interface OperationContext {
  id: string;
  type: string;
  status: OperationStatus;
  startTime: string;
  endTime?: string;
  progress?: number;
  message?: string;
  result?: any;
  error?: string;
} 