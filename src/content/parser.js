/**
 * 对话解析器 - 从页面 DOM 提取对话内容并转换为 Markdown
 */

class ConversationParser {
  constructor(platform) {
    this.platform = platform;
    this.config = PLATFORM_CONFIGS[platform];
  }

  /**
   * 检测当前平台
   */
  static detectPlatform() {
    const hostname = window.location.hostname;

    for (const [platformKey, config] of Object.entries(PLATFORM_CONFIGS)) {
      const isMatch = config.urls.some(url => {
        return hostname.includes(url) || url.includes(hostname) || hostname === url;
      });

      if (isMatch) {
        return platformKey;
      }
    }

    return null;
  }

  /**
   * 提取对话标题
   */
  extractTitle() {
    // ChatGPT 特殊处理：从侧边栏当前激活的对话中提取标题
    if (this.platform === 'chatgpt') {
      // 尝试从 URL 获取当前对话 ID
      const currentUrl = window.location.pathname;
      const conversationIdMatch = currentUrl.match(/\/c\/([^\/]+)/);

      if (conversationIdMatch) {
        const currentConversationId = conversationIdMatch[1];

        // 在侧边栏中查找匹配的对话链接
        const conversationLinks = document.querySelectorAll(this.config.selectors.conversationList);

        for (const link of conversationLinks) {
          const href = link.getAttribute('href');
          if (href && href.includes(currentConversationId)) {
            const titleElement = link.querySelector(this.config.selectors.conversationItemTitle);
            if (titleElement) {
              const title = titleElement.textContent.trim();
              if (title) {
                return title;
              }
            }
          }
        }
      }

      // 后备方案：使用页面顶部标题
      const titleElement = document.querySelector(this.config.selectors.title);
      if (titleElement) {
        const title = titleElement.textContent.trim();
        if (title && title !== '未命名对话') {
          return title;
        }
      }
    }
    // Gemini 特殊处理：从左侧聊天列表获取当前激活对话的标题
    else if (this.platform === 'gemini') {
      // 查找所有对话项
      const conversations = document.querySelectorAll(this.config.selectors.conversationList);

      // 通过背景色识别当前激活的对话（激活的对话有浅蓝色背景）
      for (const conv of conversations) {
        const computedStyle = window.getComputedStyle(conv);
        const bgColor = computedStyle.backgroundColor;

        // 检查背景色是否不是透明（当前激活的对话有颜色背景）
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          const titleElement = conv.querySelector(this.config.selectors.conversationItemTitle);
          if (titleElement) {
            const title = titleElement.textContent.trim();
            if (title) {
              return title;
            }
          }
        }
      }

      // 后备方案：使用对话列表中第一个对话的标题
      if (conversations.length > 0) {
        const firstConv = conversations[0];
        const titleElement = firstConv.querySelector(this.config.selectors.conversationItemTitle);
        if (titleElement) {
          const title = titleElement.textContent.trim();
          return title || '未命名对话';
        }
      }
    } else {
      // 其他平台使用默认逻辑
      const titleElement = document.querySelector(this.config.selectors.title);
      if (titleElement) {
        return titleElement.textContent.trim() || '未命名对话';
      }
    }

    return '未命名对话';
  }

  /**
   * 获取所有对话列表（仅 ChatGPT）
   */
  getConversationList() {
    if (this.platform !== 'chatgpt' && this.platform !== 'gemini') {
      return [];
    }

    const conversations = [];
    const conversationLinks = document.querySelectorAll(this.config.selectors.conversationList);

    conversationLinks.forEach((link, index) => {
      const titleElement = link.querySelector(this.config.selectors.conversationItemTitle);

      if (this.platform === 'chatgpt') {
        const href = link.getAttribute('href');
        const conversationId = href ? href.split('/c/')[1] : null;

        if (titleElement && conversationId) {
          conversations.push({
            id: conversationId,
            title: titleElement.textContent.trim(),
            url: `https://chatgpt.com${href}`
          });
        }
      } else if (this.platform === 'gemini') {
        // Gemini: Conversations are buttons on the same page
        if (titleElement) {
          conversations.push({
            id: index,
            title: titleElement.textContent.trim(),
            element: link // Store the button element for clicking
          });
        }
      }
    });

    return conversations;
  }

  /**
   * 提取所有对话消息
   */
  extractMessages() {
    const messages = [];

    // ChatGPT 特殊处理
    if (this.platform === 'chatgpt') {
      const turns = document.querySelectorAll(this.config.selectors.container);

      turns.forEach((turn) => {
        // 检测是用户消息还是助手消息
        const isUser = turn.querySelector(this.config.selectors.userMsg);
        const isAssistant = turn.querySelector(this.config.selectors.assistantMsg);

        if (isUser || isAssistant) {
          const role = isUser ? 'user' : 'assistant';
          const contentElement = turn.querySelector('.markdown, .whitespace-pre-wrap');

          if (contentElement) {
            messages.push({
              role: role,
              content: this.extractContent(contentElement)
            });
          }
        }
      });
    }
    // Gemini 特殊处理
    else if (this.platform === 'gemini') {
      // 用户消息
      const userMessages = document.querySelectorAll(this.config.selectors.userMsg);
      const assistantMessages = document.querySelectorAll(this.config.selectors.assistantMsg);

      // 交替合并消息
      const maxLength = Math.max(userMessages.length, assistantMessages.length);
      for (let i = 0; i < maxLength; i++) {
        if (userMessages[i]) {
          messages.push({
            role: 'user',
            content: this.extractContent(userMessages[i])
          });
        }
        if (assistantMessages[i]) {
          messages.push({
            role: 'assistant',
            content: this.extractContent(assistantMessages[i])
          });
        }
      }
    }

    return messages;
  }

  /**
   * 提取元素内容并转换为 Markdown
   */
  extractContent(element) {
    let markdown = '';

    // 克隆元素以避免修改原始 DOM
    const cloned = element.cloneNode(true);

    // 处理代码块
    const codeBlocks = cloned.querySelectorAll('pre');
    codeBlocks.forEach((pre) => {
      const code = pre.querySelector('code');
      if (code) {
        // 尝试获取语言标识
        const languageClass = code.className.match(/language-(\w+)/);
        const language = languageClass ? languageClass[1] : '';

        const codeContent = code.textContent;
        const placeholder = `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;

        // 替换为占位符
        pre.setAttribute('data-markdown', placeholder);
        pre.textContent = `{{CODE_BLOCK_${codeBlocks.length}}}`;
      }
    });

    // 获取文本内容
    markdown = this.elementToMarkdown(cloned);

    // 恢复代码块
    codeBlocks.forEach((pre, index) => {
      const placeholder = pre.getAttribute('data-markdown');
      if (placeholder) {
        markdown = markdown.replace(`{{CODE_BLOCK_${codeBlocks.length}}}`, placeholder);
      }
    });

    return markdown.trim();
  }

  /**
   * 将 DOM 元素转换为 Markdown
   */
  elementToMarkdown(element) {
    let markdown = '';

    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();

        switch (tag) {
          case 'p':
            markdown += '\n\n' + this.elementToMarkdown(node) + '\n\n';
            break;
          case 'br':
            markdown += '\n';
            break;
          case 'strong':
          case 'b':
            markdown += '**' + this.elementToMarkdown(node) + '**';
            break;
          case 'em':
          case 'i':
            markdown += '*' + this.elementToMarkdown(node) + '*';
            break;
          case 'code':
            if (!node.parentElement || node.parentElement.tagName.toLowerCase() !== 'pre') {
              markdown += '`' + node.textContent + '`';
            }
            break;
          case 'pre':
            // 已在上面处理
            markdown += node.textContent;
            break;
          case 'a':
            const href = node.getAttribute('href') || '';
            markdown += '[' + this.elementToMarkdown(node) + '](' + href + ')';
            break;
          case 'ul':
          case 'ol':
            markdown += '\n' + this.listToMarkdown(node, tag === 'ol') + '\n';
            break;
          case 'li':
            markdown += this.elementToMarkdown(node);
            break;
          case 'h1':
            markdown += '\n# ' + this.elementToMarkdown(node) + '\n';
            break;
          case 'h2':
            markdown += '\n## ' + this.elementToMarkdown(node) + '\n';
            break;
          case 'h3':
            markdown += '\n### ' + this.elementToMarkdown(node) + '\n';
            break;
          case 'h4':
            markdown += '\n#### ' + this.elementToMarkdown(node) + '\n';
            break;
          case 'blockquote':
            const quoted = this.elementToMarkdown(node);
            markdown += '\n> ' + quoted.split('\n').join('\n> ') + '\n';
            break;
          default:
            markdown += this.elementToMarkdown(node);
        }
      }
    });

    return markdown;
  }

  /**
   * 转换列表为 Markdown
   */
  listToMarkdown(listElement, isOrdered = false) {
    let markdown = '';
    const items = listElement.querySelectorAll(':scope > li');

    items.forEach((item, index) => {
      const prefix = isOrdered ? `${index + 1}. ` : '- ';
      markdown += prefix + this.elementToMarkdown(item).trim() + '\n';
    });

    return markdown;
  }

  /**
   * 生成完整的 Markdown 文档
   */
  generateMarkdown() {
    const title = this.extractTitle();
    const messages = this.extractMessages();
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const chatId = now.toISOString().replace(/[-:]/g, '').split('.')[0].substring(0, 15);

    // 生成 YAML front matter
    let markdown = `---\n`;
    markdown += `title: ${title}\n`;
    markdown += `date: ${date}\n`;
    markdown += `chat_id: ${chatId}\n`;
    markdown += `source: ${this.platform}\n`;
    markdown += `model: ${this.config.name}\n`;
    markdown += `type: chat-log\n`;
    markdown += `tags: []\n`;
    markdown += `---\n\n`;

    // 主标题
    markdown += `# 聊天记录\n\n`;

    // 元信息部分
    markdown += `## 元信息\n`;
    markdown += `- 开始时间：${date}\n`;
    markdown += `- 主题：${title}\n`;
    markdown += `- 参与者：用户 / ${this.config.name}\n\n`;
    markdown += `---\n\n`;

    // 对话正文
    markdown += `## 对话正文\n\n`;

    messages.forEach((message, index) => {
      const icon = message.role === 'user' ? EXPORT_CONFIG.userIcon : EXPORT_CONFIG.assistantIcon;
      const roleName = message.role === 'user' ? '用户' : this.config.name;

      markdown += `### ${icon} ${roleName}\n`;
      markdown += `${message.content}\n\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.ConversationParser = ConversationParser;
}
