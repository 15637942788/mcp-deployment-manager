export interface ServerConfig {
    name: string;
    version: string;
    logLevel: string;
}
export interface CursorConfig {
    configPath: string;
    backupEnabled: boolean;
    maxBackups: number;
}
export interface SecurityConfig {
    enableAuth: boolean;
    apiKey?: string | undefined;
    allowedOrigins: string[];
}
export interface FeatureConfig {
    resources: boolean;
    tools: boolean;
    prompts: boolean;
    sampling: boolean;
}
export interface LimitsConfig {
    maxConnections: number;
    requestTimeout: number;
    maxPayloadSize: number;
}
export interface Config {
    server: ServerConfig;
    cursor: CursorConfig;
    security: SecurityConfig;
    features: FeatureConfig;
    limits: LimitsConfig;
}
/**
 * 应用配置
 */
export declare const config: Config;
/**
 * 常量定义
 */
export declare const constants: {
    readonly MCP_VERSION: "2024-11-05";
    readonly PROTOCOL_VERSION: "1.0.0";
    readonly SUPPORTED_SERVER_TYPES: readonly ["node", "python", "npm", "executable"];
    readonly SUPPORTED_TRANSPORTS: readonly ["stdio", "sse", "websocket"];
    readonly SERVER_EXTENSIONS: {
        readonly ".js": "node";
        readonly ".ts": "node";
        readonly ".py": "python";
        readonly ".exe": "executable";
    };
    readonly DEFAULT_SERVER_CONFIG: {
        readonly disabled: false;
        readonly autoApprove: string[];
    };
};
export type SupportedServerType = typeof constants.SUPPORTED_SERVER_TYPES[number];
export type SupportedTransport = typeof constants.SUPPORTED_TRANSPORTS[number];
//# sourceMappingURL=index.d.ts.map