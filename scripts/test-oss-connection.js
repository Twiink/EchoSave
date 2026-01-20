const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, 'config.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❌ 无法读取配置文件:', error.message);
  process.exit(1);
}

// 创建 OSS 客户端
const client = new OSS({
  region: config.region,
  accessKeyId: config.accessKeyId,
  accessKeySecret: config.accessKeySecret,
  bucket: config.bucket
});

async function testConnection() {
  console.log('🔍 开始测试 OSS 连接...\n');

  console.log('配置信息:');
  console.log(`  Bucket: ${config.bucket}`);
  console.log(`  Region: ${config.region}`);
  console.log(`  Access Key ID: ${config.accessKeyId.substring(0, 8)}...`);
  console.log('');

  try {
    // 测试 1: 获取 Bucket 信息
    console.log('📋 测试 1: 获取 Bucket 信息...');
    const bucketInfo = await client.getBucketInfo(config.bucket);
    console.log('✅ Bucket 信息获取成功');
    console.log(`   名称: ${bucketInfo.bucket.Name}`);
    console.log(`   位置: ${bucketInfo.bucket.Location}`);
    console.log(`   创建时间: ${bucketInfo.bucket.CreationDate}`);
    console.log('');

    // 测试 2: 列出文件
    console.log('📂 测试 2: 列出文件...');
    const result = await client.list({
      prefix: config.ossPath,
      'max-keys': 5
    });
    console.log(`✅ 文件列表获取成功 (前5个)`);
    if (result.objects && result.objects.length > 0) {
      console.log(`   找到 ${result.objects.length} 个文件:`);
      result.objects.forEach(obj => {
        console.log(`   - ${obj.name} (${(obj.size / 1024).toFixed(2)} KB)`);
      });
    } else {
      console.log('   目录为空');
    }
    console.log('');

    // 测试 3: 创建测试文件
    console.log('📝 测试 3: 上传测试文件...');
    const testContent = `OSS 连接测试\n时间: ${new Date().toISOString()}\n`;
    const testFileName = `${config.ossPath}test-connection-${Date.now()}.txt`;

    await client.put(testFileName, Buffer.from(testContent));
    console.log('✅ 测试文件上传成功');
    console.log(`   文件路径: ${testFileName}`);
    console.log('');

    // 测试 4: 读取测试文件
    console.log('📖 测试 4: 读取测试文件...');
    const getResult = await client.get(testFileName);
    console.log('✅ 测试文件读取成功');
    console.log(`   内容: ${getResult.content.toString()}`);
    console.log('');

    // 测试 5: 删除测试文件
    console.log('🗑️  测试 5: 删除测试文件...');
    await client.delete(testFileName);
    console.log('✅ 测试文件删除成功');
    console.log('');

    console.log('🎉 所有测试通过！OSS 连接正常。');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.code) {
      console.error(`   错误代码: ${error.code}`);
    }
    if (error.status) {
      console.error(`   HTTP 状态: ${error.status}`);
    }
    process.exit(1);
  }
}

testConnection();
