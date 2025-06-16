import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import * as fs from 'fs-extra';
import * as tools from '../src/handlers/tools';

vi.mock('../src/handlers/ensureDeploymentRules', () => ({
  ensureDeploymentRules: vi.fn().mockResolvedValue({
    success: true,
    message: 'mocked',
    projectStandardRequired: true,
    projectStandardExists: true,
    standardSynced: true,
    targetPath: 'mock-path'
  })
}));

vi.mock('../src/handlers/tools', async () => {
  const actual = await vi.importActual<any>('../src/handlers/tools');
  return {
    ...actual,
    getCommandForServerType: vi.fn().mockReturnValue('node'),
    getArgsForServerType: vi.fn().mockReturnValue(['E:/mcp/test-server.js'])
  };
});

vi.mock('fs-extra', () => ({
  pathExists: vi.fn().mockResolvedValue(true),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  mkdirs: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  existsSync: vi.fn().mockReturnValue(true),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
  copyFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined)
}));

const deployArgs = {
  name: 'test-server',
  serverPath: 'E:/mcp/test-server.js',
  serverType: 'node' as const,
  description: '测试MCP服务器',
  env: { API_KEY: 'test-key' },
  disabled: false
};

const { handleDeployServer } = tools;
describe('deploy_mcp_server 核心功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ConfigService.prototype, 'addServerWithProtection').mockReset();
    // fs.pathExists 已由 vi.mock 统一处理，无需赋值
  });

  it('应能成功部署MCP服务器', async () => {
    vi.spyOn(ConfigService.prototype, 'addServerWithProtection').mockResolvedValue({
      success: true,
      message: '部署成功',
      serverName: 'test-server',
      backupInfo: { filename: 'backup.json', size: 123, configCount: 1, timestamp: '2024-01-01T00:00:00.000Z' },
      securityScan: {
        passed: true,
        score: 90,
        warnings: [],
        errors: [],
        details: {
          codeAnalysis: {
            passed: true,
            dangerousFunctions: [],
            suspiciousPatterns: [],
            maliciousCommands: []
          },
          dependencyCheck: {
            passed: true,
            hasPackageJson: true,
            hasRequirementsTxt: false,
            vulnerableDependencies: [],
            unspecifiedVersions: []
          },
          configurationCheck: {
            passed: true,
            hardcodedSecrets: [],
            insecureConfigs: []
          },
          permissionCheck: {
            passed: true,
            fileExists: true,
            isExecutable: true,
            isInSecurePath: true,
            pathTraversalRisk: false
          }
        }
      },
      errors: [],
      warnings: []
    });
    const timer = { end: vi.fn() };
    let result, error;
    try {
      result = await handleDeployServer(new ConfigService(), deployArgs, timer as any);
    } catch (e) {
      error = e;
    }
    if (error) {
      throw error;
    }
    expect(result).toHaveProperty('content');
    expect(JSON.stringify(result.content)).toContain('部署成功');
    expect(JSON.stringify(result.content)).toContain('test-server');
  });

  it('部署失败时应返回详细错误', async () => {
    vi.spyOn(ConfigService.prototype, 'addServerWithProtection').mockResolvedValue({
      success: false,
      message: '配置冲突',
      serverName: 'test-server',
      backupInfo: undefined,
      securityScan: {
        passed: false,
        score: 0,
        warnings: ['mock warning'],
        errors: ['mock error'],
        details: {
          codeAnalysis: {
            passed: false,
            dangerousFunctions: [],
            suspiciousPatterns: [],
            maliciousCommands: []
          },
          dependencyCheck: {
            passed: false,
            hasPackageJson: false,
            hasRequirementsTxt: false,
            vulnerableDependencies: [],
            unspecifiedVersions: []
          },
          configurationCheck: {
            passed: false,
            hardcodedSecrets: [],
            insecureConfigs: []
          },
          permissionCheck: {
            passed: false,
            fileExists: false,
            isExecutable: false,
            isInSecurePath: false,
            pathTraversalRisk: false
          }
        }
      },
      errors: ['mock error'],
      warnings: ['mock warning']
    });
    const timer = { end: vi.fn() };
    let result, error;
    try {
      result = await handleDeployServer(new ConfigService(), deployArgs, timer as any);
    } catch (e) {
      error = e;
    }
    if (error) {
      throw error;
    }
    expect(JSON.stringify(result.content)).toContain('配置冲突');
    expect(JSON.stringify(result.content)).toContain('mock error');
    expect(JSON.stringify(result.content)).toContain('mock warning');
  });
}); 