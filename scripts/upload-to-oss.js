/**
 * EchoSave OSS 批量上传脚本
 *
 * 使用方法:
 * 1. 复制 config.example.json 为 config.json
 * 2. 填写 OSS 配置信息
 * 3. 运行: npm install
 * 4. 运行: npm run upload
 */

const OSS = require('ali-oss');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, 'config.json');

/**
 * 加载配置
 */
async function loadConfig() {
  try {
    const configContent = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(chalk.red('❌ 配置文件不存在！'));
      console.log(chalk.yellow('请复制 config.example.json 为 config.json 并填写配置'));
      process.exit(1);
    }
    throw error;
  }
}

/**
 * 初始化 OSS 客户端
 */
function createOSSClient(config) {
  return new OSS({
    region: config.region,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket
  });
}

/**
 * 扫描本地 Markdown 文件
 */
async function scanMarkdownFiles(dir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 递归扫描子目录
        const subFiles = await scanMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(chalk.yellow(`⚠️  目录不存在: ${dir}`));
      return [];
    }
    throw error;
  }

  return files;
}

/**
 * 上传单个文件到 OSS
 */
async function uploadFile(client, localPath, ossPath, options = {}) {
  try {
    const fileName = path.basename(localPath);
    const objectName = path.join(ossPath, fileName).replace(/\\/g, '/');

    // 检查文件是否已存在
    if (options.skipExisting) {
      try {
        await client.head(objectName);
        return { success: true, skipped: true, fileName };
      } catch (error) {
        // 文件不存在，继续上传
      }
    }

    // 读取文件内容
    const content = await fs.readFile(localPath);

    // 上传到 OSS
    const result = await client.put(objectName, content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8'
      }
    });

    return {
      success: true,
      skipped: false,
      fileName,
      url: result.url
    };

  } catch (error) {
    return {
      success: false,
      fileName: path.basename(localPath),
      error: error.message
    };
  }
}

/**
 * 批量上传文件
 */
async function batchUpload(config) {
  console.log(chalk.blue('🚀 EchoSave OSS 上传工具\n'));

  // 解析本地目录路径
  const localDir = path.resolve(__dirname, config.localDir);
  console.log(chalk.gray(`本地目录: ${localDir}`));
  console.log(chalk.gray(`OSS 路径: ${config.ossPath}`));
  console.log(chalk.gray(`Bucket: ${config.bucket}\n`));

  // 扫描文件
  const spinner = ora('扫描本地文件...').start();
  const files = await scanMarkdownFiles(localDir);

  if (files.length === 0) {
    spinner.fail(chalk.yellow('未找到 Markdown 文件'));
    return;
  }

  spinner.succeed(chalk.green(`找到 ${files.length} 个 Markdown 文件`));

  // 创建 OSS 客户端
  const client = createOSSClient(config);

  // 测试连接
  const testSpinner = ora('测试 OSS 连接...').start();
  try {
    await client.list({ 'max-keys': 1 });
    testSpinner.succeed(chalk.green('OSS 连接成功'));
  } catch (error) {
    testSpinner.fail(chalk.red('OSS 连接失败'));
    console.error(chalk.red(error.message));
    return;
  }

  console.log('');

  // 上传统计
  const stats = {
    total: files.length,
    success: 0,
    skipped: 0,
    failed: 0
  };

  // 上传文件
  const uploadSpinner = ora('开始上传文件...').start();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = path.basename(file);

    uploadSpinner.text = `上传中 (${i + 1}/${files.length}): ${fileName}`;

    const result = await uploadFile(
      client,
      file,
      config.ossPath,
      config.options
    );

    if (result.success) {
      if (result.skipped) {
        stats.skipped++;
        if (config.options.showProgress) {
          console.log(chalk.yellow(`⏭️  跳过 (已存在): ${result.fileName}`));
        }
      } else {
        stats.success++;
        if (config.options.showProgress) {
          console.log(chalk.green(`✅ 上传成功: ${result.fileName}`));
        }
      }
    } else {
      stats.failed++;
      console.log(chalk.red(`❌ 上传失败: ${result.fileName} - ${result.error}`));
    }
  }

  uploadSpinner.stop();

  // 显示统计结果
  console.log('\n' + chalk.bold('📊 上传统计:'));
  console.log(chalk.green(`  ✅ 成功: ${stats.success}`));
  if (stats.skipped > 0) {
    console.log(chalk.yellow(`  ⏭️  跳过: ${stats.skipped}`));
  }
  if (stats.failed > 0) {
    console.log(chalk.red(`  ❌ 失败: ${stats.failed}`));
  }
  console.log(chalk.gray(`  📁 总计: ${stats.total}\n`));

  if (stats.failed === 0) {
    console.log(chalk.green('🎉 所有文件处理完成！'));
  } else {
    console.log(chalk.yellow('⚠️  部分文件上传失败，请检查错误信息'));
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 检查命令行参数
    const args = process.argv.slice(2);
    const isTest = args.includes('--test');

    if (isTest) {
      console.log(chalk.blue('🧪 测试模式\n'));
    }

    // 加载配置
    const config = await loadConfig();

    // 验证配置
    if (!config.accessKeyId || config.accessKeyId === 'your-access-key-id') {
      console.error(chalk.red('❌ 请在 config.json 中配置有效的 Access Key ID'));
      process.exit(1);
    }

    if (isTest) {
      console.log(chalk.green('✅ 配置文件格式正确'));
      console.log(chalk.gray('\n配置信息:'));
      console.log(chalk.gray(`  Region: ${config.region}`));
      console.log(chalk.gray(`  Bucket: ${config.bucket}`));
      console.log(chalk.gray(`  本地目录: ${config.localDir}`));
      console.log(chalk.gray(`  OSS 路径: ${config.ossPath}`));
      return;
    }

    // 执行上传
    await batchUpload(config);

  } catch (error) {
    console.error(chalk.red('\n❌ 发生错误:'));
    console.error(chalk.red(error.message));
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主函数
main();
