# MCP Deployment Manager

## 项目简介

MCP Deployment Manager 是一套用于安全、自动化部署 MCP 服务的管理工具，支持多语言服务（Node.js、Python、NPM、可执行文件等），并内置严格的安全标准与配置保护机制，保障生产环境的合规与可恢复性。

---

## 主要功能
- 一键安全部署 MCP 服务，自动执行安全检查与配置备份
- 严格依赖与配置安全校验，防止敏感信息泄露
- 多级配置保护与自动恢复机制
- 支持多种服务类型（node、python、npm、executable）
- 丰富的 API 与自动化测试支持

---

## 安全标准（核心摘要）
- 禁止危险函数与命令（如 eval、exec、rm -rf 等）
- 依赖包无已知高危漏洞，版本固定
- 配置文件不含敏感信息，敏感参数通过环境变量传递
- 强制部署前备份，支持一键恢复
- 部署标准文件（mcp-部署标准.mdc）自动同步与校验
- 详细安全标准见 `.cursor/rules/mcp-部署标准.mdc`

---

## 目录结构

```
your-mcp-project/
├── .cursor/
│   └── rules/
│       └── mcp-部署标准.mdc  # 部署安全标准文件
├── src/
│   ├── handlers/
│   │   ├── tools.ts                # 部署与管理核心逻辑
│   │   └── ensureDeploymentRules.ts # 部署标准校验与同步
│   └── services/
│       └── configService.ts        # 配置与备份服务
├── tests/
│   └── deploy_mcp_server.test.ts   # 单元测试
├── package.json
├── README.md
└── LICENSE
```

---

## 快速开始

1. 安装依赖：
   ```bash
   npm install
   ```
2. 运行测试：
   ```bash
   npx vitest run
   ```
3. 部署 MCP 服务（示例）：
   ```ts
   import { ConfigService } from './src/services/configService';
   import { handleDeployServer } from './src/handlers/tools';

   const configService = new ConfigService();
   const deployArgs = { /* 参考 API 文档 */ };
   const timer = { end: () => {} };
   handleDeployServer(configService, deployArgs, timer);
   ```

---

## 主要 API 文档

### `handleDeployServer`

> 安全部署 MCP 服务到配置中，自动执行安全检查、标准校验与备份。

**签名：**
```ts
handleDeployServer(
  configService: ConfigService,
  args: DeployServerRequest,
  timer: PerformanceTimer
): Promise<any>
```

**参数说明：**
- `configService`：配置服务实例
- `args`：部署参数对象（包含 name、serverPath、serverType、env、force 等）
- `timer`：性能计时器对象（需实现 end 方法）

**返回：**
- Promise，成功时返回 `{ content: [{ type: 'text', text: ... }] }`，失败时抛出异常或返回错误结构

**典型用法：**
```ts
const result = await handleDeployServer(configService, deployArgs, timer);
console.log(result.content[0].text);
```

---

### `ensureDeploymentRules`

> 校验并同步项目级部署标准文件，自动从全局标准复制，保障合规。

**签名：**
```ts
ensureDeploymentRules(serverPath: string): Promise<{
  success: boolean;
  message: string;
  projectStandardRequired: boolean;
  projectStandardExists: boolean;
  standardSynced: boolean;
  targetPath?: string;
  sourcePath?: string;
}>
```

**参数说明：**
- `serverPath`：MCP 服务主文件路径（如 `src/server.js`）

**返回：**
- Promise，返回标准校验与同步结果对象

---

## 测试与开发

- 所有核心逻辑均有 Vitest 单元测试覆盖
- 测试 mock 采用模块级 mock，隔离所有外部依赖
- 运行 `npx vitest run` 可快速验证所有功能

---

## 贡献指南

1. Fork 本仓库并新建分支
2. 保持代码风格与注释规范
3. 提交 PR 前请确保所有测试通过
4. 详细安全标准请参考 `.cursor/rules/mcp-部署标准.mdc`

---

## License

MIT 