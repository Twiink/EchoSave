/**
 * EchoSave 文件自动移动脚本
 * 监控下载目录，自动将 EchoSave 导出的文件移动到指定位置
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');

// 加载配置
const configPath = path.join(__dirname, 'mover-config.json');
if (!fs.existsSync(configPath)) {
  console.error(chalk.red('❌ 配置文件不存在！'));
  console.log(chalk.yellow('请复制 mover-config.example.json 为 mover-config.json 并配置'));
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 验证配置
if (!config.downloadDir || !config.targetDir) {
  console.error(chalk.red('❌ 配置不完整！请检查 downloadDir 和 targetDir'));
  process.exit(1);
}

// 解析路径
const downloadDir = path.resolve(config.downloadDir);
const targetDir = path.resolve(config.targetDir);

// 验证目录
if (!fs.existsSync(downloadDir)) {
  console.error(chalk.red(`❌ 下载目录不存在: ${downloadDir}`));
  process.exit(1);
}

// 创建目标目录（如果不存在）
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(chalk.green(`✅ 创建目标目录: ${targetDir}`));
}

console.log(chalk.cyan('🚀 EchoSave 文件自动移动工具'));
console.log(chalk.gray('监控目录:'), downloadDir);
console.log(chalk.gray('目标目录:'), targetDir);
console.log(chalk.gray('文件模式:'), config.filePattern || '*.md');
console.log('');

// 文件匹配模式
const filePattern = new RegExp(config.filePattern || '(chatgpt|claude|gemini|kimi|deepseek)-.+\\.md$');

// 平台名称映射
const platformMap = {
  'chatgpt': 'ChatGPT',
  'claude': 'Claude',
  'gemini': 'Gemini',
  'kimi': 'Kimi',
  'deepseek': 'DeepSeek'
};

// 移动文件函数
function moveFile(filePath) {
  const fileName = path.basename(filePath);

  // 检查文件名是否匹配 EchoSave 导出格式
  if (!filePattern.test(fileName)) {
    return;
  }

  // 等待文件写入完成
  setTimeout(() => {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      // 从文件名提取平台名称
      const platformMatch = fileName.match(/^(chatgpt|claude|gemini|kimi|deepseek)-/i);
      if (!platformMatch) {
        console.warn(chalk.yellow('⚠️  无法识别平台:'), fileName);
        return;
      }

      const platform = platformMatch[1].toLowerCase();
      const platformFolder = platformMap[platform] || platform;

      // 创建平台子文件夹
      const platformDir = path.join(targetDir, platformFolder);
      if (!fs.existsSync(platformDir)) {
        fs.mkdirSync(platformDir, { recursive: true });
        console.log(chalk.cyan('📁 创建文件夹:'), platformFolder);
      }

      const targetPath = path.join(platformDir, fileName);

      // 如果目标文件已存在，添加时间戳
      let finalTargetPath = targetPath;
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        const timestamp = Date.now();
        finalTargetPath = path.join(platformDir, `${base}-${timestamp}${ext}`);
      }

      // 移动文件
      fs.renameSync(filePath, finalTargetPath);
      console.log(chalk.green('✅ 已移动:'), chalk.white(fileName));
      console.log(chalk.gray('   目标:'), finalTargetPath);

    } catch (error) {
      console.error(chalk.red('❌ 移动失败:'), fileName);
      console.error(chalk.red('   错误:'), error.message);
    }
  }, config.delayMs || 1000);
}

// 监控下载目录
const watcher = chokidar.watch(downloadDir, {
  ignored: /(^|[\/\\])\../, // 忽略隐藏文件
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher
  .on('add', filePath => {
    moveFile(filePath);
  })
  .on('error', error => {
    console.error(chalk.red('❌ 监控错误:'), error);
  });

console.log(chalk.green('✅ 监控已启动，等待文件...'));
console.log(chalk.gray('按 Ctrl+C 停止监控'));
console.log('');

// 优雅退出
process.on('SIGINT', () => {
  console.log('');
  console.log(chalk.yellow('⏹️  停止监控...'));
  watcher.close();
  process.exit(0);
});
