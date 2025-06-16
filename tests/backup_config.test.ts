import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleBackupConfig } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService() as unknown as ConfigService;

describe('backup_config 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockConfigService as any).createBackupWithResult = vi.fn();
  });

  it('应能成功创建配置备份', async () => {
    (mockConfigService as any).createBackupWithResult.mockResolvedValue({ success: true, message: '备份成功', backupPath: '/mock/path', errors: undefined });
    const timer = { end: vi.fn() };
    const result = await handleBackupConfig(mockConfigService, { comment: '测试备份' }, timer as any);
    expect(result.content[0].text).toContain('备份成功');
    expect(result.content[0].text).toContain('/mock/path');
  });

  it('备份失败时应返回错误信息', async () => {
    (mockConfigService as any).createBackupWithResult.mockResolvedValue({ success: false, message: '备份失败', backupPath: undefined, errors: ['mock error'] });
    const timer = { end: vi.fn() };
    const result = await handleBackupConfig(mockConfigService, { comment: 'fail' }, timer as any);
    expect(result.content[0].text).toContain('备份失败');
    expect(result.content[0].text).toContain('mock error');
  });
}); 