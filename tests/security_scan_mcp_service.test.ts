import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSecurityScan } from '../src/handlers/tools';

// 模拟依赖
vi.mock('../src/services/securityService', () => ({
  SecurityService: vi.fn().mockImplementation(() => ({
    scanMCPService: vi.fn()
  }))
}));

const mockScanResultPass = {
  passed: true,
  score: 95,
  errors: [],
  warnings: []
};
const mockScanResultFail = {
  passed: false,
  score: 40,
  errors: ['危险函数'],
  warnings: ['依赖风险']
};

describe('security_scan_mcp_service 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应能通过安全扫描', async () => {
    const timer = { end: vi.fn() };
    const SecurityService = (await import('../src/services/securityService')).SecurityService;
    SecurityService.prototype.scanMCPService = vi.fn().mockResolvedValue(mockScanResultPass);
    const result = await handleSecurityScan({ serverPath: 'mock.js' }, timer as any);
    expect(result.content[0].text).toContain('安全性优秀');
    expect(result.content[0].text).toContain('可以安全部署');
  });

  it('安全扫描不通过时应有风险提示', async () => {
    const timer = { end: vi.fn() };
    const SecurityService = (await import('../src/services/securityService')).SecurityService;
    SecurityService.prototype.scanMCPService = vi.fn().mockResolvedValue(mockScanResultFail);
    const result = await handleSecurityScan({ serverPath: 'mock.js' }, timer as any);
    expect(result.content[0].text).toContain('危险');
    expect(result.content[0].text).toContain('禁止部署');
  });
}); 