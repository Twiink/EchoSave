/**
 * EchoSave OSS 批量上传脚本
 *
 * 使用方法:
 * node upload-to-oss.js
 */

const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

/**
 * 加载配置
 */
function loadConfig() {
  const ossConfigPath = path.join(__dirname, 'config.json');
  const moverConfigPath = path.join(__dirname, 'mover-config.json');

  const ossConfig = JSON.parse(fs.readFileSync(ossConfigPath, 'utf8'));
  const moverConfig = JSON.parse(fs.readFileSync(moverConfigPath, 'utf8'));

  return {
    oss: ossConfig,
    localDir: moverConfig.targetDir
  };
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
 * 获取目录下所有文件
 */
function getAllFiles(dir) {
  const files = [];

  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * 上传文件
 */
async function uploadFiles() {
  console.log('开始上传文件到 OSS...\n');

  const config = loadConfig();

  console.log(`本地目录: ${config.localDir}`);
  console.log(`OSS Bucket: ${config.oss.bucket}`);
  console.log(`OSS 路径: ${config.oss.ossPath}\n`);

  const client = createOSSClient(config.oss);

  const files = getAllFiles(config.localDir);
  console.log(`找到 ${files.length} 个文件\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relativePath = path.relative(config.localDir, filePath);
    const ossPath = config.oss.ossPath + relativePath.replace(/\\/g, '/');

    try {
      if (config.oss.options.skipExisting && !config.oss.options.overwrite) {
        try {
          await client.head(ossPath);
          console.log(`[${i + 1}/${files.length}] 跳过: ${relativePath} (已存在)`);
          skipped++;
          continue;
        } catch (error) {
          // 文件不存在，继续上传
        }
      }

      await client.put(ossPath, filePath);
      uploaded++;

      if (config.oss.options.showProgress) {
        const fileSize = fs.statSync(filePath).size;
        console.log(`[${i + 1}/${files.length}] 上传成功: ${relativePath} (${(fileSize / 1024).toFixed(2)} KB)`);
      }
    } catch (error) {
      failed++;
      console.error(`[${i + 1}/${files.length}] 上传失败: ${relativePath} - ${error.message}`);
    }
  }

  console.log('\n上传完成！');
  console.log(`成功: ${uploaded} 个`);
  console.log(`跳过: ${skipped} 个`);
  console.log(`失败: ${failed} 个`);
}

uploadFiles().catch(error => {
  console.error('上传过程出错:', error);
  process.exit(1);
});
