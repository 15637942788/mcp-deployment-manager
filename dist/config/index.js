import * as path from "path";
import * as os from "os";
/**
 * 获取Windows用户Cursor配置文件路径
 */
function getCursorConfigPath() {
    const userHome = os.homedir();
    return path.join(userHome, ".cursor", "mcp.json");
}
/**
 * 应用配置
 */
export const config = {
    server: {
        name: process.env.MCP_SERVER_NAME || "mcp-deployment-manager",
        version: process.env.MCP_SERVER_VERSION || "1.0.0",
        logLevel: process.env.LOG_LEVEL || "info",
    },
    cursor: {
        configPath: process.env.CURSOR_CONFIG_PATH || getCursorConfigPath(),
        backupEnabled: process.env.ENABLE_BACKUP !== "false",
        maxBackups: parseInt(process.env.MAX_BACKUPS || "10"),
    },
    security: {
        enableAuth: process.env.ENABLE_AUTH === "true",
        apiKey: process.env.API_KEY,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || ["*"],
    },
    features: {
        resources: process.env.ENABLE_RESOURCES !== "false",
        tools: process.env.ENABLE_TOOLS !== "false",
        prompts: process.env.ENABLE_PROMPTS !== "false",
        sampling: process.env.ENABLE_SAMPLING === "true",
    },
    limits: {
        maxConnections: parseInt(process.env.MAX_CONNECTIONS || "10"),
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
        maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE || "10485760"),
    }
};
/**
 * 常量定义
 */
export const constants = {
    // MCP协议相关
    MCP_VERSION: "2024-11-05",
    PROTOCOL_VERSION: "1.0.0",
    // 支持的服务器类型
    SUPPORTED_SERVER_TYPES: [
        "node",
        "python",
        "npm",
        "executable"
    ],
    // 支持的传输方式
    SUPPORTED_TRANSPORTS: [
        "stdio",
        "sse",
        "websocket"
    ],
    // 文件扩展名映射
    SERVER_EXTENSIONS: {
        ".js": "node",
        ".ts": "node",
        ".py": "python",
        ".exe": "executable"
    },
    // 默认配置模板
    DEFAULT_SERVER_CONFIG: {
        disabled: false,
        autoApprove: []
    }
};
//# sourceMappingURL=index.js.map