import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleRestoreConfig } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService() as unknown as ConfigService;

describe('restore_config 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockConfigService as any).restoreFromBackupWithResult = vi.fn();
  });

  it('应能成功恢复配置', async () => {
    (mockConfigService as any).restoreFromBackupWithResult.mockResolvedValue({ success: true, message: '恢复成功', errors: undefined });
    const timer = { end: vi.fn() };
    const result = await handleRestoreConfig(mockConfigService, { backupFile: 'backup-001.json' }, timer as any);
    expect(result.content[0].text).toContain('恢复成功');
  });

  it('恢复失败时应返回错误信息', async () => {
    (mockConfigService as any).restoreFromBackupWithResult.mockResolvedValue({ success: false, message: '恢复失败', errors: ['mock error'] });
    const timer = { end: vi.fn() };
    const result = await handleRestoreConfig(mockConfigService, { backupFile: 'backup-002.json' }, timer as any);
    expect(result.content[0].text).toContain('恢复失败');
    expect(result.content[0].text).toContain('mock error');
  });
}); 