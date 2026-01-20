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
    // Gemini 特殊处理：使用对话列表中第一个对话的标题
    if (this.platform === 'gemini') {
      const conversations = document.querySelectorAll(this.config.selectors.conversationList);

      if (conversations.length > 0) {
        const firstConv = conversations[0];
        const titleElement = firstConv.querySelector(this.config.selectors.conversationItemTitle);
        if (titleElement) {
          const title = titleElement.textContent.trim();
          return title || '未命名对话';
        }
      }

      // 后备方案：使用页面顶部标题
      const titleElement = document.querySelector(this.config.selectors.title);
      if (titleElement) {
        return titleElement.textContent.trim() || '未命名对话';
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
        if (titleElement) {
          conversations.push({
            id: index,
            title: titleElement.textContent.trim(),
            url: window.location.href
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
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 统计信息
    const messageCount = messages.length;
    const codeBlockCount = messages.reduce((count, msg) => {
      return count + (msg.content.match(/```/g) || []).length / 2;
    }, 0);

    // 生成 Markdown 头部
    let markdown = `# ${title}\n\n`;
    markdown += `> 平台: ${this.config.name}\n`;
    markdown += `> 导出时间: ${timestamp}\n`;
    markdown += `> 消息数: ${messageCount}\n\n`;
    markdown += `${EXPORT_CONFIG.metadataSeparator}\n\n`;

    // 生成对话内容
    messages.forEach((message, index) => {
      const icon = message.role === 'user' ? EXPORT_CONFIG.userIcon : EXPORT_CONFIG.assistantIcon;
      const roleName = message.role === 'user' ? 'User' : 'Assistant';

      markdown += `## ${icon} ${roleName}\n\n`;
      markdown += `${message.content}\n\n`;

      if (index < messages.length - 1) {
        markdown += `${EXPORT_CONFIG.metadataSeparator}\n\n`;
      }
    });

    // 添加元数据
    markdown += `\n## 📊 元数据\n\n`;
    markdown += `- 总消息数: ${messageCount}\n`;
    markdown += `- 代码块数: ${Math.floor(codeBlockCount)}\n`;
    markdown += `- 用户消息: ${messages.filter(m => m.role === 'user').length}\n`;
    markdown += `- 助手消息: ${messages.filter(m => m.role === 'assistant').length}\n`;

    return markdown;
  }
}

// 导出到全局
if (typeof window !== 'undefined') {
  window.ConversationParser = ConversationParser;
}
