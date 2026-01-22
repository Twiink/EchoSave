/**
 * EchoSave 内容脚本 - 主入口
 * 负责按钮注入和导出流程控制
 */

(function() {
  'use strict';

  let currentPlatform = null;

  function init() {
    currentPlatform = ConversationParser.detectPlatform();

    if (!currentPlatform) {
      console.log('EchoSave: 不支持的平台');
      return;
    }

    console.log(`EchoSave: 检测到平台 - ${currentPlatform}`);
    injectFloatingPanel();
    observePageChanges();
  }

  function injectFloatingPanel() {
    if (document.getElementById('echosave-floating-panel')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'echosave-floating-panel';

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

    btn.addEventListener('click', handleExport);

    container.appendChild(btn);
    document.body.appendChild(container);

    console.log('EchoSave: 悬浮面板已注入');
  }

  /**
   * 滚动到第一条消息并等待内容加载完成
   */
  async function scrollAndWaitForContent() {
    const config = PLATFORM_CONFIGS[currentPlatform];

    let previousTotalCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 15;

    while (scrollAttempts < maxScrollAttempts) {
      scrollAttempts++;

      window.scrollTo({ top: 0, behavior: 'smooth' });
      await new Promise(resolve => setTimeout(resolve, 1500));

      const firstUserMsg = document.querySelector(config.selectors.userMsg);
      if (firstUserMsg) {
        firstUserMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      let stableCount = 0;
      let lastCount = 0;

      for (let i = 0; i < 6; i++) {
        const currentCount = document.querySelectorAll(`${config.selectors.userMsg}, ${config.selectors.assistantMsg}`).length;

        if (currentCount === lastCount) {
          stableCount++;
          if (stableCount >= 3) break;
        } else {
          stableCount = 0;
        }

        lastCount = currentCount;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const currentTotalCount = lastCount;

      if (currentTotalCount === previousTotalCount) {
        break;
      }

      previousTotalCount = currentTotalCount;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * 处理导出操作
   */
  async function handleExport(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const btn = document.querySelector('.echosave-float-btn');
    if (btn) {
      btn.classList.add('echosave-loading');
    }

    try {
      await scrollAndWaitForContent();

      const parser = new ConversationParser(currentPlatform);

      const markdown = parser.generateMarkdown();
      const title = parser.extractTitle();

      if (!markdown || markdown.length < 50) {
        throw new Error('未找到有效的对话内容');
      }

      const success = await FileDownloader.export(currentPlatform, title, markdown);

      if (success) {
        FileDownloader.showNotification('✅ 导出成功', 'success');
      }

    } catch (error) {
      console.error('EchoSave: 导出失败', error);
      FileDownloader.showNotification(`❌ 导出失败: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.classList.remove('echosave-loading');
      }
    }
  }

  /**
   * 导出指定对话（在新标签页中打开并导出）
   */
  async function handleExportConversation(url, title) {
    try {
      const newTab = window.open(url, '_blank');

      setTimeout(async () => {
        await scrollAndWaitForContent();
        const parser = new ConversationParser(currentPlatform);
        const markdown = parser.generateMarkdown();
        const success = await FileDownloader.export(currentPlatform, title, markdown);
        if (success) {
          FileDownloader.showNotification(`✅ 导出成功: ${title}`, 'success');
        }
        newTab.close();
      }, 3000);
    } catch (error) {
      console.error('EchoSave: 导出对话失败', error);
      FileDownloader.showNotification(`❌ 导出失败: ${error.message}`, 'error');
    }
  }

  /**
   * 监听页面变化并重新注入面板（应对 SPA 动态内容）
   */
  function observePageChanges() {
    const observer = new MutationObserver(() => {
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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'export':
        handleExport(new Event('click')).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
        return true;

      case 'getStatus':
        sendResponse({
          platform: currentPlatform,
          hasButton: !!document.getElementById('echosave-floating-panel')
        });
        return true;

      case 'getConversationList': {
        const parser = new ConversationParser(currentPlatform);
        const conversations = parser.getConversationList();
        sendResponse({ success: true, conversations });
        return true;
      }

      case 'exportConversation':
        handleExportConversation(request.conversationUrl, request.conversationTitle);
        sendResponse({ success: true });
        return true;

      case 'exportGeminiConversation': {
        const conversationButtons = document.querySelectorAll(PLATFORM_CONFIGS.gemini.selectors.conversationList);
        const button = conversationButtons[request.index];
        if (!button) {
          sendResponse({ success: false, error: 'Conversation not found' });
          return true;
        }

        const titleElement = button.querySelector(PLATFORM_CONFIGS.gemini.selectors.conversationItemTitle);
        const conversationTitle = titleElement ? titleElement.textContent.trim() : '未命名对话';

        button.click();
        setTimeout(async () => {
          await scrollAndWaitForContent();
          const parser = new ConversationParser(currentPlatform);
          const markdown = parser.generateMarkdown();
          const success = await FileDownloader.export(currentPlatform, conversationTitle, markdown);
          if (success) {
            FileDownloader.showNotification(`✅ 导出成功: ${conversationTitle}`, 'success');
          }
          sendResponse({ success: true });
        }, 4000);
        return true;
      }

      default:
        return false;
    }
  });

  // 启动
  init();

})();
