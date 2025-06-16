import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolLogger } from "../utils/logger.js";

/**
 * 设置提示词处理器
 */
export function setupPromptHandlers(server: Server): void {

  // 列出可用提示词
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "deploy_server_guide",
          description: "生成MCP服务器部署指导",
          arguments: [
            {
              name: "serverType",
              description: "服务器类型 (node, python, npm, executable)",
              required: true
            },
            {
              name: "serverPath",
              description: "服务器文件路径",
              required: false
            }
          ]
        },
        {
          name: "troubleshoot_deployment",
          description: "生成部署故障排除指导",
          arguments: [
            {
              name: "errorMessage",
              description: "错误信息",
              required: true
            },
            {
              name: "serverName",
              description: "服务器名称",
              required: false
            }
          ]
        },
        {
          name: "config_validation_help",
          description: "生成配置验证帮助信息",
          arguments: [
            {
              name: "validationErrors",
              description: "验证错误列表",
              required: true
            }
          ]
        },
        {
          name: "mcp_server_analysis",
          description: "分析MCP服务器配置并提供优化建议",
          arguments: [
            {
              name: "configContent",
              description: "配置文件内容",
              required: true
            }
          ]
        },
        {
          name: "backup_strategy",
          description: "生成备份策略建议",
          arguments: [
            {
              name: "serversCount",
              description: "服务器数量",
              required: false
            }
          ]
        }
      ]
    };
  });

  // 获取提示词内容
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    toolLogger.debug("获取提示词", { name, arguments: args });

    switch (name) {
      case "deploy_server_guide":
        return generateDeployGuide(args?.serverType, args?.serverPath);

      case "troubleshoot_deployment":
        return generateTroubleshootGuide(args?.errorMessage, args?.serverName);

      case "config_validation_help":
        return generateValidationHelp(args?.validationErrors);

      case "mcp_server_analysis":
        return generateServerAnalysis(args?.configContent);

      case "backup_strategy":
        return generateBackupStrategy(args?.serversCount);

      default:
        throw new Error(`未知提示词: ${name}`);
    }
  });
}

/**
 * 生成部署指导提示词
 */
function generateDeployGuide(serverType?: string, serverPath?: string) {
  const basePrompt = `
# MCP服务器部署指导

请帮助用户部署一个MCP服务器到Cursor配置中。

## 服务器信息
${serverType ? `- 服务器类型: ${serverType}` : '- 服务器类型: 待确定'}
${serverPath ? `- 服务器路径: ${serverPath}` : '- 服务器路径: 待指定'}

## 部署步骤指导

请按照以下步骤提供详细的指导：

1. **验证服务器文件**
   - 检查文件是否存在
   - 验证文件类型和权限
   - 确认服务器是否可执行

2. **配置参数设置**
   - 选择合适的服务器名称
   - 设置环境变量（如果需要）
   - 配置自动批准选项

3. **部署执行**
   - 使用deploy_mcp_server工具
   - 验证部署结果
   - 检查配置文件更新

4. **测试验证**
   - 重启Cursor IDE
   - 验证服务器状态
   - 测试服务器功能

## 注意事项
- 部署前会自动创建配置备份
- 建议先在测试环境验证服务器功能
- 服务器名称必须唯一，避免冲突

请根据用户的具体情况提供个性化的部署建议。
`;

  return {
    description: "MCP服务器部署指导",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: basePrompt
        }
      }
    ]
  };
}

/**
 * 生成故障排除指导提示词
 */
function generateTroubleshootGuide(errorMessage?: string, serverName?: string) {
  const troubleshootPrompt = `
# MCP服务器部署故障排除

请帮助用户解决MCP服务器部署中遇到的问题。

## 问题信息
${errorMessage ? `- 错误信息: ${errorMessage}` : '- 错误信息: 待提供'}
${serverName ? `- 服务器名称: ${serverName}` : '- 服务器名称: 未指定'}

## 常见问题诊断

请按照以下流程帮助用户排查问题：

### 1. 文件路径问题
- 检查服务器文件路径是否正确
- 验证文件是否存在和可访问
- 确认路径格式（Windows使用绝对路径）

### 2. 权限问题
- 检查文件执行权限
- 验证Cursor配置目录访问权限
- 确认用户账户权限

### 3. 配置格式问题
- 验证JSON语法正确性
- 检查必需字段是否完整
- 确认数据类型匹配

### 4. 环境依赖问题
- 检查Node.js/Python版本
- 验证运行时环境
- 确认依赖包安装

### 5. 名称冲突问题
- 检查服务器名称是否重复
- 验证配置键值唯一性

## 解决方案建议

请根据错误信息提供：
1. 问题根本原因分析
2. 具体解决步骤
3. 预防措施建议
4. 相关工具使用方法

## 验证步骤
- 使用validate_config工具检查配置
- 使用get_system_status查看状态
- 检查日志文件获取详细信息
`;

  return {
    description: "MCP部署故障排除指导",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: troubleshootPrompt
        }
      }
    ]
  };
}

/**
 * 生成配置验证帮助提示词
 */
function generateValidationHelp(validationErrors?: string) {
  const validationPrompt = `
# MCP配置验证帮助

请帮助用户理解和修复配置验证错误。

## 验证错误信息
${validationErrors ? `错误列表:\n${validationErrors}` : '错误信息: 待提供'}

## 配置验证规则

请解释以下配置要求：

### 基本结构要求
- 必须是有效的JSON格式
- 必须包含mcpServers字段
- mcpServers必须是对象类型

### 服务器配置要求
每个服务器配置必须包含：
- command: 字符串类型，执行命令
- args: 数组类型，命令参数
- env: 对象类型（可选），环境变量
- disabled: 布尔类型（可选），是否禁用
- autoApprove: 数组类型（可选），自动批准工具

### 常见错误修复

请针对用户的具体错误提供：
1. 错误原因详细解释
2. 正确配置示例
3. 修复步骤指导
4. 验证方法建议

## 最佳实践建议
- 使用绝对路径避免路径问题
- 合理设置环境变量
- 定期备份配置文件
- 使用工具验证配置正确性
`;

  return {
    description: "配置验证帮助指导",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: validationPrompt
        }
      }
    ]
  };
}

/**
 * 生成服务器分析提示词
 */
function generateServerAnalysis(configContent?: string) {
  const analysisPrompt = `
# MCP服务器配置分析

请分析当前的MCP服务器配置并提供优化建议。

## 配置内容
${configContent ? `\`\`\`json\n${configContent}\n\`\`\`` : '配置内容: 待提供'}

## 分析维度

请从以下角度分析配置：

### 1. 配置完整性
- 检查配置结构完整性
- 验证必需字段存在性
- 确认数据类型正确性

### 2. 安全性评估
- 环境变量使用情况
- 权限配置合理性
- 敏感信息保护

### 3. 性能优化
- 服务器启动配置
- 资源使用优化
- 并发连接设置

### 4. 维护便利性
- 命名规范性
- 配置可读性
- 备份策略完善性

## 优化建议

请提供以下建议：
1. 配置结构优化
2. 安全性改进措施
3. 性能提升方案
4. 维护便利性改善

## 最佳实践对比
对比当前配置与最佳实践，指出：
- 符合标准的部分
- 需要改进的地方
- 推荐的配置模式
`;

  return {
    description: "MCP服务器配置分析",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: analysisPrompt
        }
      }
    ]
  };
}

/**
 * 生成备份策略提示词
 */
function generateBackupStrategy(serversCount?: string) {
  const backupPrompt = `
# MCP配置备份策略建议

请帮助用户制定合适的MCP配置备份策略。

## 当前环境信息
${serversCount ? `- MCP服务器数量: ${serversCount}` : '- 服务器数量: 待确定'}
- 备份功能: 已启用
- 自动清理: 支持

## 备份策略建议

### 1. 备份频率
- **高频更新场景**: 每次部署前自动备份
- **稳定环境**: 定期手动备份
- **开发测试**: 重要变更前备份

### 2. 备份保留策略
- 保留最近10个备份（当前设置）
- 重要里程碑版本长期保留
- 定期清理过期备份

### 3. 备份验证
- 定期测试备份完整性
- 验证恢复流程可用性
- 备份文件元数据记录

### 4. 灾难恢复计划
- 快速恢复流程文档
- 关键配置外部存储
- 多重备份存储位置

## 自动化建议

考虑以下自动化措施：
1. 部署前自动备份
2. 定期备份检查
3. 备份状态监控
4. 异常情况告警

## 操作指导

使用以下工具管理备份：
- backup_config: 创建即时备份
- list_backups: 查看备份列表
- restore_config: 从备份恢复

请根据用户的具体需求提供个性化的备份策略建议。
`;

  return {
    description: "MCP配置备份策略建议",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: backupPrompt
        }
      }
    ]
  };
}

export default setupPromptHandlers; 