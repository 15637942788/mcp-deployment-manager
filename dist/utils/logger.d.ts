import winston from "winston";
/**
 * 主日志记录器
 */
export declare const logger: winston.Logger;
/**
 * 为请求添加requestId的子日志器
 */
export declare function withRequestId(requestId: string): winston.Logger;
/**
 * 部署操作专用日志器
 */
export declare const deploymentLogger: winston.Logger;
/**
 * 配置管理专用日志器
 */
export declare const configLogger: winston.Logger;
/**
 * 工具操作专用日志器
 */
export declare const toolLogger: winston.Logger;
/**
 * 资源管理专用日志器
 */
export declare const resourceLogger: winston.Logger;
/**
 * 性能监控日志器
 */
export declare const performanceLogger: winston.Logger;
/**
 * 审计日志器 - 记录重要的系统操作
 */
export declare const auditLogger: winston.Logger;
/**
 * 记录审计事件
 */
export declare function auditLog(action: string, details: any, userId?: string): void;
/**
 * 性能计时器
 */
export declare class PerformanceTimer {
    private startTime;
    private operation;
    constructor(operation: string);
    end(details?: any): number;
}
/**
 * 错误日志记录辅助函数
 */
export declare function logError(error: Error, context?: string, details?: any): void;
/**
 * 成功操作日志记录
 */
export declare function logSuccess(operation: string, details?: any): void;
/**
 * 警告日志记录
 */
export declare function logWarning(message: string, details?: any): void;
export default logger;
//# sourceMappingURL=logger.d.ts.map