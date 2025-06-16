import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleValidateConfig } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService() as unknown as ConfigService;

describe('validate_config 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockConfigService as any).validateCurrentConfig = vi.fn();
  });

  it('应能成功校验配置', async () => {
    (mockConfigService as any).validateCurrentConfig.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    const timer = { end: vi.fn() };
    const result = await handleValidateConfig(mockConfigService, timer as any);
    expect(result.content[0].text).toContain('配置验证通过');
  });

  it('校验失败时应返回错误信息', async () => {
    (mockConfigService as any).validateCurrentConfig.mockResolvedValue({ valid: false, errors: ['mock error'], warnings: ['mock warning'] });
    const timer = { end: vi.fn() };
    const result = await handleValidateConfig(mockConfigService, timer as any);
    expect(result.content[0].text).toContain('配置验证失败');
    expect(result.content[0].text).toContain('mock error');
    expect(result.content[0].text).toContain('mock warning');
  });
}); 