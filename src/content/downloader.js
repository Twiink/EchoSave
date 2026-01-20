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
    // 获取当前日期
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // 清理标题
    let cleanTitle = title
      .replace(FILE_CONFIG.illegalChars, FILE_CONFIG.replacementChar)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // 限制长度
    if (cleanTitle.length > FILE_CONFIG.maxTitleLength) {
      cleanTitle = cleanTitle.substring(0, FILE_CONFIG.maxTitleLength);
    }

    // 移除首尾的连字符
    cleanTitle = cleanTitle.replace(/^-+|-+$/g, '');

    // 如果标题为空，使用默认值
    if (!cleanTitle) {
      cleanTitle = 'untitled';
    }

    // 基础文件名
    const filename = `${platform.toLowerCase()}-${dateStr}-${cleanTitle}.md`;

    // 如果启用了子文件夹，添加路径前缀
    if (preferences && preferences.saveToSubfolder && preferences.subfolderName) {
      const subfolder = preferences.subfolderName.replace(FILE_CONFIG.illegalChars, FILE_CONFIG.replacementChar).trim();
      return `${subfolder}/${filename}`;
    }

    return filename;
  }

  /**
   * 下载文件（使用 Blob 和 <a> 标签）
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   */
  static downloadFile(content, filename) {
    try {
      // 创建 Blob 对象
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      // 触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('下载失败:', error);
      return false;
    }
  }

  /**
   * 使用 Chrome Downloads API 下载（更可靠）
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   */
  static async downloadViaAPI(content, filename) {
    return new Promise((resolve, reject) => {
      try {
        // 创建 Blob URL
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // 发送消息给 background script
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
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `echosave-notification echosave-notification-${type}`;
    notification.textContent = message;

    // 添加到页面
    document.body.appendChild(notification);

    // 触发显示动画
    setTimeout(() => {
      notification.classList.add('echosave-notification-show');
    }, 10);

    // 自动隐藏
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
      // 获取用户偏好设置
      let preferences = null;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        preferences = await new Promise((resolve) => {
          chrome.storage.local.get([STORAGE_KEYS.userPreferences], (result) => {
            resolve(result[STORAGE_KEYS.userPreferences] || null);
          });
        });
      }

      const filename = this.generateFilename(platform, title, preferences);

      // 优先尝试使用 Chrome API
      let success = false;

      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          await this.downloadViaAPI(content, filename);
          success = true;
        } catch (error) {
          console.warn('Chrome API 下载失败，尝试降级方案:', error);
          success = this.downloadFile(content, filename);
        }
      } else {
        success = this.downloadFile(content, filename);
      }

      if (success) {
        // 显示文件名（不含路径）
        const displayName = filename.split('/').pop();
        this.showNotification(`✅ 导出成功: ${displayName}`, 'success');

        // 保存到导出历史
        this.saveToHistory(platform, title, filename);
      } else {
        throw new Error('下载失败');
      }

      return success;
    } catch (error) {
      console.error('导出失败:', error);
      this.showNotification(`❌ 导出失败: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * 保存到导出历史
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

        // 只保留最近 100 条记录
        const trimmedHistory = history.slice(0, 100);

        chrome.storage.local.set({
          [STORAGE_KEYS.exportHistory]: trimmedHistory
        });
      });
    }
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.FileDownloader = FileDownloader;
}
