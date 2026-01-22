/**
 * 文件下载管理器
 */

class FileDownloader {
  /**
   * 生成文件名（带路径）
   * @param {string} platform - 平台名称
   * @param {string} title - 对话标题
   * @param {object} preferences - 用户偏好设置
   * @returns {string} 文件名（可能包含子文件夹路径）
   */
  static generateFilename(platform, title, preferences = null) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    let cleanTitle = title
      .replace(FILE_CONFIG.illegalChars, FILE_CONFIG.replacementChar)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, FILE_CONFIG.maxTitleLength)
      .replace(/^-+|-+$/g, '') || 'untitled';

    const filename = `${platform.toLowerCase()}-${dateStr}-${cleanTitle}.md`;

    if (preferences?.saveToSubfolder && preferences.subfolderName) {
      const subfolder = preferences.subfolderName
        .replace(FILE_CONFIG.illegalChars, FILE_CONFIG.replacementChar)
        .trim();
      return `${subfolder}/${filename}`;
    }

    return filename;
  }

  /**
   * 下载文件（使用 Blob 和 <a> 标签作为降级方案）
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   */
  static downloadFile(content, filename) {
    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('下载失败:', error);
      return false;
    }
  }

  /**
   * 使用 Chrome Downloads API 下载（更可靠，支持子文件夹）
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   */
  static async downloadViaAPI(content, filename) {
    return new Promise((resolve, reject) => {
      try {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        chrome.runtime.sendMessage(
          {
            action: 'download',
            url: url,
            filename: filename
          },
          (response) => {
            URL.revokeObjectURL(url);

            if (response && response.success) {
              resolve(true);
            } else {
              reject(new Error(response?.error || '下载失败'));
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 ('success' | 'error')
   */
  static showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `echosave-notification echosave-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('echosave-notification-show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('echosave-notification-show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, EXPORT_CONFIG.notificationDuration);
  }

  /**
   * 执行导出流程
   * @param {string} platform - 平台名称
   * @param {string} title - 对话标题
   * @param {string} content - Markdown 内容
   */
  static async export(platform, title, content) {
    try {
      const preferences = await this.getPreferences();
      const filename = this.generateFilename(platform, title, preferences);

      const success = await this.performDownload(content, filename);

      if (success) {
        this.saveToHistory(platform, title, filename);

        if (preferences?.autoUpload) {
          this.uploadToOSS(filename, content).catch(error => {
            console.error('自动上传失败:', error);
          });
        }
      }

      return success;
    } catch (error) {
      console.error('导出失败:', error);
      return false;
    }
  }

  /**
   * 获取用户偏好设置
   */
  static async getPreferences() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return null;
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.userPreferences], (result) => {
        resolve(result[STORAGE_KEYS.userPreferences] || null);
      });
    });
  }

  /**
   * 执行下载操作
   */
  static async performDownload(content, filename) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        await this.downloadViaAPI(content, filename);
        return true;
      } catch (error) {
        console.warn('Chrome API 下载失败，尝试降级方案:', error);
        return this.downloadFile(content, filename);
      }
    }

    return this.downloadFile(content, filename);
  }

  /**
   * 上传文件到 OSS（如果启用自动上传）
   */
  static async uploadToOSS(filename, content) {
    try {
      const ossConfig = await new Promise((resolve) => {
        chrome.storage.local.get(['oss_config'], (result) => {
          resolve(result.oss_config || null);
        });
      });

      if (!ossConfig) {
        console.warn('OSS 配置未设置，跳过自动上传');
        return;
      }

      const uploader = new OSSUploader(ossConfig);
      const result = await uploader.upload(filename, content);

      if (result.success) {
        console.log('OSS 上传成功:', result.url);
        this.showNotification('✅ 已自动上传到 OSS', 'success');
      } else {
        console.error('OSS 上传失败:', result.error);
        this.showNotification('⚠️ OSS 上传失败', 'error');
      }
    } catch (error) {
      console.error('OSS 上传异常:', error);
    }
  }

  /**
   * 保存到导出历史（最多保留100条）
   */
  static saveToHistory(platform, title, filename) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([STORAGE_KEYS.exportHistory], (result) => {
        const history = result[STORAGE_KEYS.exportHistory] || [];

        history.unshift({
          platform: platform,
          title: title,
          filename: filename,
          timestamp: new Date().toISOString()
        });

        const trimmedHistory = history.slice(0, 100);

        chrome.storage.local.set({
          [STORAGE_KEYS.exportHistory]: trimmedHistory
        });
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.FileDownloader = FileDownloader;
}
