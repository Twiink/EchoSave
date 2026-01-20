/**
 * 阿里云 OSS 上传模块
 * 注意：浏览器环境中使用 OSS 需要配置 CORS 和 STS 临时凭证
 */

class OSSUploader {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  /**
   * 初始化 OSS 客户端
   * 注意：这里需要引入阿里云 OSS Browser SDK
   * 由于浏览器环境的安全限制，建议使用 STS 临时凭证
   */
  async init() {
    if (!this.config.accessKeyId || !this.config.accessKeySecret) {
      throw new Error('OSS 配置不完整');
    }

    // 这里需要实际的 OSS SDK 初始化
    // 由于 Manifest V3 不支持远程脚本，需要将 SDK 打包到插件中
    console.warn('OSS 客户端初始化 - 功能开发中');

    // 示例代码（需要实际的 SDK）:
    /*
    this.client = new OSS({
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      bucket: this.config.bucket
    });
    */
  }

  /**
   * 上传文件到 OSS
   * @param {string} filename - 文件名
   * @param {string} content - 文件内容
   * @param {function} onProgress - 进度回调
   * @returns {Promise<object>} 上传结果
   */
  async upload(filename, content, onProgress) {
    if (!this.client) {
      throw new Error('OSS 客户端未初始化');
    }

    const objectName = `${this.config.path || 'ai-conversations/'}${filename}`;

    try {
      // 转换内容为 Blob
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

      // 上传文件（示例代码）
      /*
      const result = await this.client.put(objectName, blob, {
        progress: (p) => {
          if (onProgress) {
            onProgress(p * 100);
          }
        }
      });

      return {
        success: true,
        url: result.url,
        name: result.name
      };
      */

      // 临时返回（实际需要 SDK）
      return {
        success: false,
        error: '浏览器端 OSS 上传功能开发中，请使用独立的 Node.js 脚本上传'
      };

    } catch (error) {
      console.error('OSS 上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成预签名 URL（用于临时访问）
   * @param {string} objectName - 对象名称
   * @param {number} expires - 过期时间（秒）
   * @returns {Promise<string>}
   */
  async generateSignedUrl(objectName, expires = 3600) {
    if (!this.client) {
      throw new Error('OSS 客户端未初始化');
    }

    // 示例代码
    /*
    const url = this.client.signatureUrl(objectName, {
      expires: expires
    });
    return url;
    */

    throw new Error('功能开发中');
  }

  /**
   * 检查文件是否存在
   * @param {string} objectName - 对象名称
   * @returns {Promise<boolean>}
   */
  async exists(objectName) {
    if (!this.client) {
      throw new Error('OSS 客户端未初始化');
    }

    try {
      // 示例代码
      /*
      await this.client.head(objectName);
      return true;
      */
      return false;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * 批量上传文件
   * @param {Array} files - 文件列表 [{filename, content}, ...]
   * @param {function} onProgress - 进度回调
   * @returns {Promise<object>} 上传结果统计
   */
  async batchUpload(files, onProgress) {
    const results = {
      success: [],
      failed: [],
      total: files.length
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const result = await this.upload(
          file.filename,
          file.content,
          (progress) => {
            if (onProgress) {
              const overall = ((i + progress / 100) / files.length) * 100;
              onProgress(overall, i + 1, files.length);
            }
          }
        );

        if (result.success) {
          results.success.push({
            filename: file.filename,
            url: result.url
          });
        } else {
          results.failed.push({
            filename: file.filename,
            error: result.error
          });
        }
      } catch (error) {
        results.failed.push({
          filename: file.filename,
          error: error.message
        });
      }
    }

    return results;
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.OSSUploader = OSSUploader;
}

/**
 * 使用说明：
 *
 * 1. 由于浏览器环境的安全限制，直接在插件中使用 OSS 需要：
 *    - 在 OSS Bucket 中配置 CORS 规则
 *    - 使用 STS 临时凭证而非永久凭证
 *    - 将 OSS SDK 打包到插件中
 *
 * 2. 推荐方案：
 *    - 方案 A: 使用独立的 Node.js 脚本上传（已提供）
 *    - 方案 B: 搭建后端 API 代理上传
 *    - 方案 C: 使用 OSS PostObject 接口
 *
 * 3. 如需在插件中启用 OSS 上传，需要：
 *    - 下载阿里云 OSS Browser SDK
 *    - 将 SDK 文件放入插件目录
 *    - 在 manifest.json 中声明 SDK 文件
 *    - 实现 STS 临时凭证获取
 */
