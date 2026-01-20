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

    // 等待页面加载完成后注入按钮
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectButton);
    } else {
      injectButton();
    }

    // 使用 MutationObserver 监听动态内容
    observePageChanges();
  }

  /**
   * 注入导出按钮
   */
  function injectButton() {
    // 避免重复注入
    if (exportButton && document.body.contains(exportButton)) {
      return;
    }

    const config = PLATFORM_CONFIGS[currentPlatform];
    const targetElement = document.querySelector(config.buttonPosition.selector);

    if (!targetElement) {
      console.log('EchoSave: 未找到按钮插入位置，稍后重试');
      setTimeout(injectButton, 1000);
      return;
    }

    // 创建按钮
    exportButton = document.createElement('button');
    exportButton.className = 'echosave-export-button';
    exportButton.innerHTML = `
      <svg class="echosave-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>${EXPORT_CONFIG.buttonText}</span>
    `;

    // 绑定点击事件
    exportButton.addEventListener('click', handleExport);

    // 插入按钮
    if (config.buttonPosition.position === 'afterend') {
      targetElement.parentNode.insertBefore(exportButton, targetElement.nextSibling);
    } else if (config.buttonPosition.position === 'beforebegin') {
      targetElement.parentNode.insertBefore(exportButton, targetElement);
    } else {
      targetElement.appendChild(exportButton);
    }

    console.log('EchoSave: 导出按钮已注入');
  }

  /**
   * 处理导出操作
   */
  async function handleExport(event) {
    event.preventDefault();

    // 禁用按钮防止重复点击
    exportButton.disabled = true;
    exportButton.classList.add('echosave-loading');

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
      exportButton.disabled = false;
      exportButton.classList.remove('echosave-loading');
    }
  }

  /**
   * 监听页面变化（应对 SPA 动态内容）
   */
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      // 检查按钮是否仍在页面中
      if (exportButton && !document.body.contains(exportButton)) {
        console.log('EchoSave: 按钮被移除，重新注入');
        injectButton();
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
    }

    return true;
  });

  // 启动
  init();

})();
