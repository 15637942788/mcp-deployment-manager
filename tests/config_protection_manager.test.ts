import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleConfigProtectionManager } from '../src/handlers/tools';
import { ConfigService } from '../src/services/configService';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService();

describe('config_protection_manager 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应能启用配置保护', async () => {
    const timer = { end: vi.fn() };
    const result = await handleConfigProtectionManager(mockConfigService, { action: 'enable', protectionLevel: 'strict' }, timer as any);
    expect(result.content[0].text).toContain('MCP配置保护已启用');
    expect(result.content[0].text).toContain('严格');
  });

  it('应能禁用配置保护', async () => {
    const timer = { end: vi.fn() };
    const result = await handleConfigProtectionManager(mockConfigService, { action: 'disable' }, timer as any);
    expect(result.content[0].text).toContain('MCP配置保护已禁用');
  });

  it('应能查询配置保护状态', async () => {
    const timer = { end: vi.fn() };
    mockConfigService.listBackups = vi.fn().mockResolvedValue([]);
    mockConfigService.getBackupPath = vi.fn().mockReturnValue('/mock/backup');
    const result = await handleConfigProtectionManager(mockConfigService, { action: 'status' }, timer as any);
    expect(result.content[0].text).toContain('configurationProtection');
    expect(result.content[0].text).toContain('backupStatus');
  });
}); 