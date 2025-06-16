import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/configService';
import { handleValidateConfig } from '../src/handlers/tools';

vi.mock('../src/services/configService');
const mockConfigService = new ConfigService() as unknown as ConfigService;

describe('validate_config 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应能成功校验配置', async () => {
    mockConfigService.validateConfig = vi.fn().mockResolvedValue({ success: true, message: '校验通过' });
    const timer = { end: vi.fn() };
    const result = await handleValidateConfig(mockConfigService, timer as any);
    expect(result.content[0].text).toContain('校验通过');
  });

  it('校验失败时应返回错误信息', async () => {
    mockConfigService.validateConfig = vi.fn().mockResolvedValue({ success: false, message: '校验失败' });
    const timer = { end: vi.fn() };
    const result = await handleValidateConfig(mockConfigService, timer as any);
    expect(result.content[0].text).toContain('校验失败');
  });
}); 