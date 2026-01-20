/**
 * Chrome Storage API 封装
 * 提供简化的存储操作接口
 */

class StorageManager {
  /**
   * 保存数据
   * @param {string} key - 存储键
   * @param {any} value - 存储值
   * @returns {Promise<boolean>}
   */
  static async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 获取数据
   * @param {string} key - 存储键
   * @returns {Promise<any>}
   */
  static async get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  /**
   * 获取多个键的数据
   * @param {string[]} keys - 存储键数组
   * @returns {Promise<object>}
   */
  static async getMultiple(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * 删除数据
   * @param {string} key - 存储键
   * @returns {Promise<boolean>}
   */
  static async remove(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 清空所有数据
   * @returns {Promise<boolean>}
   */
  static async clear() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 保存 OSS 配置（带加密）
   * @param {object} config - OSS 配置
   * @returns {Promise<boolean>}
   */
  static async saveOSSConfig(config) {
    // 简单的 Base64 加密（生产环境应使用更安全的加密方法）
    const encrypted = {
      accessKeyId: btoa(config.accessKeyId || ''),
      accessKeySecret: btoa(config.accessKeySecret || ''),
      bucket: config.bucket,
      region: config.region,
      path: config.path || 'ai-conversations/'
    };

    return this.set(STORAGE_KEYS.ossConfig, encrypted);
  }

  /**
   * 获取 OSS 配置（带解密）
   * @returns {Promise<object|null>}
   */
  static async getOSSConfig() {
    const encrypted = await this.get(STORAGE_KEYS.ossConfig);

    if (!encrypted) {
      return null;
    }

    // 解密
    return {
      accessKeyId: atob(encrypted.accessKeyId || ''),
      accessKeySecret: atob(encrypted.accessKeySecret || ''),
      bucket: encrypted.bucket,
      region: encrypted.region,
      path: encrypted.path || 'ai-conversations/'
    };
  }

  /**
   * 保存用户偏好设置
   * @param {object} preferences - 用户偏好
   * @returns {Promise<boolean>}
   */
  static async savePreferences(preferences) {
    return this.set(STORAGE_KEYS.userPreferences, preferences);
  }

  /**
   * 获取用户偏好设置
   * @returns {Promise<object>}
   */
  static async getPreferences() {
    const prefs = await this.get(STORAGE_KEYS.userPreferences);

    // 返回默认值
    return prefs || {
      autoUpload: false,
      fileNamingPattern: 'platform-date-title',
      notificationEnabled: true,
      saveToSubfolder: false,
      subfolder: 'EchoSave'
    };
  }

  /**
   * 添加导出历史记录
   * @param {object} record - 导出记录
   * @returns {Promise<boolean>}
   */
  static async addExportRecord(record) {
    const history = await this.get(STORAGE_KEYS.exportHistory) || [];

    history.unshift({
      ...record,
      timestamp: new Date().toISOString()
    });

    // 只保留最近 100 条
    const trimmed = history.slice(0, 100);

    return this.set(STORAGE_KEYS.exportHistory, trimmed);
  }

  /**
   * 获取导出历史
   * @returns {Promise<array>}
   */
  static async getExportHistory() {
    return (await this.get(STORAGE_KEYS.exportHistory)) || [];
  }

  /**
   * 清空导出历史
   * @returns {Promise<boolean>}
   */
  static async clearExportHistory() {
    return this.set(STORAGE_KEYS.exportHistory, []);
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
