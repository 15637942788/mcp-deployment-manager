# MCP服务部署管理器功能详解

> 本文档详尽介绍"MCP服务部署管理器"项目的全部功能、特性及典型应用场景，便于用户理解和高效使用本服务。

---

## 一、项目简介

MCP服务部署管理器是一个符合MCP标准的服务器，专为管理和部署其他MCP服务到Cursor的全局配置中而设计。它集成了服务部署、配置管理、安全审计、智能辅助等多项功能，极大提升了MCP服务的运维效率和安全性。

---

## 二、核心功能详解

### 1. MCP服务统一管理与部署
- **deploy_mcp_server**：
  - 部署新的MCP服务器到Cursor配置。
  - 支持多种服务器类型（Node.js、Python、NPM包、可执行文件）。
  - 可指定服务器路径、类型、描述、环境变量、自动批准工具等参数。
  - 部署前自动备份配置，部署后自动校验。
- **remove_mcp_server**：
  - 移除已配置的MCP服务器。
  - 自动更新Cursor配置并备份。
- **list_mcp_servers**：
  - 列出所有已配置的MCP服务器，展示服务器名称、类型、状态等详细信息。
- **scan_mcp_servers**：
  - 扫描指定目录，自动发现潜在的MCP服务器，辅助批量管理。
- **get_system_status**：
  - 获取系统运行状态、服务器健康状况、资源占用等统计信息。

### 2. 配置与备份管理
- **backup_config**：
  - 创建Cursor配置的完整备份，支持自动和手动触发。
  - 备份文件自动编号，最多保留10个最新备份。
- **restore_config**：
  - 从指定备份恢复Cursor配置，支持应急回滚。
- **validate_config**：
  - 严格校验配置文件格式，基于JSON Schema，防止配置错误导致服务异常。
- **get_cursor_config_path**：
  - 获取当前Cursor配置文件的绝对路径，便于定位和手动操作。
- **config://current**、**config://backup-list**：
  - 实时访问当前配置内容和所有可用备份列表。

### 3. 日志与资源访问
- **logs://combined.log**：
  - 综合日志，记录所有操作和系统事件。
- **logs://deployment.log**：
  - 部署相关操作日志，便于追踪部署历史。
- **logs://error.log**：
  - 错误日志，详细记录异常和故障信息。
- **system://status**：
  - 系统状态信息，辅助监控和运维。

### 4. 智能辅助与提示
- **deploy_server_guide**：
  - 自动生成MCP服务器部署指导，降低新手上手难度。
- **troubleshoot_deployment**：
  - 部署故障排查建议，快速定位并解决常见问题。
- **config_validation_help**：
  - 配置验证错误修复指导，提升配置正确率。
- **mcp_server_analysis**：
  - 配置分析和优化建议，提升系统性能和安全性。
- **backup_strategy**：
  - 备份策略建议，保障数据安全。

---

## 三、安全特性
- **自动备份**：每次配置变更前自动备份，防止误操作。
- **配置验证**：所有配置变更均需通过严格的JSON Schema校验。
- **权限检查**：操作前验证文件和目录的访问权限，防止越权。
- **错误处理与恢复**：全面的异常捕获和恢复机制，支持一键回滚。
- **审计日志**：详细记录所有操作，便于安全审计和问题追踪。

---

## 四、典型使用场景
- 一键部署/移除/管理MCP服务器，适用于多服务统一运维。
- 配置变更自动备份与恢复，适合高安全性要求的生产环境。
- 配置和权限安全校验，防止因配置错误或权限问题导致服务中断。
- 故障排查与日志分析，提升运维效率和系统稳定性。
- 智能提示辅助新手快速上手和高效运维。

---

## 五、项目结构简述

```
mcp-deployment-manager/
├── src/                    # 核心源代码
│   ├── server.ts          # 主服务器文件
│   ├── config/            # 配置管理
│   ├── handlers/          # 请求处理器
│   ├── services/          # 业务服务
│   ├── types/             # 类型定义
│   └── utils/             # 工具函数
├── dist/                  # 编译输出
├── logs/                  # 日志文件
├── scripts/               # 部署脚本
├── tests/                 # 测试用例
└── docs/                  # 项目文档
```

---

如需详细操作方法或接口说明，请参考项目自带的`README.md`或`docs/`目录。 