/**
 * 错误类型定义
 */
export class MCPDeploymentError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "MCPDeploymentError";
    }
}
export class ConfigurationError extends Error {
    configPath;
    details;
    constructor(message, configPath, details) {
        super(message);
        this.configPath = configPath;
        this.details = details;
        this.name = "ConfigurationError";
    }
}
export class ValidationError extends Error {
    validationErrors;
    constructor(message, validationErrors) {
        super(message);
        this.validationErrors = validationErrors;
        this.name = "ValidationError";
    }
}
//# sourceMappingURL=index.js.map