# EchoSave OSS 上传脚本使用说明

这是一个独立的 Node.js 脚本，用于批量上传本地的 Markdown 文件到阿里云 OSS。

## 功能特性

- ✅ 批量上传本地 Markdown 文件
- ✅ 递归扫描子目录
- ✅ 跳过已存在的文件（可配置）
- ✅ 实时进度显示
- ✅ 上传统计报告
- ✅ 错误处理和重试

## 安装依赖

```bash
cd scripts
npm install
```

## 配置

1. 复制配置模板：
```bash
cp config.example.json config.json
```

2. 编辑 `config.json` 填写您的 OSS 信息：

```json
{
  "accessKeyId": "你的AccessKeyId",
  "accessKeySecret": "你的AccessKeySecret",
  "bucket": "你的Bucket名称",
  "region": "oss-cn-hangzhou",
  "localDir": "../downloads",
  "ossPath": "ai-conversations/",
  "options": {
    "overwrite": false,
    "skipExisting": true,
    "showProgress": true
  }
}
```

### 配置说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `accessKeyId` | 阿里云 Access Key ID | `LTAI5t...` |
| `accessKeySecret` | 阿里云 Access Key Secret | `xxxxx...` |
| `bucket` | OSS Bucket 名称 | `my-bucket` |
| `region` | OSS 区域 | `oss-cn-hangzhou` |
| `localDir` | 本地文件目录（相对路径） | `../downloads` |
| `ossPath` | OSS 中的保存路径 | `ai-conversations/` |
| `options.skipExisting` | 跳过已存在的文件 | `true` |
| `options.showProgress` | 显示详细进度 | `true` |

## 使用方法

### 测试配置

```bash
npm run test
```

### 批量上传

```bash
npm run upload
```

或者直接运行：

```bash
node upload-to-oss.js
```

## 输出示例

```
🚀 EchoSave OSS 上传工具

本地目录: D:\Code\Project\EchoSave\downloads
OSS 路径: ai-conversations/
Bucket: my-bucket

✔ 找到 15 个 Markdown 文件
✔ OSS 连接成功

✅ 上传成功: chatgpt-2026-01-20-example.md
✅ 上传成功: gemini-2026-01-19-test.md
⏭️  跳过 (已存在): chatgpt-2026-01-18-old.md

📊 上传统计:
  ✅ 成功: 12
  ⏭️  跳过: 2
  ❌ 失败: 1
  📁 总计: 15

🎉 所有文件处理完成！
```

## 安全建议

1. **不要将 `config.json` 提交到 Git**
   - 已添加到 `.gitignore`
   - 包含敏感的访问密钥

2. **使用 RAM 子账号**
   - 不要使用主账号密钥
   - 创建专用于 OSS 上传的子账号
   - 仅授予必要的权限（如 `PutObject`）

3. **定期轮换密钥**
   - 定期更换 Access Key
   - 发现泄露立即禁用

## 常见问题

### Q: 提示 "配置文件不存在"
A: 请确保已经从 `config.example.json` 复制并重命名为 `config.json`

### Q: OSS 连接失败
A: 检查以下项目：
- Access Key ID 和 Secret 是否正确
- Region 是否与 Bucket 匹配
- 网络连接是否正常

### Q: 上传失败
A: 可能的原因：
- Bucket 权限配置问题
- 网络不稳定
- 文件大小超过限制

### Q: 如何上传到不同的目录？
A: 修改 `config.json` 中的 `ossPath` 字段

## 技术支持

遇到问题请查看：
- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)
- [ali-oss SDK 文档](https://github.com/ali-sdk/ali-oss)
