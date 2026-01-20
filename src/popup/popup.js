/**
 * EchoSave Popup 脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 初始化标签页切换
  initTabs();

  // 加载状态信息
  await loadStatus();

  // 加载设置
  await loadSettings();

  // 加载 OSS 配置
  await loadOSSConfig();

  // 加载历史记录
  await loadHistory();

  // 加载对话列表
  await loadConversations();

  // 绑定事件监听器
  bindEventListeners();
});

/**
 * 初始化标签页
 */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // 更新按钮状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // 更新内容显示
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${tabName}`) {
          content.classList.add('active');
        }
      });
    });
  });
}

/**
 * 加载状态信息
 */
async function loadStatus() {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 添加重试机制，解决消息传递时序问题
    let retryCount = 0;
    const maxRetries = 3;

    const checkStatus = () => {
      chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          // 如果失败且未达到最大重试次数，则重试
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`EchoSave Popup: 重试获取状态 (${retryCount}/${maxRetries})`);
            setTimeout(checkStatus, 500); // 延迟500ms后重试
            return;
          }

          // 重试失败后才显示未激活
          console.log('EchoSave Popup: 无法连接到 content script，可能不在支持的页面');
          document.getElementById('current-platform').textContent = '不支持的页面';
          document.getElementById('plugin-status').innerHTML = '<span class="status-dot inactive"></span>未激活';
          return;
        }

        if (response && response.platform) {
          const platformName = PLATFORM_CONFIGS[response.platform].name;
          document.getElementById('current-platform').textContent = platformName;
          document.getElementById('plugin-status').innerHTML = '<span class="status-dot active"></span>已激活';
          console.log(`EchoSave Popup: 状态检测成功 - ${platformName}`);
        } else {
          document.getElementById('current-platform').textContent = '不支持的页面';
          document.getElementById('plugin-status').innerHTML = '<span class="status-dot inactive"></span>未激活';
        }
      });
    };

    // 开始检查状态
    checkStatus();

    // 加载统计信息
    const history = await StorageManager.getExportHistory();
    document.getElementById('total-exports').textContent = history.length;

    // 计算今日导出次数
    const today = new Date().toDateString();
    const todayCount = history.filter(record => {
      const recordDate = new Date(record.timestamp).toDateString();
      return recordDate === today;
    }).length;
    document.getElementById('today-exports').textContent = todayCount;

  } catch (error) {
    console.error('加载状态失败:', error);
  }
}

/**
 * 加载设置
 */
async function loadSettings() {
  try {
    const preferences = await StorageManager.getPreferences();

    document.getElementById('setting-notifications').checked = preferences.notificationEnabled;
    document.getElementById('setting-auto-upload').checked = preferences.autoUpload;
    document.getElementById('setting-naming-pattern').value = preferences.fileNamingPattern;
    document.getElementById('setting-save-to-subfolder').checked = preferences.saveToSubfolder || false;
    document.getElementById('setting-subfolder-name').value = preferences.subfolderName || 'EchoSave';

  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

/**
 * 加载 OSS 配置
 */
async function loadOSSConfig() {
  try {
    const config = await StorageManager.getOSSConfig();

    if (config) {
      document.getElementById('oss-key-id').value = config.accessKeyId || '';
      document.getElementById('oss-key-secret').value = config.accessKeySecret || '';
      document.getElementById('oss-bucket').value = config.bucket || '';
      document.getElementById('oss-region').value = config.region || 'oss-cn-hangzhou';
      document.getElementById('oss-path').value = config.path || 'ai-conversations/';
    }

  } catch (error) {
    console.error('加载 OSS 配置失败:', error);
  }
}

/**
 * 加载历史记录
 */
async function loadHistory() {
  try {
    const history = await StorageManager.getExportHistory();
    const historyList = document.getElementById('history-list');

    if (history.length === 0) {
      historyList.innerHTML = '<p class="empty-state">暂无导出记录</p>';
      return;
    }

    historyList.innerHTML = history.map(record => `
      <div class="history-item">
        <div class="history-info">
          <div class="history-title">${record.title}</div>
          <div class="history-meta">
            <span class="platform-tag">${record.platform}</span>
            <span class="timestamp">${formatTimestamp(record.timestamp)}</span>
          </div>
        </div>
        <div class="history-filename">${record.filename}</div>
      </div>
    `).join('');

  } catch (error) {
    console.error('加载历史记录失败:', error);
  }
}

/**
 * 加载对话列表
 */
async function loadConversations() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'getConversationList' }, (response) => {
      const conversationsList = document.getElementById('conversations-list');
      const conversationsCount = document.getElementById('conversations-count');

      if (chrome.runtime.lastError || !response || !response.success) {
        conversationsList.innerHTML = '<p class="empty-state">无法获取对话列表，请确保在 ChatGPT 页面</p>';
        conversationsCount.textContent = '0';
        return;
      }

      const conversations = response.conversations || [];
      conversationsCount.textContent = conversations.length;

      if (conversations.length === 0) {
        conversationsList.innerHTML = '<p class="empty-state">暂无对话</p>';
        return;
      }

      conversationsList.innerHTML = conversations.map(conv => `
        <div class="conversation-item">
          <div class="conversation-title">${conv.title}</div>
          <button class="btn btn-sm btn-icon export-conversation-btn" data-url="${conv.url}" data-title="${conv.title}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      `).join('');

      // 绑定导出按钮事件
      document.querySelectorAll('.export-conversation-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const url = e.currentTarget.getAttribute('data-url');
          const title = e.currentTarget.getAttribute('data-title');

          chrome.tabs.sendMessage(tab.id, {
            action: 'exportConversation',
            conversationUrl: url,
            conversationTitle: title
          });

          showMessage(`开始导出: ${title}`, 'info');
        });
      });
    });

  } catch (error) {
    console.error('加载对话列表失败:', error);
  }
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
  // 立即导出按钮
  document.getElementById('export-now').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'export' }, (response) => {
      if (response && response.success) {
        showMessage('导出成功！', 'success');
        loadHistory(); // 刷新历史记录
        loadStatus(); // 刷新统计
      } else {
        showMessage('导出失败，请确保在支持的页面上', 'error');
      }
    });
  });

  // 保存设置
  document.getElementById('save-settings').addEventListener('click', async () => {
    try {
      const subfolderName = document.getElementById('setting-subfolder-name').value.trim();

      // 验证子文件夹名称
      if (document.getElementById('setting-save-to-subfolder').checked && !subfolderName) {
        showMessage('请输入子文件夹名称', 'error');
        return;
      }

      const preferences = {
        notificationEnabled: document.getElementById('setting-notifications').checked,
        autoUpload: document.getElementById('setting-auto-upload').checked,
        fileNamingPattern: document.getElementById('setting-naming-pattern').value,
        saveToSubfolder: document.getElementById('setting-save-to-subfolder').checked,
        subfolderName: subfolderName || 'EchoSave'
      };

      await StorageManager.savePreferences(preferences);
      showMessage('设置已保存', 'success');

    } catch (error) {
      showMessage('保存设置失败', 'error');
      console.error(error);
    }
  });

  // 保存 OSS 配置
  document.getElementById('save-oss-config').addEventListener('click', async () => {
    try {
      const config = {
        accessKeyId: document.getElementById('oss-key-id').value.trim(),
        accessKeySecret: document.getElementById('oss-key-secret').value.trim(),
        bucket: document.getElementById('oss-bucket').value.trim(),
        region: document.getElementById('oss-region').value,
        path: document.getElementById('oss-path').value.trim()
      };

      if (!config.accessKeyId || !config.accessKeySecret || !config.bucket) {
        showMessage('请填写完整的 OSS 配置信息', 'error');
        return;
      }

      await StorageManager.saveOSSConfig(config);
      showMessage('OSS 配置已保存', 'success');

    } catch (error) {
      showMessage('保存配置失败', 'error');
      console.error(error);
    }
  });

  // 测试 OSS 连接
  document.getElementById('test-oss-connection').addEventListener('click', () => {
    showMessage('测试功能开发中，请使用独立脚本验证配置', 'info');
  });

  // 清空历史
  document.getElementById('clear-history').addEventListener('click', async () => {
    if (confirm('确定要清空所有导出历史吗？')) {
      await StorageManager.clearExportHistory();
      await loadHistory();
      await loadStatus();
      showMessage('历史记录已清空', 'success');
    }
  });

  // 刷新对话列表
  document.getElementById('refresh-conversations').addEventListener('click', async () => {
    await loadConversations();
    showMessage('对话列表已刷新', 'success');
  });
}

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // 小于 1 分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于 1 小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} 分钟前`;
  }

  // 小于 24 小时
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} 小时前`;
  }

  // 显示完整日期
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 显示消息提示
 */
function showMessage(message, type = 'info') {
  const messageEl = document.createElement('div');
  messageEl.className = `popup-message popup-message-${type}`;
  messageEl.textContent = message;

  document.body.appendChild(messageEl);

  setTimeout(() => {
    messageEl.classList.add('show');
  }, 10);

  setTimeout(() => {
    messageEl.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(messageEl);
    }, 300);
  }, 3000);
}
