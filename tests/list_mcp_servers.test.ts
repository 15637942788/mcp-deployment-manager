import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleListServers } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService() as unknown as ConfigService;

describe('list_mcp_servers 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockConfigService as any).listServers = vi.fn();
  });

  it('应能正确列出所有MCP服务器', async () => {
    (mockConfigService as any).listServers.mockResolvedValue([
      { name: 'server1', type: 'node' },
      { name: 'server2', type: 'python' }
    ]);
    const timer = { end: vi.fn() };
    const result = await handleListServers(mockConfigService, timer as any);
    expect(result.content[0].text).toContain('server1');
    expect(result.content[0].text).toContain('server2');
  });
}); 