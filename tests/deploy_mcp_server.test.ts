import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleDeployServer } from '../src/handlers/tools';

// 模拟依赖
vi.mock('../src/services/configService');

const mockConfigService = new ConfigService() as unknown as ConfigService;

// 假设的部署参数
const deployArgs = {
  name: 'test-server',
  serverPath: 'E:/mcp/test-server.js',
  serverType: 'node',
  description: '测试MCP服务器',
  env: { API_KEY: 'test-key' },
  disabled: false
};

describe('deploy_mcp_server 核心功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应能成功部署MCP服务器', async () => {
    // 假设部署成功
    mockConfigService.deployServer = vi.fn().mockResolvedValue({ success: true, message: '部署成功' });
    const timer = { end: vi.fn() };
    const result = await handleDeployServer(mockConfigService, deployArgs, timer as any);
    expect(result).toHaveProperty('content');
    expect(JSON.stringify(result.content)).toContain('部署成功');
  });

  it('部署失败时应返回详细错误', async () => {
    mockConfigService.deployServer = vi.fn().mockResolvedValue({ success: false, message: '配置冲突' });
    const timer = { end: vi.fn() };
    const result = await handleDeployServer(mockConfigService, deployArgs, timer as any);
    expect(JSON.stringify(result.content)).toContain('配置冲突');
  });
}); 