const PLATFORM_CONFIGS = {
  chatgpt: {
    name: 'ChatGPT',
    urls: ['chat.openai.com', 'chatgpt.com'],
    selectors: {
      container: '[data-testid^="conversation-turn"]',
      userMsg: '[data-message-author-role="user"]',
      assistantMsg: '[data-message-author-role="assistant"]',
      title: 'main h1',
      conversationList: 'nav a[href^="/c/"]',
      conversationItemTitle: 'span[dir="auto"]',
      codeBlock: 'pre code',
      messageContent: '.markdown'
    },
    buttonPosition: {
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

const FILE_CONFIG = {
  maxTitleLength: 50,
  illegalChars: /[<>:"/\\|?*\x00-\x1f]/g,
  replacementChar: '-',
  dateFormat: 'YYYY-MM-DD'
};

const EXPORT_CONFIG = {
  metadataSeparator: '---',
  userIcon: '👤',
  assistantIcon: '🤖',
  buttonText: '📥 导出为 Markdown',
  notificationDuration: 3000
};

const STORAGE_KEYS = {
  ossConfig: 'oss_config',
  userPreferences: 'user_preferences',
  exportHistory: 'export_history'
};

if (typeof window !== 'undefined') {
  window.PLATFORM_CONFIGS = PLATFORM_CONFIGS;
  window.FILE_CONFIG = FILE_CONFIG;
  window.EXPORT_CONFIG = EXPORT_CONFIG;
  window.STORAGE_KEYS = STORAGE_KEYS;
}
