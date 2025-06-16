import winston from "winston";
import * as path from "path";
import { config } from "../config/index.js";
/**
 * 创建日志目录格式化器
 */
const createFormatter = () => {
    return winston.format.combine(winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), winston.format.errors({ stack: true }), winston.format.json(), winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
        const logEntry = {
            timestamp,
            level,
            service: service || config.server.name,
            message,
            ...meta
        };
        if (requestId) {
            logEntry.requestId = requestId;
        }
        return JSON.stringify(logEntry, null, 2);
    }));
};
/**
 * 创建控制台格式化器
 */
const createConsoleFormatter = () => {
    return winston.format.combine(winston.format.timestamp({
        format: 'HH:mm:ss'
    }), winston.format.colorize(), winston.format.printf(({ timestamp, level, message, requestId }) => {
        const prefix = requestId ? `[${requestId}]` : '';
        return `${timestamp} ${level}: ${prefix} ${message}`;
    }));
};
/**
 * 主日志记录器
 */
export const logger = winston.createLogger({
    level: config.server.logLevel,
    format: createFormatter(),
    defaultMeta: {
        service: config.server.name,
        version: config.server.version
    },
    transports: [
        // 控制台输出
        new winston.transports.Console({
            format: createConsoleFormatter()
        }),
        // 错误日志文件
        new winston.transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // 综合日志文件
        new winston.transports.File({
            filename: path.join("logs", "combined.log"),
            maxsize: 5242880, // 5MB
            maxFiles: 10
        }),
        // 部署操作专用日志
        new winston.transports.File({
            filename: path.join("logs", "deployment.log"),
            level: "info",
            maxsize: 5242880, // 5MB
            maxFiles: 15
        })
    ],
    // 异常处理
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join("logs", "exceptions.log")
        })
    ],
    // 未捕获的Promise拒绝
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join("logs", "rejections.log")
        })
    ]
});
/**
 * 为请求添加requestId的子日志器
 */
export function withRequestId(requestId) {
    return logger.child({ requestId });
}
/**
 * 部署操作专用日志器
 */
export const deploymentLogger = logger.child({
    component: "deployment",
    category: "mcp-server-management"
});
/**
 * 配置管理专用日志器
 */
export const configLogger = logger.child({
    component: "config",
    category: "cursor-integration"
});
/**
 * 工具操作专用日志器
 */
export const toolLogger = logger.child({
    component: "tools",
    category: "mcp-tools"
});
/**
 * 资源管理专用日志器
 */
export const resourceLogger = logger.child({
    component: "resources",
    category: "mcp-resources"
});
/**
 * 性能监控日志器
 */
export const performanceLogger = logger.child({
    component: "performance",
    category: "monitoring"
});
/**
 * 审计日志器 - 记录重要的系统操作
 */
export const auditLogger = winston.createLogger({
    level: "info",
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [
        new winston.transports.File({
            filename: path.join("logs", "audit.log"),
            maxsize: 10485760, // 10MB
            maxFiles: 20
        })
    ]
});
/**
 * 记录审计事件
 */
export function auditLog(action, details, userId) {
    auditLogger.info("审计事件", {
        action,
        details,
        userId: userId || "system",
        timestamp: new Date().toISOString()
    });
}
/**
 * 性能计时器
 */
export class PerformanceTimer {
    startTime;
    operation;
    constructor(operation) {
        this.operation = operation;
        this.startTime = Date.now();
        performanceLogger.debug(`开始操作: ${operation}`);
    }
    end(details) {
        const duration = Date.now() - this.startTime;
        performanceLogger.info(`操作完成: ${this.operation}`, {
            duration: `${duration}ms`,
            ...details
        });
        return duration;
    }
}
/**
 * 错误日志记录辅助函数
 */
export function logError(error, context, details) {
    logger.error(`错误: ${context || "未知上下文"}`, {
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        context,
        ...details
    });
}
/**
 * 成功操作日志记录
 */
export function logSuccess(operation, details) {
    logger.info(`✅ ${operation}`, details);
}
/**
 * 警告日志记录
 */
export function logWarning(message, details) {
    logger.warn(`⚠️  ${message}`, details);
}
export default logger;
//# sourceMappingURL=logger.js.map