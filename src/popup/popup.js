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

      conversationsList.innerHTML = conversations.map((conv, index) => `
        <div class="conversation-item">
          <label class="checkbox-label">
            <input type="checkbox" class="conversation-checkbox" data-url="${conv.url || ''}" data-title="${conv.title}" data-index="${index}">
          </label>
          <div class="conversation-title">${conv.title}</div>
          <button class="btn btn-sm btn-icon export-conversation-btn" data-url="${conv.url || ''}" data-title="${conv.title}" data-index="${index}">
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
          const index = e.currentTarget.getAttribute('data-index');

          // 获取当前平台
          const statusResponse = await new Promise(resolve => {
            chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, resolve);
          });

          if (statusResponse?.platform === 'gemini') {
            // Gemini: 点击对话按钮并导出
            chrome.tabs.sendMessage(tab.id, {
              action: 'exportGeminiConversation',
              index: parseInt(index)
            });
          } else {
            // ChatGPT: 使用 URL 导出
            chrome.tabs.sendMessage(tab.id, {
              action: 'exportConversation',
              conversationUrl: url,
              conversationTitle: title
            });
          }

          showMessage(`开始导出: ${title}`, 'info');
        });
      });

      // 绑定复选框事件
      updateBatchExportButton();
      document.querySelectorAll('.conversation-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateBatchExportButton);
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
      const preferences = {
        notificationEnabled: document.getElementById('setting-notifications').checked,
        autoUpload: document.getElementById('setting-auto-upload').checked,
        fileNamingPattern: document.getElementById('setting-naming-pattern').value
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

  // 全选/取消全选
  document.getElementById('select-all-conversations').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.conversation-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
    updateBatchExportButton();
  });

  // 批量导出
  document.getElementById('batch-export-btn').addEventListener('click', async () => {
    const selectedCheckboxes = document.querySelectorAll('.conversation-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
      showMessage('请先选择要导出的对话', 'error');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const total = selectedCheckboxes.length;

    // 获取当前平台
    const statusResponse = await new Promise(resolve => {
      chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, resolve);
    });
    const platform = statusResponse?.platform;

    // 显示进度条
    const progressContainer = document.getElementById('batch-export-progress');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressBarFill = document.getElementById('progress-bar-fill');

    progressContainer.style.display = 'block';
    document.getElementById('batch-export-btn').disabled = true;

    showMessage(`开始批量导出 ${total} 个对话`, 'info');

    if (platform === 'gemini') {
      // Gemini: 在当前页面点击对话按钮并导出
      for (let i = 0; i < selectedCheckboxes.length; i++) {
        const checkbox = selectedCheckboxes[i];
        const index = parseInt(checkbox.getAttribute('data-index'));

        // 更新进度
        const current = i + 1;
        const percentage = Math.round((current / total) * 100);
        progressText.textContent = `正在导出 ${current}/${total}`;
        progressPercentage.textContent = `${percentage}%`;
        progressBarFill.style.width = `${percentage}%`;

        // 在当前页面导出
        await new Promise(resolve => {
          chrome.tabs.sendMessage(tab.id, { action: 'exportGeminiConversation', index }, resolve);
        });

        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } else {
      // ChatGPT: 打开新标签页导出
      for (let i = 0; i < selectedCheckboxes.length; i++) {
        const checkbox = selectedCheckboxes[i];
        const url = checkbox.getAttribute('data-url');

        // 更新进度
        const current = i + 1;
        const percentage = Math.round((current / total) * 100);
        progressText.textContent = `正在导出 ${current}/${total}`;
        progressPercentage.textContent = `${percentage}%`;
        progressBarFill.style.width = `${percentage}%`;

        // 打开对话页面
        const newTab = await chrome.tabs.create({ url: url, active: false });

        // 等待页面加载完成后导出
        await new Promise(resolve => setTimeout(resolve, 4000));

        // 在新标签页中执行导出
        chrome.tabs.sendMessage(newTab.id, { action: 'export' }, (response) => {
          chrome.tabs.remove(newTab.id);
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 导出完成后取消所有选中的复选框
    selectedCheckboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    document.getElementById('select-all-conversations').checked = false;
    updateBatchExportButton();

    // 隐藏进度条
    progressContainer.style.display = 'none';
    progressBarFill.style.width = '0%';
    document.getElementById('batch-export-btn').disabled = false;

    showMessage('批量导出已完成', 'success');

    // 刷新统计数据和历史记录
    await loadHistory();
    await loadStatus();
  });
}

/**
 * 更新批量导出按钮状态
 */
function updateBatchExportButton() {
  const selectedCheckboxes = document.querySelectorAll('.conversation-checkbox:checked');
  const batchExportBtn = document.getElementById('batch-export-btn');
  const selectedCount = document.getElementById('selected-count');

  selectedCount.textContent = selectedCheckboxes.length;
  batchExportBtn.disabled = selectedCheckboxes.length === 0;
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
