/**
 * EchoSave 后台脚本 (Service Worker)
 * 处理下载、消息传递和插件生命周期
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('EchoSave: 插件已安装');

    chrome.storage.local.set({
      user_preferences: {
        autoUpload: false,
        fileNamingPattern: 'platform-date-title',
        notificationEnabled: true
      },
      export_history: []
    });
  } else if (details.reason === 'update') {
    console.log('EchoSave: 插件已更新到版本', chrome.runtime.getManifest().version);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'download':
      handleDownload(request, sendResponse);
      return true;

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

    case 'testOSSConnection':
      testOSSConnection(sendResponse);
      return true;

    default:
      sendResponse({ success: false, error: '未知操作' });
      return false;
  }
});

/**
 * 处理文件下载
 * 使用轮询机制监控下载状态直到完成或失败
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
 * 注意: 使用 Base64 编码存储凭证，生产环境应使用更安全的加密方法
 */
function saveOSSConfig(config, sendResponse) {
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
 * 获取 OSS 配置并解密凭证
 */
function getOSSConfig(sendResponse) {
  chrome.storage.local.get(['oss_config'], (result) => {
    if (result.oss_config) {
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
 * 测试 OSS 连接
 */
function testOSSConnection(sendResponse) {
  chrome.storage.local.get(['oss_config'], async (result) => {
    if (!result.oss_config) {
      sendResponse({
        success: false,
        error: '未配置 OSS 信息'
      });
      return;
    }

    const config = result.oss_config;
    const endpoint = `https://${config.bucket}.${config.region}.aliyuncs.com`;

    try {
      await fetch(endpoint, {
        method: 'HEAD',
        mode: 'no-cors'
      });

      sendResponse({
        success: true,
        message: 'OSS 连接测试成功'
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: `连接失败: ${error.message}`
      });
    }
  });
}

/**
 * 处理 OSS 上传
 * 注意: 由于浏览器环境限制，实际的 OSS 上传可能需要后端支持
 */
function handleOSSUpload(request, sendResponse) {
  chrome.storage.local.get(['oss_config'], (result) => {
    if (!result.oss_config) {
      sendResponse({
        success: false,
        error: '未配置 OSS 信息'
      });
      return;
    }

    sendResponse({
      success: false,
      error: '浏览器端 OSS 上传功能开发中，请使用独立脚本上传'
    });
  });
}

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    console.log('文件下载完成:', delta.id);
  }
});

console.log('EchoSave: Service Worker 已启动');
