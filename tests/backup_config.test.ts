import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleBackupConfig } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService() as unknown as ConfigService;

describe('backup_config 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应能成功创建配置备份', async () => {
    mockConfigService.createBackup = vi.fn().mockResolvedValue({ success: true, filename: 'backup-001.json' });
    const timer = { end: vi.fn() };
    const result = await handleBackupConfig(mockConfigService, { comment: '测试备份' }, timer as any);
    expect(result.content[0].text).toContain('backup-001.json');
  });

  it('备份失败时应返回错误信息', async () => {
    mockConfigService.createBackup = vi.fn().mockResolvedValue({ success: false, message: '备份失败' });
    const timer = { end: vi.fn() };
    const result = await handleBackupConfig(mockConfigService, { comment: 'fail' }, timer as any);
    expect(result.content[0].text).toContain('备份失败');
  });
}); 