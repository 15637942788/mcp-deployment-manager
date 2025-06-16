/**
 * MCP服务部署管理器主服务器
 */
declare class MCPDeploymentServer {
    private server;
    constructor();
    /**
     * 设置请求处理器
     */
    private setupHandlers;
    /**
     * 设置错误处理
     */
    private setupErrorHandling;
    /**
     * 启动服务器
     */
    start(): Promise<void>;
    /**
     * 确保日志目录存在
     */
    private ensureLogDirectory;
    /**
     * 验证配置
     */
    private validateConfiguration;
    /**
     * 打印使用说明
     */
    private printUsageInstructions;
    /**
     * 关闭服务器
     */
    private shutdown;
}
export default MCPDeploymentServer;
//# sourceMappingURL=server.d.ts.map