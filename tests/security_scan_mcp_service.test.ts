import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSecurityScan } from '../src/handlers/tools';
import * as fs from 'fs-extra';
import { SecurityService } from '../src/services/securityService';

vi.mock('fs-extra');

const mockScanResultPass = {
  passed: true,
  score: 95,
  errors: [],
  warnings: [],
  details: {
    codeAnalysis: {
      passed: true,
      dangerousFunctions: [],
      suspiciousPatterns: [],
      maliciousCommands: []
    },
    dependencyCheck: {
      passed: true,
      hasPackageJson: true,
      hasRequirementsTxt: false,
      vulnerableDependencies: [],
      unspecifiedVersions: []
    },
    configurationCheck: {
      passed: true,
      hardcodedSecrets: [],
      insecureConfigs: []
    },
    permissionCheck: {
      passed: true,
      fileExists: true,
      isExecutable: true,
      isInSecurePath: true,
      pathTraversalRisk: false
    }
  }
};
const mockScanResultFail = {
  passed: false,
  score: 40,
  errors: ['危险函数'],
  warnings: ['依赖风险'],
  details: {
    codeAnalysis: {
      passed: false,
      dangerousFunctions: ['eval'],
      suspiciousPatterns: ['rm -rf'],
      maliciousCommands: ['rm -rf']
    },
    dependencyCheck: {
      passed: false,
      hasPackageJson: true,
      hasRequirementsTxt: false,
      vulnerableDependencies: ['bad-package'],
      unspecifiedVersions: ['^1.0.0']
    },
    configurationCheck: {
      passed: false,
      hardcodedSecrets: ['API_KEY'],
      insecureConfigs: ['debug=true']
    },
    permissionCheck: {
      passed: false,
      fileExists: true,
      isExecutable: false,
      isInSecurePath: false,
      pathTraversalRisk: true
    }
  }
};

describe('security_scan_mcp_service 功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.pathExists).mockResolvedValue(true as any);
    vi.spyOn(SecurityService.prototype, 'scanMCPService').mockReset();
  });

  it('应能通过安全扫描', async () => {
    vi.spyOn(SecurityService.prototype, 'scanMCPService').mockResolvedValue(mockScanResultPass);
    const timer = { end: vi.fn() };
    const result = await handleSecurityScan({ serverPath: 'mock.js' }, timer as any);
    expect(result.content[0].text).toContain('安全性优秀');
    expect(result.content[0].text).toContain('可以安全部署');
  });

  it('安全扫描不通过时应有风险提示', async () => {
    vi.spyOn(SecurityService.prototype, 'scanMCPService').mockResolvedValue(mockScanResultFail);
    const timer = { end: vi.fn() };
    const result = await handleSecurityScan({ serverPath: 'mock.js' }, timer as any);
    expect(result.content[0].text).toContain('危险');
    expect(result.content[0].text).toContain('禁止部署');
  });
}); 