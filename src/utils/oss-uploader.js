/**
 * 阿里云 OSS 上传模块 - 使用 PostObject 接口
 */

class OSSUploader {
  constructor(config) {
    this.config = config;
  }

  /**
   * 生成 Policy 和 Signature
   */
  generateSignature(filename) {
    const expireTime = new Date().getTime() + 3600000; // 1小时后过期
    const expireDate = new Date(expireTime).toISOString();
    const objectKey = `${this.config.path || 'AIConversations/'}${filename}`;

    const policyText = {
      expiration: expireDate,
      conditions: [
        { bucket: this.config.bucket },
        ['eq', '$key', objectKey],
        ['content-length-range', 0, 10485760] // 最大10MB
      ]
    };

    const policyBase64 = btoa(JSON.stringify(policyText));
    const signature = this.computeSignature(policyBase64, this.config.accessKeySecret);

    return {
      policy: policyBase64,
      signature: signature,
      objectKey: objectKey
    };
  }

  /**
   * 计算 HMAC-SHA1 签名
   */
  computeSignature(policyBase64, accessKeySecret) {
    // 使用 Web Crypto API 计算 HMAC-SHA1
    const encoder = new TextEncoder();
    const keyData = encoder.encode(accessKeySecret);
    const messageData = encoder.encode(policyBase64);

    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    ).then(key => {
      return crypto.subtle.sign('HMAC', key, messageData);
    }).then(signature => {
      const signatureArray = Array.from(new Uint8Array(signature));
      return btoa(String.fromCharCode.apply(null, signatureArray));
    });
  }

  /**
   * 上传文件到 OSS
   */
  async upload(filename, content) {
    try {
      const signData = this.generateSignature(filename);
      const signature = await signData.signature;

      const endpoint = `https://${this.config.bucket}.${this.config.region}.aliyuncs.com`;

      const formData = new FormData();
      formData.append('key', signData.objectKey);
      formData.append('policy', signData.policy);
      formData.append('OSSAccessKeyId', this.config.accessKeyId);
      formData.append('signature', signature);
      formData.append('success_action_status', '200');
      formData.append('file', new Blob([content], { type: 'text/markdown;charset=utf-8' }), filename);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        return {
          success: true,
          url: `${endpoint}/${signData.objectKey}`,
          name: filename
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `上传失败: ${response.status} - ${errorText}`
        };
      }
    } catch (error) {
      console.error('OSS 上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量上传文件
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
        const result = await this.upload(file.filename, file.content);

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

        if (onProgress) {
          onProgress(((i + 1) / files.length) * 100, i + 1, files.length);
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
