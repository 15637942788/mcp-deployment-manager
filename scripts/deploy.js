#!/usr/bin/env node

/**
 * MCP服务部署管理器自动部署脚本
 * 
 * 这个脚本将MCP服务部署管理器自身部署到Cursor的全局配置中
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置常量
const CONFIG = {
  serverName: 'mcp-deployment-manager',
  cursorConfigPath: path.join(os.homedir(), '.cursor', 'mcp.json'),
  projectPath: path.resolve(__dirname, '..'),
  serverPath: path.resolve(__dirname, '..', 'dist', 'server.js')
};

/**
 * 主部署函数
 */
async function deployToMCP() {
  console.log('🚀 开始部署MCP服务部署管理器...\n');

  try {
    // 步骤1: 验证环境
    console.log('📋 步骤1: 验证部署环境');
    await validateEnvironment();
    console.log('✅ 环境验证通过\n');

    // 步骤2: 构建项目
    console.log('📋 步骤2: 构建项目');
    await buildProject();
    console.log('✅ 项目构建完成\n');

    // 步骤3: 备份现有配置
    console.log('📋 步骤3: 备份现有配置');
    await backupExistingConfig();
    console.log('✅ 配置备份完成\n');

    // 步骤4: 更新Cursor配置
    console.log('📋 步骤4: 更新Cursor配置');
    await updateCursorConfig();
    console.log('✅ 配置更新完成\n');

    // 步骤5: 验证部署
    console.log('📋 步骤5: 验证部署');
    await validateDeployment();
    console.log('✅ 部署验证通过\n');

    console.log('🎉 MCP服务部署管理器已成功部署！');
    console.log('\n📖 使用说明:');
    console.log('1. 重启Cursor IDE');
    console.log('2. 在Cursor中使用MCP工具');
    console.log('3. 可用工具包括: deploy_mcp_server, list_mcp_servers, backup_config等');
    console.log(`\n📁 配置文件位置: ${CONFIG.cursorConfigPath}`);
    console.log(`📁 服务器文件位置: ${CONFIG.serverPath}`);

  } catch (error) {
    console.error('\n❌ 部署失败:', error.message);
    console.error('\n🔧 故障排除建议:');
    console.error('1. 检查Node.js版本 (需要 >= 18.0.0)');
    console.error('2. 确保有写入Cursor配置目录的权限');
    console.error('3. 验证项目依赖已正确安装');
    console.error('4. 检查TypeScript编译是否成功');
    process.exit(1);
  }
}

/**
 * 验证部署环境
 */
async function validateEnvironment() {
  // 检查Node.js版本
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 18) {
    throw new Error(`Node.js版本过低: ${nodeVersion}，需要 >= 18.0.0`);
  }
  console.log(`  ✓ Node.js版本: ${nodeVersion}`);

  // 检查项目结构
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'src/server.ts'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(CONFIG.projectPath, file);
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`缺少必需文件: ${file}`);
    }
  }
  console.log(`  ✓ 项目结构完整`);

  // 检查依赖是否安装
  const nodeModulesPath = path.join(CONFIG.projectPath, 'node_modules');
  if (!(await fs.pathExists(nodeModulesPath))) {
    throw new Error('依赖未安装，请运行: npm install');
  }
  console.log(`  ✓ 依赖已安装`);

  // 检查Cursor配置目录权限
  const configDir = path.dirname(CONFIG.cursorConfigPath);
  await fs.ensureDir(configDir);
  
  try {
    await fs.access(configDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    throw new Error(`无法访问Cursor配置目录: ${configDir}`);
  }
  console.log(`  ✓ Cursor配置目录可访问: ${configDir}`);
}

/**
 * 构建项目
 */
async function buildProject() {

  return new Promise((resolve, reject) => {
    console.log('  🔨 正在编译TypeScript...');
    
    const tsc = spawn('npx', ['tsc'], {
      cwd: CONFIG.projectPath,
      shell: true,
      stdio: 'pipe'
    });

    let output = '';
    let error = '';

    tsc.stdout.on('data', (data) => {
      output += data.toString();
    });

    tsc.stderr.on('data', (data) => {
      error += data.toString();
    });

    tsc.on('close', (code) => {
      if (code === 0) {
        console.log('  ✓ TypeScript编译成功');
        resolve();
      } else {
        console.error('  ❌ TypeScript编译失败:');
        console.error(error || output);
        reject(new Error('TypeScript编译失败'));
      }
    });
  });
}

/**
 * 备份现有配置
 */
async function backupExistingConfig() {
  if (await fs.pathExists(CONFIG.cursorConfigPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${CONFIG.cursorConfigPath}.backup-${timestamp}`;
    
    await fs.copy(CONFIG.cursorConfigPath, backupPath);
    console.log(`  ✓ 配置已备份: ${backupPath}`);
  } else {
    console.log('  ℹ️  配置文件不存在，将创建新配置');
  }
}

/**
 * 更新Cursor配置
 */
async function updateCursorConfig() {
  let config = { mcpServers: {} };

  // 读取现有配置
  if (await fs.pathExists(CONFIG.cursorConfigPath)) {
    try {
      const content = await fs.readFile(CONFIG.cursorConfigPath, 'utf-8');
      config = JSON.parse(content);
      console.log(`  ✓ 读取现有配置，包含 ${Object.keys(config.mcpServers || {}).length} 个服务器`);
    } catch (error) {
      console.log('  ⚠️  现有配置格式错误，将创建新配置');
      config = { mcpServers: {} };
    }
  }

  // 确保mcpServers字段存在
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // 添加或更新MCP部署管理器配置
  const serverConfig = {
    command: "node",
    args: [CONFIG.serverPath],
    env: {
      NODE_ENV: "production",
      LOG_LEVEL: "info"
    },
    disabled: false,
    autoApprove: []
  };

  config.mcpServers[CONFIG.serverName] = serverConfig;

  // 写入配置文件
  const configContent = JSON.stringify(config, null, 2);
  await fs.writeFile(CONFIG.cursorConfigPath, configContent, 'utf-8');
  
  console.log(`  ✓ 已添加服务器配置: ${CONFIG.serverName}`);
  console.log(`  ✓ 配置文件已更新: ${CONFIG.cursorConfigPath}`);
}

/**
 * 验证部署
 */
async function validateDeployment() {
  // 检查服务器文件存在
  if (!(await fs.pathExists(CONFIG.serverPath))) {
    throw new Error(`服务器文件不存在: ${CONFIG.serverPath}`);
  }
  console.log(`  ✓ 服务器文件存在: ${CONFIG.serverPath}`);

  // 检查配置文件格式
  try {
    const content = await fs.readFile(CONFIG.cursorConfigPath, 'utf-8');
    const config = JSON.parse(content);
    
    if (!config.mcpServers || !config.mcpServers[CONFIG.serverName]) {
      throw new Error('配置文件中缺少服务器配置');
    }
    
    console.log(`  ✓ 配置文件格式正确`);
    console.log(`  ✓ 服务器配置已添加: ${CONFIG.serverName}`);
    
  } catch (error) {
    throw new Error(`配置验证失败: ${error.message}`);
  }

  // 尝试启动服务器进行测试（可选）
  console.log('  ℹ️  服务器将在Cursor启动时自动加载');
}

/**
 * 显示使用说明
 */
function showUsageInstructions() {
  console.log('\n📚 MCP服务部署管理器使用指南:');
  console.log('\n🛠️  主要工具:');
  console.log('  • deploy_mcp_server     - 部署新的MCP服务器');
  console.log('  • remove_mcp_server     - 移除MCP服务器');
  console.log('  • list_mcp_servers      - 列出所有服务器');
  console.log('  • get_system_status     - 获取系统状态');
  console.log('  • backup_config         - 创建配置备份');
  console.log('  • restore_config        - 从备份恢复');
  console.log('  • validate_config       - 验证配置文件');
  console.log('  • scan_mcp_servers      - 扫描MCP服务器');

  console.log('\n📖 资源访问:');
  console.log('  • config://cursor/mcp.json  - Cursor配置文件');
  console.log('  • logs://combined.log       - 综合日志');
  console.log('  • system://status           - 系统状态');

  console.log('\n💡 提示词模板:');
  console.log('  • deploy_server_guide       - 部署指导');
  console.log('  • troubleshoot_deployment   - 故障排除');
  console.log('  • config_validation_help    - 配置验证帮助');
}

// 运行部署
deployToMCP().then(() => {
  showUsageInstructions();
}).catch((error) => {
  console.error('部署过程发生错误:', error);
  process.exit(1);
});

export { deployToMCP, CONFIG }; 