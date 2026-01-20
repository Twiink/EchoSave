# EchoSave

AI 对话导出助手 - 支持 ChatGPT 和 Gemini 对话导出为 Markdown 格式

## 功能特性

- **多平台支持**：支持 ChatGPT 和 Gemini 对话导出
- **Markdown 格式**：导出为标准 Markdown 格式，包含元数据和对话内容
- **批量导出**：支持选择多个对话进行批量导出
- **灵活命名**：支持多种文件命名模式（平台-日期-标题、日期-平台-标题、标题-平台-日期）
- **本地保存**：文件直接下载到本地，无需额外操作
- **OSS 上传**：支持自动上传到阿里云对象存储（可选）
- **导出历史**：记录最近 100 条导出历史，方便追踪
- **实时通知**：导出成功/失败时显示通知提示

## 安装方法

### 从源码安装

1. 克隆或下载本项目
2. 打开 Chrome 浏览器，进入扩展管理页面（`chrome://extensions/`）
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录
6. 扩展安装完成

## 使用方法

### 基本导出

1. 访问 ChatGPT（https://chatgpt.com）或 Gemini（https://gemini.google.com）
2. 点击浏览器工具栏中的 EchoSave 图标
3. 在弹窗中点击"立即导出当前对话"按钮
4. 文件将自动下载到浏览器默认下载目录

### 批量导出

1. 打开 EchoSave 弹窗
2. 切换到"对话列表"标签页
3. 勾选要导出的对话
4. 点击"批量导出"按钮
5. 等待导出完成

### 查看导出历史

1. 打开 EchoSave 弹窗
2. 切换到"历史"标签页
3. 查看最近的导出记录

## 配置说明

### 基本设置

在"设置"标签页中可以配置：

- **显示导出通知**：导出成功/失败时是否显示通知
- **自动上传到 OSS**：导出后是否自动上传到阿里云对象存储（不建议使用，建议使用手动上传脚本）
- **文件命名模式**：选择文件名格式
  - 平台-日期-标题（默认）
  - 日期-平台-标题
  - 标题-平台-日期

### OSS 配置（可选）

如果需要将导出的文件上传到阿里云对象存储，需要配置以下信息：

#### 1. 在阿里云控制台准备

1. 登录阿里云 OSS 控制台
2. 创建或选择一个 Bucket
3. 获取以下信息：
   - Access Key ID
   - Access Key Secret
   - Bucket 名称
   - Region（如：oss-cn-hangzhou）

4. 配置 CORS 规则（必需）：
   - 进入 Bucket 的"权限管理" → "跨域设置（CORS）"
   - 添加规则：
     - 来源：`*`（或指定 `chrome-extension://你的扩展ID`）
     - 允许 Methods：GET, POST, PUT, HEAD
     - 允许 Headers：`*`
     - 暴露 Headers：ETag, x-oss-request-id
     - 缓存时间：600

#### 2. 在扩展中配置

1. 打开 EchoSave 弹窗
2. 切换到"OSS 配置"标签页
3. 填写以下信息：
   - Access Key ID
   - Access Key Secret
   - Bucket 名称
   - Region 区域
   - 存储路径（默认：AIConversations/）
4. 点击"保存配置"
5. 点击"测试连接"验证配置是否正确

#### 3. 启用自动上传（可选）

1. 切换到"设置"标签页
2. 勾选"自动上传到 OSS"
3. 点击"保存设置"

**注意**：浏览器自动上传功能不建议使用，推荐使用手动上传脚本。

## 手动上传脚本

项目提供了 Node.js 脚本用于批量上传文件到 OSS。

### 配置文件说明

#### config.json
OSS 上传配置文件，包含阿里云 OSS 的连接信息。

```json
{
  "accessKeyId": "你的 Access Key ID",
  "accessKeySecret": "你的 Access Key Secret",
  "bucket": "echosave",
  "region": "oss-cn-hangzhou",
  "ossPath": "AIConversations/",
  "options": {
    "overwrite": true,
    "skipExisting": false,
    "showProgress": true
  }
}
```

**字段说明：**
- `accessKeyId`: 阿里云访问密钥 ID
- `accessKeySecret`: 阿里云访问密钥 Secret
- `bucket`: OSS 存储桶名称
- `region`: OSS 区域（如：oss-cn-hangzhou）
- `ossPath`: OSS 中的存储路径前缀
- `options.overwrite`: 是否覆盖已存在的文件
- `options.skipExisting`: 是否跳过已存在的文件
- `options.showProgress`: 是否显示上传进度

#### config.example.json
配置文件示例，包含占位符值供参考。首次使用时复制为 `config.json` 并填入真实配置。

#### mover-config.json
文件自动移动配置，用于 `file-mover.js` 脚本。

```json
{
  "downloadDir": "D:/EdgeDownload",
  "targetDir": "D:/Code/AIChat",
  "filePattern": "(chatgpt|claude|gemini|kimi|deepseek)-.+\\.md$",
  "delayMs": 1000
}
```

**字段说明：**
- `downloadDir`: 浏览器下载目录（监控源）
- `targetDir`: 目标存储目录（文件会移动到这里）
- `filePattern`: 文件名匹配正则表达式
- `delayMs`: 文件写入完成后的等待时间（毫秒）

### 安装依赖

```bash
cd scripts
npm install
```

### 测试连接

```bash
cd scripts
node test-oss-connection.js
```

测试脚本会执行以下检查：
1. 获取 Bucket 信息
2. 列出文件（前 5 个）
3. 上传测试文件
4. 读取测试文件
5. 删除测试文件

### 上传文件

```bash
cd scripts
node upload-to-oss.js
```

脚本会自动：
- 读取 `mover-config.json` 中的 `targetDir` 目录
- 遍历所有文件
- 上传到 OSS 的 `AIConversations/` 路径
- 显示上传进度和结果

### 自动移动文件（可选）

如果希望导出的文件自动从下载目录移动到指定位置，可以使用文件监控脚本：

```bash
cd scripts
node file-mover.js
```

**功能：**
- 实时监控浏览器下载目录
- 自动识别 EchoSave 导出的文件
- 按平台分类移动到目标目录（ChatGPT/Gemini/Claude 等子文件夹）
- 支持文件覆盖

**使用场景：**
1. 浏览器导出文件到下载目录
2. file-mover.js 自动移动到 `targetDir`
3. upload-to-oss.js 批量上传到 OSS

**注意：** 脚本会持续运行，按 Ctrl+C 停止监控。

## 文件格式

导出的 Markdown 文件格式：

```markdown
---
platform: ChatGPT
title: 对话标题
export_date: 2026-01-21T08:00:00.000Z
---

# 对话标题

👤 **User**

用户的问题内容

🤖 **Assistant**

AI 的回答内容
```

## 注意事项

1. **权限要求**：扩展需要访问 ChatGPT 和 Gemini 网站的权限
2. **浏览器兼容性**：仅支持 Chrome 和基于 Chromium 的浏览器
3. **OSS 安全性**：
   - 插件中的 OSS 配置使用 Base64 加密存储在本地
   - 不建议在浏览器中启用自动上传
   - 推荐使用独立的 Node.js 脚本上传
4. **文件大小限制**：单个文件最大 10MB（OSS PostObject 限制）
5. **导出历史**：最多保存 100 条记录

## 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript
- 阿里云 OSS SDK（Node.js 脚本）
- Web Crypto API（浏览器签名）

## 项目结构

```
EchoSave/
├── src/
│   ├── background.js          # 后台脚本
│   ├── content/
│   │   ├── content.js         # 内容脚本主入口
│   │   ├── parser.js          # 对话解析器
│   │   └── downloader.js      # 文件下载管理
│   ├── popup/
│   │   ├── popup.html         # 弹窗界面
│   │   ├── popup.js           # 弹窗逻辑
│   │   └── popup.css          # 弹窗样式
│   └── utils/
│       ├── constants.js       # 常量定义
│       ├── storage.js         # 存储管理
│       └── oss-uploader.js    # OSS 上传模块
├── scripts/
│   ├── config.json            # OSS 配置
│   ├── mover-config.json      # 文件移动配置
│   ├── test-oss-connection.js # OSS 连接测试
│   └── upload-to-oss.js       # 批量上传脚本
├── icons/                     # 图标资源
└── manifest.json              # 扩展配置文件
```

## 常见问题

### 1. 导出失败怎么办？

- 检查是否在支持的网站（ChatGPT 或 Gemini）
- 刷新页面后重试
- 查看浏览器控制台是否有错误信息

### 2. OSS 上传失败？

- 检查 CORS 配置是否正确
- 验证 Access Key 是否有效
- 确认 Bucket 名称和 Region 是否正确
- 使用"测试连接"功能验证配置

### 3. 批量导出很慢？

- 批量导出需要逐个加载对话内容
- Gemini 平台需要等待页面加载（约 4 秒/个）
- 建议分批导出，每次不超过 10 个对话

### 4. 文件命名包含特殊字符？

- 扩展会自动清理非法字符（`<>:"/\|?*`）
- 标题长度限制为 50 个字符
- 空格会被替换为连字符

## 开发说明

### 安装依赖（仅用于上传脚本）

```bash
cd scripts
npm install
```

### 重新加载扩展

修改代码后，在 Chrome 扩展管理页面点击"重新加载"按钮。

## 许可证

MIT License

## 作者

Twiink

## 贡献

欢迎提交 Issue 和 Pull Request！