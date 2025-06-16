# MCP服务部署管理器

> 一个符合MCP标准的服务器，专门用于管理和部署其他MCP服务到Cursor的全局配置中

## ✨ 功能特性

### 🛠️ 核心工具
- **deploy_mcp_server** - 部署新的MCP服务器到Cursor配置
- **remove_mcp_server** - 移除现有的MCP服务器
- **list_mcp_servers** - 列出所有已配置的MCP服务器
- **get_system_status** - 获取系统状态和统计信息
- **backup_config** - 创建Cursor配置的备份
- **restore_config** - 从备份恢复配置
- **validate_config** - 验证配置文件的有效性
- **scan_mcp_servers** - 扫描目录查找潜在的MCP服务器
- **get_cursor_config_path** - 获取Cursor配置文件路径

### 📖 资源访问
- **config://cursor/mcp.json** - 实时访问Cursor配置文件
- **config://current** - 解析后的当前配置内容
- **config://backup-list** - 可用备份列表
- **logs://combined.log** - 综合日志文件
- **logs://deployment.log** - 部署操作日志
- **logs://error.log** - 错误日志
- **system://status** - 系统状态信息

### 💡 智能提示词
- **deploy_server_guide** - 生成MCP服务器部署指导
- **troubleshoot_deployment** - 部署故障排除帮助
- **config_validation_help** - 配置验证错误修复指导
- **mcp_server_analysis** - 配置分析和优化建议
- **backup_strategy** - 备份策略建议

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 自动部署到Cursor
```bash
npm run deploy
```

这将自动：
1. 编译TypeScript代码
2. 备份现有Cursor配置
3. 将服务器添加到MCP配置中
4. 验证部署成功

### 手动构建和运行
```bash
# 构建项目
npm run build

# 测试服务器
npm run dev

# 生产环境启动
npm start
```

## 📁 项目结构

```
mcp-deployment-manager/
├── src/                    # 源代码
│   ├── server.ts          # 主服务器文件
│   ├── config/            # 配置管理
│   ├── handlers/          # 请求处理器
│   │   ├── tools.ts       # 工具处理器
│   │   ├── resources.ts   # 资源处理器
│   │   └── prompts.ts     # 提示词处理器
│   ├── services/          # 业务服务
│   │   └── configService.ts # 配置管理服务
│   ├── types/             # 类型定义
│   └── utils/             # 工具函数
│       └── logger.ts      # 日志工具
├── dist/                  # 编译输出
├── logs/                  # 日志文件
├── scripts/               # 部署脚本
│   └── deploy.js         # 自动部署脚本
├── tests/                 # 测试文件
└── docs/                  # 文档
```

## 🔧 使用指南

### 部署新的MCP服务器

```javascript
// 使用deploy_mcp_server工具
{
  "name": "my-awesome-server",
  "serverPath": "E:\\path\\to\\server.js",
  "serverType": "node",
  "description": "我的MCP服务器",
  "env": {
    "API_KEY": "your-api-key"
  },
  "disabled": false
}
```

### 支持的服务器类型

- **node** - Node.js服务器 (.js, .ts)
- **python** - Python服务器 (.py)
- **npm** - NPM包服务器
- **executable** - 可执行文件 (.exe)

### 配置管理

```javascript
// 列出所有服务器
list_mcp_servers()

// 获取系统状态
get_system_status()

// 创建备份
backup_config()

// 验证配置
validate_config()
```

## 📋 配置文件格式

Cursor的MCP配置文件格式：

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["E:\\path\\to\\server.js"],
      "env": {
        "NODE_ENV": "production"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## 🛡️ 安全特性

- **自动备份** - 每次操作前自动备份配置
- **配置验证** - 严格的JSON Schema验证
- **权限检查** - 验证文件和目录访问权限
- **错误处理** - 全面的错误处理和恢复
- **审计日志** - 详细的操作审计记录

## 🔍 故障排除

### 常见问题

1. **服务器状态显示红色**
   - 检查Node.js版本 (需要 >= 18.0.0)
   - 验证服务器文件路径正确
   - 确认文件权限可执行

2. **配置文件格式错误**
   - 使用 `validate_config` 工具检查
   - 查看详细错误信息
   - 从备份恢复配置

3. **权限问题**
   - 确保对Cursor配置目录有写入权限
   - 检查文件所有者和权限设置

### 日志查看

```bash
# 查看综合日志
tail -f logs/combined.log

# 查看部署日志
tail -f logs/deployment.log

# 查看错误日志
tail -f logs/error.log
```

## 🔄 更新和维护

### 更新服务器
```bash
git pull
npm install
npm run build
npm run deploy
```

### 清理旧备份
备份文件会自动清理，保留最新的10个备份。

### 配置路径
- **Windows**: `%USERPROFILE%\.cursor\mcp.json`
- **macOS**: `~/.cursor/mcp.json`
- **Linux**: `~/.cursor/mcp.json`

## 📚 MCP标准合规性

本项目严格遵循MCP标准规范：

- ✅ 完整的工具(Tools)实现
- ✅ 资源(Resources)访问支持
- ✅ 提示词(Prompts)模板系统
- ✅ 标准错误处理
- ✅ 结构化日志记录
- ✅ 配置验证和备份
- ✅ 安全最佳实践

## 🤝 贡献

欢迎提交Issue和Pull Request！

### 开发环境设置
```bash
git clone <repository>
cd mcp-deployment-manager
npm install
npm run dev
```

## 📄 许可证

MIT License

## 🔗 相关链接

- [Model Context Protocol 官方文档](https://modelcontextprotocol.io/)
- [Cursor IDE](https://cursor.com/)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)

---

**享受使用MCP服务部署管理器！** 🎉

如有问题，请查看日志文件或提交Issue。 