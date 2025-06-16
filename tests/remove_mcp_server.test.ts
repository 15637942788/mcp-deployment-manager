import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleRemoveServer } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService();

describe('remove_mcp_server 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockConfigService as any).removeServer = vi.fn();
  });

  it('应能成功移除MCP服务器', async () => {
    (mockConfigService as any).removeServer.mockResolvedValue({ success: true, message: '移除成功' });
    const timer = { end: vi.fn() };
    const result = await handleRemoveServer(mockConfigService, { name: 'server1' }, timer as any);
    expect(result.content[0].text).toContain('移除成功');
  });

  it('移除失败时应返回错误信息', async () => {
    (mockConfigService as any).removeServer.mockResolvedValue({ success: false, message: '未找到服务器' });
    const timer = { end: vi.fn() };
    const result = await handleRemoveServer(mockConfigService, { name: 'serverX' }, timer as any);
    expect(result.content[0].text).toContain('未找到服务器');
  });
}); 