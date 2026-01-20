/**
 * EchoSave 后台脚本 (Service Worker)
 * 处理下载、消息传递和插件生命周期
 */

// 插件安装时初始化
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('EchoSave: 插件已安装');

    // 初始化默认配置
    chrome.storage.local.set({
      user_preferences: {
        autoUpload: false,
        fileNamingPattern: 'platform-date-title',
        notificationEnabled: true
      },
      export_history: []
    });

    // 打开欢迎页面（可选）
    // chrome.tabs.create({ url: 'welcome.html' });
  } else if (details.reason === 'update') {
    console.log('EchoSave: 插件已更新到版本', chrome.runtime.getManifest().version);
  }
});

// 监听来自 content script 和 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'download':
      handleDownload(request, sendResponse);
      return true; // 异步响应

    case 'getExportHistory':
      getExportHistory(sendResponse);
      return true;

    case 'clearHistory':
      clearHistory(sendResponse);
      return true;

    case 'uploadToOSS':
      handleOSSUpload(request, sendResponse);
      return true;

    case 'saveOSSConfig':
      saveOSSConfig(request.config, sendResponse);
      return true;

    case 'getOSSConfig':
      getOSSConfig(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: '未知操作' });
      return false;
  }
});

/**
 * 处理文件下载
 */
async function handleDownload(request, sendResponse) {
  const { url, filename } = request;

  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: 'overwrite'
    },
    async (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      // 轮询检查下载状态
      const checkDownloadStatus = async () => {
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            chrome.downloads.search({ id: downloadId }, (results) => {
              if (results.length === 0) {
                clearInterval(interval);
                resolve({ success: false, error: '下载任务未找到' });
                return;
              }

              const download = results[0];

              if (download.state === 'complete') {
                clearInterval(interval);
                resolve({ success: true, downloadId: downloadId });
              } else if (download.state === 'interrupted') {
                clearInterval(interval);
                resolve({ success: false, error: '下载被中断' });
              }
            });
          }, 100);
        });
      };

      const result = await checkDownloadStatus();
      sendResponse(result);
    }
  );
}

/**
 * 获取导出历史
 */
function getExportHistory(sendResponse) {
  chrome.storage.local.get(['export_history'], (result) => {
    sendResponse({
      success: true,
      history: result.export_history || []
    });
  });
}

/**
 * 清空导出历史
 */
function clearHistory(sendResponse) {
  chrome.storage.local.set({ export_history: [] }, () => {
    sendResponse({ success: true });
  });
}

/**
 * 保存 OSS 配置
 */
function saveOSSConfig(config, sendResponse) {
  // 加密敏感信息（简单的 Base64 编码，实际应使用更安全的方法）
  const encryptedConfig = {
    ...config,
    accessKeyId: btoa(config.accessKeyId || ''),
    accessKeySecret: btoa(config.accessKeySecret || '')
  };

  chrome.storage.local.set({ oss_config: encryptedConfig }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message
      });
    } else {
      sendResponse({ success: true });
    }
  });
}

/**
 * 获取 OSS 配置
 */
function getOSSConfig(sendResponse) {
  chrome.storage.local.get(['oss_config'], (result) => {
    if (result.oss_config) {
      // 解密
      const decryptedConfig = {
        ...result.oss_config,
        accessKeyId: atob(result.oss_config.accessKeyId || ''),
        accessKeySecret: atob(result.oss_config.accessKeySecret || '')
      };
      sendResponse({
        success: true,
        config: decryptedConfig
      });
    } else {
      sendResponse({
        success: true,
        config: null
      });
    }
  });
}

/**
 * 处理 OSS 上传
 * 注意：由于浏览器环境限制，实际的 OSS 上传可能需要后端支持
 */
async function handleOSSUpload(request, sendResponse) {
  try {
    // 获取 OSS 配置
    chrome.storage.local.get(['oss_config'], async (result) => {
      if (!result.oss_config) {
        sendResponse({
          success: false,
          error: '未配置 OSS 信息'
        });
        return;
      }

      // 这里需要实现实际的 OSS 上传逻辑
      // 由于浏览器环境的限制，建议使用阿里云 OSS 的浏览器端 SDK
      // 或者通过后端 API 进行上传

      sendResponse({
        success: false,
        error: '浏览器端 OSS 上传功能开发中，请使用独立脚本上传'
      });
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// 监听下载完成事件
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('文件下载完成:', delta.id);
  }
});

console.log('EchoSave: Service Worker 已启动');
