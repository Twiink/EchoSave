/**
 * EchoSave 内容脚本 - 主入口
 * 负责按钮注入和导出流程控制
 */

(function() {
  'use strict';

  let exportButton = null;
  let currentPlatform = null;

  /**
   * 初始化
   */
  function init() {
    // 检测平台
    currentPlatform = ConversationParser.detectPlatform();

    if (!currentPlatform) {
      console.log('EchoSave: 不支持的平台');
      return;
    }

    console.log(`EchoSave: 检测到平台 - ${currentPlatform}`);

    // 不再注入悬浮面板，仅通过浏览器扩展图标使用
  }

  /**
   * 注入右上角悬浮面板
   */
  function injectFloatingPanel() {
    // 避免重复注入
    if (document.getElementById('echosave-floating-panel')) {
      return;
    }

    // 创建容器
    const container = document.createElement('div');
    container.id = 'echosave-floating-panel';

    // 创建导出按钮
    const btn = document.createElement('div');
    btn.className = 'echosave-float-btn';
    btn.title = '导出当前对话 (EchoSave)';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>导出对话</span>
    `;

    // 绑定事件
    btn.addEventListener('click', (e) => {
      exportButton = e.currentTarget; // 保存引用以便 toggle loading 状态
      handleExport(e);
    });

    container.appendChild(btn);
    document.body.appendChild(container);

    console.log('EchoSave: 悬浮面板已注入');
  }

  /**
   * 处理导出操作
   */
  async function handleExport(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // 查找按钮元素
    const btn = document.querySelector('.echosave-float-btn');
    if (btn) {
      btn.classList.add('echosave-loading');
    }

    try {
      console.log('EchoSave: 开始导出...');

      // 创建解析器
      const parser = new ConversationParser(currentPlatform);

      // 生成 Markdown
      const markdown = parser.generateMarkdown();
      const title = parser.extractTitle();

      if (!markdown || markdown.length < 50) {
        throw new Error('未找到有效的对话内容');
      }

      console.log(`EchoSave: Markdown 生成成功，长度: ${markdown.length} 字符`);

      // 执行下载
      await FileDownloader.export(currentPlatform, title, markdown);

    } catch (error) {
      console.error('EchoSave: 导出失败', error);
      FileDownloader.showNotification(`❌ 导出失败: ${error.message}`, 'error');
    } finally {
      // 恢复按钮状态
      if (btn) {
        btn.classList.remove('echosave-loading');
      }
    }
  }

  /**
   * 导出指定对话
   */
  async function handleExportConversation(url, title) {
    try {
      FileDownloader.showNotification(`开始导出: ${title}`, 'info');

      // 在新标签页中打开对话并导出
      const newTab = window.open(url, '_blank');

      // 等待页面加载后导出
      setTimeout(async () => {
        const parser = new ConversationParser(currentPlatform);
        const markdown = parser.generateMarkdown();
        await FileDownloader.export(currentPlatform, title, markdown);
        newTab.close();
      }, 3000);

    } catch (error) {
      console.error('EchoSave: 导出对话失败', error);
      FileDownloader.showNotification(`❌ 导出失败: ${error.message}`, 'error');
    }
  }

  /**
   * 监听页面变化（应对 SPA 动态内容）
   */
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      // 检查按钮是否仍在页面中
      if (!document.getElementById('echosave-floating-panel')) {
        console.log('EchoSave: 面板被移除，重新注入');
        injectFloatingPanel();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'export') {
      handleExport(new Event('click'));
      sendResponse({ success: true });
    } else if (request.action === 'getStatus') {
      sendResponse({
        platform: currentPlatform,
        hasButton: exportButton && document.body.contains(exportButton)
      });
    } else if (request.action === 'getConversationList') {
      const parser = new ConversationParser(currentPlatform);
      const conversations = parser.getConversationList();
      sendResponse({ success: true, conversations });
    } else if (request.action === 'exportConversation') {
      handleExportConversation(request.conversationUrl, request.conversationTitle);
      sendResponse({ success: true });
    } else if (request.action === 'exportGeminiConversation') {
      const conversationButtons = document.querySelectorAll(PLATFORM_CONFIGS.gemini.selectors.conversationList);
      const button = conversationButtons[request.index];
      if (button) {
        // 获取对话标题
        const titleElement = button.querySelector(PLATFORM_CONFIGS.gemini.selectors.conversationItemTitle);
        const conversationTitle = titleElement ? titleElement.textContent.trim() : '未命名对话';

        button.click();
        setTimeout(() => {
          // 创建解析器并导出，使用从对话列表获取的标题
          const parser = new ConversationParser(currentPlatform);
          const markdown = parser.generateMarkdown();

          FileDownloader.export(currentPlatform, conversationTitle, markdown);
          sendResponse({ success: true });
        }, 4000);
      } else {
        sendResponse({ success: false, error: 'Conversation not found' });
      }
    }

    return true;
  });

  // 启动
  init();

})();
