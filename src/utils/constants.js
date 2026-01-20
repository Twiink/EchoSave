// 平台配置常量
const PLATFORM_CONFIGS = {
  chatgpt: {
    name: 'ChatGPT',
    urls: ['chat.openai.com', 'chatgpt.com'],
    selectors: {
      // 对话容器
      container: '[data-testid^="conversation-turn"]',
      // 用户消息
      userMsg: '[data-message-author-role="user"]',
      // 助手消息
      assistantMsg: '[data-message-author-role="assistant"]',
      // 对话标题（页面顶部）
      title: 'main h1',
      // 侧边栏对话列表
      conversationList: 'nav a[href^="/c/"]',
      // 对话列表项标题
      conversationItemTitle: 'span[dir="auto"]',
      // 代码块
      codeBlock: 'pre code',
      // 消息内容
      messageContent: '.markdown'
    },
    buttonPosition: {
      // 按钮插入位置选择器
      selector: 'nav',
      position: 'afterend'
    }
  },
  gemini: {
    name: 'Gemini',
    urls: ['gemini.google.com'],
    selectors: {
      container: 'message-content',
      userMsg: 'user-query',
      assistantMsg: 'model-response',
      title: '[role="heading"]',
      conversationList: '[data-test-id="conversation"]',
      conversationItemTitle: '.conversation-title',
      codeBlock: 'code-block pre',
      messageContent: '.message-content'
    },
    buttonPosition: {
      selector: 'main',
      position: 'afterend'
    }
  }
};

// 文件命名配置
const FILE_CONFIG = {
  // 文件名最大长度
  maxTitleLength: 50,
  // 非法字符替换
  illegalChars: /[<>:"/\\|?*\x00-\x1f]/g,
  replacementChar: '-',
  // 日期格式
  dateFormat: 'YYYY-MM-DD'
};

// 导出配置
const EXPORT_CONFIG = {
  // Markdown 元数据分隔符
  metadataSeparator: '---',
  // 用户角色图标
  userIcon: '👤',
  // 助手角色图标
  assistantIcon: '🤖',
  // 导出按钮文本
  buttonText: '📥 导出为 Markdown',
  // 通知显示时长（毫秒）
  notificationDuration: 3000
};

// 存储键名
const STORAGE_KEYS = {
  ossConfig: 'oss_config',
  userPreferences: 'user_preferences',
  exportHistory: 'export_history'
};

// 尝试导出到全局（兼容性处理）
if (typeof window !== 'undefined') {
  window.PLATFORM_CONFIGS = PLATFORM_CONFIGS;
  window.FILE_CONFIG = FILE_CONFIG;
  window.EXPORT_CONFIG = EXPORT_CONFIG;
  window.STORAGE_KEYS = STORAGE_KEYS;
}
