
(function () {

  const faLink = document.createElement('link');
  faLink.rel = 'stylesheet';
  faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  (document.head || document.documentElement).appendChild(faLink);

  const DEFAULT_SETTINGS = {
    'extension-toggle': true,
    'visual-sticky-navbar': true,
    'visual-sticky-headers': true,
    'visual-theme-enabled': true,
    'visual-hide-sidebar': false,
    'visual-toggle-sidebar': false,
    'visual-vertical-borders': false,
    'visual-replace-favicon': false,
    'visual-remove-top-padding': false,
    'tweak-floating-filter': true,
    'tweak-load-more': true,
    'tweak-ip-info': false,
    'tweak-always-limit': 'none',
    'tweak-copy-btn-visibility': 'hover',
    'visual-logo-customization': 'default',
    'tweak-copy-row': true,
    'tweak-hide-row': true,
    'tweak-copy-cells': true,
    'tweak-block-copy': true,
    'tweak-multi-select': true
  };

  const LOGS_ORIGIN = 'https://logsparser.cypher-team.com';

  let currentSettings = { ...DEFAULT_SETTINGS };
  let arizonaSettings = {};
  let arizonaTemplates = [];

  let isProcessingTable = false;
  let isProcessingIps = false;
  let isProcessingIdentical = false;
  let isProcessingTuning = false;

  function clearCopyableSnippets() {
    document.querySelectorAll('.arz-copyable-snippet').forEach((snippet) => {
      snippet.replaceWith(document.createTextNode(snippet.textContent || ''));
    });
  }

  function updateCopyBlockSetting(enabled) {
    window.dispatchEvent(new CustomEvent('arizona-helper-copy-setting', {
      detail: { enabled: enabled === true }
    }));
  }

  function isCurrentlyProcessing() {
    return isProcessingTable;
  }

  function suspendObservers() {
    if (window.ArizonaObservers && typeof window.ArizonaObservers.stop === 'function') {
      window.ArizonaObservers.stop();
    }
    if (window.ArizonaMaskingManager && typeof window.ArizonaMaskingManager.stopObserver === 'function') {
      window.ArizonaMaskingManager.stopObserver();
    }
  }

  function resumeObservers() {
    if (currentSettings['extension-toggle'] !== false) {
      if (window.ArizonaObservers && typeof window.ArizonaObservers.start === 'function') {
        window.ArizonaObservers.start();
      }
      if (window.ArizonaMaskingManager && typeof window.ArizonaMaskingManager.startObserver === 'function') {
        window.ArizonaMaskingManager.startObserver();
      }
    }
  }

  function isValidNickname(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (s.length < 3 || s.length > 32) return false;
    if (/^(unic_id\d*|color_?id\d*|item_?id\d*|model_?id\d*|account_?id\d*|char_?id\d*|player_?id\d*|user_?id\d*|vk_?id\d*|tg_?id\d*|vc_?id\d*|discord_?id\d*)$/i.test(s)) {
      return false;
    }
    return /^[A-Z][a-zA-Z0-9]*_[A-Za-z0-9_]+$/.test(s);
  }
  window.isValidNickname = isValidNickname;

  function runWhenElementExists(selector, callback) {
    const el = document.querySelector(selector);
    if (el) {
      callback(el);
      return;
    }
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (attempts >= 100) {
        clearInterval(timer);
      }
    }, 100);
  }

  function openOverlay(overlay) {
    document.body.appendChild(overlay);
    overlay.getBoundingClientRect();
    overlay.classList.add('open-active');
    document.body.classList.add('arz-modal-open');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        const container = overlay.querySelector('.arz-modal-container, .arz-modal');
        if (container) {
          container.classList.remove('arz-modal-bounce');
          void container.offsetWidth;
          container.classList.add('arz-modal-bounce');
        }
      }
    });
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('open-active');
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.remove();
      const openOverlays = document.querySelectorAll('.arz-modal-overlay.open-active');
      const filterModal = document.querySelector('.arz-filter-modal');
      const isFilterOpen = filterModal && filterModal.style.display === 'flex';
      if (openOverlays.length === 0 && !isFilterOpen) {
        document.body.classList.remove('arz-modal-open');
      }
    }, 250);
  }

  function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function setupDateShortcuts(container, dateFromId, dateToId) {
    container.querySelectorAll('.arz-btn-shortcut').forEach(btn => {
      btn.onclick = () => {
        const range = btn.dataset.range;
        const toDate = new Date();
        let fromDate = new Date();

        if (range === 'day') {
        } else if (range === 'week') {
          fromDate.setDate(toDate.getDate() - 6);
        } else if (range === 'month') {
          fromDate.setMonth(toDate.getMonth() - 1);
        } else if (range === 'start-week') {
          const day = fromDate.getDay();
          const diff = fromDate.getDate() - day + (day === 0 ? -6 : 1);
          fromDate.setDate(diff);
        } else if (range === 'start-month') {
          fromDate.setDate(1);
        } else if (range === 'start-year') {
          fromDate.setMonth(0, 1);
        }

        const dateFromInput = container.querySelector('#' + dateFromId);
        const dateToInput = container.querySelector('#' + dateToId);
        if (dateFromInput) dateFromInput.value = formatLocalDate(fromDate);
        if (dateToInput) dateToInput.value = formatLocalDate(toDate);
      };
    });
  }

  async function fetchWithRetry(url, options = {}, maxRetries = 5, initialDelay = 1500) {
    let retries = 0;
    while (true) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429) {
          retries++;
          if (retries > maxRetries) {
            return response;
          }
          const retryAfterHeader = response.headers.get('Retry-After');
          let delay = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : initialDelay * Math.pow(2, retries - 1);
          if (isNaN(delay) || delay <= 0) {
            delay = initialDelay * Math.pow(2, retries - 1);
          }
          delay = Math.min(delay, 15000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return response;
      } catch (err) {
        if (retries >= maxRetries) {
          throw err;
        }
        retries++;
        let delay = initialDelay * Math.pow(2, retries - 1);
        delay = Math.min(delay, 15000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('execCommand copy failed'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  class LogAnonymizer {
    constructor() {
      this.reset();
    }

    reset() {
      this.nickMap = new Map();
      this.nickRevMap = new Map();
      this.ipMap = new Map();
      this.ipRevMap = new Map();
      this.moneyMap = new Map();
      this.moneyRevMap = new Map();
      this.dateMap = new Map();
      this.dateRevMap = new Map();

      this.nickCounter = 0;
      this.ipCounter = 0;
      this.moneyCounter = 0;
      this.dateCounter = 0;
      this.baseDate = new Date('2020-01-01T00:00:00');
    }

    exportState() {
      return {
        nickMap: Object.fromEntries(this.nickMap),
        nickRevMap: Object.fromEntries(this.nickRevMap),
        ipMap: Object.fromEntries(this.ipMap),
        ipRevMap: Object.fromEntries(this.ipRevMap),
        moneyMap: Object.fromEntries(this.moneyMap),
        moneyRevMap: Object.fromEntries(this.moneyRevMap),
        dateMap: Object.fromEntries(this.dateMap),
        dateRevMap: Object.fromEntries(this.dateRevMap),
        nickCounter: this.nickCounter,
        ipCounter: this.ipCounter,
        moneyCounter: this.moneyCounter,
        dateCounter: this.dateCounter
      };
    }

    importState(state) {
      if (!state) return;
      this.nickMap = new Map(Object.entries(state.nickMap || {}));
      this.nickRevMap = new Map(Object.entries(state.nickRevMap || {}));
      this.ipMap = new Map(Object.entries(state.ipMap || {}));
      this.ipRevMap = new Map(Object.entries(state.ipRevMap || {}));
      this.moneyMap = new Map(Object.entries(state.moneyMap || {}));
      this.moneyRevMap = new Map(Object.entries(state.moneyRevMap || {}));
      this.dateMap = new Map(Object.entries(state.dateMap || {}));
      this.dateRevMap = new Map(Object.entries(state.dateRevMap || {}));
      this.nickCounter = state.nickCounter || 0;
      this.ipCounter = state.ipCounter || 0;
      this.moneyCounter = state.moneyCounter || 0;
      this.dateCounter = state.dateCounter || 0;
    }

    getFakeNickname(realName) {
      if (this.nickMap.has(realName)) {
        return this.nickMap.get(realName);
      }
      this.nickCounter++;
      const fakeName = `Fake_Player_${this.nickCounter}`;
      this.nickMap.set(realName, fakeName);
      this.nickRevMap.set(fakeName, realName);
      return fakeName;
    }

    getFakeIP(realIP) {
      if (this.ipMap.has(realIP)) {
        return this.ipMap.get(realIP);
      }
      this.ipCounter++;
      const fakeIP = `10.0.0.${this.ipCounter}`;
      this.ipMap.set(realIP, fakeIP);
      this.ipRevMap.set(fakeIP, realIP);
      return fakeIP;
    }

    getFakeMoney(realMoneyStr, currency) {
      const key = realMoneyStr + ' ' + currency;
      if (this.moneyMap.has(key)) {
        return this.moneyMap.get(key);
      }
      this.moneyCounter++;
      const baseVal = this.moneyCounter * 250000;
      const fakeMoneyStr = baseVal.toLocaleString('en-US');
      const fakeVal = `${fakeMoneyStr} ${currency}`;
      this.moneyMap.set(key, fakeVal);
      this.moneyRevMap.set(fakeVal, realMoneyStr + ' ' + currency);
      return fakeVal;
    }

    getFakeDate(realDateStr) {
      if (this.dateMap.has(realDateStr)) {
        return this.dateMap.get(realDateStr);
      }
      this.dateCounter++;
      const newDate = new Date(this.baseDate.getTime() + this.dateCounter * 60000);
      const pad = (num) => String(num).padStart(2, '0');
      const fakeDateStr = `${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())} ` +
        `${pad(newDate.getHours())}:${pad(newDate.getMinutes())}:${pad(newDate.getSeconds())}`;
      this.dateMap.set(realDateStr, fakeDateStr);
      this.dateRevMap.set(fakeDateStr, realDateStr);
      return fakeDateStr;
    }

    anonymizeCyrillicNames(query) {
      if (!query) return query;
      let result = query;
      const nicks = Array.from(this.nickMap.keys());
      if (nicks.length === 0) return query;

      const nickPhonetics = nicks.map(realName => {
        const parts = realName.split('_');
        return {
          realName: realName,
          fakeName: this.nickMap.get(realName),
          firstPhonetic: normalizePhonetic(parts[0]),
          lastPhonetic: normalizePhonetic(parts[1] || ''),
          fullPhonetic: normalizePhonetic(parts[0] + (parts[1] || ''))
        };
      });

      function normalizePhonetic(str) {
        if (!str) return '';
        let s = str.toLowerCase();
        const cyrToLat = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
          'з': 'z', 'и': 'i', 'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
          'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
          'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
          'я': 'ya'
        };
        let res = '';
        for (let i = 0; i < s.length; i++) {
          const char = s[i];
          if (cyrToLat[char] !== undefined) {
            res += cyrToLat[char];
          } else {
            res += char;
          }
        }
        res = res
          .replace(/ph/g, 'f')
          .replace(/th/g, 't')
          .replace(/kh/g, 'h')
          .replace(/oo/g, 'u')
          .replace(/ee/g, 'i')
          .replace(/ck/g, 'k')
          .replace(/c/g, 'k')
          .replace(/y/g, 'i')
          .replace(/x/g, 'ks')
          .replace(/w/g, 'v')
          .replace(/([a-z])\1+/g, '$1');
        return res.replace(/[^a-z0-9]/g, '');
      }

      const cyrWordRegex = /[а-яА-ЯёЁ]+/g;
      const words = [];
      let match;
      while ((match = cyrWordRegex.exec(query)) !== null) {
        words.push({
          text: match[0],
          index: match.index,
          length: match[0].length
        });
      }

      for (let i = 0; i < words.length - 1; i++) {
        const w1 = words[i];
        const w2 = words[i + 1];
        const intermediateText = query.substring(w1.index + w1.length, w2.index);
        if (intermediateText.length > 5 || /[\w]/.test(intermediateText)) continue;

        const combinedCyrillic = w1.text + w2.text;
        const combinedPhonetic = normalizePhonetic(combinedCyrillic);

        const found = nickPhonetics.find(np => {
          const lenDiff = Math.abs(np.fullPhonetic.length - combinedPhonetic.length);
          if (lenDiff > 2) return false;
          return np.fullPhonetic.startsWith(combinedPhonetic.substring(0, Math.min(np.fullPhonetic.length - 1, combinedPhonetic.length))) ||
            combinedPhonetic.startsWith(np.fullPhonetic.substring(0, Math.min(combinedPhonetic.length - 1, np.fullPhonetic.length)));
        });

        if (found) {
          result = result.substring(0, w1.index) + found.fakeName + result.substring(w2.index + w2.length);
          return this.anonymizeCyrillicNames(result);
        }
      }

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const wordPhonetic = normalizePhonetic(w.text);
        if (wordPhonetic.length < 3) continue;

        const found = nickPhonetics.find(np => {
          return (np.firstPhonetic.length >= 3 && (np.firstPhonetic.startsWith(wordPhonetic) || wordPhonetic.startsWith(np.firstPhonetic))) ||
            (np.lastPhonetic.length >= 3 && (np.lastPhonetic.startsWith(wordPhonetic) || wordPhonetic.startsWith(np.lastPhonetic)));
        });

        if (found) {
          result = result.substring(0, w.index) + found.fakeName + result.substring(w.index + w.length);
          return this.anonymizeCyrillicNames(result);
        }
      }

      return result;
    }

    anonymize(text) {
      let result = this.anonymizeCyrillicNames(text);

      const nickRegex = /\b[A-Z][a-zA-Z0-9]*_[A-Z][a-zA-Z0-9]*\b/g;
      const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      const dateRegex = /\b\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\b|\b\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}\b/g;
      const moneyRegex = /\b\d{1,3}(?:[,\s]\d{3})*(?:\s*(?:\$|руб|VC\$))(?!\w)/g;
      const datesFound = [];
      result = result.replace(dateRegex, (match) => {
        const fake = this.getFakeDate(match);
        datesFound.push(fake);
        return `__DATE_${datesFound.length - 1}__`;
      });

      const ipsFound = [];
      result = result.replace(ipRegex, (match) => {
        const fake = this.getFakeIP(match);
        ipsFound.push(fake);
        return `__IP_${ipsFound.length - 1}__`;
      });

      const moneyFound = [];
      result = result.replace(moneyRegex, (match) => {
        const numPart = match.replace(/[^\d,\s]/g, '').trim();
        const currPart = match.replace(/[\d,\s]/g, '').trim();
        const fake = this.getFakeMoney(numPart, currPart);
        moneyFound.push(fake);
        return `__MONEY_${moneyFound.length - 1}__`;
      });

      const nicksFound = [];
      result = result.replace(nickRegex, (match) => {
        const fake = this.getFakeNickname(match);
        nicksFound.push(fake);
        return `__NICK_${nicksFound.length - 1}__`;
      });

      result = result.replace(/__DATE_(\d+)__/g, (m, idx) => datesFound[parseInt(idx)]);
      result = result.replace(/__IP_(\d+)__/g, (m, idx) => ipsFound[parseInt(idx)]);
      result = result.replace(/__MONEY_(\d+)__/g, (m, idx) => moneyFound[parseInt(idx)]);
      result = result.replace(/__NICK_(\d+)__/g, (m, idx) => nicksFound[parseInt(idx)]);

      return result;
    }

    deanonymize(fakeText) {
      let result = fakeText;

      const fakeNicks = Array.from(this.nickRevMap.keys()).sort((a, b) => b.length - a.length);
      fakeNicks.forEach(fake => {
        const real = this.nickRevMap.get(fake);
        const escaped = fake.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), real);
      });

      const fakeDates = Array.from(this.dateRevMap.keys()).sort((a, b) => b.length - a.length);
      fakeDates.forEach(fake => {
        const real = this.dateRevMap.get(fake);
        const parts = fake.split(' ');
        if (parts.length === 2) {
          const datePart = parts[0];
          const timePart = parts[1];
          const escapedDate = datePart.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const escapedTime = timePart.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const flexibleRegex = new RegExp(escapedDate + '(\\s*(?:в|at|,|-)?\\s*)' + escapedTime, 'g');
          result = result.replace(flexibleRegex, real);
        } else {
          const escaped = fake.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          result = result.replace(new RegExp(escaped, 'g'), real);
        }
      });

      const fakeMoney = Array.from(this.moneyRevMap.keys()).sort((a, b) => b.length - a.length);
      fakeMoney.forEach(fake => {
        const real = this.moneyRevMap.get(fake);
        const escaped = fake.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), real);
      });

      const fakeIPs = Array.from(this.ipRevMap.keys()).sort((a, b) => b.length - a.length);
      fakeIPs.forEach(fake => {
        const real = this.ipRevMap.get(fake);
        const escaped = fake.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), real);
      });

      return result;
    }
  }

  function copyTextToClipboard(text, element) {
    writeToClipboard(text).then(() => {
      const originalColor = element.style.color;
      const originalBorder = element.style.borderBottom;

      element.style.color = 'var(--az-success)';
      element.style.borderBottom = '1px solid var(--az-success)';

      setTimeout(() => {
        element.style.color = originalColor;
        element.style.borderBottom = originalBorder;
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy snippet:', err);
    });
  }

  const getCleanCellText = (cell, isIpCell = false) => {
    if (!cell) return '';
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('.arz-row-actions-wrapper, .arz-cell-copy-btn, .arz-log-copy-menu-btn, .arz-col-eye-btn, .badge, .bi, svg, i, .az-geo-inserted').forEach(el => el.remove());
    let text = clone.textContent;
    if (!isIpCell) {
      const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
      text = text.replace(ipGeoRegex, '');
    }
    return text.replace(/\s+/g, ' ').trim();
  };

  function copyRowToClipboard(tr, btn) {
    const date = getCleanCellText(tr.cells[0]);
    const action = getCleanCellText(tr.cells[1]);
    const data = getCleanCellText(tr.cells[2]);
    const ip = getCleanCellText(tr.cells[3], true);

    const parts = [date, action, data, ip].map(x => x.trim());
    while (parts.length > 0 && !parts[parts.length - 1]) {
      parts.pop();
    }
    const cleanText = parts.join(' | ');

    writeToClipboard(cleanText).then(() => {
      btn.classList.add('copied');
      const icon = btn.querySelector('i');
      icon.className = 'fa-solid fa-check';
      setTimeout(() => {
        btn.classList.remove('copied');
        icon.className = 'fa-regular fa-copy';
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy row:', err);
    });
  }

  function injectRowActions(tr) {
    if (!tr) return;
    const wrappers = tr.querySelectorAll('.arz-row-actions-wrapper');
    wrappers.forEach(el => el.remove());
  }

  function copyCellText(cell, btn) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('.arz-row-actions-wrapper, .arz-cell-copy-btn, .arz-log-copy-menu-btn, .arz-col-eye-btn, .badge, .bi, svg, i, .az-geo-inserted').forEach(el => el.remove());
    let text = clone.textContent;
    const isIpCell = cell.cellIndex === 3;
    if (!isIpCell) {
      const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
      text = text.replace(ipGeoRegex, '');
    }
    const textToCopy = text.replace(/\s+/g, ' ').trim();

    writeToClipboard(textToCopy).then(() => {
      btn.classList.add('copied');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-check';
      }
      setTimeout(() => {
        btn.classList.remove('copied');
        if (icon) {
          icon.className = 'fa-regular fa-copy';
        }
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy cell text:', err);
    });
  }

  function processSnippetsInElement(element) {
    if (!element) return;
    if (currentSettings['tweak-copy-cells'] === false) return;
    if (element.querySelector('.arz-copyable-snippet') || element.classList.contains('arz-copyable-snippet')) return;

    const textNodes = [];
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === 'BUTTON' || parent.tagName === 'A' || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('.arz-row-actions-wrapper') || parent.closest('.arz-col-eye-btn') || parent.closest('.badge') || parent.closest('.arz-cell-copy-btn')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while (node = walk.nextNode()) {
      textNodes.push(node);
    }
  }

  let copyBtnObserver = null;

  function lazyInjectCopyBtn(tr) {
    if (!tr.cells[1]) return;
    if (tr.getAttribute('data-arz-copy-btn-injected') === 'true') return;

    tr.setAttribute('data-arz-copy-btn-injected', 'true');

    const cell = tr.cells[1];
    if (cell.querySelector('.arz-log-copy-menu-btn')) return;

    cell.style.setProperty('position', 'relative', 'important');
    cell.style.setProperty('padding-right', '36px', 'important');

    const copyBtn = document.createElement('span');
    copyBtn.setAttribute('role', 'button');
    copyBtn.className = 'arz-log-copy-menu-btn';
    copyBtn.title = 'Копировать...';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.ArizonaCopyPopupMenu.open(e, tr);
    });

    cell.appendChild(copyBtn);
  }

  function handleRowHover(e) {
    if (document.body.classList.contains('arz-extension-disabled')) return;

    const tr = e.target.closest('table.table tbody tr');
    if (!tr) return;

    lazyInjectCopyBtn(tr);
  }

  function initCopyButtonsLazy(settings) {
    const isEnabled = settings['extension-toggle'] !== false &&
      settings['tweak-copy-btn-visibility'] !== 'off';
    if (!isEnabled) {
      document.removeEventListener('mouseover', handleRowHover);
      if (copyBtnObserver) {
        copyBtnObserver.disconnect();
        copyBtnObserver = null;
      }
      document.querySelectorAll('.arz-log-copy-menu-btn').forEach(btn => btn.remove());
      document.querySelectorAll('tr[data-arz-copy-btn-injected="true"]').forEach((tr) => {
        tr.removeAttribute('data-arz-copy-btn-injected');
        const cell = tr.cells?.[1];
        if (cell) {
          cell.style.removeProperty('position');
          cell.style.removeProperty('padding-right');
        }
      });
      return;
    }

    const visibilityMode = settings['tweak-copy-btn-visibility'] || 'hover';

    if (visibilityMode === 'always') {
      if (!copyBtnObserver) {
        copyBtnObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const tr = entry.target;
              copyBtnObserver.unobserve(tr);
              lazyInjectCopyBtn(tr);
            }
          });
        }, {
          rootMargin: '200px 0px',
          threshold: 0.01
        });
      }

      const table = document.querySelector('table.table');
      if (table) {
        table.querySelectorAll('tbody tr').forEach(tr => {
          if (tr.getAttribute('data-arz-copy-btn-injected') !== 'true') {
            copyBtnObserver.observe(tr);
          }
        });
      }
    } else {
      if (copyBtnObserver) {
        copyBtnObserver.disconnect();
        copyBtnObserver = null;
      }
    }

    document.removeEventListener('mouseover', handleRowHover);
    document.addEventListener('mouseover', handleRowHover, { passive: true });
  }

  function getIpCellFromRow(tr) {
    if (!tr || !tr.cells) return null;
    if (tr.cells[3] && (tr.cells[3].querySelector('.table-ip') || /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(tr.cells[3].textContent))) {
      return tr.cells[3];
    }
    if (tr.cells[2] && (tr.cells[2].querySelector('.table-ip') || /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(tr.cells[2].textContent))) {
      return tr.cells[2];
    }
    for (let i = 1; i < tr.cells.length; i++) {
      if (tr.cells[i] && tr.cells[i].querySelector('.table-ip')) return tr.cells[i];
    }
    return tr.cells[3] || null;
  }

  function highlightIdenticalIps(tr) {
    if (!arizonaSettings.tools?.identicalIPs) return;
    const ipCell = getIpCellFromRow(tr);
    if (!ipCell) return;
    const links = ipCell.querySelectorAll('a[title="последний"], [title*="последний"], .badge-secondary');
    if (links.length < 2) return;
    const ips = Array.from(links).map(l => l.textContent.trim());
    const hasDup = ips.some((ip, idx) => ips.indexOf(ip) !== idx);
    const col = arizonaSettings.tools.identicalIPsColor || '#d33b45';
    if (hasDup) {
      tr.style.color = col;
      links.forEach(l => l.style.color = col);
    } else {
      tr.style.color = '';
      links.forEach(l => l.style.color = '');
    }
  }

  let cachedTuningPatterns = null;
  let cachedTuningPatternString = null;

  function getTuningPatterns() {
    const patternStr = arizonaSettings.tuningParts?.timePattern || '';
    if (cachedTuningPatternString === patternStr && cachedTuningPatterns !== null) {
      return cachedTuningPatterns;
    }
    cachedTuningPatternString = patternStr;
    cachedTuningPatterns = patternStr.split(',')
      .map(p => p.trim())
      .filter(p => /^\d{2}:\d{2}$/.test(p));
    return cachedTuningPatterns;
  }

  function highlightTuningAHK(tr) {
    if (!arizonaSettings.tuningParts?.enabled) return;
    const timeCell = tr.cells[0];
    const actCell = tr.cells[1];
    if (!timeCell || !actCell) return;

    const KEYWORDS = ['тонировка', 'цвет фар', 'установка', 'изменение', 'улучшение', 'прошивка', 'перекраска', 'обклейка'];
    const text = actCell.textContent.toLowerCase();
    const isTuning = KEYWORDS.some(k => text.includes(k));
    const timeMatch = timeCell.textContent.match(/(\d{2}):(\d{2}):(\d{2})/);
    const timeStr = timeMatch ? `${timeMatch[2]}:${timeMatch[3]}` : '';

    const patterns = getTuningPatterns();
    const matchTime = timeStr && (patterns.length === 0 || patterns.includes(timeStr));

    const col = arizonaSettings.tuningParts.highlightColor || '#d33b45';
    const w = arizonaSettings.tuningParts.outlineWidth || 2;

    if (isTuning && (matchTime || !arizonaSettings.tuningParts.highlightOnlyMatching)) {
      tr.style.outline = `${w}px solid ${col}`;
      return true;
    } else {
      tr.style.outline = '';
      return false;
    }
  }

  function handleTuningAutoScroll() {
    if (arizonaSettings.tuningParts?.enabled && arizonaSettings.tuningParts.autoScrollToMatch) {
      const match = document.querySelector('tbody tr[style*="outline"]');
      if (match) {
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function injectMarkHandle(tr) {
    if (!tr || !tr.cells || !tr.cells[0]) return;
    const firstCell = tr.cells[0];
    if (firstCell.querySelector('.arz-row-mark-handle')) return;

    firstCell.style.setProperty('position', 'relative', 'important');
    firstCell.style.setProperty('padding-left', '14px', 'important');
    const handle = document.createElement('div');
    handle.className = 'arz-row-mark-handle';
    handle.title = 'Отметить / снять метку с лога';

    handle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const isMarked = tr.classList.toggle('arz-row-marked');
      if (window.ArizonaNotifications) {
        window.ArizonaNotifications.show(isMarked ? 'Лог отмечен' : 'Метка снята', isMarked ? 'success' : 'info');
      }
    });

    firstCell.insertBefore(handle, firstCell.firstChild);
  }

  function removeMarkHandle(tr) {
    const handle = tr?.querySelector('.arz-row-mark-handle');
    if (handle) handle.remove();
    if (tr?.cells?.[0]) {
      tr.cells[0].style.removeProperty('position');
      tr.cells[0].style.removeProperty('padding-left');
    }
  }

  function processRow(tr) {
    if (!tr || !tr.cells || !tr.cells[1]) return;

    try {
      if (arizonaSettings.tools?.markLogsEnabled !== false) injectMarkHandle(tr);
      else removeMarkHandle(tr);
    } catch (e) { }
    try { window.ArizonaMultiSelectManager.injectCheckbox(tr); } catch (e) { }

    if (window.ArizonaMaskingManager && typeof window.ArizonaMaskingManager.maskRow === 'function') {
      try { window.ArizonaMaskingManager.maskRow(tr); } catch (e) { }
    }

    try { highlightIdenticalIps(tr); } catch (e) { }
    try { highlightTuningAHK(tr); } catch (e) { }
    try { injectRowActions(tr); } catch (e) { }

    if (currentSettings['tweak-copy-cells'] !== false) {
      try { processSnippetsInElement(tr.cells[1]); } catch (e) { }
    }
    if (tr.cells[2]) {
      if (currentSettings['tweak-copy-cells'] !== false) {
        try { processSnippetsInElement(tr.cells[2]); } catch (e) { }
      }
    }

    const isEnabled = currentSettings['extension-toggle'] !== false;
    const isIpEnabled = isEnabled && (currentSettings['tweak-ip-info'] || arizonaSettings.ipLookupEnabled);
    if (isIpEnabled) {
      try {
        injectIpPlaceholder(tr);
        const observer = getIpRowObserver();
        if (observer) {
          const processed = tr.getAttribute('data-arz-ip-processed');
          if (processed !== 'true' && processed !== 'pending') {
            observer.observe(tr);
            queueIpRowForProcessing(tr);
          }
        }
      } catch (e) {
        console.error('Error processing IP for row:', e);
      }
    }

    const visibilityMode = currentSettings['tweak-copy-btn-visibility'] || 'hover';
    if (visibilityMode === 'always' && copyBtnObserver) {
      try { copyBtnObserver.observe(tr); } catch (e) { }
    }
  }

  window.ArizonaCopyPopupMenu = (function () {
    let currentPopup = null;

    function close() {
      if (currentPopup) {
        currentPopup.classList.remove('open');
        currentPopup.classList.add('closing');
        const pop = currentPopup;
        setTimeout(() => pop.remove(), 200);
        currentPopup = null;
      }
    }

    function getNicknamesFromRow(tr) {
      const nicks = [];
      const actionCell = tr.cells ? tr.cells[1] : null;
      if (!actionCell) return nicks;

      actionCell.querySelectorAll('a[href*="player="], a[href*="player"]').forEach(lnk => {
        let text = '';
        if (lnk.href) {
          try {
            const url = new URL(lnk.href, window.location.origin);
            text = url.searchParams.get('player') || '';
          } catch (e) { }
        }
        if (!text) text = lnk.textContent.trim();
        if (text && isValidNickname(text) && !nicks.includes(text)) {
          nicks.push(text);
        }
      });

      actionCell.querySelectorAll('a strong').forEach(el => {
        const text = el.textContent.trim();
        if (text && isValidNickname(text) && !nicks.includes(text)) {
          nicks.push(text);
        }
      });

      if (nicks.length === 0) {
        const textContent = actionCell.textContent || '';
        const nickRegex = /\b[A-Z][a-zA-Z0-9]*_[A-Za-z0-9_]+\b/g;
        const matches = textContent.match(nickRegex);
        if (matches) {
          matches.forEach(m => {
            if (isValidNickname(m) && !nicks.includes(m)) nicks.push(m);
          });
        }
      }

      return nicks;
    }

    function open(event, tr) {
      close();

      const getCleanCellText = (cell, isIpCell = false) => {
        if (!cell) return '';
        const clone = cell.cloneNode(true);
        clone.querySelectorAll('.arz-row-actions-wrapper, .arz-cell-copy-btn, .arz-log-copy-menu-btn, .arz-col-eye-btn, .badge, .bi, svg, i, .az-geo-inserted').forEach(el => el.remove());
        let text = clone.textContent;
        if (!isIpCell) {
          const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
          text = text.replace(ipGeoRegex, '');
        }
        return text.replace(/\s+/g, ' ').trim();
      };

      const date = getCleanCellText(tr.cells[0]);
      const action = getCleanCellText(tr.cells[1]);
      const data = getCleanCellText(tr.cells[2]);
      const ipCell = getIpCellFromRow(tr);
      const ip = getCleanCellText(ipCell, true);

      const nicks = getNicknamesFromRow(tr);
      const nick1 = nicks[0] || null;
      const nick2 = nicks[1] || null;

      const dropdown = document.createElement('div');
      dropdown.className = 'arz-ip-dropdown arz-copy-dropdown';

      const nick1Btn = nick1
        ? `<button class="arz-ip-dropdown-item" data-action="nick-1" data-nick="${window.ArizonaUtils.escapeHtml(nick1)}"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Никнейм игрока 1 (${window.ArizonaUtils.escapeHtml(nick1)})</button>`
        : `<button class="arz-ip-dropdown-item disabled" data-action="nick-1" disabled style="opacity: 0.4; cursor: not-allowed;"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Никнейм игрока 1</button>`;

      const nick2Btn = nick2
        ? `<button class="arz-ip-dropdown-item" data-action="nick-2" data-nick="${window.ArizonaUtils.escapeHtml(nick2)}"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M17 21v-2a4 4 0 0 0-3-3.87"></path><path d="M9 21v-2a4 4 0 0 0-4-4H3a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> Никнейм игрока 2 (${window.ArizonaUtils.escapeHtml(nick2)})</button>`
        : `<button class="arz-ip-dropdown-item disabled" data-action="nick-2" disabled style="opacity: 0.4; cursor: not-allowed;"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M17 21v-2a4 4 0 0 0-3-3.87"></path><path d="M9 21v-2a4 4 0 0 0-4-4H3a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> Никнейм игрока 2</button>`;

      dropdown.innerHTML = `
        <div class="arz-ip-dropdown-header"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Копирование</div>
        <button class="arz-ip-dropdown-item" data-action="time-log"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Время + Лог</button>
        ${nick1Btn}
        ${nick2Btn}
        <button class="arz-ip-dropdown-item" data-action="log"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Текст лога</button>
        <button class="arz-ip-dropdown-item" data-action="time"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Время</button>
        <button class="arz-ip-dropdown-item" data-action="data"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><circle cx="8" cy="8" r="6"></circle><circle cx="18" cy="18" r="4"></circle><path d="M12 18a6 6 0 0 0-6-6"></path></svg> Данные</button>
        <button class="arz-ip-dropdown-item" data-action="ip"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M12 8v8M5 16v-4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"></path></svg> IP адрес</button>
        <hr class="arz-ip-dropdown-divider">
        <button class="arz-ip-dropdown-item" data-action="all"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Скопировать всё</button>
      `;

      document.body.appendChild(dropdown);
      currentPopup = dropdown;

      const rect = event.target.getBoundingClientRect();
      dropdown.style.position = 'fixed';
      dropdown.style.top = rect.bottom + 'px';
      dropdown.style.left = rect.left + 'px';

      dropdown.getBoundingClientRect();
      const dropdownRect = dropdown.getBoundingClientRect();

      if (rect.bottom + dropdownRect.height > window.innerHeight) {
        dropdown.style.top = (rect.top - dropdownRect.height) + 'px';
      }

      if (rect.left + dropdownRect.width > window.innerWidth) {
        dropdown.style.left = (rect.right - dropdownRect.width) + 'px';
      }

      dropdown.classList.add('open');

      dropdown.querySelectorAll('.arz-ip-dropdown-item').forEach(item => {
        item.onclick = (e) => {
          e.stopPropagation();
          if (item.hasAttribute('disabled') || item.classList.contains('disabled')) return;

          const act = item.getAttribute('data-action');
          let textToCopy = '';
          if (act === 'time-log') {
            textToCopy = date && action ? `${date} | ${action}` : (date || action);
          } else if (act === 'nick-1') {
            textToCopy = item.getAttribute('data-nick') || nick1 || '';
          } else if (act === 'nick-2') {
            textToCopy = item.getAttribute('data-nick') || nick2 || '';
          } else if (act === 'log') {
            textToCopy = action;
          } else if (act === 'time') {
            textToCopy = date;
          } else if (act === 'data') {
            textToCopy = data;
          } else if (act === 'ip') {
            textToCopy = ip;
          } else if (act === 'all') {
            const parts = [date, action, data, ip].filter(p => p);
            textToCopy = parts.join(' | ');
          }

          if (!textToCopy) {
            window.ArizonaNotifications.show('Нечего копировать', 'warning');
            return;
          }

          writeToClipboard(textToCopy).then(() => {
            window.ArizonaNotifications.show('Скопировано!', 'success');
            close();
          }).catch(err => {
            console.error('Failed to copy text:', err);
            window.ArizonaNotifications.show('Ошибка копирования', 'error');
          });
        };
      });
    }

    document.addEventListener('click', (e) => {
      if (currentPopup && !currentPopup.contains(e.target)) {
        close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
      }
    });

    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close, { passive: true });

    return {
      open: open,
      close: close
    };
  })();

  let ipDetailsCache = {};
  const pendingIps = new Set();
  let isCacheLoaded = false;

  async function loadIpDetailsCache() {
    if (isCacheLoaded) return;

    await new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['arz_ip_details_cache'], (result) => {
          if (result && result['arz_ip_details_cache']) {
            ipDetailsCache = { ...result['arz_ip_details_cache'] };
          }
          resolve();
        });
      } else {
        resolve();
      }
    });

    isCacheLoaded = true;
  }

  let saveCacheTimeout = null;
  function persistIpCacheToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const keys = Object.keys(ipDetailsCache);
      if (keys.length > 3000) {
        const keysToRemove = keys.slice(0, keys.length - 2000);
        keysToRemove.forEach(k => delete ipDetailsCache[k]);
      }
      chrome.storage.local.set({ 'arz_ip_details_cache': ipDetailsCache });
    }
  }

  function saveIpToCaches(ip, data) {
    ipDetailsCache[ip] = data;

    if (!saveCacheTimeout) {
      saveCacheTimeout = setTimeout(() => {
        persistIpCacheToStorage();
        saveCacheTimeout = null;
      }, 500);
    }
  }

  function parseAllIpsFromCell(ipCell) {
    if (!ipCell) return [];
    const pairs = [];
    const tableIpDivs = ipCell.querySelectorAll('.table-ip');
    if (tableIpDivs.length > 0) {
      tableIpDivs.forEach((div) => {
        const lastIpEl = div.querySelector('.badge-secondary, [title="последний"], [title*="Последний IP"], [title*="последний"]');
        const regIpEl = div.querySelector('.badge-primary, .badge-danger, .badge-warning, .badge-info, [title="регистрационный"], [title*="Регистрационный IP"], [title*="регистрационный"]');

        let lastIp = lastIpEl ? lastIpEl.textContent.trim() : null;
        let regIp = regIpEl ? regIpEl.textContent.trim() : null;

        if (!lastIp || !regIp) {
          const ipsInDiv = (div.textContent || '').match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
          if (ipsInDiv && ipsInDiv.length > 0) {
            if (!lastIp) lastIp = ipsInDiv[0];
            if (!regIp && ipsInDiv.length > 1) regIp = ipsInDiv[1];
          }
        }

        let prefix = '';
        const strongEl = div.querySelector('strong, code');
        if (strongEl) {
          prefix = strongEl.textContent.trim();
        } else {
          const match = div.textContent.match(/^\s*(I+|V+|X+)\s*:/i);
          if (match) prefix = match[0].trim();
        }

        if (lastIp || regIp) {
          pairs.push({
            lastIp: (lastIp && !lastIp.includes('*')) ? lastIp : null,
            regIp: (regIp && !regIp.includes('*')) ? regIp : null,
            prefix: prefix,
            divElement: div,
            lastLink: lastIpEl ? (lastIpEl.closest('a') || lastIpEl) : null,
            regLink: regIpEl ? (regIpEl.closest('a') || regIpEl) : null
          });
        }
      });
    } else {
      const text = ipCell.textContent || '';
      const ips = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
      if (ips && ips.length > 0) {
        for (let i = 0; i < ips.length; i += 2) {
          const lastIp = ips[i];
          const regIp = ips[i + 1] || null;
          pairs.push({
            lastIp: lastIp,
            regIp: regIp,
            prefix: i === 0 ? 'I:' : i === 2 ? 'II:' : '',
            divElement: null,
            lastLink: null,
            regLink: null
          });
        }
      }
    }
    return pairs;
  }

  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function clearIpDetailsFromPage() {
    const table = document.querySelector('table.table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(tr => {
      const ipCell = getIpCellFromRow(tr);
      tr.removeAttribute('data-arz-ip-processed');
      if (!ipCell) return;

      const lastIpEl = ipCell.querySelector('.badge-secondary, [title*="Последний IP"]');
      const regIpEl = ipCell.querySelector('.badge-primary, [title*="Регистрационный IP"]');

      if (lastIpEl) {
        lastIpEl.setAttribute('title', 'последний');
        if (lastIpEl.parentElement && lastIpEl.parentElement.tagName === 'A') {
          lastIpEl.parentElement.setAttribute('title', 'последний');
        }
      }
      if (regIpEl) {
        regIpEl.setAttribute('title', 'регистрационный');
        if (regIpEl.parentElement && regIpEl.parentElement.tagName === 'A') {
          regIpEl.parentElement.setAttribute('title', 'регистрационный');
        }
      }

      const existingDist = ipCell.querySelectorAll('.arz-ip-distance-inline');
      existingDist.forEach(el => el.remove());

      const existingPlaceholder = ipCell.querySelector('.arz-ip-loading-placeholder');
      if (existingPlaceholder) existingPlaceholder.remove();
    });
  }

  function renderIpDetailsForPair(ipCell, pair) {
    if (!currentSettings['tweak-ip-info']) return;
    const lastDetails = pair.lastIp ? ipDetailsCache[pair.lastIp] : null;
    const regDetails = pair.regIp ? ipDetailsCache[pair.regIp] : null;

    const formatTooltipText = (prefix, details) => {
      if (!details) return `${prefix}: Данные не загружены`;
      if (details.status !== 'success') {
        const errorMsg = details.message === 'private range' ? 'Локальный IP' : 'Неизвестно';
        return `${prefix} (${errorMsg})`;
      }
      const country = details.country || details.countryCode || '';
      const city = details.city || '';
      const org = details.org || details.as || '';
      const mobile = details.mobile ? 'Mobile' : '';
      const proxy = details.proxy ? 'Proxy' : '';
      const host = details.hosting ? 'Host' : '';

      return `${prefix} (${country}, ${city}, ${org}, ${mobile} ${proxy} ${host})`;
    };

    if (pair.lastLink && lastDetails) {
      const tooltip = formatTooltipText('Последний IP', lastDetails);
      pair.lastLink.setAttribute('title', tooltip);
      const outerAnchor = pair.lastLink.closest('a');
      if (outerAnchor) outerAnchor.setAttribute('title', tooltip);
    }

    if (pair.regLink && regDetails) {
      const tooltip = formatTooltipText('Регистрационный IP', regDetails);
      pair.regLink.setAttribute('title', tooltip);
      const outerAnchor = pair.regLink.closest('a');
      if (outerAnchor) outerAnchor.setAttribute('title', tooltip);
    }

    if (pair.lastIp && pair.regIp && lastDetails && regDetails) {
      const dist = calculateHaversineDistance(regDetails.lat, regDetails.lon, lastDetails.lat, lastDetails.lon);
      if (dist !== null) {
        const parent = pair.divElement || ipCell;
        const existingDist = parent.querySelector('.arz-ip-distance-inline');
        if (existingDist) existingDist.remove();

        const distEl = document.createElement('span');
        distEl.className = 'arz-ip-distance-inline';

        let alertClass = 'dist-safe';
        if (dist >= 500) {
          alertClass = 'dist-danger';
        } else if (dist >= 50) {
          alertClass = 'dist-warning';
        }
        distEl.classList.add(alertClass);
        distEl.innerHTML = `~${dist.toFixed(2)}km`;

        parent.appendChild(distEl);
      }
    }
  }

  function formatGeoText(ipData, distance) {
    let txt = `<span class="az-clickable-ip" data-ip="${ipData.query}" style="font-weight: 500; cursor: pointer;">${ipData.query}</span>`;
    let fields = [];
    const ipFields = arizonaSettings.ipFields || { country: true, city: true, regionName: true, isp: true, org: true, as: true };

    if (ipFields.country && ipData.country) fields.push(`${ipData.country}`);
    if (ipFields.city && ipData.city) fields.push(`${ipData.city}`);
    if (ipFields.regionName && ipData.regionName) fields.push(`${ipData.regionName}`);
    if (ipFields.isp && ipData.isp) fields.push(`${ipData.isp}`);
    if (ipFields.org && ipData.org) fields.push(`${ipData.org}`);
    if (ipFields.as && ipData.as) fields.push(`${ipData.as}`);
    if (fields.length > 0) txt += ` (${fields.join(', ')})`;

    const sec = [];
    if (ipFields.proxy && ipData.proxy) sec.push('Proxy');
    if (ipFields.hosting && ipData.hosting) sec.push('Host');
    if (ipFields.mobile && ipData.mobile) sec.push('Mobile');
    if (ipData.vpn) sec.push('VPN');
    if (ipData.tor) sec.push('Tor');
    if (sec.length > 0) txt += ` | ${sec.join('/')}`;

    if (distance !== null && arizonaSettings.geoIPEnabled) {
      const col = distance <= 100 ? 'var(--az-success)' : distance <= 500 ? 'var(--az-warning)' : 'var(--az-danger)';
      txt += ` <span style="color: ${col}; font-weight: 500;">~${distance.toFixed(1)}km</span>`;
    }
    return txt;
  }

  function attachTooltip(link, ip) {
    if (!link) return;
    link.setAttribute('data-ip', ip);
  }

  function attachRegTooltip(link, ip) {
    if (!link) return;
    link.setAttribute('data-ip', ip);
  }

  function shouldShowInlineGeoText(row) {
    const actionCell = row.cells[1];
    if (!actionCell) return false;
    const text = actionCell.textContent.toLowerCase();
    return text.includes('авторизовался') ||
      text.includes('вышел');
  }

  function renderInlineGeoText(row, pairs) {

    pairs.forEach(pair => {
      let regData = pair.regIp ? ipDetailsCache[pair.regIp] : null;
      let lastData = pair.lastIp ? ipDetailsCache[pair.lastIp] : null;
      let dist = null;
      if (regData && lastData && regData.lat && regData.lon && lastData.lat && lastData.lon) {
        dist = calculateHaversineDistance(lastData.lat, lastData.lon, regData.lat, regData.lon);
      }
      if (pair.lastLink && lastData) attachTooltip(pair.lastLink, pair.lastIp, lastData, regData, dist);
      if (pair.regLink && regData) attachRegTooltip(pair.regLink, pair.regIp, regData);
    });

    if (!arizonaSettings.ipLookupEnabled) return;
    const actionCell = row.cells[1];
    if (!actionCell) return;

    if (!shouldShowInlineGeoText(row)) {
      const existing = actionCell.querySelector('.az-geo-inserted');
      if (existing) existing.remove();
      return;
    }

    let htmls = [];
    pairs.forEach(pair => {
      if (!pair.lastIp) return;
      const lastData = ipDetailsCache[pair.lastIp];
      if (!lastData) return;

      let dist = null;
      if (pair.regIp && arizonaSettings.geoIPEnabled) {
        const regData = ipDetailsCache[pair.regIp];
        if (regData && regData.lat && regData.lon && lastData.lat && lastData.lon) {
          dist = calculateHaversineDistance(lastData.lat, lastData.lon, regData.lat, regData.lon);
        }
      }

      let lineText = formatGeoText(lastData, dist);
      htmls.push(lineText);
    });

    if (htmls.length === 0) return;

    let existing = actionCell.querySelector('.az-geo-inserted');
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'az-geo-inserted';
      existing.style.cssText = 'display: block; font-size: 12px; margin-top: 4px; padding: 4px 0; border-top: 1px solid var(--az-border);';
      actionCell.appendChild(existing);
    }
    existing.innerHTML = htmls.join('<br>');
  }

  function injectIpPlaceholder(tr) {
    const ipCell = getIpCellFromRow(tr);
    if (!ipCell) return;
    const processed = tr.getAttribute('data-arz-ip-processed');
    if (processed === 'true' || processed === 'pending') return;

    const pairs = parseAllIpsFromCell(ipCell);
    pairs.forEach(pair => {
      const parent = pair.divElement || ipCell;
      if (!parent.querySelector('.arz-ip-distance-inline')) {
        const distEl = document.createElement('span');
        distEl.className = 'arz-ip-distance-inline dist-placeholder';
        distEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        parent.appendChild(distEl);
      }
    });
  }

  let ipRowObserver = null;
  const pendingIpRows = new Set();
  let ipBatchTimeout = null;

  function getIpRowObserver() {
    const isEnabled = currentSettings['extension-toggle'] !== false;
    const isIpEnabled = isEnabled && (currentSettings['tweak-ip-info'] || arizonaSettings.ipLookupEnabled);

    if (!isIpEnabled) {
      if (ipRowObserver) {
        ipRowObserver.disconnect();
        ipRowObserver = null;
      }
      return null;
    }

    if (!ipRowObserver) {
      ipRowObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const tr = entry.target;
            ipRowObserver.unobserve(tr);
            queueIpRowForProcessing(tr);
          }
        });
      }, {
        rootMargin: '300px 0px',
        threshold: 0.01
      });
    }
    return ipRowObserver;
  }

  function initIpRowsObserver() {
    const observer = getIpRowObserver();
    if (!observer) return;

    const table = document.querySelector('table.table');
    if (table) {
      table.querySelectorAll('tbody tr').forEach(tr => {
        const processed = tr.getAttribute('data-arz-ip-processed');
        if (processed !== 'true' && processed !== 'pending') {
          observer.observe(tr);
          injectIpPlaceholder(tr);
          queueIpRowForProcessing(tr);
        }
      });
    }
  }

  function queueIpRowForProcessing(tr) {
    const processed = tr.getAttribute('data-arz-ip-processed');
    if (processed === 'true' || processed === 'pending') return;

    pendingIpRows.add(tr);

    if (ipBatchTimeout) clearTimeout(ipBatchTimeout);
    ipBatchTimeout = setTimeout(processPendingIpRows, 50);
  }

  async function processPendingIpRows() {
    if (pendingIpRows.size === 0) return;
    const rows = Array.from(pendingIpRows);
    pendingIpRows.clear();
    await processIpsForRowsBatch(rows);
  }

  async function processIpsForRowsBatch(rowsToProcess) {
    if (rowsToProcess.length === 0) return;

    try {
      await loadIpDetailsCache();

      const ipsToFetch = new Set();
      const rowsWaitingForIps = [];

      rowsToProcess.forEach(tr => {
        const ipCell = getIpCellFromRow(tr);
        if (!ipCell) return;

        const processed = tr.getAttribute('data-arz-ip-processed');
        if (processed === 'true') return;

        const pairs = parseAllIpsFromCell(ipCell);
        if (pairs.length === 0) return;

        let allCached = true;
        pairs.forEach(pair => {
          const lastCached = !pair.lastIp || (ipDetailsCache[pair.lastIp] !== undefined);
          const regCached = !pair.regIp || (ipDetailsCache[pair.regIp] !== undefined);

          if (!lastCached || !regCached) {
            allCached = false;

            if (pair.lastIp && (ipDetailsCache[pair.lastIp] === undefined) && !pendingIps.has(pair.lastIp)) {
              ipsToFetch.add(pair.lastIp);
            }
            if (pair.regIp && (ipDetailsCache[pair.regIp] === undefined) && !pendingIps.has(pair.regIp)) {
              ipsToFetch.add(pair.regIp);
            }
          }
        });

        renderInlineGeoText(tr, pairs);
        pairs.forEach(pair => {
          renderIpDetailsForPair(ipCell, pair);
        });

        if (allCached) {
          tr.setAttribute('data-arz-ip-processed', 'true');
          const placeholders = ipCell.querySelectorAll('.arz-ip-loading-placeholder, .dist-placeholder');
          placeholders.forEach(p => p.remove());
        } else {
          tr.setAttribute('data-arz-ip-processed', 'pending');
          rowsWaitingForIps.push({ tr, ipCell, pairs });
          injectIpPlaceholder(tr);
        }
      });

      if (ipsToFetch.size > 0) {
        const uniqueIps = Array.from(ipsToFetch);
        uniqueIps.forEach(ip => pendingIps.add(ip));

        const batchChunkSize = 50;
        for (let i = 0; i < uniqueIps.length; i += batchChunkSize) {
          const chunk = uniqueIps.slice(i, i + batchChunkSize);

          try {
            const res = await window.ArizonaUtils.sendMessageToBackground({
              action: 'fetch_ip_geo_batch',
              ips: chunk
            });

            if (res && res.success && Array.isArray(res.data)) {
              res.data.forEach(item => {
                if (item && item.query) {
                  saveIpToCaches(item.query, item);
                }
              });
            }
          } catch (err) {
            console.error('Failed to fetch IP details chunk:', err);
          } finally {
            chunk.forEach(ip => pendingIps.delete(ip));
          }
        }

        rowsWaitingForIps.forEach(({ tr, ipCell, pairs }) => {
          let allCached = true;
          pairs.forEach(pair => {
            const lastCached = !pair.lastIp || (ipDetailsCache[pair.lastIp] !== undefined);
            const regCached = !pair.regIp || (ipDetailsCache[pair.regIp] !== undefined);
            if (!lastCached || !regCached) {
              allCached = false;
            }
          });

          renderInlineGeoText(tr, pairs);
          pairs.forEach(pair => {
            renderIpDetailsForPair(ipCell, pair);
          });

          if (allCached) {
            tr.setAttribute('data-arz-ip-processed', 'true');
            const placeholders = ipCell.querySelectorAll('.arz-ip-loading-placeholder, .dist-placeholder');
            placeholders.forEach(p => p.remove());
          } else {
            tr.removeAttribute('data-arz-ip-processed');
            const placeholders = ipCell.querySelectorAll('.arz-ip-loading-placeholder, .dist-placeholder');
            placeholders.forEach(p => p.remove());
          }
        });
      }

    } catch (e) {
      console.error('Error in processIpsForRowsBatch:', e);
    }
  }

  function processTable() {
    if (isProcessingTable) return false;
    const table = document.querySelector('table.table');
    if (!table) return false;

    const rows = Array.from(table.querySelectorAll('tbody tr:not([data-arz-processed="true"])'));
    if (rows.length === 0) return false;

    isProcessingTable = true;
    try {
      if (window.ArizonaTgVkDetector) window.ArizonaTgVkDetector.reset();
      if (window.ArizonaEmailDetector) window.ArizonaEmailDetector.reset();
    } catch (e) { }

    let index = 0;
    const chunkSize = 100;

    function processBatch() {
      try {
        const limit = Math.min(index + chunkSize, rows.length);
        for (; index < limit; index++) {
          const tr = rows[index];
          tr.setAttribute('data-arz-processed', 'true');
          try {
            processRow(tr);
          } catch (e) {
            console.error('Error processing row:', e);
          }
        }

        if (index < rows.length) {
          setTimeout(processBatch, 0);
        } else {
          isProcessingTable = false;
          try {
            window.ArizonaColumnEyeButtons.update();
            window.ArizonaTgVkDetector.scan();
            window.ArizonaEmailDetector.scan();
            handleTuningAutoScroll();
            window.ArizonaOnlineManager.checkAutoCalculation();
            window.ArizonaDateShortcut.reposition();
          } catch (e) {
            console.error('Error in post-processTable update:', e);
          }

          const newRows = table.querySelectorAll('tbody tr:not([data-arz-processed="true"])');
          if (newRows.length > 0) {
            processTable();
          }
        }
      } catch (err) {
        console.error('Error in processBatch loop:', err);
        isProcessingTable = false;
      }
    }

    processBatch();
    return true;
  }

  let originalLogoHTML = null;

  function applyLogoCustomization(mode) {
    const logoContainer = document.querySelector('.app-nav-logo');
    if (!logoContainer) return;

    if (originalLogoHTML === null) {
      originalLogoHTML = logoContainer.innerHTML;
    }

    logoContainer.innerHTML = originalLogoHTML;

    if (mode === 'default' || !mode) {
      return;
    }

    const iconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('icons/icon48.png')
      : 'icons/icon48.png';

    const imgEl = document.createElement('img');
    imgEl.src = iconUrl;
    imgEl.alt = 'Logo';
    imgEl.style.width = '22px';
    imgEl.style.height = '22px';
    imgEl.style.marginRight = '8px';
    imgEl.style.verticalAlign = 'middle';
    imgEl.style.borderRadius = '5px';
    imgEl.style.display = 'inline-block';

    if (mode === 'with-icon') {
      logoContainer.insertBefore(imgEl, logoContainer.firstChild);
    } else if (mode === 'with-icon-replace') {
      logoContainer.innerHTML = '';
      logoContainer.appendChild(imgEl);

      const textNode = document.createTextNode(' ');
      logoContainer.appendChild(textNode);

      const spanEl = document.createElement('span');
      spanEl.className = 'text-muted';
      spanEl.textContent = 'LogsParser';
      logoContainer.appendChild(spanEl);
    }
  }

  let originalFavicons = [];

  function applyFaviconCustomization(replace) {
    let faviconLinks = document.querySelectorAll("link[rel*='icon']");

    if (replace) {
      if (originalFavicons.length === 0) {
        if (faviconLinks.length > 0) {
          faviconLinks.forEach(link => {
            originalFavicons.push({
              element: link,
              originalHref: link.getAttribute('href')
            });
          });
        } else {
          const newFavicon = document.createElement('link');
          newFavicon.rel = 'icon';
          document.head.appendChild(newFavicon);
          originalFavicons.push({
            element: newFavicon,
            originalHref: null
          });
          faviconLinks = [newFavicon];
        }
      }

      const newFaviconUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('icons/icon16.png')
        : 'icons/icon16.png';

      faviconLinks.forEach(link => {
        link.setAttribute('href', newFaviconUrl);
      });
    } else {
      if (originalFavicons.length > 0) {
        originalFavicons.forEach(item => {
          if (item.originalHref === null) {
            item.element.remove();
          } else {
            item.element.setAttribute('href', item.originalHref);
          }
        });
        originalFavicons = [];
      }
    }
  }

  let filterFab = null;
  let filterModal = null;
  let formPlaceholder = null;
  let scrollHandler = null;
  let formObserver = null;
  let floatingFilterFormWatcher = null;

  function setupFloatingFilter(enabled) {
    if (floatingFilterFormWatcher) {
      clearInterval(floatingFilterFormWatcher);
      floatingFilterFormWatcher = null;
    }

    if (formObserver) {
      formObserver.disconnect();
      formObserver = null;
    }
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }

    if (!enabled) {
      if (filterFab) {
        filterFab.remove();
        filterFab = null;
      }
      closeFilterModal();
      return;
    }

    let attempts = 0;
    const checkForm = () => {
      const form = document.querySelector('form.filter');
      if (form) {
        if (floatingFilterFormWatcher) {
          clearInterval(floatingFilterFormWatcher);
          floatingFilterFormWatcher = null;
        }
        initFloatingFilter(form);
      } else {
        attempts++;
        if (attempts >= 100) {
          if (floatingFilterFormWatcher) {
            clearInterval(floatingFilterFormWatcher);
            floatingFilterFormWatcher = null;
          }
        }
      }
    };

    const form = document.querySelector('form.filter');
    if (form) {
      initFloatingFilter(form);
    } else {
      floatingFilterFormWatcher = setInterval(checkForm, 100);
    }
  }

  function initFloatingFilter(form) {
    if (!filterFab) {
      filterFab = document.createElement('button');
      filterFab.id = 'arz-floating-filter-btn';
      filterFab.className = 'arz-floating-filter-btn';
      filterFab.title = 'Открыть фильтры поиска';
      filterFab.innerHTML = '<i class="fa-solid fa-filter"></i>';
      document.body.appendChild(filterFab);

      filterFab.addEventListener('click', () => {
        openFilterModal(form);
      });
    }

    if (formObserver) {
      formObserver.disconnect();
    }

    formObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const isFormVisible = entry.isIntersecting;
        if (!isFormVisible && !isModalOpen()) {
          filterFab.classList.add('visible');
        } else {
          filterFab.classList.remove('visible');
        }
      });
    }, { root: null, threshold: 0 });

    formObserver.observe(form);
  }

  function isModalOpen() {
    return filterModal && filterModal.style.display === 'flex';
  }

  function openFilterModal(form) {
    if (!filterModal) {

      filterModal = document.createElement('div');
      filterModal.className = 'arz-filter-modal';

      const modalContent = document.createElement('div');
      modalContent.className = 'arz-filter-modal-content';

      const modalHeader = document.createElement('div');
      modalHeader.className = 'arz-filter-modal-header';

      const modalTitle = document.createElement('h3');
      modalTitle.textContent = 'Фильтры поиска';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'arz-filter-modal-close';
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.addEventListener('click', closeFilterModal);

      modalHeader.appendChild(modalTitle);
      modalHeader.appendChild(closeBtn);
      modalContent.appendChild(modalHeader);

      const formContainer = document.createElement('div');
      formContainer.className = 'arz-filter-modal-form-container';
      modalContent.appendChild(formContainer);

      filterModal.appendChild(modalContent);
      document.body.appendChild(filterModal);

      filterModal.addEventListener('click', (e) => {
        if (e.target === filterModal) {
          closeFilterModal();
        }
      });
    }

    const formContainer = filterModal.querySelector('.arz-filter-modal-form-container');

    if (!formPlaceholder) {
      formPlaceholder = document.createElement('div');
      formPlaceholder.id = 'arz-form-placeholder';
      formPlaceholder.style.display = 'none';
      form.parentNode.insertBefore(formPlaceholder, form);
    }

    formContainer.appendChild(form);

    filterModal.style.display = 'flex';
    document.body.classList.add('arz-modal-open');

    if (filterFab) {
      filterFab.classList.remove('visible');
    }
  }

  function setupNickCounter(overlay, textareaSelector, countNumId) {
    const textarea = overlay.querySelector(textareaSelector);
    const countEl = overlay.querySelector('#' + countNumId);
    if (textarea && countEl) {
      const update = () => {
        const count = textarea.value.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length;
        countEl.textContent = count;
      };
      textarea.addEventListener('input', update);
      update();
    }
  }

  function closeFilterModal() {
    if (!filterModal || filterModal.style.display !== 'flex') return;

    const form = filterModal.querySelector('form.filter');
    if (form && formPlaceholder) {

      formPlaceholder.parentNode.insertBefore(form, formPlaceholder);
      formPlaceholder.remove();
      formPlaceholder = null;
    }

    filterModal.style.display = 'none';

    const openOverlays = document.querySelectorAll('.arz-modal-overlay.open-active');
    if (openOverlays.length === 0) {
      document.body.classList.remove('arz-modal-open');
    }

    if (scrollHandler) {
      scrollHandler();
    }
  }

  function refreshFeatureManagers() {
    [
      window.ArizonaColumnEyeButtons,
      window.ArizonaLogFilter,
      window.ArizonaFormsManager,
      window.ArizonaOnlineManager,
      window.ArizonaPunishmentManager,
      window.ArizonaIpBatchManager,
      window.ArizonaIdNickManager,
      window.ArizonaReportManager,
      window.ArizonaLookupManager,
      window.ArizonaAnalyticsManager,
      window.ArizonaTemplatesManager,
      window.ArizonaCopyLogsManager,
      window.ArizonaSidebarManager,
      window.ArizonaMultiSelectManager,
      window.ArizonaLoadMoreManager,
      window.ArizonaMultiPlayersManager
    ].forEach((manager) => {
      if (manager && typeof manager.updateSettings === 'function') {
        try { manager.updateSettings(arizonaSettings); } catch (e) { }
      }
    });

    if (window.ArizonaThemeManager && typeof window.ArizonaThemeManager.updateSettings === 'function') {
      try {
        window.ArizonaThemeManager.updateSettings({
          ...arizonaSettings,
          themeEnabled: currentSettings['extension-toggle'] !== false &&
            currentSettings['visual-theme-enabled'] !== false
        });
      } catch (e) { }
    }
  }

  function applySettings(settings) {
    initCopyButtonsLazy(settings);
    initIpRowsObserver(settings);
    updateCopyBlockSetting(
      settings['extension-toggle'] !== false && settings['tweak-block-copy'] !== false
    );
    refreshFeatureManagers();
    const isEnabled = settings['extension-toggle'] !== false;

    document.body.classList.remove(
      'arz-sticky-navbar-active',
      'arz-sticky-headers-active',
      'arz-hide-sidebar-active',
      'arz-vertical-borders-active',
      'arz-remove-top-padding-active',
      'arz-extension-disabled',
      'arz-tweak-copy-row-active',
      'arz-tweak-hide-row-active',
      'arz-tweak-copy-cells-active',
      'arz-tweak-ip-info-active',
      'arz-copy-btn-hover',
      'arz-copy-btn-always'
    );

    applyLogoCustomization(isEnabled ? settings['visual-logo-customization'] : 'default');

    applyFaviconCustomization(isEnabled && settings['visual-replace-favicon']);

    setupFloatingFilter(isEnabled && settings['tweak-floating-filter']);

    if (!isEnabled) {
      document.body.classList.add('arz-extension-disabled');
      clearIpDetailsFromPage();
      clearCopyableSnippets();
      return;
    }

    if (settings['visual-sticky-navbar']) {
      document.body.classList.add('arz-sticky-navbar-active');
    }
    if (settings['visual-sticky-headers']) {
      document.body.classList.add('arz-sticky-headers-active');
    }
    if (settings['visual-hide-sidebar']) {
      document.body.classList.add('arz-hide-sidebar-active');
    }
    if (settings['visual-vertical-borders']) {
      document.body.classList.add('arz-vertical-borders-active');
    }
    if (settings['visual-remove-top-padding']) {
      document.body.classList.add('arz-remove-top-padding-active');
    }

    if (settings['tweak-copy-row']) {
      document.body.classList.add('arz-tweak-copy-row-active');
    }
    if (settings['tweak-hide-row']) {
      document.body.classList.add('arz-tweak-hide-row-active');
    }
    if (settings['tweak-copy-cells']) {
      document.body.classList.add('arz-tweak-copy-cells-active');
    }
    if (settings['tweak-ip-info']) {
      document.body.classList.add('arz-tweak-ip-info-active');
      const table = document.querySelector('table.table');
      if (table) {
        table.querySelectorAll('tbody tr').forEach(tr => {
          tr.removeAttribute('data-arz-ip-processed');
        });
      }
      initIpRowsObserver();
    } else {
      clearIpDetailsFromPage();
    }

    if (settings['tweak-copy-cells'] === false) {
      clearCopyableSnippets();
    }

    if (window.ArizonaSidebarManager) {
      window.ArizonaSidebarManager.updateSettings(arizonaSettings);
    }

    const visibilityMode = settings['tweak-copy-btn-visibility'] || 'hover';
    document.body.classList.add(`arz-copy-btn-${visibilityMode}`);

    const table = document.querySelector('table.table');
    if (table) {
      table.querySelectorAll('tbody tr').forEach(tr => {
        tr.removeAttribute('data-arz-processed');
      });
      processTable();
    }
  }


  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.action !== 'arz_fetch_logs_html' || !message.url) return undefined;

      let target;
      try {
        target = new URL(message.url, location.origin);
      } catch (error) {
        sendResponse({ success: false, error: 'bad_url' });
        return undefined;
      }

      if (target.origin !== location.origin) {
        sendResponse({ success: false, error: 'bad_origin' });
        return undefined;
      }

      fetch(target.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'text/html,application/xhtml+xml' }
      })
        .then(response => response.text().then(html => sendResponse({
          success: response.ok,
          status: response.status,
          html
        })))
        .catch(error => sendResponse({ success: false, error: error.message }));

      return true;
    });
  }

  window.ArizonaUtils = {
    isValidNickname: isValidNickname,
    escapeHtml: function (str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    sendMessageToBackground: function (message) {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          try {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(response || { success: false });
              }
            });
          } catch (err) {
            resolve({ success: false, error: err.message });
          }
        } else {
          resolve({ success: false, error: 'Extension context not available' });
        }
      });
    },
    debounce: function (func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },
    throttle: function (func, limit) {
      let inThrottle;
      return function (...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },
    generateId: function () {
      return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  };

  window.ArizonaNotifications = (function () {
    let container = null;
    function getContainer() {
      if (!container) {
        container = document.createElement('div');
        container.id = 'az-notification-container';
        container.style.cssText = `
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          z-index: 1000001 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          pointer-events: none !important;
        `;
        document.body.appendChild(container);
      }
      return container;
    }
    const style = document.createElement('style');
    style.id = 'az-notification-styles';
    style.textContent = `
      .az-notification {
        position: relative !important;
        width: 360px !important;
        max-width: calc(100vw - 40px) !important;
        background: var(--az-bg-sidebar) !important;
        border: 1px solid var(--az-border) !important;
        border-left: 4px solid !important;
        border-radius: var(--az-border-radius) !important;
        box-shadow: var(--az-shadow-md) !important;
        display: flex !important;
        align-items: flex-start !important;
        gap: 12px !important;
        padding: 14px 16px !important;
        pointer-events: auto !important;
        transform: translateX(420px) !important;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        overflow: hidden !important;
        margin-bottom: 5px;
        font-family: inherit !important;
      }
      .az-notification.show { transform: translateX(0) !important; }
      .az-notification.hide { transform: translateX(420px) !important; }
      .az-notification-success { border-left-color: var(--az-success) !important; }
      .az-notification-error { border-left-color: var(--az-danger) !important; }
      .az-notification-warning { border-left-color: var(--az-warning) !important; }
      .az-notification-info { border-left-color: var(--az-accent) !important; }
      .az-notification-icon { flex-shrink: 0 !important; width: 20px !important; height: 20px !important; }
      .az-notification-icon svg { width: 100% !important; height: 100% !important; }
      .az-notification-content { flex: 1 !important; }
      .az-notification-title { font-size: 14px !important; font-weight: 600 !important; color: var(--az-text) !important; margin-bottom: 4px !important; }
      .az-notification-message { font-size: 13px !important; color: var(--az-text-secondary) !important; line-height: 1.4 !important; }
      .az-notification-close { flex-shrink: 0 !important; width: 20px !important; height: 20px !important; background: none !important; border: none !important; color: var(--az-text-secondary) !important; cursor: pointer !important; font-size: 14px !important; display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 4px !important; }
      .az-notification-close:hover { color: var(--az-text) !important; background: var(--az-table-row-hover) !important; }
      .az-notification-progress { position: absolute !important; bottom: 0 !important; left: 0 !important; height: 3px !important; opacity: 0.3 !important; animation: azProgress 4s linear forwards !important; }
      @keyframes azProgress { from { width: 100%; } to { width: 0%; } }
    `;
    (document.head || document.documentElement).appendChild(style);

    return {
      show: function (message, type = 'success') {
        const container = getContainer();
        const colors = { success: 'var(--az-success)', error: 'var(--az-danger)', warning: 'var(--az-warning)', info: 'var(--az-accent)' };
        const titles = { success: 'Успешно', error: 'Ошибка', warning: 'Внимание', info: 'Информация' };
        const icons = {
          success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17L4 12"/></svg>',
          error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6L18 18"/></svg>',
          warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z"/></svg>',
          info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 3a9 9 0 110 18 9 9 0 010-18z"/></svg>'
        };

        const notif = document.createElement('div');
        notif.className = `az-notification az-notification-${type}`;
        notif.style.borderLeftColor = colors[type];
        notif.innerHTML = `
          <div class="az-notification-icon" style="color: ${colors[type]}">${icons[type]}</div>
          <div class="az-notification-content">
            <div class="az-notification-title">${titles[type]}</div>
            <div class="az-notification-message">${window.ArizonaUtils.escapeHtml(message)}</div>
          </div>
          <button class="az-notification-close" aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><path d="M18 6L6 18M6 6L18 18"/></svg></button>
          <div class="az-notification-progress" style="background: ${colors[type]};"></div>
        `;
        container.appendChild(notif);
        setTimeout(() => notif.classList.add('show'), 10);

        const removeNotif = () => {
          notif.classList.remove('show');
          notif.classList.add('hide');
          setTimeout(() => notif.remove(), 300);
        };

        notif.querySelector('.az-notification-close').addEventListener('click', removeNotif);
        let t = setTimeout(removeNotif, 4000);

        notif.addEventListener('mouseenter', () => {
          clearTimeout(t);
          const prog = notif.querySelector('.az-notification-progress');
          if (prog) prog.style.animationPlayState = 'paused';
        });

        notif.addEventListener('mouseleave', () => {
          t = setTimeout(removeNotif, 1000);
          const prog = notif.querySelector('.az-notification-progress');
          if (prog) prog.style.animationPlayState = 'running';
        });
      }
    };
  })();

  window.ArizonaHelper = {
    showNotification: function (message, type, force) {
      window.ArizonaNotifications.show(message, type);
    }
  };

  window.ArizonaIpPopupMenu = (function () {
    let currentPopup = null;

    function getIpData(ip) {
      if (ipDetailsCache && ipDetailsCache[ip]) {
        return ipDetailsCache[ip];
      }
      if (window.ArizonaIpLookupManager && typeof window.ArizonaIpLookupManager.getIpData === 'function') {
        return window.ArizonaIpLookupManager.getIpData(ip);
      }
      return null;
    }

    function close() {
      if (currentPopup) {
        currentPopup.classList.remove('open');
        currentPopup.classList.add('closing');
        const pop = currentPopup;
        setTimeout(() => pop.remove(), 200);
        currentPopup = null;
      }
    }

    function open(event, ip, tr) {
      close();

      const ipData = getIpData(ip);
      const nickname = tr ? tr.querySelector('td:nth-child(2) a[href*="player="]')?.textContent.trim() : null;

      const params = new URLSearchParams(window.location.search);
      const serverNumber = params.get('server_number') || '5';
      const minPeriod = params.get('min_period') || '';
      const maxPeriod = params.get('max_period') || '';
      const sort = params.get('sort') || 'desc';
      const limit = params.get('limit') || '1000';

      const buildIpLogsUrl = (ipAddress) => {
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('server_number', serverNumber);
        url.searchParams.set('ip', ipAddress);
        if (minPeriod) url.searchParams.set('min_period', minPeriod);
        if (maxPeriod) url.searchParams.set('max_period', maxPeriod);
        url.searchParams.set('sort', sort);
        url.searchParams.set('limit', limit);
        for (const [key, value] of params.entries()) {
          if (key.startsWith('type')) {
            url.searchParams.append(key, value);
          }
        }
        return url.toString();
      };

      const buildIpPlayerLogsUrl = (ipAddress, playerNick) => {
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('server_number', serverNumber);
        url.searchParams.set('ip', ipAddress);
        if (playerNick) url.searchParams.set('player', playerNick);
        if (minPeriod) url.searchParams.set('min_period', minPeriod);
        if (maxPeriod) url.searchParams.set('max_period', maxPeriod);
        url.searchParams.set('sort', sort);
        url.searchParams.set('limit', limit);
        for (const [key, value] of params.entries()) {
          if (key.startsWith('type')) {
            url.searchParams.append(key, value);
          }
        }
        return url.toString();
      };

      const ipLogsUrl = buildIpLogsUrl(ip);
      const ipPlayerLogsUrl = buildIpPlayerLogsUrl(ip, nickname);

      const dropdown = document.createElement('div');
      dropdown.className = 'arz-ip-dropdown';

      let infoHtml = '';
      if (ipData && ipData.status === 'success') {
        const locationParts = [];
        if (ipData.country) locationParts.push(ipData.country);
        if (ipData.regionName) locationParts.push(ipData.regionName);
        if (ipData.city) locationParts.push(ipData.city);
        const locationText = locationParts.join(', ');

        const safetyBadges = [];
        if (ipData.proxy) {
          safetyBadges.push(`<span class="arz-badge-proxy" style="background: rgba(var(--az-danger-rgb), 0.15); color: var(--az-danger); border: 1px solid rgba(var(--az-danger-rgb), 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-user-shield" style="font-size: 10px; color: var(--az-danger) !important; width: auto !important; margin: 0 !important;"></i> VPN/Прокси</span>`);
        }
        if (ipData.mobile) {
          safetyBadges.push(`<span class="arz-badge-mobile" style="background: rgba(var(--az-info-rgb), 0.15); color: var(--az-info); border: 1px solid rgba(var(--az-info-rgb), 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-mobile-screen-button" style="font-size: 10px; color: var(--az-info) !important; width: auto !important; margin: 0 !important;"></i> Мобильный</span>`);
        }
        if (ipData.hosting) {
          safetyBadges.push(`<span class="arz-badge-hosting" style="background: rgba(var(--az-warning-rgb), 0.15); color: var(--az-warning); border: 1px solid rgba(var(--az-warning-rgb), 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-cloud" style="font-size: 10px; color: var(--az-warning) !important; width: auto !important; margin: 0 !important;"></i> Хостинг</span>`);
        }

        const safetyBadgesHtml = safetyBadges.length > 0
          ? `<hr class="arz-ip-dropdown-divider" style="display: block !important;"><div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; padding: 2px 0;">${safetyBadges.join('')}</div>`
          : '';

        infoHtml = `
          <div class="arz-ip-dropdown-info">
            ${locationText ? `<div><i class="fa-solid fa-location-dot"></i> <span><b>Место:</b> ${window.ArizonaUtils.escapeHtml(locationText)}</span></div>` : ''}
            ${ipData.isp ? `<div><i class="fa-solid fa-wifi"></i> <span><b>Провайдер:</b> ${window.ArizonaUtils.escapeHtml(ipData.isp)}</span></div>` : ''}
            ${ipData.org && ipData.org !== ipData.isp ? `<div><i class="fa-solid fa-building"></i> <span><b>Орг:</b> ${window.ArizonaUtils.escapeHtml(ipData.org)}</span></div>` : ''}
            ${ipData.as ? `<div><i class="fa-solid fa-hashtag"></i> <span><b>AS:</b> <span style="font-size: 11px; color: var(--az-text-secondary);">${window.ArizonaUtils.escapeHtml(ipData.as)}</span></span></div>` : ''}
            ${safetyBadgesHtml}
          </div>
          <hr class="arz-ip-dropdown-divider">
        `;
      } else {
        infoHtml = `
          <div class="arz-ip-dropdown-info" style="color: var(--az-text-secondary); font-weight: 500;">
            <i class="fa-solid fa-location-dot"></i> Данные о геолокации не найдены
          </div>
          <hr class="arz-ip-dropdown-divider">
        `;
      }

      dropdown.innerHTML = `
        <div class="arz-ip-dropdown-header"><i class="fa-solid fa-earth-americas"></i> IP: ${ip}</div>
        ${infoHtml}
        <button class="arz-ip-dropdown-item arz-ip-dropdown-copy"><i class="fa-regular fa-copy"></i> Копировать IP</button>
        <a href="${ipLogsUrl}" class="arz-ip-dropdown-item"><i class="fa-solid fa-magnifying-glass"></i> Логи IP</a>
        ${nickname ? `<a href="${ipPlayerLogsUrl}" class="arz-ip-dropdown-item"><i class="fa-solid fa-user"></i> Логи IP + Ник</a>` : ''}
      `;

      document.body.appendChild(dropdown);
      currentPopup = dropdown;

      const rect = event.target.getBoundingClientRect();
      dropdown.style.position = 'fixed';
      dropdown.style.top = rect.bottom + 'px';
      dropdown.style.left = rect.left + 'px';

      dropdown.getBoundingClientRect();
      const dropdownRect = dropdown.getBoundingClientRect();

      if (rect.bottom + dropdownRect.height > window.innerHeight) {
        dropdown.style.top = (rect.top - dropdownRect.height) + 'px';
      }

      if (rect.left + dropdownRect.width > window.innerWidth) {
        dropdown.style.left = (rect.right - dropdownRect.width) + 'px';
      }

      dropdown.classList.add('open');

      dropdown.querySelector('.arz-ip-dropdown-copy').onclick = (e) => {
        e.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ip).then(() => {
            window.ArizonaNotifications.show('IP скопирован', 'success');
            close();
          });
        }
      };
    }

    document.addEventListener('click', (e) => {
      if (currentPopup && !currentPopup.contains(e.target)) {
        close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
      }
    });

    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close, { passive: true });

    return {
      open: open,
      close: close
    };
  })();

  document.addEventListener('click', (e) => {
    const target = e.target;

    if (target.closest('.arz-ip-dropdown')) {
      return;
    }

    const anchor = target.closest('a');
    let ip = null;

    const href = anchor ? anchor.getAttribute('href') : null;
    if (href && !href.startsWith('#')) {
      try {
        const url = new URL(anchor.href, window.location.href);
        ip = url.searchParams.get('ip') || url.searchParams.get('dynamic[109]');
      } catch (err) {
        const match = anchor.href.match(/[?&]ip=([^&]+)/);
        if (match) ip = decodeURIComponent(match[1]);
      }
    }

    if (!ip) {
      const elWithDataIp = target.closest('[data-ip]');
      if (elWithDataIp) {
        ip = elWithDataIp.getAttribute('data-ip');
      }
    }

    const clickableSpan = target.closest('.az-clickable-ip');
    if (clickableSpan && !ip) {
      ip = clickableSpan.getAttribute('data-ip');
    }

    const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ip && IP_REGEX.test(ip.trim())) {
      ip = ip.trim();
      e.preventDefault();
      e.stopPropagation();

      const tr = target.closest('tr');
      window.ArizonaIpPopupMenu.open(e, ip, tr);
    }
  }, true);

  window.ArizonaModalManager = (function () {
    let currentModal = null;
    return {
      open: function (options) {
        this.close();
        const overlay = document.createElement('div');
        overlay.className = 'arz-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'arz-modal';
        if (options.width) modal.style.width = options.width;

        let buttonsHtml = '';
        if (options.buttons) {
          buttonsHtml = options.buttons.map(btn => `<button class="btn ${btn.class || 'btn-secondary'}" data-action="${btn.text}">${btn.text}</button>`).join('');
        }

        modal.innerHTML = `
          <div class="arz-modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar);">
            <h3 style="font-size: 17px; font-weight: 600; color: var(--az-text); margin: 0;">${options.title || ''}</h3>
            <button class="arz-modal-close" style="background: none; border: none; cursor: pointer; color: var(--az-text-secondary); font-size: 20px; font-weight: bold;">&times;</button>
          </div>
          <div class="arz-modal-body" style="padding: 20px; color: var(--az-text); font-size: 13px; line-height: 1.5; background: var(--az-card-bg);">
            ${options.content || ''}
          </div>
          <div class="arz-modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 18px 20px; border-top: 1px solid var(--az-border); background: var(--az-bg-sidebar);">
            ${buttonsHtml}
          </div>
        `;
        overlay.appendChild(modal);
        openOverlay(overlay);
        currentModal = overlay;

        modal.querySelector('.arz-modal-close').addEventListener('click', () => this.close());

        if (options.buttons) {
          const buttons = modal.querySelectorAll('.arz-modal-footer button');
          buttons.forEach((btn, idx) => {
            btn.addEventListener('click', () => {
              if (options.buttons[idx].onClick) options.buttons[idx].onClick();
              if (options.buttons[idx].closeOnClick !== false) this.close();
            });
          });
        }
        if (options.onOpen) setTimeout(options.onOpen, 10);
      },
      close: function () {
        if (currentModal) {
          closeOverlay(currentModal);
          currentModal = null;
        }
      }
    };
  })();

  window.ArizonaThemeManager = (function () {
    let settings = {};

    const defaultCustomTheme = {
      dark: {
        accent: '#d33b45',
        accentHover: '#e0525c',
        bg: '#0f1115',
        bgSidebar: '#14171c',
        bgNav: '#14171c',
        cardBg: '#191d23',
        tableBg: '#161a1f',
        text: '#e6e8eb',
        textSecondary: '#9aa1ab',
        border: '#2a2f37'
      },
      light: {
        accent: '#d33b45',
        accentHover: '#b42f39',
        bg: '#f4f5f7',
        bgSidebar: '#ffffff',
        bgNav: '#ffffff',
        cardBg: '#ffffff',
        tableBg: '#ffffff',
        text: '#171a1f',
        textSecondary: '#626a75',
        border: '#e1e4e8'
      }
    };

    function isHexColor(value) {
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    }

    function hexToRgb(value, fallback) {
      if (!isHexColor(value)) return fallback;
      return value.slice(1).match(/.{2}/g).map(part => parseInt(part, 16)).join(', ');
    }

    function getCustomPalette(theme) {
      const fallback = defaultCustomTheme[theme] || defaultCustomTheme.dark;
      const saved = settings.customTheme && settings.customTheme[theme];
      const palette = { ...fallback, ...(saved || {}) };
      Object.keys(fallback).forEach((key) => {
        if (!isHexColor(palette[key])) palette[key] = fallback[key];
      });
      return palette;
    }

    const neutralSurfaces = {
      dark: {
        bg: '#0f1115',
        bgSidebar: '#14171c',
        bgNav: '#14171c',
        cardBg: '#191d23',
        tableBg: '#161a1f',
        tableRowHover: 'rgba(255, 255, 255, 0.035)'
      },
      light: {
        bg: '#f4f5f7',
        bgSidebar: '#ffffff',
        bgNav: '#ffffff',
        cardBg: '#ffffff',
        tableBg: '#ffffff',
        tableRowHover: '#eef0f3'
      }
    };

    const accentOverrides = {
      red: { accent: '#d33b45', accentHover: '#e0525c', accentRgb: '211, 59, 69' },
      ocean: { accent: '#3b82f6', accentHover: '#60a5fa', accentRgb: '59, 130, 246' },
      emerald: { accent: '#10b981', accentHover: '#34d399', accentRgb: '16, 185, 129' },
      gold: { accent: '#d97706', accentHover: '#f59e0b', accentRgb: '217, 119, 6' },
      frost: { accent: '#64748b', accentHover: '#94a3b8', accentRgb: '100, 116, 139' },
      dracula: { accent: '#a78bfa', accentHover: '#c4b5fd', accentRgb: '167, 139, 250' },
      sunset: { accent: '#ea580c', accentHover: '#fb923c', accentRgb: '234, 88, 12' },
      cyberpunk: { accent: '#e11d48', accentHover: '#fb7185', accentRgb: '225, 29, 72' },
      nord: { accent: '#5b8def', accentHover: '#7aa5f5', accentRgb: '91, 141, 239' },
      matrix: { accent: '#16a34a', accentHover: '#22c55e', accentRgb: '22, 163, 74' }
    };

    const colorSchemes = {
      red: { accent: '#d33b45', accentRgb: '211, 59, 69', accentHover: '#e0525c', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      ocean: { accent: '#3b82f6', accentRgb: '59, 130, 246', accentHover: '#60a5fa', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      emerald: { accent: '#10b981', accentRgb: '16, 185, 129', accentHover: '#34d399', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      gold: { accent: '#d97706', accentRgb: '217, 119, 6', accentHover: '#f59e0b', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      frost: { accent: '#64748b', accentRgb: '100, 116, 139', accentHover: '#94a3b8', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      dracula: { accent: '#a78bfa', accentRgb: '167, 139, 250', accentHover: '#c4b5fd', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      sunset: { accent: '#ea580c', accentRgb: '234, 88, 12', accentHover: '#fb923c', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      cyberpunk: { accent: '#e11d48', accentRgb: '225, 29, 72', accentHover: '#fb7185', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      nord: { accent: '#5b8def', accentRgb: '91, 141, 239', accentHover: '#7aa5f5', dark: neutralSurfaces.dark, light: neutralSurfaces.light },
      matrix: { accent: '#16a34a', accentRgb: '22, 163, 74', accentHover: '#22c55e', dark: neutralSurfaces.dark, light: neutralSurfaces.light }
    };

    return {
      init: function (settingsData) {
        settings = settingsData || {};
        this.apply();
      },
      updateSettings: function (settingsData) {
        settings = settingsData || {};
        this.apply();
      },
      apply: function () {
        if (settings.themeEnabled === false) {
          document.body.classList.remove('az-light-theme', 'az-custom-bg-image-active');
          document.body.classList.forEach(cls => {
            if (cls.startsWith('az-theme-')) {
              document.body.classList.remove(cls);
            }
          });
          [
            '--az-font-size', '--az-border-radius', '--az-border-radius-small',
            '--az-accent', '--az-accent-rgb', '--az-accent-hover', '--az-bg',
            '--az-custom-bg-image', '--az-custom-bg-blur', '--az-bg-sidebar',
            '--az-bg-nav', '--az-card-bg', '--az-log-card-bg', '--az-log-table-bg',
            '--az-log-card-border', '--az-log-card-body-border', '--az-table-bg',
            '--az-table-row-hover', '--az-text', '--az-text-secondary', '--az-border',
            '--az-input-bg', '--az-input-border', '--az-input-text',
            '--az-btn-close-filter'
          ].forEach(name => document.documentElement.style.removeProperty(name));
          return;
        }

        const theme = settings.theme || 'dark';
        const colorSchemeName = settings.colorScheme || 'red';
        const borderRadiusVal = settings.borderRadius || '8px';
        const fontSizeVal = settings.fontSize || 14;

        if (theme === 'light') {
          document.body.classList.add('az-light-theme');
        } else {
          document.body.classList.remove('az-light-theme');
        }

        document.body.classList.forEach(cls => {
          if (cls.startsWith('az-theme-')) {
            document.body.classList.remove(cls);
          }
        });
        document.body.classList.add(`az-theme-${settings.customThemeEnabled === true ? 'custom' : colorSchemeName}`);

        document.documentElement.style.setProperty('--az-font-size', `${fontSizeVal}px`);
        document.documentElement.style.setProperty('--az-border-radius', borderRadiusVal);
        const radiusPx = parseInt(borderRadiusVal) || 0;
        const smallRadius = radiusPx > 4 ? `${radiusPx - 2}px` : `${radiusPx}px`;
        document.documentElement.style.setProperty('--az-border-radius-small', smallRadius);

        const baseScheme = colorSchemes[colorSchemeName] || colorSchemes.red;
        const scheme = { ...baseScheme, ...(accentOverrides[colorSchemeName] || {}) };
        const modeColors = { ...(baseScheme[theme] || baseScheme.dark), ...neutralSurfaces[theme === 'light' ? 'light' : 'dark'] };
        const customPalette = settings.customThemeEnabled === true ? getCustomPalette(theme) : null;
        const activeColors = customPalette ? { ...modeColors, ...customPalette } : modeColors;
        const customBackground = settings.customThemeEnabled === true
          ? (isHexColor(activeColors.bg) ? activeColors.bg : modeColors.bg)
          : (isHexColor(settings.backgroundColor || '') ? settings.backgroundColor : modeColors.bg);
        const cardOpacity = Math.min(100, Math.max(10, Number(settings.cardOpacity ?? 100))) / 100;
        const backgroundImage = typeof settings.backgroundImage === 'string' && settings.backgroundImage.startsWith('data:image/')
          ? settings.backgroundImage : 'none';
        const backgroundImageUrl = typeof settings.backgroundImageUrl === 'string' && /^https?:\/\//i.test(settings.backgroundImageUrl)
          ? settings.backgroundImageUrl : 'none';
        const backgroundSource = backgroundImageUrl !== 'none' ? backgroundImageUrl : backgroundImage;
        const backgroundImageBlur = Math.min(30, Math.max(0, Number(settings.backgroundImageBlur ?? 0)));
        document.body.classList.toggle('az-custom-bg-image-active', backgroundSource !== 'none');

        const accent = isHexColor(activeColors.accent) ? activeColors.accent : scheme.accent;
        const accentHover = isHexColor(activeColors.accentHover) ? activeColors.accentHover : scheme.accentHover;
        document.documentElement.style.setProperty('--az-accent', accent);
        document.documentElement.style.setProperty('--az-accent-rgb', hexToRgb(accent, scheme.accentRgb));
        document.documentElement.style.setProperty('--az-accent-hover', accentHover);

        document.documentElement.style.setProperty('--az-bg', customBackground);
        const safeBackgroundSource = backgroundSource.replace(/[\\"\r\n]/g, (character) => `\\${character}`);
        document.documentElement.style.setProperty('--az-custom-bg-image', `url("${safeBackgroundSource}")`);
        document.documentElement.style.setProperty('--az-custom-bg-blur', `${backgroundImageBlur}px`);
        document.documentElement.style.setProperty('--az-bg-sidebar', activeColors.bgSidebar);
        document.documentElement.style.setProperty('--az-bg-nav', activeColors.bgNav || activeColors.bgSidebar);
        const cardMatch = activeColors.cardBg.match(/^#([0-9a-f]{6})$/i);
        const cardColor = cardMatch
          ? cardMatch[1].match(/.{2}/g).map(part => parseInt(part, 16)).join(', ')
          : '25, 29, 35';
        const tableMatch = typeof activeColors.tableBg === 'string' && activeColors.tableBg.match(/^#([0-9a-f]{6})$/i);
        const tableColor = tableMatch
          ? tableMatch[1].match(/.{2}/g).map(part => parseInt(part, 16)).join(', ')
          : cardColor;
        document.documentElement.style.setProperty('--az-card-bg', activeColors.cardBg);
        document.documentElement.style.setProperty('--az-log-card-bg', `rgba(${cardColor}, ${cardOpacity})`);
        document.documentElement.style.setProperty('--az-log-table-bg', `rgba(${tableColor}, ${cardOpacity})`);
        document.documentElement.style.setProperty('--az-log-card-border', settings.cardBodyBorder === true ? '1px solid var(--az-border)' : 'none');
        document.documentElement.style.setProperty('--az-log-card-body-border', settings.cardBodyBorder === true ? '1px solid var(--az-border)' : 'none');
        document.documentElement.style.setProperty('--az-table-bg', activeColors.tableBg);
        const hoverRgb = hexToRgb(accent, theme === 'light' ? '211, 59, 69' : '211, 59, 69');
        document.documentElement.style.setProperty('--az-table-row-hover', customPalette
          ? `rgba(${hoverRgb}, ${theme === 'light' ? '0.08' : '0.12'})`
          : modeColors.tableRowHover);

        if (customPalette) {
          document.documentElement.style.setProperty('--az-text', activeColors.text);
          document.documentElement.style.setProperty('--az-text-secondary', activeColors.textSecondary);
          document.documentElement.style.setProperty('--az-border', activeColors.border);
          document.documentElement.style.setProperty('--az-input-bg', activeColors.bgSidebar);
          document.documentElement.style.setProperty('--az-input-border', activeColors.border);
          document.documentElement.style.setProperty('--az-input-text', activeColors.text);
          document.documentElement.style.setProperty('--az-btn-close-filter', theme === 'light' ? 'none' : 'invert(1) grayscale(1) brightness(2)');
        } else if (theme === 'light') {
          document.documentElement.style.setProperty('--az-text', '#171a1f');
          document.documentElement.style.setProperty('--az-text-secondary', '#626a75');
          document.documentElement.style.setProperty('--az-border', '#e1e4e8');
          document.documentElement.style.setProperty('--az-input-bg', '#ffffff');
          document.documentElement.style.setProperty('--az-input-border', '#d6dae0');
          document.documentElement.style.setProperty('--az-input-text', '#171a1f');
          document.documentElement.style.setProperty('--az-btn-close-filter', 'none');
        } else {
          document.documentElement.style.setProperty('--az-text', '#e6e8eb');
          document.documentElement.style.setProperty('--az-text-secondary', '#9aa1ab');
          document.documentElement.style.setProperty('--az-border', '#2a2f37');
          document.documentElement.style.setProperty('--az-input-bg', '#12151a');
          document.documentElement.style.setProperty('--az-input-border', '#343a44');
          document.documentElement.style.setProperty('--az-input-text', '#e6e8eb');
          document.documentElement.style.setProperty('--az-btn-close-filter', 'invert(1) grayscale(1) brightness(2)');
        }
      }
    };
  })();

  window.ArizonaObservers = (function () {
    let tbodyObserver = null;
    let containerObserver = null;
    let scanTimeout = null;
    let callback = null;

    function startTbodyObserver() {
      if (tbodyObserver) {
        tbodyObserver.disconnect();
        tbodyObserver = null;
      }
      const tbody = document.querySelector('table.table tbody');
      if (!tbody) return;

      tbodyObserver = new MutationObserver((mutations) => {
        let hasRowChanges = false;
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            hasRowChanges = true;
            break;
          }
        }
        if (!hasRowChanges) return;

        if (isCurrentlyProcessing()) return;
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
          if (callback) {
            const maskingActive = window.ArizonaMaskingManager && typeof window.ArizonaMaskingManager.stopObserver === 'function';
            if (maskingActive) {
              window.ArizonaMaskingManager.stopObserver();
            }
            try {
              callback();
            } finally {
              if (maskingActive) {
                window.ArizonaMaskingManager.startObserver();
              }
            }
          }
        }, 20);
      });

      tbodyObserver.observe(tbody, { childList: true, subtree: false });
    }

    function startContainerObserver() {
      if (containerObserver) {
        containerObserver.disconnect();
        containerObserver = null;
      }

      const table = document.querySelector('table.table');
      const container = table ? table.parentElement : document.querySelector('.card-body') || document.body;

      containerObserver = new MutationObserver((mutations) => {
        let tableReplaced = false;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.tagName === 'TABLE' && node.classList.contains('table')) {
                tableReplaced = true;
                break;
              }
              if (node.querySelector && node.querySelector('table.table')) {
                tableReplaced = true;
                break;
              }
            }
          }
          if (tableReplaced) break;
        }

        if (tableReplaced) {
          startTbodyObserver();
          if (callback) callback();
        }
      });

      containerObserver.observe(container, { childList: true, subtree: false });
    }

    return {
      init: function (settings, onTableUpdate) {
        callback = onTableUpdate;
        this.start();
      },
      start: function () {
        startTbodyObserver();
        startContainerObserver();
      },
      stop: function () {
        if (tbodyObserver) { tbodyObserver.disconnect(); tbodyObserver = null; }
        if (containerObserver) { containerObserver.disconnect(); containerObserver = null; }
        if (scanTimeout) { clearTimeout(scanTimeout); scanTimeout = null; }
      }
    };
  })();

  window.ArizonaMaskingManager = (function () {
    const IP_REGEX = /\b\d{1,3}(\.\d{1,3}){3}\b/g;
    const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const TG_REGEX = /@([A-Za-z0-9_]+)/g;
    const TG_ID_REGEX = /TG ID:\s*(\d+)/g;
    const VK_REGEX = /([А-Яа-яA-Za-z0-9_]+)\s*\(VK ID:\s*(\d+)\)/g;
    const VK_ID_REGEX = /VK ID:\s*(\d+)/g;
    let observer = null;
    let settings = { masking: { enabled: true, maskIp: true, maskEmail: true, maskTG: true, maskVK: true } };

    function maskIP(ip) {
      if (!settings.masking?.maskIp) return ip;
      if (ip.includes('***') || ip.includes('****')) return ip;
      const parts = ip.split('.');
      if (parts.length === 4) return parts[0] + '.***';
      return ip.substring(0, 2) + '****';
    }

    function maskEmail(email) {
      if (!settings.masking?.maskEmail) return email;
      if (email.includes('***') || email.includes('****')) return email;
      const atIndex = email.indexOf('@');
      if (atIndex <= 3) return email.slice(0, 1) + '***@' + email.slice(atIndex + 1);
      if (atIndex <= 6) return email.slice(0, 3) + '***@' + email.slice(atIndex + 1);
      return email.slice(0, 4) + '***@' + email.slice(atIndex + 1);
    }

    function maskTG(text) {
      if (!settings.masking?.maskTG) return text;
      let result = text;
      result = result.replace(TG_REGEX, (match, username) => {
        if (username.includes('***') || username.includes('****')) return match;
        if (username.length > 4) return '@' + username.slice(0, 4) + '****';
        return '@' + username.slice(0, 2) + '***';
      });
      result = result.replace(TG_ID_REGEX, (match, id) => {
        if (id.includes('***') || id.includes('****')) return match;
        if (id.length > 8) return 'TG ID: ' + id.slice(0, 4) + '****' + id.slice(-4);
        return 'TG ID: ' + id.slice(0, 2) + '****' + id.slice(-2);
      });
      return result;
    }

    function maskVK(text) {
      if (!settings.masking?.maskVK) return text;
      let result = text;
      result = result.replace(VK_REGEX, (match, name, id) => {
        let mName = name;
        let mId = id;
        if (!name.includes('***') && !name.includes('****')) {
          mName = name.length > 6 ? name.slice(0, 4) + '****' + name.slice(-2) : name.slice(0, 4) + '****';
        }
        if (!id.includes('***') && !id.includes('****')) {
          mId = id.length > 8 ? id.slice(0, 4) + '****' + id.slice(-4) : id.slice(0, 2) + '****' + id.slice(-2);
        }
        return `${mName} (VK ID: ${mId})`;
      });
      result = result.replace(VK_ID_REGEX, (match, id) => {
        if (id.includes('***') || id.includes('****')) return match;
        if (id.length > 8) return 'VK ID: ' + id.slice(0, 4) + '****' + id.slice(-4);
        return 'VK ID: ' + id.slice(0, 2) + '****' + id.slice(-2);
      });
      return result;
    }

    function processTextNode(node) {
      const text = node.nodeValue;
      if (!text || text.trim() === '') return;
      const masking = settings.masking || { maskIp: true, maskEmail: true, maskTG: true, maskVK: true };
      let changed = false;
      let newText = text;

      const hasDigit = /\d/.test(newText);
      const hasDot = newText.includes('.');
      const hasAt = newText.includes('@');
      const hasVk = newText.includes('VK') || newText.includes('vk') || newText.includes('Vk') || newText.includes('vK');
      const hasTg = hasAt || newText.includes('TG') || newText.includes('tg') || newText.includes('Tg') || newText.includes('tG');

      if (!hasDigit && !hasDot && !hasAt && !hasVk && !hasTg) {
        return;
      }

      if (masking.maskIp !== false && hasDot && hasDigit) {
        const temp = newText.replace(IP_REGEX, ip => maskIP(ip));
        if (temp !== newText) { newText = temp; changed = true; }
      }
      if (masking.maskEmail !== false && hasAt && hasDot) {
        const temp = newText.replace(EMAIL_REGEX, email => maskEmail(email));
        if (temp !== newText) { newText = temp; changed = true; }
      }
      if (masking.maskTG !== false && hasTg) {
        const temp = maskTG(newText);
        if (temp !== newText) { newText = temp; changed = true; }
      }
      if (masking.maskVK !== false && hasVk) {
        const temp = maskVK(newText);
        if (temp !== newText) { newText = temp; changed = true; }
      }
      if (changed) node.nodeValue = newText;
    }

    function walk(node) {
      if (node.nodeType === 3) {
        processTextNode(node);
      } else if (node.nodeType === 1) {
        const tagName = node.tagName;
        if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'TEXTAREA' || tagName === 'INPUT') return;

        const classList = node.classList;
        if (classList && (classList.contains('az-geo-inserted') || classList.contains('table-ip'))) return;
        if (tagName === 'A' && node.hasAttribute('data-ip')) return;

        let child = node.firstChild;
        while (child) {
          walk(child);
          child = child.nextSibling;
        }
      }
    }

    function runMasking() {
      if (settings.masking?.enabled === false) return;
      const tableBody = document.querySelector('table.table tbody');
      if (tableBody) {
        walk(tableBody);
      } else {
        walk(document.body);
      }
    }

    return {
      init: function (settingsData) {
        settings = settingsData || {};
        if (!settings.masking) settings.masking = { enabled: true, maskIp: true, maskEmail: true, maskTG: true, maskVK: true };
        if (settings.masking?.enabled !== false) {
          runWhenElementExists('table.table', () => { runMasking(); });
        }
      },
      updateSettings: function (settingsData) {
        settings = settingsData || {};
        if (settings.masking?.enabled !== false) {
          runMasking();
        }
      },
      maskRow: function (tr) {
        if (settings.masking?.enabled === false) return;
        const len = tr.cells.length;
        for (let i = 1; i < len; i++) {
          const cell = tr.cells[i];
          if (cell) walk(cell);
        }
      },
      startObserver: function () {
      },
      stopObserver: function () {
      },
      refresh: function () {
        runMasking();
      },
      handleCopy: function (e, settingsData) {
        const selection = window.getSelection().toString();
        if (!selection) return;

        let cleaned = selection;
        const singleIpRegex = /^\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*$/;
        if (!singleIpRegex.test(selection)) {
          const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
          cleaned = cleaned.replace(ipGeoRegex, '');
        }

        const masking = settingsData?.masking || { enabled: true, maskIp: true, maskEmail: true, maskTG: true, maskVK: true };
        if (masking.enabled !== false) {
          if (masking.maskEmail !== false) cleaned = cleaned.replace(EMAIL_REGEX, email => maskEmail(email));
          if (masking.maskTG !== false) cleaned = maskTG(cleaned);
          if (masking.maskVK !== false) cleaned = maskVK(cleaned);
        }
        if (cleaned !== selection) {
          e.clipboardData.setData('text/plain', cleaned);
          e.preventDefault();
        }
      }
    };
  })();

  window.ArizonaIpLookupManager = (function () {
    return {
      init: function (settingsData) {
        initIpRowsObserver();
      },
      processTable: function () {
        initIpRowsObserver();
      },
      updateSettings: function (newSettings) {
        if (!newSettings.ipLookupEnabled) {
          document.querySelectorAll('.az-geo-inserted').forEach(span => span.remove());
        }
        initIpRowsObserver();
      },
      getIpData: function (ip) {
        return ipDetailsCache[ip];
      }
    };
  })();

  window.ArizonaTuningAHKManager = (function () {
    return {
      init: function (s) {
        arizonaSettings = s || {};
        if (arizonaSettings.tuningParts?.enabled) {
          runWhenElementExists('tbody tr', () => this.apply());
        }
      },
      updateSettings: function (s) {
        arizonaSettings = s || {};
        if (arizonaSettings.tuningParts?.enabled) {
          this.apply();
        } else {
          document.querySelectorAll('tbody tr').forEach(row => {
            row.style.outline = '';
          });
        }
      },
      apply: function () {
        document.querySelectorAll('tbody tr').forEach(row => {
          highlightTuningAHK(row);
        });
        handleTuningAutoScroll();
      }
    };
  })();

  window.ArizonaTgVkDetector = (function () {
    let done = false;
    let settings = {};
    let lastScannedRowCount = 0;
    return {
      init: function (s) { settings = s || {}; done = false; lastScannedRowCount = 0; runWhenElementExists('.filter-buttons', () => this.scan()); },
      reset: function () { done = false; lastScannedRowCount = 0; },
      updateSettings: function (s) {
        settings = s || {};
        done = false;
        lastScannedRowCount = 0;
        this.scan();
      },
      scan: function () {
        const existing = document.getElementById('az-tgvk-check-section');
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.tools?.tgVkDetectorEnabled !== false;
        if (!isEnabled) {
          if (existing) existing.remove();
          return;
        }
        if (done) return;
        const sel = document.querySelector('select[name="type[]"]');
        if (!sel || !Array.from(sel.selectedOptions).some(o => o.value === 'mail')) return;
        const btn = document.querySelector('.filter-buttons');
        if (!btn) return;

        const rows = document.querySelectorAll('tbody tr');
        if (rows.length === 0 || rows.length === lastScannedRowCount) return;
        lastScannedRowCount = rows.length;

        if (existing) existing.remove();

        const tg = new Map(), vk = new Map();
        rows.forEach(row => {
          const cells = row.cells;
          if (cells.length < 2) return;
          const txt = cells[1].textContent;
          if (txt.includes('привязывает аккаунт')) {
            const tgM = txt.match(/@([A-Za-z0-9_]+)/);
            if (tgM) { tg.set(tgM[1], tg.get(tgM[1]) || []); tg.get(tgM[1]).push(txt); }
            const tgId = txt.match(/TG ID:\s*(\d+)/);
            if (tgId) { tg.set(tgId[1], tg.get(tgId[1]) || []); tg.get(tgId[1]).push(txt); }
            const vkM = txt.match(/([А-Яа-яA-Za-z0-9_]+)\s*\(VK ID:\s*(\d+)\)/);
            if (vkM) { vk.set(vkM[2], vk.get(vkM[2]) || []); vk.get(vkM[2]).push(txt); }
          }
        });

        const dupTg = Array.from(tg.entries()).filter(([_, e]) => e.length > 1);
        const dupVk = Array.from(vk.entries()).filter(([_, e]) => e.length > 1);
        if (dupTg.length === 0 && dupVk.length === 0) return;

        const sec = document.createElement('div');
        sec.id = 'az-tgvk-check-section';
        sec.className = 'arz-warn-section';
        let html = `<div class="arz-warn-header"><i class="fa-solid fa-magnifying-glass"></i> Повторяющиеся TG/VK (возможные боты)</div>`;
        if (dupTg.length > 0) {
          html += `<div class="arz-warn-group-title"><i class="fa-brands fa-telegram"></i> Telegram</div><div class="arz-warn-list">`;
          dupTg.forEach(([id, e]) => {
            const col = e.length >= 10 ? 'var(--az-danger)' : e.length >= 5 ? 'var(--az-warning)' : 'var(--az-success)';
            html += `<div class="arz-warn-item"><span class="arz-warn-item-key">${id}</span><span class="arz-warn-badge" style="background: ${col};">${e.length} акк.</span></div>`;
          });
          html += `</div>`;
        }
        if (dupVk.length > 0) {
          html += `<div class="arz-warn-group-title"><i class="fa-brands fa-vk"></i> VK</div><div class="arz-warn-list">`;
          dupVk.forEach(([id, e]) => {
            const col = e.length >= 10 ? 'var(--az-danger)' : e.length >= 5 ? 'var(--az-warning)' : 'var(--az-success)';
            html += `<div class="arz-warn-item"><span class="arz-warn-item-key">VK ID: ${id}</span><span class="arz-warn-badge" style="background: ${col};">${e.length} акк.</span></div>`;
          });
          html += `</div>`;
        }
        sec.innerHTML = html;
        btn.insertAdjacentElement('afterend', sec);
        done = true;
      }
    };
  })();

  window.ArizonaEmailDetector = (function () {
    let done = false;
    let settings = {};
    let lastScannedRowCount = 0;
    return {
      init: function (s) { settings = s || {}; done = false; lastScannedRowCount = 0; runWhenElementExists('.filter-buttons', () => this.scan()); },
      reset: function () { done = false; lastScannedRowCount = 0; },
      updateSettings: function (s) {
        settings = s || {};
        done = false;
        lastScannedRowCount = 0;
        this.scan();
      },
      scan: function () {
        const existing = document.getElementById('az-email-check-section');
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.emailCheck?.enabled !== false;
        if (!isEnabled) {
          if (existing) existing.remove();
          return;
        }
        if (done) return;
        const sel = document.querySelector('select[name="type[]"]');
        if (!sel || !Array.from(sel.selectedOptions).some(o => o.value === 'mail')) return;
        const btn = document.querySelector('.filter-buttons');
        if (!btn) return;

        const rows = document.querySelectorAll('tbody tr');
        if (rows.length === 0 || rows.length === lastScannedRowCount) return;
        lastScannedRowCount = rows.length;

        if (existing) existing.remove();

        const emails = new Map();
        rows.forEach(row => {
          const cells = row.cells;
          if (cells.length < 2) return;
          const txt = cells[1].textContent;
          if (txt.includes('изменил почту') || txt.includes('привязал почту')) {
            const m = txt.match(/на\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
            if (m) emails.set(m[1], (emails.get(m[1]) || 0) + 1);
          }
        });

        const threshold = settings.emailCheck?.threshold || 3;
        const dups = Array.from(emails.entries()).filter(([_, c]) => c >= threshold).sort((a, b) => b[1] - a[1]);
        if (dups.length === 0) return;

        const sec = document.createElement('div');
        sec.id = 'az-email-check-section';
        sec.className = 'arz-warn-section';

        const server = document.querySelector('select[name="server_number"]')?.value || '5';
        const minP = document.querySelector('input[name="min_period"]')?.value || '2026-01-01 00:00:00';
        const low = settings.emailCheck?.lowColor || '#3fb950';
        const med = settings.emailCheck?.mediumColor || '#d29922';
        const high = settings.emailCheck?.highColor || '#f85149';

        let html = `<div class="arz-warn-header"><i class="fa-solid fa-magnifying-glass"></i> Повторяющиеся почты (возможные боты)</div><table class="arz-warn-table"><thead><tr><th><i class="fa-regular fa-envelope"></i> Почта</th><th><i class="fa-solid fa-users"></i> Аккаунтов</th></tr></thead><tbody>`;
        dups.forEach(([mail, count]) => {
          const bg = count >= 10 ? high : count >= 5 ? med : low;
          const url = `${LOGS_ORIGIN}/?server_number=${server}&type%5B%5D%5B%5D=mail&sort=desc&min_period=${encodeURIComponent(minP)}&dynamic%5B109%5D=${encodeURIComponent(mail)}`;
          html += `<tr><td><a href="${url}">${window.ArizonaUtils.escapeHtml(mail)}</a></td><td><span class="arz-warn-badge" style="background: ${bg};">${count}</span></td></tr>`;
        });
        html += '</tbody></table>';
        sec.innerHTML = html;
        btn.insertAdjacentElement('afterend', sec);
        done = true;
      }
    };
  })();

  window.ArizonaColumnEyeButtons = (function () {
    let col3Hidden = false, col4Hidden = false;
    let settings = {};

    function toggle(idx, hide) {
      document.querySelectorAll(`table.table tbody tr td:nth-child(${idx})`).forEach(c => { c.style.visibility = hide ? 'hidden' : ''; });
    }

    function addEye(th, type, getHidden, setHidden, idx) {
      if (!th) return;
      let btn = th.querySelector('.arz-col-eye-btn');
      if (!btn) {
        btn = document.createElement('span');
        btn.setAttribute('role', 'button');
        btn.className = 'arz-col-eye-btn';
        btn.onclick = (e) => {
          e.stopPropagation();
          setHidden(!getHidden());
          if (!settings.hiddenColumns) settings.hiddenColumns = {};
          settings.hiddenColumns[type === 'data' ? 'col3' : 'col4'] = getHidden();
          chrome.storage.local.set({ arizonaSettings: settings });
          btn.innerHTML = `<i class="fa-regular fa-eye${getHidden() ? '-slash' : ''}" style="font-size:13px;"></i>`;
          th.style.opacity = getHidden() ? '0.4' : '';
          toggle(idx, getHidden());
        };
        th.appendChild(btn);
      }
      btn.innerHTML = `<i class="fa-regular fa-eye${getHidden() ? '-slash' : ''}" style="font-size:13px;"></i>`;
      th.style.opacity = getHidden() ? '0.4' : '';
      toggle(idx, getHidden());
    }

    function removeEye(th, idx) {
      if (!th) return;
      const btn = th.querySelector('.arz-col-eye-btn');
      if (btn) btn.remove();
      th.style.opacity = '';
      toggle(idx, false);
    }

    return {
      init: function (s) {
        settings = s || {};
        if (settings.hiddenColumns) {
          col3Hidden = !!settings.hiddenColumns.col3;
          col4Hidden = !!settings.hiddenColumns.col4;
        }
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        if (settings.hiddenColumns) {
          col3Hidden = !!settings.hiddenColumns.col3;
          col4Hidden = !!settings.hiddenColumns.col4;
        }
        this.update();
      },
      update: function () {
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.tools?.columnEyeButtons !== false;
        const ths = document.querySelectorAll('table.table thead tr th');
        if (ths.length >= 4) {
          if (isEnabled) {
            addEye(ths[2], 'data', () => col3Hidden, (val) => col3Hidden = val, 3);
            addEye(ths[3], 'ip', () => col4Hidden, (val) => col4Hidden = val, 4);
          } else {
            removeEye(ths[2], 3);
            removeEye(ths[3], 4);
          }
        }
      }
    };
  })();

  window.ArizonaLogFilter = (function () {
    let settings = {};
    function getMode() { return document.querySelector('input[name="arz-filter-logs-mode"]:checked')?.value || 'show'; }
    function autoApply() { if (document.getElementById('arz-filter-logs-auto')?.checked) apply(false); }

    function apply(toast = false) {
      const ta = document.getElementById('arz-filter-logs');
      if (!ta) return;
      const useRegex = !!document.getElementById('arz-filter-logs-regex')?.checked;
      const filters = ta.value.split('\n').map(f => f.trim()).filter(f => f.length > 0);
      let regexFilters = [];
      if (useRegex) {
        try {
          regexFilters = filters.map(f => new RegExp(f, 'i'));
        } catch (error) {
          if (toast && window.ArizonaNotifications) window.ArizonaNotifications.show(`Ошибка регулярного выражения: ${error.message}`, 'error');
          return;
        }
      }
      const rows = document.querySelectorAll('table.table tbody tr');
      const mode = getMode();
      let shown = 0, hidden = 0;

      rows.forEach(row => {
        const cell = row.querySelector('td:nth-child(2)');
        if (!cell) return;
        const text = cell.textContent;
        if (filters.length === 0) { row.style.display = ''; shown++; return; }
        const match = useRegex
          ? regexFilters.some(regex => regex.test(text))
          : filters.some(f => text.toLowerCase().includes(f.toLowerCase()));
        const hide = mode === 'show' ? !match : match;
        row.style.display = hide ? 'none' : '';
        if (hide) hidden++; else shown++;
      });
      if (toast && filters.length > 0) window.ArizonaNotifications.show(`Показано: ${shown} / Скрыто: ${hidden}`, 'info');
      chrome.storage.local.set({ arzLogFilter: { text: ta.value, mode: mode, auto: document.getElementById('arz-filter-logs-auto')?.checked, regex: useRegex } });
    }

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.tools?.filterWindow !== false;
        if (isEnabled) {
          runWhenElementExists('.filter-buttons', () => this.createUI());
        } else {
          this.removeUI();
        }
      },
      removeUI: function () {
        const root = document.getElementById('arz-log-filter-root');
        if (root) root.remove();
        const ta = document.getElementById('arz-filter-logs');
        if (ta) {
          const container = ta.closest('.col-sm-3, .col-sm-4');
          if (container) container.remove();
          else ta.remove();
        }
        document.querySelectorAll('table.table tbody tr').forEach(r => r.style.display = '');
      },
      createUI: function () {
        if (document.getElementById('arz-log-filter-root')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;

        const div = document.createElement('div');
        div.id = 'arz-log-filter-root';
        div.className = 'col-sm-4 pt-3';
        div.innerHTML = `
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: var(--az-text); visibility: hidden;">&nbsp;</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" id="arz-filter-logs-submit" class="btn btn-success"><i class="fa-solid fa-magnifying-glass" style="margin-right:6px;"></i> Применить поиск</button>
            <button type="button" id="arz-filter-logs-reset" class="btn btn-secondary" title="Сбросить поиск"><i class="fa-solid fa-arrows-rotate" style="margin-right: 0px !important;"></i></button>
          </div>
          <div id="arz-filter-logs-options" style="margin-top: 10px;">
            <div class="form-check" style="margin-bottom: 5px;">
              <input class="form-check-input" type="radio" name="arz-filter-logs-mode" id="arz-filter-mode-show" value="show" checked>
              <label class="form-check-label" for="arz-filter-mode-show" style="color:var(--az-text);cursor:pointer;margin-left:5px;">Оставить с указанным текстом</label>
            </div>
            <div class="form-check" style="margin-bottom: 5px;">
              <input class="form-check-input" type="radio" name="arz-filter-logs-mode" id="arz-filter-mode-hide" value="hide">
              <label class="form-check-label" for="arz-filter-mode-hide" style="color:var(--az-text);cursor:pointer;margin-left:5px;">Скрыть с указанным текстом</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="arz-filter-logs-auto">
              <label class="form-check-label" for="arz-filter-logs-auto" style="color:var(--az-text);cursor:pointer;margin-left:5px;">Автоматически применять при загрузке страницы</label>
            </div>
          </div>
        `;
        const taDiv = document.createElement('div');
        taDiv.className = 'pt-3 col-sm-4';
        taDiv.innerHTML = `
          <div style="font-weight: 500; font-size: 13px; margin-bottom: 6px; color: var(--az-text);"><i class="fa-solid fa-magnifying-glass" style="margin-right: 6px; color: var(--az-accent-hover);"></i>Фильтр для поиска среди логов на странице</div>
          <textarea id="arz-filter-logs" class="form-control" rows="3" placeholder="Фильтр для поиска в логах..." style="height:102px; background:var(--az-input-bg); border:1px solid var(--az-input-border); color:var(--az-input-text);"></textarea>
          <div class="arz-log-filter-regex-row">
            <label><input type="checkbox" id="arz-filter-logs-regex"> Регулярные выражения</label>
            <span class="arz-regex-presets">
              <button type="button" data-regex="\\b\\d{1,3}(?:\\.\\d{1,3}){3}\\b">IP</button>
              <button type="button" data-regex="\\b\\d{1,2}:\\d{2}:\\d{2}\\b">Время</button>
              <button type="button" data-regex="(?:получил|передал|отдал)">Действие</button>
              <button type="button" data-regex="\\$\\s?\\d[\\d ,]*">Деньги</button>
            </span>
          </div>
        `;

        const row = container.closest('.row');
        if (row) { row.appendChild(taDiv); row.appendChild(div); }

        document.getElementById('arz-filter-logs-submit').onclick = () => apply(true);
        document.getElementById('arz-filter-logs-reset').onclick = () => {
          const ta = document.getElementById('arz-filter-logs');
          if (ta) ta.value = '';
          const auto = document.getElementById('arz-filter-logs-auto');
          if (auto) auto.checked = false;
          const regex = document.getElementById('arz-filter-logs-regex');
          if (regex) regex.checked = false;
          const show = document.getElementById('arz-filter-mode-show');
          if (show) show.checked = true;
          document.querySelectorAll('table.table tbody tr').forEach(r => r.style.display = '');
          chrome.storage.local.remove('arzLogFilter');
        };
        const ta = document.getElementById('arz-filter-logs');
        if (ta) ta.oninput = autoApply;
        const regex = document.getElementById('arz-filter-logs-regex');
        if (regex) regex.onchange = autoApply;
        document.querySelectorAll('.arz-regex-presets button').forEach(button => button.onclick = () => {
          const value = button.dataset.regex || '';
          ta.value = ta.value.trim() ? `${ta.value.trim()}\n${value}` : value;
          if (regex) regex.checked = true;
          autoApply();
        });
        document.querySelectorAll('input[name="arz-filter-logs-mode"]').forEach(r => r.onchange = autoApply);
        document.getElementById('arz-filter-logs-auto').onchange = () => chrome.storage.local.set({ arzLogFilter: { text: ta.value, mode: getMode(), auto: document.getElementById('arz-filter-logs-auto').checked, regex: !!regex?.checked } });

        chrome.storage.local.get(['arzLogFilter'], (res) => {
          if (res.arzLogFilter) {
            const data = res.arzLogFilter;
            if (ta) ta.value = data.text || '';
            if (regex) regex.checked = !!data.regex;
            const rad = document.querySelector(`input[name="arz-filter-logs-mode"][value="${data.mode || 'show'}"]`);
            if (rad) rad.checked = true;
            const auto = document.getElementById('arz-filter-logs-auto');
            if (auto) auto.checked = !!data.auto;
            if (data.text?.trim() && data.auto) apply(false);
          }
        });
      }
    };
  })();

  window.ArizonaFormsManager = (function () {
    let settings = {};
    let source = 'first';

    const modalHTML = `
      <div id="arz-forms-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper">
              <i class="fa-solid fa-list-check"></i>
            </div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Генератор команд</div>
              <div class="arz-modal-subtitle">{nick} - автоматически заменится на ник игрока</div>
            </div>
            <button id="arz-forms-close" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="arz-modal-body" style="gap: 18px !important;">
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="arz-modal-label"><i class="fa-solid fa-terminal"></i> Шаблон команды</label>
                <span style="font-size: 10px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 3px 8px; border-radius: 12px;">Пример: /banoff 0 {nick} 2000 Чит</span>
              </div>
              <textarea id="arz-form-template" class="arz-textarea" rows="3" placeholder="/banoff 0 {nick} 2000 Чит"></textarea>
            </div>
            <div class="arz-modal-form-group">
              <label class="arz-modal-label" style="margin-bottom: 4px;"><i class="fa-solid fa-user"></i> Источник ника</label>
              <div style="display: flex; gap: 8px; background: var(--az-input-bg); padding: 6px; border-radius: 14px; border: 1px solid var(--az-border);">
                <button type="button" class="forms-switch-btn active" data-source="first" style="flex: 1; padding: 10px 16px; background: var(--az-accent); border: none; border-radius: 10px; font-size: 13px; font-weight: 600; color: white; cursor: pointer; transition: all 0.2s;">Первый ник</button>
                <button type="button" class="forms-switch-btn" data-source="second" style="flex: 1; padding: 10px 16px; background: transparent; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--az-text-secondary); cursor: pointer; transition: all 0.2s;">Второй ник</button>
              </div>
            </div>
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="arz-modal-label"><i class="fa-solid fa-list"></i> Сгенерированные команды</label>
                <span id="arz-commands-count" style="background: var(--az-accent); color: white; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 30px;">0</span>
              </div>
              <div id="arz-form-commands" class="arz-list-container"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-forms-close-bottom" class="arz-btn-danger" style="flex: 1;">Закрыть</button>
            <button id="arz-copy-all-btn" class="arz-btn-primary" style="flex: 1;">Копировать всё</button>
          </div>
        </div>
      </div>
    `;

    function extractNicks(src) {
      const nicks = [];
      document.querySelectorAll('table.table tbody tr').forEach(row => {
        const td = row.querySelectorAll('td')[1];
        if (!td) return;
        const links = td.querySelectorAll('a strong');
        const idx = src === 'second' ? 1 : 0;
        const name = links[idx]?.textContent.trim();
        if (name && !nicks.includes(name)) nicks.push(name);
      });
      return nicks;
    }

    function generate() {
      const template = document.getElementById('arz-form-template')?.value || '';
      const count = document.getElementById('arz-commands-count');
      const container = document.getElementById('arz-form-commands');
      if (!container) return;
      if (!template.trim() || !template.includes('{nick}')) {
        if (count) count.textContent = '0';
        container.innerHTML = '';
        return;
      }
      const nicks = extractNicks(source);
      if (count) count.textContent = nicks.length;
      container.innerHTML = '';
      nicks.forEach(nick => {
        const cmd = template.replace(/\{nick\}/g, nick);
        const item = document.createElement('div');
        item.className = 'arz-list-item';

        const txt = document.createElement('div');
        txt.className = 'arz-list-item-text';
        txt.textContent = cmd;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'arz-list-item-btn';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';

        const copyHandler = async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(cmd);
            window.ArizonaNotifications.show('Команда скопирована', 'success');
          } catch (err) { }
        };
        copyBtn.onclick = copyHandler;
        item.onclick = copyHandler;

        item.appendChild(txt);
        item.appendChild(copyBtn);
        container.appendChild(item);
      });
    }

    function setup(modal) {
      modal.querySelector('#arz-forms-close').onclick = () => closeOverlay(modal);
      modal.querySelector('#arz-forms-close-bottom').onclick = () => closeOverlay(modal);
      modal.querySelector('#arz-copy-all-btn').onclick = async () => {
        const cmds = Array.from(modal.querySelectorAll('#arz-form-commands .arz-list-item-text')).map(el => el.textContent);
        if (cmds.length) {
          await navigator.clipboard.writeText(cmds.join('\n'));
          window.ArizonaNotifications.show(`Скопировано ${cmds.length} команд`, 'success');
        }
      };
      const ta = modal.querySelector('#arz-form-template');
      ta.oninput = () => { generate(); localStorage.setItem('arz_forms_template', ta.value); };
      ta.value = localStorage.getItem('arz_forms_template') || '';

      const switchBtns = modal.querySelectorAll('.forms-switch-btn');
      switchBtns.forEach(btn => {
        btn.onclick = () => {
          switchBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          source = btn.dataset.source;
          generate();
        };
      });
      generate();
    }

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.tools?.formsEnabled !== false;
        const existingBtn = document.getElementById('arz-forms-btn');
        if (isEnabled) {
          runWhenElementExists('.filter-buttons', () => this.injectButton());
        } else {
          if (existingBtn) existingBtn.remove();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-forms-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-forms-btn';
        btn.className = 'btn btn-success';
        btn.style.cssText = 'margin-left: 10px;';
        btn.innerHTML = `<i class="fa-solid fa-list-check" style="margin-right: 6px;"></i> Формы`;
        btn.onclick = () => {
          const overlay = document.createElement('div');
          overlay.innerHTML = modalHTML;
          const el = overlay.firstElementChild;
          openOverlay(el);
          setup(el);
        };
        container.appendChild(btn);
      }
    };
  })();

  window.ArizonaOnlineManager = (function () {
    let settings = {};
    let calculated = false;

    const modalHTML = `
      <div id="arz-online-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-clock"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Расчет онлайна</div>
              <div class="arz-modal-subtitle">Анализ игровых сессий</div>
            </div>
            <button data-action="cancel" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="arz-modal-body">
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="arz-modal-label" style="margin: 0;"><i class="fa-solid fa-users"></i> Ник(и) игрока(ов)</label>
                <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px;">Введено: <strong id="arz-online-count-num" style="color: var(--az-accent-hover);">0</strong></span>
              </div>
              <textarea id="arz-online-nicks" class="arz-textarea" rows="3" placeholder="Введите один или несколько ников (каждый с новой строки или через запятую)"></textarea>
            </div>
            <div style="display: flex; gap: 12px; width: 100%; box-sizing: border-box;">
              <div class="arz-modal-form-group" style="flex: 1;">
                <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата от</label>
                <input type="date" id="arz-online-date-from" class="arz-input">
              </div>
              <div class="arz-modal-form-group" style="flex: 1;">
                <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата до</label>
                <input type="date" id="arz-online-date-to" class="arz-input">
              </div>
            </div>
            <div class="arz-date-shortcuts" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; width: 100% !important; box-sizing: border-box !important; margin-top: -4px !important;">
              <button type="button" class="arz-btn-shortcut" data-range="day">За день</button>
              <button type="button" class="arz-btn-shortcut" data-range="week">За неделю</button>
              <button type="button" class="arz-btn-shortcut" data-range="month">За месяц</button>
              <button type="button" class="arz-btn-shortcut" data-range="start-week">С начала недели</button>
              <button type="button" class="arz-btn-shortcut" data-range="start-month">С начала месяца</button>
              <button type="button" class="arz-btn-shortcut" data-range="start-year">С начала года</button>
            </div>
            <div class="arz-modal-form-group" style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="arz-online-stealth" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--az-accent);">
              <label for="arz-online-stealth" class="arz-modal-label" style="margin: 0; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                <i class="fa-solid fa-user-secret"></i> Скрытный режим (анализ общих логов)
              </label>
            </div>
            <div class="arz-accordion">
              <div class="arz-accordion-header">
                <div class="arz-accordion-header-left"><i class="fa-solid fa-filter"></i> <span>Чистый онлайн</span></div>
                <i class="fa-solid fa-chevron-down arz-accordion-chevron"></i>
              </div>
              <div class="arz-accordion-content">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--az-text-secondary);"><i class="fa-solid fa-circle-info"></i> Учитывать только указанный промежуток суток</div>
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  <span style="font-size: 12px; color: var(--az-text); min-width: 70px;">Будние дни</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="time" id="arz-online-wd-from" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                    <span style="color: var(--az-text-secondary);">-</span>
                    <input type="time" id="arz-online-wd-to" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                  </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  <span style="font-size: 12px; color: var(--az-text); min-width: 70px;">Выходные</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="time" id="arz-online-we-from" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                    <span style="color: var(--az-text-secondary);">-</span>
                    <input type="time" id="arz-online-we-to" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button data-action="cancel" class="arz-btn-danger" style="flex: 1;">Закрыть</button>
            <button data-action="start" class="arz-btn-primary" style="flex: 1;">Пробить онлайн</button>
          </div>
        </div>
      </div>
    `;

    function parseHHMM(str) {
      if (!str) return null;
      const p = str.split(':');
      if (p.length < 2) return null;
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    }

    function parseDate(str) {
      str = (str || '').trim();
      let d = new Date(str);
      if (!isNaN(d.getTime())) return d;
      const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
      return null;
    }

    function calculateOnlineFromSessions(sessions, player, dateFrom, dateTo) {
      const wdFrom = parseHHMM(localStorage.getItem('arz-clean-weekday-from'));
      const wdTo = parseHHMM(localStorage.getItem('arz-clean-weekday-to'));
      const weFrom = parseHHMM(localStorage.getItem('arz-clean-weekend-from'));
      const weTo = parseHHMM(localStorage.getItem('arz-clean-weekend-to'));
      const wdWin = (wdFrom !== null && wdTo !== null) ? { fromMin: wdFrom, toMin: wdTo } : null;
      const weWin = (weFrom !== null && weTo !== null) ? { fromMin: weFrom, toMin: weTo } : null;

      const onlineByDay = {};
      let earliest = null, latest = null;

      sessions.forEach(session => {
        const { sessionEnd, rawSecs } = session;
        const isWE = sessionEnd.getDay() === 0 || sessionEnd.getDay() === 6;
        const secs = clampSession(sessionEnd, rawSecs, isWE ? weWin : wdWin);

        const day = new Date(sessionEnd.getFullYear(), sessionEnd.getMonth(), sessionEnd.getDate());
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        if (!earliest || day < earliest) earliest = day;
        if (!latest || day > latest) latest = day;
        if (secs > 0) onlineByDay[key] = (onlineByDay[key] || 0) + secs;
      });

      const currentParams = new URLSearchParams(window.location.search);
      const startP = dateFrom ? parsePeriodDate(dateFrom) : (currentParams.get('min_period') ? parsePeriodDate(currentParams.get('min_period')) : earliest);
      const endP = dateTo ? parsePeriodDate(dateTo) : (currentParams.get('max_period') ? parsePeriodDate(currentParams.get('max_period')) : latest);

      if (!startP || !endP) {
        return {
          player,
          total: 0,
          avg: '0.0',
          allDays: [],
          entries: [],
          error: 'Сессии не найдены'
        };
      }

      const allDays = [];
      const iter = new Date(startP);
      const maxIterDays = 366;
      let safetyCount = 0;
      while (iter <= endP && safetyCount < maxIterDays) {
        allDays.push(`${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, '0')}-${String(iter.getDate()).padStart(2, '0')}`);
        iter.setDate(iter.getDate() + 1);
        safetyCount++;
      }

      const entries = allDays.map(k => [k, onlineByDay[k] || 0]);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      const totalDaysCount = allDays.length;
      const avg = totalDaysCount > 0 ? (total / totalDaysCount / 3600).toFixed(1) : '0.0';

      return {
        player,
        total,
        avg,
        allDays,
        entries
      };
    }

    function calculatePlayerOnline(doc, player, dateFrom, dateTo) {
      const rows = doc.querySelectorAll('table.table tbody tr');
      const sessions = [];
      const RE = /(.*).*Игрок.*сессии:\s*([\d:]+),.*авторизация/i;

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return;
        const text = (cells[0].textContent || '').trim() + ' ' + (cells[1].textContent || '').replace(/\s+/g, ' ').trim();
        const m = RE.exec(text);
        if (!m) return;
        const sessionEnd = parseDate(m[1].trim());
        if (!sessionEnd || isNaN(sessionEnd.getTime())) return;
        const rawSecs = timeToSecs(m[2]);
        sessions.push({ sessionEnd, rawSecs });
      });

      return calculateOnlineFromSessions(sessions, player, dateFrom, dateTo);
    }

    function matchPlayerFromRow(row, nicks) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return null;
      const cell = cells[1];

      const anchors = cell.querySelectorAll('a[href*="player="]');
      for (const a of anchors) {
        const nick = a.textContent.trim();
        if (nicks.includes(nick)) return nick;
      }

      const text = cell.textContent;
      for (const nick of nicks) {
        if (text.includes(nick)) return nick;
      }
      return null;
    }

    function parsePeriodDate(str) {
      if (!str) return null;
      str = str.split(' ')[0].trim();
      let d = new Date(str);
      if (!isNaN(d.getTime())) return d;
      const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      return null;
    }

    function timeToSecs(str) {
      const [h, m, s] = (str || '0:0:0').split(':').map(Number);
      return h * 3600 + m * 60 + s;
    }

    function secsToHMS(total) {
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
    }

    function clampSession(sessionEnd, rawSecs, win) {
      if (!win) return rawSecs;
      const sessionEndMin = sessionEnd.getHours() * 60 + sessionEnd.getMinutes();
      const sessionStartMin = sessionEndMin - Math.floor(rawSecs / 60);
      const overlapStart = Math.max(sessionStartMin, win.fromMin);
      const overlapEnd = Math.min(sessionEndMin, win.toMin);
      if (overlapEnd <= overlapStart) return 0;
      return (overlapEnd - overlapStart) * 60;
    }

    function renderSingleOnlineResult(res) {
      const { player, total, avg, allDays, entries } = res;
      const copyLines = [`Онлайн игрока ${player} за ${allDays.length} дней: ${secsToHMS(total)} (~${avg} час/день)`];
      entries.forEach(([k, v]) => {
        const [y, mo, d] = k.split('-');
        copyLines.push(`${d}.${mo}.${y} → ${secsToHMS(v)}`);
      });

      let rowsHtml = '';
      entries.forEach(([k, v]) => {
        const [y, mo, d] = k.split('-');
        rowsHtml += `<tr><td style="padding: 8px 20px; font-family: monospace; font-size: 13px; color: ${v > 0 ? 'var(--az-text)' : 'var(--az-text-secondary)'}; border-bottom: 1px solid var(--az-border);">${d}.${mo}.${y}</td><td style="padding: 8px 20px; font-family: monospace; font-size: 13px; font-weight: 600; color: ${v > 0 ? 'var(--az-accent-hover)' : 'var(--az-text-secondary)'}; border-bottom: 1px solid var(--az-border);">${secsToHMS(v)}</td></tr>`;
      });

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 480px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-clock"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результат расчета</div>
              <div class="arz-modal-subtitle" style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span class="player-nick" style="color: #ffffff; font-weight: 600; background: var(--az-accent); padding: 2px 8px; border-radius: 12px; font-size: 11px;">${player}</span>
                <span>Онлайн по дням</span>
              </div>
            </div>
            <button id="arz-online-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-stats" style="text-align: center; padding: 20px; background: var(--az-table-row-hover); border-bottom: 1px solid var(--az-border);">
            <div class="online-result-total" style="font-size: 38px; font-weight: 700; color: var(--az-accent-hover); font-family: monospace;">${secsToHMS(total)}</div>
            <div class="online-result-sub" style="color: var(--az-text-secondary); font-size: 13px; margin-top: 6px;">за <strong>${allDays.length}</strong> дн. · <strong>${avg}</strong> ч/день</div>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);"><table class="online-result-table" style="width: 100%; border-collapse: collapse;"><thead><tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0;"><th style="text-align: left; padding: 12px 20px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Дата</th><th style="text-align: left; padding: 12px 20px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Онлайн</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
          <div class="arz-modal-footer">
            <button id="arz-online-copy-btn" class="arz-btn-primary" style="flex: 1;"><i class="fa-regular fa-copy"></i> Копировать</button>
            <button id="arz-online-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый расчет</button>
            <button id="arz-online-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;
      openOverlay(overlay);
      overlay.querySelector('#arz-online-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-online-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);
      overlay.querySelector('#arz-online-copy-btn').onclick = () => {
        navigator.clipboard.writeText(copyLines.join('\n')).then(() => {
          overlay.querySelector('#arz-online-copy-btn').innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => overlay.querySelector('#arz-online-copy-btn').innerHTML = '<i class="fa-regular fa-copy"></i> Копировать', 2000);
        });
      };
      overlay.querySelector('#arz-online-reopen-btn').onclick = () => { closeOverlay(overlay); window.ArizonaLookupManager.openModal('online'); };

    }

    async function calculate() {
      const params = new URLSearchParams(window.location.search);
      const player = params.get('player') || 'Не указан';
      const dateFrom = params.get('min_period');
      const dateTo = params.get('max_period');

      const res = calculatePlayerOnline(document, player, dateFrom, dateTo);
      if (res.error) {
        window.ArizonaNotifications.show(res.error, 'error');
        return;
      }
      renderSingleOnlineResult(res);
    }

    async function processStealthOnline(nicks, dateFrom, dateTo) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Скрытный расчет</div>
              <div class="arz-modal-subtitle">Анализ общих логов выхода...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-player" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Загрузка страниц...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Загружено страниц: 0</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 100%; height: 100%; background: var(--az-accent); border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Сбор данных отменен', 'warning');
      };

      const playerSessions = {};
      nicks.forEach(nick => {
        playerSessions[nick] = [];
      });

      const RE = /(.*).*Игрок.*сессии:\s*([\d:]+),.*авторизация/i;

      let page = 1;
      let hasMore = true;
      let totalFound = 0;

      const fetchUrl = new URL(window.location.href);
      fetchUrl.searchParams.delete('player');
      fetchUrl.searchParams.set('type[]', 'disconnect');
      fetchUrl.searchParams.set('limit', '1000');
      fetchUrl.searchParams.set('sort', 'desc');
      fetchUrl.searchParams.delete('arz_online');
      if (dateFrom) fetchUrl.searchParams.set('min_period', dateFrom + ' 00:00:00');
      if (dateTo) fetchUrl.searchParams.set('max_period', dateTo + ' 23:59:59');

      while (hasMore && !cancelBatch) {
        statusTextEl.textContent = `Загружено страниц: ${page - 1} · Найдено сессий: ${totalFound}`;

        try {
          fetchUrl.searchParams.set('page', page);
          const response = await fetchWithRetry(fetchUrl.href);
          if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
          }
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, 'text/html');

          const rows = doc.querySelectorAll('table.table tbody tr');
          if (rows.length === 0) {
            hasMore = false;
            break;
          }

          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;
            const text = (cells[0].textContent || '').trim() + ' ' + (cells[1].textContent || '').replace(/\s+/g, ' ').trim();
            const m = RE.exec(text);
            if (!m) return;

            const matchedNick = matchPlayerFromRow(row, nicks);
            if (matchedNick) {
              const sessionEnd = parseDate(m[1].trim());
              if (sessionEnd && !isNaN(sessionEnd.getTime())) {
                const rawSecs = timeToSecs(m[2]);
                playerSessions[matchedNick].push({ sessionEnd, rawSecs });
                totalFound++;
              }
            }
          });

          let hasNextPage = false;
          const nextAnchor = doc.querySelector('a[rel="next"], a[aria-label*="Next"], a[aria-label*="next"], .pagination a[class*="next"], .page-item a[class*="next"]');
          if (nextAnchor) {
            hasNextPage = true;
          }
          if (!hasNextPage) {
            const nextPageQuery = `page=${page + 1}`;
            hasNextPage = Array.from(doc.querySelectorAll('a[href*="page="]')).some(a => {
              const href = a.getAttribute('href') || '';
              return href.includes(nextPageQuery);
            });
          }
          if (!hasNextPage) {
            const nextPageStr = String(page + 1);
            hasNextPage = Array.from(doc.querySelectorAll('.pagination a, ul.pagination a, li.page-item a')).some(a => {
              return a.textContent.trim() === nextPageStr;
            });
          }

          console.log(`Stealth Mode: processed page ${page}, found ${rows.length} rows, hasNextPage=${hasNextPage}`);

          if (!hasNextPage) {
            hasMore = false;
          }

          page++;
          await new Promise(r => setTimeout(r, 200));

        } catch (err) {
          console.error(`Stealth fetch error on page ${page}:`, err);
          window.ArizonaNotifications.show(`Ошибка на странице ${page}: ${err.message}`, 'error');
          hasMore = false;
        }
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        const results = nicks.map(nick => {
          const sessions = playerSessions[nick];
          return calculateOnlineFromSessions(sessions, nick, dateFrom, dateTo);
        });

        if (results.length === 1) {
          if (results[0].error) {
            window.ArizonaNotifications.show(results[0].error, 'error');
          } else {
            renderSingleOnlineResult(results[0]);
          }
        } else {
          showMultiResultsModal(results);
        }
      }
    }

    async function processMultiplePlayers(nicks, dateFrom, dateTo) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробитие онлайна</div>
              <div class="arz-modal-subtitle">Сбор данных игроков...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-player" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Запуск...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Подготовка запросов</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 0%; height: 100%; background: var(--az-accent); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const playerTextEl = progressOverlay.querySelector('#arz-progress-player');
      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const barFillEl = progressOverlay.querySelector('#arz-progress-bar-fill');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Сбор данных отменен', 'warning');
      };

      const results = [];
      for (let i = 0; i < nicks.length; i++) {
        if (cancelBatch) break;
        const player = nicks[i];

        playerTextEl.textContent = player;
        statusTextEl.textContent = `Загрузка данных (${i + 1} из ${nicks.length})`;
        barFillEl.style.width = `${Math.round((i / nicks.length) * 100)}%`;

        try {
          const fetchUrl = new URL(window.location.href);
          fetchUrl.searchParams.set('player', player);
          fetchUrl.searchParams.set('type[]', 'disconnect');
          fetchUrl.searchParams.set('limit', '1000');
          fetchUrl.searchParams.set('sort', 'asc');
          fetchUrl.searchParams.delete('arz_online');
          if (dateFrom) fetchUrl.searchParams.set('min_period', dateFrom + ' 00:00:00');
          if (dateTo) fetchUrl.searchParams.set('max_period', dateTo + ' 23:59:59');

          const response = await fetchWithRetry(fetchUrl.href);
          if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
          }
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, 'text/html');

          const res = calculatePlayerOnline(doc, player, dateFrom, dateTo);
          results.push(res);
        } catch (err) {
          console.error(`Error fetching online for ${player}:`, err);
          results.push({
            player,
            total: 0,
            avg: '0.0',
            allDays: [],
            entries: [],
            error: err.message || 'Ошибка загрузки'
          });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        if (results.length === 1) {
          if (results[0].error) {
            window.ArizonaNotifications.show(results[0].error, 'error');
          } else {
            renderSingleOnlineResult(results[0]);
          }
        } else {
          showMultiResultsModal(results);
        }
      }
    }

    function showMultiResultsModal(results) {
      let rowsHtml = '';
      results.forEach((res, index) => {
        const hasError = !!res.error;
        const totalStr = hasError ? `<span style="color: var(--az-danger); font-size: 12px;">${res.error}</span>` : secsToHMS(res.total);
        const avgStr = hasError ? '-' : `${res.avg} ч/день`;

        let detailsHtml = '';
        if (!hasError && res.entries && res.entries.length > 0) {
          let detailRows = '';
          res.entries.forEach(([k, v]) => {
            const [y, mo, d] = k.split('-');
            detailRows += `
              <div style="display: flex; justify-content: space-between; padding: 6px 20px; font-family: monospace; font-size: 12px; border-bottom: 1px solid var(--az-border);">
                <span style="color: var(--az-text-secondary);">${d}.${mo}.${y}</span>
                <span style="color: ${v > 0 ? 'var(--az-accent-hover)' : 'var(--az-text-secondary)'}; font-weight: 500;">${secsToHMS(v)}</span>
              </div>
            `;
          });
          detailsHtml = `
            <tr id="arz-details-row-${index}" class="arz-details-row" style="display: none; background: var(--az-input-bg);">
              <td colspan="4" style="padding: 0; border-bottom: 1px solid var(--az-border);">
                <div style="max-height: 180px; overflow-y: auto; padding: 4px 0;">
                  ${detailRows}
                </div>
              </td>
            </tr>
          `;
        }

        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border); cursor: pointer;" class="arz-player-row" data-index="${index}">
            <td style="padding: 12px 16px; font-weight: 600; color: var(--az-text); font-size: 13px;">
              <span class="arz-toggle-details-btn" style="margin-right: 8px; color: var(--az-text-secondary);"><i class="fa-solid fa-chevron-right"></i></span>
              ${res.player}
            </td>
            <td style="padding: 12px 16px; font-family: monospace; font-weight: 700; color: ${hasError ? 'var(--az-danger)' : 'var(--az-accent-hover)'}; font-size: 14px;">
              ${totalStr}
            </td>
            <td style="padding: 12px 16px; font-size: 13px; color: var(--az-text-secondary);">
              ${avgStr}
            </td>
            <td style="padding: 12px 16px; text-align: right;">
              <button class="arz-btn-icon arz-copy-single-btn" data-index="${index}" title="Копировать онлайн игрока" style="background: none; border: none; color: var(--az-text-secondary); cursor: pointer; padding: 4px 8px; font-size: 14px; transition: color 0.2s;"><i class="fa-regular fa-copy"></i></button>
            </td>
          </tr>
          ${detailsHtml}
        `;
      });

      const allPlayersSummaryLines = ['Суммарный онлайн игроков:'];
      results.forEach((res, i) => {
        if (res.error) {
          allPlayersSummaryLines.push(`${i + 1}. ${res.player} - ${res.error}`);
        } else {
          allPlayersSummaryLines.push(`${i + 1}. ${res.player} - ${secsToHMS(res.total)} (~${res.avg} ч/день, за ${res.allDays.length} дн.)`);
        }
      });
      const allPlayersSummaryText = allPlayersSummaryLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 600px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-users"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результаты расчета</div>
              <div class="arz-modal-subtitle">Сводный онлайн игроков</div>
            </div>
            <button id="arz-online-multi-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Игрок</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Суммарный онлайн</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Средний</th>
                  <th style="text-align: right; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 50px;">Копировать</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-online-multi-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать весь онлайн</button>
            <button id="arz-online-multi-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый расчет</button>
            <button id="arz-online-multi-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);

      overlay.querySelector('#arz-online-multi-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-online-multi-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);


      overlay.querySelector('#arz-online-multi-reopen-btn').onclick = () => {
        closeOverlay(overlay);
        window.ArizonaLookupManager.openModal('online');
      };

      overlay.querySelector('#arz-online-multi-copy-btn').onclick = () => {
        navigator.clipboard.writeText(allPlayersSummaryText).then(() => {
          const btn = overlay.querySelector('#arz-online-multi-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать весь онлайн', 2000);
        });
      };

      overlay.querySelectorAll('.arz-player-row').forEach(row => {
        row.onclick = (e) => {
          if (e.target.closest('.arz-copy-single-btn')) return;

          const index = row.getAttribute('data-index');
          const detailsRow = overlay.querySelector(`#arz-details-row-${index}`);
          if (detailsRow) {
            const isVisible = detailsRow.style.display !== 'none';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';
            const icon = row.querySelector('.arz-toggle-details-btn i');
            if (icon) {
              icon.className = isVisible ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down';
            }
          }
        };
      });

      overlay.querySelectorAll('.arz-copy-single-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const index = parseInt(btn.getAttribute('data-index'), 10);
          const res = results[index];
          if (!res) return;

          let textToCopy = '';
          if (res.error) {
            textToCopy = `${res.player}: ${res.error}`;
          } else {
            const singleLines = [`Онлайн игрока ${res.player} за ${res.allDays.length} дней: ${secsToHMS(res.total)} (~${res.avg} час/день)`];
            res.entries.forEach(([k, v]) => {
              const [y, mo, d] = k.split('-');
              singleLines.push(`${d}.${mo}.${y} → ${secsToHMS(v)}`);
            });
            textToCopy = singleLines.join('\n');
          }

          navigator.clipboard.writeText(textToCopy).then(() => {
            const icon = btn.querySelector('i');
            icon.className = 'fa-solid fa-check';
            btn.style.color = 'var(--az-success)';
            setTimeout(() => {
              icon.className = 'fa-regular fa-copy';
              btn.style.color = 'var(--az-text-secondary)';
            }, 2000);
          });
        };
      });
    }

    function openModal() {
      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = modalHTML;
      openOverlay(overlay);

      const params = new URLSearchParams(window.location.search);
      const urlMin = params.get('min_period');
      const urlMax = params.get('max_period');
      if (urlMin) {
        overlay.querySelector('#arz-online-date-from').value = urlMin.split(' ')[0];
      }
      if (urlMax) {
        overlay.querySelector('#arz-online-date-to').value = urlMax.split(' ')[0];
      }
      const urlPlayer = params.get('player');
      if (urlPlayer) {
        overlay.querySelector('#arz-online-nicks').value = urlPlayer;
      }

      overlay.querySelector('#arz-online-wd-from').value = localStorage.getItem('arz-clean-weekday-from') || '';
      overlay.querySelector('#arz-online-wd-to').value = localStorage.getItem('arz-clean-weekday-to') || '';
      overlay.querySelector('#arz-online-we-from').value = localStorage.getItem('arz-clean-weekend-from') || '';
      overlay.querySelector('#arz-online-we-to').value = localStorage.getItem('arz-clean-weekend-to') || '';

      const isStealth = localStorage.getItem('arz-online-stealth-enabled') === 'true';
      overlay.querySelector('#arz-online-stealth').checked = isStealth;

      const contentEl = overlay.querySelector('.arz-accordion-content');
      const chevron = overlay.querySelector('.arz-accordion-chevron');
      overlay.querySelector('.arz-accordion-header').onclick = () => {
        const show = contentEl.style.display === 'none' || contentEl.style.display === '';
        contentEl.style.display = show ? 'flex' : 'none';
        chevron.style.transform = show ? 'rotate(180deg)' : '';
      };

      setupDateShortcuts(overlay, 'arz-online-date-from', 'arz-online-date-to');

      overlay.querySelectorAll('[data-action="cancel"]').forEach(btn => btn.onclick = () => closeOverlay(overlay));
      overlay.querySelector('[data-action="start"]').onclick = () => {
        const nicksVal = overlay.querySelector('#arz-online-nicks').value.trim();
        const nicks = nicksVal.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);

        if (nicks.length === 0) {
          window.ArizonaNotifications.show('Введите хотя бы один ник', 'error');
          return;
        }

        const dateFrom = overlay.querySelector('#arz-online-date-from').value;
        const dateTo = overlay.querySelector('#arz-online-date-to').value;
        const cleanOn = contentEl.style.display === 'flex';
        const stealthOn = overlay.querySelector('#arz-online-stealth').checked;

        localStorage.setItem('arz-clean-weekday-from', cleanOn ? overlay.querySelector('#arz-online-wd-from').value.trim() : '');
        localStorage.setItem('arz-clean-weekday-to', cleanOn ? overlay.querySelector('#arz-online-wd-to').value.trim() : '');
        localStorage.setItem('arz-clean-weekend-from', cleanOn ? overlay.querySelector('#arz-online-we-from').value.trim() : '');
        localStorage.setItem('arz-clean-weekend-to', cleanOn ? overlay.querySelector('#arz-online-we-to').value.trim() : '');
        localStorage.setItem('arz-online-stealth-enabled', stealthOn ? 'true' : 'false');

        closeOverlay(overlay);
        if (stealthOn) {
          processStealthOnline(nicks, dateFrom, dateTo);
        } else {
          processMultiplePlayers(nicks, dateFrom, dateTo);
        }
      };

    }

    return {
      init: function (s) {
        settings = s || {};
        if (settings.tools?.online !== false) {
          this.checkAutoCalculation();
        }
      },
      updateSettings: function (s) {
        settings = s || {};
        if (settings.tools?.online !== false) {
          this.checkAutoCalculation();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-online-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-online-btn';
        btn.className = 'btn btn-success';
        btn.style.cssText = 'margin-left: 10px;';
        btn.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="margin-right:6px;"></i> Онлайн`;
        btn.onclick = openModal;
        container.appendChild(btn);
      },
      checkAutoCalculation: function () {
        const params = new URLSearchParams(window.location.search);
        if (params.get('arz_online') === '1' && !calculated) {
          calculated = true;
          setTimeout(calculate, 1000);
        }
      },
      processStealthOnline: processStealthOnline,
      processMultiplePlayers: processMultiplePlayers
    };
  })();

  window.ArizonaPunishmentManager = (function () {
    let settings = {};
    let calculated = false;

    const PUNISHMENT_TYPES = [
      'cmd_unadeldesc', 'cmd_adeldesc', 'bail', 'undriveban', 'driveban',
      'ungunban', 'gunban', 'remove_autoads', 'rmute', 'unrmute',
      'apunish', 'skick', 'weap', 'ban', 'banip', 'banipoff',
      'jail', 'kpz', 'mute', 'unban', 'unbanip', 'unjail',
      'unmute', 'unwarn', 'warn'
    ];

    const modalHTML = `
      <div id="arz-punish-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-gavel"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробив наказаний</div>
              <div class="arz-modal-subtitle">Анализ истории наказаний</div>
            </div>
            <button data-action="cancel" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="arz-modal-body">
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="arz-modal-label" style="margin: 0;"><i class="fa-solid fa-users"></i> Ник(и) игрока(ов)</label>
                <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px;">Введено: <strong id="arz-punish-count-num" style="color: var(--az-accent-hover);">0</strong></span>
              </div>
              <textarea id="arz-punish-nicks" class="arz-textarea" rows="3" placeholder="Введите один или несколько ников (каждый с новой строки или через запятую)"></textarea>
            </div>
            <div style="display: flex; gap: 12px; width: 100%; box-sizing: border-box;">
              <div class="arz-modal-form-group" style="flex: 1;">
                <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата от</label>
                <input type="date" id="arz-punish-date-from" class="arz-input">
              </div>
              <div class="arz-modal-form-group" style="flex: 1;">
                <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата до</label>
                <input type="date" id="arz-punish-date-to" class="arz-input">
              </div>
            </div>
            <div class="arz-date-shortcuts" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; width: 100% !important; box-sizing: border-box !important; margin-top: -4px !important;">
              <button type="button" class="arz-btn-shortcut" data-range="day">За день</button>
              <button type="button" class="arz-btn-shortcut" data-range="week">За неделю</button>
              <button type="button" class="arz-btn-shortcut" data-range="month">За месяц</button>
              <button type="button" class="arz-btn-shortcut" data-range="start-week">С начала недели</button>
              <button type="button" class="arz-btn-shortcut" data-range="start-month">С начала месяца</button>
              <button type="button" class="arz-btn-shortcut" data-range="start-year">С начала года</button>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button data-action="cancel" class="arz-btn-danger" style="flex: 1;">Закрыть</button>
            <button data-action="start" class="arz-btn-primary" style="flex: 1;">Пробить</button>
          </div>
        </div>
      </div>
    `;

    function parsePeriodDate(str) {
      if (!str) return null;
      str = str.split(' ')[0].trim();
      let d = new Date(str);
      if (!isNaN(d.getTime())) return d;
      const m = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      return null;
    }

    function parsePlayerPunishments(doc, player) {
      const rows = doc.querySelectorAll('table.table tbody tr');
      const punishments = [];

      rows.forEach(row => {
        const cells = row.cells;
        if (cells.length < 2) return;
        const date = (cells[0].textContent || '').trim();
        const action = (cells[1].textContent || '').trim();
        const actionText = action.replace(/\s+/g, ' ').trim();
        const ip = cells[3] ? (cells[3].textContent || '').trim() : '';
        const cleanIp = ip.replace(/\s+/g, ' ').trim();

        punishments.push({
          date,
          action: actionText,
          ip: cleanIp
        });
      });

      return {
        player,
        punishments,
        error: rows.length === 0 ? 'Наказаний не найдено' : null
      };
    }

    async function calculate() {
      const doc = document;
      const params = new URLSearchParams(window.location.search);
      const player = params.get('player') || 'Не указан';
      const res = parsePlayerPunishments(doc, player);

      if (res.punishments.length === 0) {
        window.ArizonaNotifications.show('Наказаний не найдено', 'info');
        return;
      }

      showSingleResultsModal(res);
    }

    function showSingleResultsModal(res) {
      let rowsHtml = '';
      const copyLines = [`Наказания игрока ${res.player}:`];

      res.punishments.forEach(p => {
        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border);">
            <td style="padding: 10px 16px; font-family: monospace; font-size: 13px; color: var(--az-text-secondary); white-space: nowrap;">${p.date}</td>
            <td style="padding: 10px 16px; font-weight: 600; color: var(--az-accent-hover); font-size: 13px; line-height: 1.4;">${p.action}</td>
          </tr>
        `;
        copyLines.push(`${p.date} | ${p.action}`);
      });
      const copyText = copyLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 650px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-gavel"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">История наказаний</div>
              <div class="arz-modal-subtitle" style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span style="color: #ffffff; font-weight: 600; background: var(--az-accent); padding: 2px 8px; border-radius: 12px; font-size: 11px;">${res.player}</span>
                <span>Найдено: ${res.punishments.length}</span>
              </div>
            </div>
            <button id="arz-punish-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 150px;">Дата</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Содержимое лога</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-punish-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Копировать наказания</button>
            <button id="arz-punish-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый пробив</button>
            <button id="arz-punish-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);
      overlay.querySelector('#arz-punish-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-punish-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);
      overlay.querySelector('#arz-punish-copy-btn').onclick = () => {
        navigator.clipboard.writeText(copyText).then(() => {
          const btn = overlay.querySelector('#arz-punish-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Копировать наказания', 2000);
        });
      };
      overlay.querySelector('#arz-punish-reopen-btn').onclick = () => { closeOverlay(overlay); window.ArizonaLookupManager.openModal('punish'); };

    }

    async function processMultiplePlayers(nicks, dateFrom, dateTo) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper" style="background: rgba(var(--az-warning-rgb), 0.12); color: var(--az-warning);"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробив наказаний</div>
              <div class="arz-modal-subtitle">Сбор наказаний игроков...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-player" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Запуск...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Подготовка запросов</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 0%; height: 100%; background: var(--az-warning); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const playerTextEl = progressOverlay.querySelector('#arz-progress-player');
      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const barFillEl = progressOverlay.querySelector('#arz-progress-bar-fill');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Сбор данных отменен', 'warning');
      };

      const results = [];
      for (let i = 0; i < nicks.length; i++) {
        if (cancelBatch) break;
        const player = nicks[i];

        playerTextEl.textContent = player;
        statusTextEl.textContent = `Загрузка данных (${i + 1} из ${nicks.length})`;
        barFillEl.style.width = `${Math.round((i / nicks.length) * 100)}%`;

        try {
          const fetchUrl = new URL(window.location.href);
          fetchUrl.searchParams.set('player', player);

          fetchUrl.searchParams.delete('type[]');
          PUNISHMENT_TYPES.forEach(t => {
            fetchUrl.searchParams.append('type[]', t);
          });

          fetchUrl.searchParams.set('limit', '1000');
          fetchUrl.searchParams.set('sort', 'desc');
          fetchUrl.searchParams.delete('arz_online');
          fetchUrl.searchParams.delete('arz_punish');

          if (dateFrom) fetchUrl.searchParams.set('min_period', dateFrom + ' 00:00:00');
          if (dateTo) fetchUrl.searchParams.set('max_period', dateTo + ' 23:59:59');

          const response = await fetchWithRetry(fetchUrl.href);
          if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
          }
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, 'text/html');

          const res = parsePlayerPunishments(doc, player);
          results.push(res);
        } catch (err) {
          console.error(`Error fetching punishments for ${player}:`, err);
          results.push({
            player,
            punishments: [],
            error: err.message || 'Ошибка загрузки'
          });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        if (results.length === 1) {
          if (results[0].punishments.length === 0 && !results[0].error) {
            window.ArizonaNotifications.show('Наказаний не найдено', 'info');
          } else if (results[0].error) {
            window.ArizonaNotifications.show(results[0].error, 'error');
          } else {
            showSingleResultsModal(results[0]);
          }
        } else {
          showMultiResultsModal(results);
        }
      }
    }

    function showMultiResultsModal(results) {
      let rowsHtml = '';
      results.forEach((res, index) => {
        const hasError = !!res.error;
        const hasPunishments = res.punishments && res.punishments.length > 0;
        const countStr = hasError ? `<span style="color: var(--az-danger); font-size: 12px;">${res.error}</span>` : `${res.punishments.length} наказ.`;

        let detailsHtml = '';
        if (hasPunishments) {
          let detailRows = '';
          res.punishments.forEach(p => {
            detailRows += `
              <div style="display: flex; flex-direction: column; padding: 8px 20px; border-bottom: 1px solid var(--az-border); gap: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; align-items: center;">
                  <span style="color: var(--az-text-secondary); font-family: monospace;">${p.date}</span>
                </div>
                <div style="color: var(--az-accent-hover); font-weight: 600; font-size: 13px; line-height: 1.4;">${p.action}</div>
              </div>
            `;
          });
          detailsHtml = `
            <tr id="arz-punish-details-row-${index}" class="arz-details-row" style="display: none; background: var(--az-table-row-hover);">
              <td colspan="4" style="padding: 0; border-bottom: 1px solid var(--az-border);">
                <div style="max-height: 250px; overflow-y: auto; padding: 4px 0;">
                  ${detailRows}
                </div>
              </td>
            </tr>
          `;
        }

        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border); cursor: pointer;" class="arz-player-row" data-index="${index}">
            <td style="padding: 12px 16px; font-weight: 600; color: var(--az-text); font-size: 13px;">
              <span class="arz-toggle-details-btn" style="margin-right: 8px; color: var(--az-text-secondary);"><i class="fa-solid fa-chevron-right"></i></span>
              ${res.player}
            </td>
            <td style="padding: 12px 16px; font-weight: 700; color: ${hasError ? 'var(--az-text-secondary)' : 'var(--az-accent-hover)'}; font-size: 13px;">
              ${countStr}
            </td>
            <td style="padding: 12px 16px; text-align: right;">
              <button class="arz-btn-icon arz-copy-single-punish-btn" data-index="${index}" title="Копировать наказания игрока" style="background: none; border: none; color: var(--az-text-secondary); cursor: pointer; padding: 4px 8px; font-size: 14px; transition: color 0.2s;"><i class="fa-regular fa-copy"></i></button>
            </td>
          </tr>
          ${detailsHtml}
        `;
      });

      const allPlayersSummaryLines = ['Сводка наказаний игроков:'];
      results.forEach((res) => {
        allPlayersSummaryLines.push(`\nИгрок: ${res.player}`);
        if (res.error) {
          allPlayersSummaryLines.push(`- ${res.error}`);
        } else if (res.punishments && res.punishments.length > 0) {
          res.punishments.forEach(p => {
            allPlayersSummaryLines.push(`- [${p.date}] [${p.action}]`);
          });
        } else {
          allPlayersSummaryLines.push(`- Наказаний не найдено`);
        }
      });
      const allPlayersSummaryText = allPlayersSummaryLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 650px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-gavel"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результаты расчета</div>
              <div class="arz-modal-subtitle">Наказания игроков</div>
            </div>
            <button id="arz-punish-multi-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Игрок</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Наказания</th>
                  <th style="text-align: right; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 50px;">Копировать</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-punish-multi-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать все наказания</button>
            <button id="arz-punish-multi-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый пробив</button>
            <button id="arz-punish-multi-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);

      overlay.querySelector('#arz-punish-multi-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-punish-multi-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);


      overlay.querySelector('#arz-punish-multi-reopen-btn').onclick = () => {
        closeOverlay(overlay);
        window.ArizonaLookupManager.openModal('punish');
      };

      overlay.querySelector('#arz-punish-multi-copy-btn').onclick = () => {
        navigator.clipboard.writeText(allPlayersSummaryText).then(() => {
          const btn = overlay.querySelector('#arz-punish-multi-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать все наказания', 2000);
        });
      };

      overlay.querySelectorAll('.arz-player-row').forEach(row => {
        row.onclick = (e) => {
          if (e.target.closest('.arz-copy-single-punish-btn')) return;

          const index = row.getAttribute('data-index');
          const detailsRow = overlay.querySelector(`#arz-punish-details-row-${index}`);
          if (detailsRow) {
            const isVisible = detailsRow.style.display !== 'none';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';
            const icon = row.querySelector('.arz-toggle-details-btn i');
            if (icon) {
              icon.className = isVisible ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down';
            }
          }
        };
      });

      overlay.querySelectorAll('.arz-copy-single-punish-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const index = parseInt(btn.getAttribute('data-index'), 10);
          const res = results[index];
          if (!res) return;

          let textToCopy = '';
          if (res.error) {
            textToCopy = `${res.player}: ${res.error}`;
          } else {
            const singleLines = [`Наказания игрока ${res.player}:`];
            res.punishments.forEach(p => {
              singleLines.push(`- [${p.date}] [${p.action}]`);
            });
            textToCopy = singleLines.join('\n');
          }

          navigator.clipboard.writeText(textToCopy).then(() => {
            const icon = btn.querySelector('i');
            icon.className = 'fa-solid fa-check';
            btn.style.color = 'var(--az-success)';
            setTimeout(() => {
              icon.className = 'fa-regular fa-copy';
              btn.style.color = 'var(--az-text-secondary)';
            }, 2000);
          });
        };
      });
    }

    function openModal() {
      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = modalHTML;
      openOverlay(overlay);

      const params = new URLSearchParams(window.location.search);
      const urlMin = params.get('min_period');
      const urlMax = params.get('max_period');
      if (urlMin) {
        overlay.querySelector('#arz-punish-date-from').value = urlMin.split(' ')[0];
      }
      if (urlMax) {
        overlay.querySelector('#arz-punish-date-to').value = urlMax.split(' ')[0];
      }
      const urlPlayer = params.get('player');
      if (urlPlayer) {
        overlay.querySelector('#arz-punish-nicks').value = urlPlayer;
      }

      setupDateShortcuts(overlay, 'arz-punish-date-from', 'arz-punish-date-to');

      overlay.querySelectorAll('[data-action="cancel"]').forEach(btn => btn.onclick = () => closeOverlay(overlay));
      overlay.querySelector('[data-action="start"]').onclick = () => {
        const nicksVal = overlay.querySelector('#arz-punish-nicks').value.trim();
        const nicks = nicksVal.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);

        if (nicks.length === 0) {
          window.ArizonaNotifications.show('Введите хотя бы один ник', 'error');
          return;
        }

        const dateFrom = overlay.querySelector('#arz-punish-date-from').value;
        const dateTo = overlay.querySelector('#arz-punish-date-to').value;

        closeOverlay(overlay);
        processMultiplePlayers(nicks, dateFrom, dateTo);
      };

    }

    return {
      init: function (s) {
        settings = s || {};
        if (settings.tools?.online !== false && settings.tools?.punishment !== false) {
          this.checkAutoCalculation();
        }
      },
      updateSettings: function (s) {
        settings = s || {};
        if (settings.tools?.online !== false && settings.tools?.punishment !== false) {
          this.checkAutoCalculation();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-punish-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-punish-btn';
        btn.className = 'btn btn-warning';
        btn.style.cssText = 'margin-left: 10px; color: white !important;';
        btn.innerHTML = `<i class="fa-solid fa-gavel" style="margin-right:6px;"></i> Наказания`;
        btn.onclick = openModal;
        container.appendChild(btn);
      },
      checkAutoCalculation: function () {
        const params = new URLSearchParams(window.location.search);
        if (params.get('arz_punish') === '1' && !calculated) {
          calculated = true;
          setTimeout(calculate, 1000);
        }
      },
      processMultiplePlayers: processMultiplePlayers
    };
  })();

  window.ArizonaLoadMoreManager = (function () {
    let settings = {};
    let isLoading = false;

    function updateTopPagination() {
      const enabled = currentSettings['extension-toggle'] !== false && settings.tools?.duplicatePaginationTop !== false;
      const old = document.getElementById('arz-top-pagination');
      const bottom = document.querySelector('nav[role="navigation"]:not(#arz-top-pagination)');
      const table = document.querySelector('table.table');
      const host = table?.closest('.table-responsive') || table?.parentElement;
      if (!enabled) { old?.remove(); return; }
      if (!bottom || !table || !host) return;

      const top = bottom.cloneNode(true);
      top.id = 'arz-top-pagination';

      const topLoadMore = top.querySelector('#arz-load-more-btn');
      if (topLoadMore) {
        topLoadMore.id = 'arz-load-more-btn-top';
        topLoadMore.onclick = () => loadNextPage();
      } else if (currentSettings['tweak-load-more'] !== false) {
        const bottomBtn = bottom.querySelector('#arz-load-more-btn');
        if (bottomBtn) {
          const btn = bottomBtn.cloneNode(true);
          btn.id = 'arz-load-more-btn-top';
          btn.onclick = () => loadNextPage();
          const paginationUl = top.querySelector('.pagination');
          if (paginationUl) paginationUl.parentElement.insertBefore(btn, paginationUl);
        }
      }

      const bottomList = bottom.querySelector('.pagination');
      const topList = top.querySelector('.pagination');
      if (topList && bottomList) topList.innerHTML = bottomList.innerHTML;

      if (old) old.remove();
      host.insertBefore(top, table);
    }

    function getNextPageUrl(doc = document) {
      const nextBtn = doc.querySelector('.pagination a[aria-label*="Вперёд"], .pagination a[aria-label*="Next"]');
      if (nextBtn && nextBtn.href && !nextBtn.closest('li').classList.contains('disabled')) {
        return nextBtn.href;
      }

      const activeLi = doc.querySelector('.pagination li.page-item.active');
      if (activeLi) {
        const nextLi = activeLi.nextElementSibling;
        if (nextLi && !nextLi.classList.contains('disabled')) {
          const a = nextLi.querySelector('a');
          if (a && a.href && a.href !== '#' && !a.href.startsWith('javascript:')) {
            return a.href;
          }
        }
      }
      return null;
    }

    function injectButton() {
      const isEnabled = currentSettings['extension-toggle'] !== false && currentSettings['tweak-load-more'] !== false;
      const existingBtn = document.getElementById('arz-load-more-btn');

      if (!isEnabled) {
        if (existingBtn) existingBtn.remove();
        return;
      }

      const nextPageUrl = getNextPageUrl();
      if (!nextPageUrl) {
        if (existingBtn) existingBtn.remove();
        return;
      }

      const nav = document.querySelector('nav[role="navigation"]');
      if (!nav) return;

      const paginationUl = nav.querySelector('.pagination');
      if (!paginationUl) return;

      if (existingBtn) return;

      const btn = document.createElement('button');
      btn.id = 'arz-load-more-btn';
      btn.type = 'button';
      btn.className = 'btn btn-primary';
      btn.style.cssText = 'margin-right: 12px; height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; font-size: 13px; background: var(--az-accent) !important; border: none !important; color: white !important;';
      btn.innerHTML = `<i class="fa-solid fa-angles-down"></i> Загрузить ещё`;

      btn.onclick = () => loadNextPage();

      const parentDiv = paginationUl.parentElement;
      if (parentDiv) {
        parentDiv.insertBefore(btn, paginationUl);
        updateTopPagination();
      }
    }

    async function loadNextPage() {
      if (isLoading) return;

      const nextPageUrl = getNextPageUrl();
      if (!nextPageUrl) {
        window.ArizonaNotifications.show('Больше нет страниц для загрузки', 'warning');
        return;
      }

      const btn = document.getElementById('arz-load-more-btn');
      if (btn) {
        isLoading = true;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Загрузка...`;
      }

      try {
        const response = await fetchWithRetry(nextPageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const htmlText = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(htmlText, 'text/html');

        const newRows = newDoc.querySelectorAll('table.table tbody tr');
        const currentTbody = document.querySelector('table.table tbody');

        if (currentTbody && newRows.length > 0) {
          newRows.forEach(row => {
            row.removeAttribute('data-arz-processed');
            row.removeAttribute('data-arz-ip-processed');
            row.removeAttribute('data-arz-copy-btn-injected');
            currentTbody.appendChild(row);
          });
        }

        const newNav = newDoc.querySelector('nav[role="navigation"]');
        const currentNav = document.querySelector('nav[role="navigation"]');

        if (newNav && currentNav) {
          const currentStrongTo = currentNav.querySelector('p.text-muted strong:nth-of-type(2)');
          const newStrongTo = newNav.querySelector('p.text-muted strong:nth-of-type(2)');
          if (currentStrongTo && newStrongTo) {
            currentStrongTo.textContent = newStrongTo.textContent;
          }

          const currentUl = currentNav.querySelector('ul.pagination');
          const newUl = newNav.querySelector('ul.pagination');
          if (currentUl && newUl) {
            currentUl.innerHTML = newUl.innerHTML;
          }
          updateTopPagination();
        }

        if (typeof processTable === 'function') {
          processTable();
        }

        window.ArizonaNotifications.show(`Загружено ещё ${newRows.length} логов`, 'success');

      } catch (err) {
        console.error('Error loading next page logs:', err);
        window.ArizonaNotifications.show(`Ошибка загрузки: ${err.message}`, 'error');
      } finally {
        isLoading = false;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-angles-down"></i> Загрузить ещё`;
        }

        const hasMorePages = getNextPageUrl();
        if (!hasMorePages && btn) {
          btn.remove();
        }
      }
    }

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const isEnabled = currentSettings['extension-toggle'] !== false && currentSettings['tweak-load-more'] !== false;
        if (isEnabled) {
          runWhenElementExists('nav[role="navigation"]', () => injectButton());
        } else {
          const btn = document.getElementById('arz-load-more-btn');
          if (btn) btn.remove();
        }
        if (currentSettings['extension-toggle'] !== false) {
          runWhenElementExists('table.table', () => updateTopPagination());
        } else {
          document.getElementById('arz-top-pagination')?.remove();
        }
      },
      injectButton: injectButton,
      loadNextPage: loadNextPage
    };
  })();

  window.ArizonaIpBatchManager = (function () {
    let settings = {};

    const modalHTML = `
      <div id="arz-ip-batch-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-network-wired"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробив IP-адресов</div>
              <div class="arz-modal-subtitle">Сбор IP по последнему выходу</div>
            </div>
            <button data-action="cancel" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="arz-modal-body">
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="arz-modal-label" style="margin: 0;"><i class="fa-solid fa-users"></i> Ник(и) игрока(ов)</label>
                <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px;">Введено: <strong id="arz-ip-batch-count-num" style="color: var(--az-accent-hover);">0</strong></span>
              </div>
              <textarea id="arz-ip-batch-nicks" class="arz-textarea" rows="3" placeholder="Введите один или несколько ников (каждый с новой строки или через запятую)"></textarea>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button data-action="cancel" class="arz-btn-danger" style="flex: 1;">Закрыть</button>
            <button data-action="start" class="arz-btn-primary" style="flex: 1;">Пробить IP</button>
          </div>
        </div>
      </div>
    `;

    function getFormattedDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function parsePlayerIps(doc, player) {
      const rows = doc.querySelectorAll('table.table tbody tr');
      if (rows.length === 0) {
        return { player, lastIp: '', regIp: '', date: '', error: 'Выходы не найдены' };
      }

      let foundLastIp = '';
      let foundRegIp = '';
      let foundDate = '';
      let fallbackRegIp = '';

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.cells;
        if (cells.length < 4) continue;
        const date = (cells[0].textContent || '').trim();
        const ipCell = cells[3];
        if (!ipCell) continue;

        const lastIpEl = ipCell.querySelector('.badge-secondary, [title*="последний"], [title*="Последний IP"]');
        const regIpEl = ipCell.querySelector('.badge-primary, [title*="регистрационный"], [title*="Регистрационный IP"]');

        const lastIp = lastIpEl ? lastIpEl.textContent.trim() : '';
        const regIp = regIpEl ? regIpEl.textContent.trim() : '';

        if (!foundLastIp && lastIp) {
          foundLastIp = lastIp;
          foundDate = date;
        }

        if (regIp) {
          if (regIp !== '255.255.255.255') {
            if (!foundRegIp) {
              foundRegIp = regIp;
            }
          } else {
            if (!fallbackRegIp) {
              fallbackRegIp = regIp;
            }
          }
        }

        if (foundLastIp && foundRegIp) {
          break;
        }
      }

      const finalRegIp = foundRegIp || fallbackRegIp;

      if (foundLastIp || finalRegIp) {
        return {
          player,
          lastIp: foundLastIp,
          regIp: finalRegIp,
          date: foundDate,
          error: null
        };
      }

      return { player, lastIp: '', regIp: '', date: '', error: 'IP-адреса не найдены в логах' };
    }

    async function processMultiplePlayers(nicks) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробив IP</div>
              <div class="arz-modal-subtitle">Поиск IP-адресов игроков...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-player" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Запуск...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Подготовка запросов</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 0%; height: 100%; background: var(--az-accent); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const playerTextEl = progressOverlay.querySelector('#arz-progress-player');
      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const barFillEl = progressOverlay.querySelector('#arz-progress-bar-fill');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Сбор данных отменен', 'warning');
      };

      const results = [];
      for (let i = 0; i < nicks.length; i++) {
        if (cancelBatch) break;
        const player = nicks[i];

        playerTextEl.textContent = player;
        statusTextEl.textContent = `Загрузка данных (${i + 1} из ${nicks.length})`;
        barFillEl.style.width = `${Math.round((i / nicks.length) * 100)}%`;

        try {
          const fetchUrl = new URL(window.location.href);
          fetchUrl.searchParams.set('player', player);

          fetchUrl.searchParams.delete('type[]');
          fetchUrl.searchParams.append('type[]', 'disconnect');

          fetchUrl.searchParams.set('limit', '5');
          fetchUrl.searchParams.set('sort', 'desc');
          fetchUrl.searchParams.delete('arz_online');
          fetchUrl.searchParams.delete('arz_punish');

          let rows = [];
          let doc = document;
          let currentDate = new Date();
          let attempts = 0;
          const maxAttempts = 10;

          while (attempts < maxAttempts) {
            let maxDateStr = getFormattedDate(currentDate);
            currentDate.setMonth(currentDate.getMonth() - 6);
            let minDateStr = getFormattedDate(currentDate);

            fetchUrl.searchParams.set('min_period', minDateStr + ' 00:00:00');
            fetchUrl.searchParams.set('max_period', maxDateStr + ' 23:59:59');

            statusTextEl.textContent = `Запрос данных (${i + 1} из ${nicks.length}), период: ${minDateStr} - ${maxDateStr}`;

            const response = await fetchWithRetry(fetchUrl.href);
            if (!response.ok) {
              throw new Error(`Ошибка: ${response.status}`);
            }
            const htmlText = await response.text();
            const parser = new DOMParser();
            doc = parser.parseFromString(htmlText, 'text/html');
            rows = doc.querySelectorAll('table.table tbody tr');

            if (rows.length > 0) {
              break;
            }

            currentDate.setDate(currentDate.getDate() - 1);
            attempts++;
            await new Promise(r => setTimeout(r, 100));
          }

          const res = parsePlayerIps(doc, player);
          results.push(res);
        } catch (err) {
          console.error(`Error fetching IP for ${player}:`, err);
          results.push({
            player,
            lastIp: '',
            regIp: '',
            date: '',
            error: err.message || 'Ошибка загрузки'
          });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        showMultiResultsModal(results);
      }
    }

    function showMultiResultsModal(results) {
      let rowsHtml = '';
      results.forEach((res) => {
        const hasError = !!res.error;
        const lastIpStr = hasError ? `<span style="color: var(--az-danger); font-size: 12px;">${res.error}</span>` : `<code style="font-family: monospace; font-size: 13px; color: var(--az-accent-hover);">${res.lastIp}</code>`;
        const regIpStr = hasError ? '-' : `<code style="font-family: monospace; font-size: 13px; color: var(--az-text-secondary);">${res.regIp}</code>`;
        const dateStr = hasError ? '-' : `<span style="color: var(--az-text-secondary); font-size: 12px;">${res.date}</span>`;

        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border);">
            <td style="padding: 12px 16px; font-weight: 600; color: var(--az-text); font-size: 13px;">${res.player}</td>
            <td style="padding: 12px 16px;">${lastIpStr}</td>
            <td style="padding: 12px 16px;">${regIpStr}</td>
            <td style="padding: 12px 16px;">${dateStr}</td>
          </tr>
        `;
      });

      const copyLines = ['IP-адреса пробитых игроков:'];
      results.forEach((res, i) => {
        if (res.error) {
          copyLines.push(`${i + 1}. ${res.player} - ${res.error}`);
        } else {
          copyLines.push(`${i + 1}. ${res.player}: Последний IP: ${res.lastIp} (${res.date}) | Рег IP: ${res.regIp}`);
        }
      });
      const copyText = copyLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 700px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-network-wired"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результаты пробива IP</div>
              <div class="arz-modal-subtitle">Адреса по последнему выходу с сервера</div>
            </div>
            <button id="arz-ip-multi-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Игрок</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Последний IP</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Регистрационный IP</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 140px;">Дата выхода</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-ip-multi-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать все IP</button>
            <button id="arz-ip-multi-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый пробив</button>
            <button id="arz-ip-multi-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);

      overlay.querySelector('#arz-ip-multi-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-ip-multi-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);


      overlay.querySelector('#arz-ip-multi-reopen-btn').onclick = () => {
        closeOverlay(overlay);
        window.ArizonaLookupManager.openModal('ip');
      };

      overlay.querySelector('#arz-ip-multi-copy-btn').onclick = () => {
        navigator.clipboard.writeText(copyText).then(() => {
          const btn = overlay.querySelector('#arz-ip-multi-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать все IP', 2000);
        });
      };
    }

    function openModal() {
      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = modalHTML;
      openOverlay(overlay);

      const params = new URLSearchParams(window.location.search);
      const urlPlayer = params.get('player');
      if (urlPlayer) {
        overlay.querySelector('#arz-ip-batch-nicks').value = urlPlayer;
      }

      overlay.querySelectorAll('[data-action="cancel"]').forEach(btn => btn.onclick = () => closeOverlay(overlay));
      overlay.querySelector('[data-action="start"]').onclick = () => {
        const nicksVal = overlay.querySelector('#arz-ip-batch-nicks').value.trim();
        const nicks = nicksVal.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);

        if (nicks.length === 0) {
          window.ArizonaNotifications.show('Введите хотя бы один ник', 'error');
          return;
        }

        closeOverlay(overlay);
        processMultiplePlayers(nicks);
      };

    }

    return {
      init: function (s) {
        settings = s || {};
      },
      updateSettings: function (s) {
        settings = s || {};
      },
      injectButton: function () {
        if (document.getElementById('arz-ip-batch-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-ip-batch-btn';
        btn.className = 'btn btn-info';
        btn.style.cssText = 'margin-left: 10px; color: white !important;';
        btn.innerHTML = `<i class="fa-solid fa-network-wired" style="margin-right:6px;"></i> IP`;
        btn.onclick = openModal;
        container.appendChild(btn);
      },
      processMultiplePlayers: processMultiplePlayers
    };
  })();

  window.ArizonaIdNickManager = (function () {
    let settings = {};

    const modalHTML = `
      <div id="arz-idnick-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-id-badge"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Узнать ID аккаунта / NickName</div>
              <div class="arz-modal-subtitle">Поиск ID по никнейму или наоборот</div>
            </div>
            <button data-action="cancel" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="arz-modal-body">
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="arz-modal-label" style="margin: 0;"><i class="fa-solid fa-users"></i> Никнеймы или ID аккаунтов</label>
                <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px;">Введено: <strong id="arz-idnick-count-num" style="color: var(--az-accent-hover);">0</strong></span>
              </div>
              <textarea id="arz-idnick-inputs" class="arz-textarea" rows="4" placeholder="Введите никнеймы (Nick_Name) или ID аккаунтов (числа)\nКаждый элемент с новой строки или через запятую"></textarea>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button data-action="cancel" class="arz-btn-danger" style="flex: 1;">Закрыть</button>
            <button data-action="start" class="arz-btn-primary" style="flex: 1;">Узнать данные</button>
          </div>
        </div>
      </div>
    `;

    function getFormattedDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    async function processMultipleInputs(inputs) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Поиск ID/NickName</div>
              <div class="arz-modal-subtitle">Сбор информации с логов...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-input" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Запуск...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Подготовка запросов</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 0%; height: 100%; background: var(--az-accent); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const inputTextEl = progressOverlay.querySelector('#arz-progress-input');
      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const barFillEl = progressOverlay.querySelector('#arz-progress-bar-fill');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Сбор данных отменен', 'warning');
      };

      const results = [];
      for (let i = 0; i < inputs.length; i++) {
        if (cancelBatch) break;
        const currentInput = inputs[i];

        inputTextEl.textContent = currentInput;
        statusTextEl.textContent = `Запрос данных (${i + 1} из ${inputs.length})`;
        barFillEl.style.width = `${Math.round((i / inputs.length) * 100)}%`;

        const isId = /^\d+$/.test(currentInput);

        try {
          const fetchUrl = new URL(window.location.href);
          fetchUrl.searchParams.set('player', currentInput);

          fetchUrl.searchParams.delete('type[]');
          fetchUrl.searchParams.append('type[]', 'disconnect');

          fetchUrl.searchParams.set('limit', '5');
          fetchUrl.searchParams.set('sort', 'desc');
          fetchUrl.searchParams.delete('arz_online');
          fetchUrl.searchParams.delete('arz_punish');

          let rows = [];
          let doc = document;
          let currentDate = new Date();
          let attempts = 0;
          const maxAttempts = 10;

          while (attempts < maxAttempts) {
            let maxDateStr = getFormattedDate(currentDate);
            currentDate.setMonth(currentDate.getMonth() - 6);
            let minDateStr = getFormattedDate(currentDate);

            fetchUrl.searchParams.set('min_period', minDateStr + ' 00:00:00');
            fetchUrl.searchParams.set('max_period', maxDateStr + ' 23:59:59');

            statusTextEl.textContent = `Запрос данных (${i + 1} из ${inputs.length}), период: ${minDateStr} - ${maxDateStr}`;

            const response = await fetchWithRetry(fetchUrl.href);
            if (!response.ok) {
              throw new Error(`Ошибка запроса: ${response.status}`);
            }
            const htmlText = await response.text();
            const parser = new DOMParser();
            doc = parser.parseFromString(htmlText, 'text/html');
            rows = doc.querySelectorAll('table.table tbody tr');

            if (rows.length > 0) {
              break;
            }

            currentDate.setDate(currentDate.getDate() - 1);
            attempts++;
            await new Promise(r => setTimeout(r, 100));
          }

          if (rows.length === 0) {
            results.push({
              query: currentInput,
              nickname: isId ? '-' : currentInput,
              accountId: isId ? currentInput : '-',
              error: 'Логи выхода не найдены'
            });
          } else {
            const firstRow = rows[0];
            const actionText = firstRow.cells[1] ? firstRow.cells[1].textContent.trim() : '';

            let extractedNick = '';
            const nickMatch = actionText.match(/\b([A-Za-z0-9]+_[A-Za-z0-9]+)\b/);
            if (nickMatch) {
              extractedNick = nickMatch[1];
            } else {
              extractedNick = isId ? '-' : currentInput;
            }

            let extractedId = '';
            const idMatch = doc.body.innerHTML.match(/ID аккаунта\s*:\s*(\d+)/i) || doc.body.innerHTML.match(/ID\s*аккаунта\s*:\s*<[^>]+>\s*(\d+)/i);
            if (idMatch) {
              extractedId = idMatch[1];
            } else {
              const btn = firstRow.querySelector('.btn-info, [data-toggle="modal"], button, a');
              if (btn) {
                const targetSelector = btn.getAttribute('data-target');
                if (targetSelector) {
                  const modalEl = doc.querySelector(targetSelector);
                  if (modalEl) {
                    const mMatch = modalEl.innerHTML.match(/ID аккаунта\s*:\s*(\d+)/i) || modalEl.innerHTML.match(/ID\s*аккаунта\s*:\s*<[^>]+>\s*(\d+)/i);
                    if (mMatch) extractedId = mMatch[1];
                  }
                }

                if (!extractedId) {
                  const siblingModal = firstRow.nextElementSibling?.classList.contains('modal') ? firstRow.nextElementSibling : firstRow.querySelector('.modal');
                  if (siblingModal) {
                    const mMatch = siblingModal.innerHTML.match(/ID аккаунта\s*:\s*(\d+)/i) || siblingModal.innerHTML.match(/ID\s*аккаунта\s*:\s*<[^>]+>\s*(\d+)/i);
                    if (mMatch) extractedId = mMatch[1];
                  }
                }

                if (!extractedId) {
                  let url = btn.getAttribute('data-href') || btn.getAttribute('data-url') || btn.getAttribute('href');
                  const onclick = btn.getAttribute('onclick');

                  if (!url && onclick) {
                    const urlMatch = onclick.match(/['"](\/[^'"]+)['"]/);
                    if (urlMatch) {
                      url = urlMatch[1];
                    }
                  }

                  if (url && url !== '#' && !url.startsWith('javascript:')) {
                    try {
                      const fetchUrlInfo = new URL(url, window.location.origin).href;
                      const infoRes = await fetch(fetchUrlInfo);
                      if (infoRes.ok) {
                        const infoText = await infoRes.text();
                        const mMatch = infoText.match(/ID аккаунта\s*:\s*(\d+)/i) || infoText.match(/ID\s*аккаунта\s*:\s*<[^>]+>\s*(\d+)/i);
                        if (mMatch) extractedId = mMatch[1];
                      }
                    } catch (err) {
                      console.warn('Failed to fetch additional info in loop:', err);
                    }
                  }
                }
              }
            }

            if (!extractedId && isId) {
              extractedId = currentInput;
            }

            results.push({
              query: currentInput,
              nickname: extractedNick || (isId ? '-' : currentInput),
              accountId: extractedId || (isId ? currentInput : '-'),
              error: null
            });
          }
        } catch (err) {
          console.error(`Error processing query ${currentInput}:`, err);
          results.push({
            query: currentInput,
            nickname: isId ? '-' : currentInput,
            accountId: isId ? currentInput : '-',
            error: err.message || 'Ошибка загрузки'
          });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        showResultsModal(results);
      }
    }

    function showResultsModal(results) {
      let rowsHtml = '';
      results.forEach((res) => {
        const hasError = !!res.error;
        const nickStr = hasError ? `<span style="color: var(--az-danger); font-size: 12px;">${res.error}</span>` : `<span style="font-weight: 600; color: var(--az-text);">${res.nickname}</span>`;
        const idStr = hasError ? '-' : `<code style="font-family: monospace; font-size: 13px; color: var(--az-accent-hover);">${res.accountId}</code>`;

        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border);">
            <td style="padding: 12px 16px; font-weight: 500; color: var(--az-text-secondary); font-size: 13px;">${res.query}</td>
            <td style="padding: 12px 16px;">${nickStr}</td>
            <td style="padding: 12px 16px;">${idStr}</td>
          </tr>
        `;
      });

      const copyLines = ['Результаты поиска ID/NickName:'];
      results.forEach((res, i) => {
        if (res.error) {
          copyLines.push(`${i + 1}. ${res.query} - ${res.error}`);
        } else {
          copyLines.push(`${i + 1}. Ник: ${res.nickname} | ID: ${res.accountId}`);
        }
      });
      const copyText = copyLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 600px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-id-badge"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результаты поиска</div>
              <div class="arz-modal-subtitle">Сопоставление NickName и ID аккаунта</div>
            </div>
            <button id="arz-idnick-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Запрос</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">NickName</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">ID аккаунта</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-idnick-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать результаты</button>
            <button id="arz-idnick-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый пробив</button>
            <button id="arz-idnick-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);

      overlay.querySelector('#arz-idnick-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-idnick-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);


      overlay.querySelector('#arz-idnick-reopen-btn').onclick = () => {
        closeOverlay(overlay);
        window.ArizonaLookupManager.openModal('idnick');
      };

      overlay.querySelector('#arz-idnick-copy-btn').onclick = () => {
        navigator.clipboard.writeText(copyText).then(() => {
          const btn = overlay.querySelector('#arz-idnick-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать результаты', 2000);
        });
      };
    }

    function openModal() {
      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = modalHTML;
      openOverlay(overlay);

      const params = new URLSearchParams(window.location.search);
      const urlPlayer = params.get('player');
      if (urlPlayer) {
        overlay.querySelector('#arz-idnick-inputs').value = urlPlayer;
      }

      overlay.querySelectorAll('[data-action="cancel"]').forEach(btn => btn.onclick = () => closeOverlay(overlay));
      overlay.querySelector('[data-action="start"]').onclick = () => {
        const inputsVal = overlay.querySelector('#arz-idnick-inputs').value.trim();
        const inputs = inputsVal.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);

        if (inputs.length === 0) {
          window.ArizonaNotifications.show('Введите хотя бы один ник или ID', 'error');
          return;
        }

        closeOverlay(overlay);
        processMultipleInputs(inputs);
      };

    }

    return {
      init: function (s) {
        settings = s || {};
      },
      updateSettings: function (s) {
        settings = s || {};
      },
      injectButton: function () {
        if (document.getElementById('arz-idnick-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-idnick-btn';
        btn.className = 'btn btn-primary';
        btn.style.cssText = 'margin-left: 10px; color: white !important;';
        btn.innerHTML = `<i class="fa-solid fa-id-badge" style="margin-right:6px;"></i> ID/Ник`;
        btn.onclick = openModal;
        container.appendChild(btn);
      },
      processMultipleInputs: processMultipleInputs,
      resolveSingle: async function (query) {
        const isId = /^\d+$/.test(query);
        const fetchUrl = new URL(window.location.href);
        fetchUrl.searchParams.set('player', query);
        fetchUrl.searchParams.delete('type[]');
        fetchUrl.searchParams.append('type[]', 'disconnect');
        fetchUrl.searchParams.set('limit', '5');
        fetchUrl.searchParams.set('sort', 'desc');
        fetchUrl.searchParams.delete('arz_online');
        fetchUrl.searchParams.delete('arz_punish');

        let currentDate = new Date();
        let attempts = 0;
        const maxAttempts = 10;
        let doc = document;

        const getFormattedDate = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        while (attempts < maxAttempts) {
          let maxDateStr = getFormattedDate(currentDate);
          currentDate.setMonth(currentDate.getMonth() - 6);
          let minDateStr = getFormattedDate(currentDate);

          fetchUrl.searchParams.set('min_period', minDateStr + ' 00:00:00');
          fetchUrl.searchParams.set('max_period', maxDateStr + ' 23:59:59');

          try {
            const response = await fetchWithRetry(fetchUrl.href);
            if (response.ok) {
              const htmlText = await response.text();
              const parser = new DOMParser();
              doc = parser.parseFromString(htmlText, 'text/html');
              const rows = doc.querySelectorAll('table.table tbody tr');
              if (rows.length > 0) break;
            }
          } catch (err) {
            console.error(`Error resolving ID/Nick for ${query}:`, err);
          }

          currentDate.setDate(currentDate.getDate() - 1);
          attempts++;
          await new Promise(r => setTimeout(r, 100));
        }

        const rows = doc.querySelectorAll('table.table tbody tr');
        if (rows.length === 0) return null;

        const firstRow = rows[0];
        const actionText = firstRow.cells[1] ? firstRow.cells[1].textContent.trim() : '';

        let extractedNick = '';
        const nickMatch = actionText.match(/\b([A-Za-z0-9]+_[A-Za-z0-9]+)\b/);
        if (nickMatch) {
          extractedNick = nickMatch[1];
        }

        let extractedId = '';
        const idMatch = doc.body.innerHTML.match(/ID аккаунта\s*:\s*(\d+)/i) || doc.body.innerHTML.match(/ID\s*аккаунта\s*:\s*<[^>]+>\s*(\d+)/i);
        if (idMatch) {
          extractedId = idMatch[1];
        } else {
          const btn = firstRow.querySelector('.btn-info, [data-toggle="modal"], button, a');
          if (btn) {
            const targetSelector = btn.getAttribute('data-target');
            if (targetSelector) {
              const modalEl = doc.querySelector(targetSelector);
              if (modalEl) {
                const mMatch = modalEl.innerHTML.match(/ID аккаунта\s*:\s*(\d+)/i) || modalEl.innerHTML.match(/ID\s*аккаунта\s*:\s*<[^>]+>\s*(\d+)/i);
                if (mMatch) extractedId = mMatch[1];
              }
            }
          }
        }

        return {
          query,
          nickname: extractedNick || (isId ? null : query),
          accountId: extractedId || (isId ? query : null)
        };
      }
    };
  })();

  window.ArizonaReportManager = (function () {
    let settings = {};
    let calculated = false;

    function parsePlayerReports(doc, player) {
      const rows = doc.querySelectorAll('table.table tbody tr');
      const reports = [];

      rows.forEach(row => {
        const cells = row.cells;
        if (cells.length < 2) return;
        const date = (cells[0].textContent || '').trim();
        const action = (cells[1].textContent || '').trim();
        const actionText = action.replace(/\s+/g, ' ').trim();

        let targetPlayer = '-';
        let question = '';
        let answer = '';

        const playerMatch = actionText.match(/ответил на репорт\s+([A-Za-z0-9_]+)/i);
        if (playerMatch) {
          targetPlayer = playerMatch[1];
        }

        const regex = /репорт [A-Za-z0-9_]+(?:\[\d+\])?:\s*(.*?)\.?\s*Ответ:\s*(.*)$/i;
        const match = actionText.match(regex);
        if (match) {
          question = match[1].trim();
          answer = match[2].trim();
        } else {
          const splitIndex = actionText.toLowerCase().lastIndexOf('ответ:');
          if (splitIndex !== -1) {
            answer = actionText.substring(splitIndex + 6).trim();
            const questionPart = actionText.substring(0, splitIndex);

            let q = questionPart.trim();
            if (q.endsWith('.')) {
              q = q.slice(0, -1).trim();
            }

            const colonIndex = q.indexOf(':');
            if (colonIndex !== -1) {
              question = q.substring(colonIndex + 1).trim();
            } else {
              question = q;
            }
          } else {
            question = actionText;
            answer = '-';
          }
        }

        reports.push({
          date,
          player: targetPlayer,
          question,
          answer,
          actionText
        });
      });

      return {
        player,
        reports,
        error: rows.length === 0 ? 'Репортов не найдено' : null
      };
    }

    async function calculate() {
      const doc = document;
      const params = new URLSearchParams(window.location.search);
      const player = params.get('player') || 'Не указан';
      const res = parsePlayerReports(doc, player);

      if (res.reports.length === 0) {
        window.ArizonaNotifications.show('Репортов не найдено', 'info');
        return;
      }

      showSingleResultsModal(res);
    }

    function showSingleResultsModal(res) {
      let rowsHtml = '';
      const copyLines = [`Репорты администратора ${res.player}:`];

      res.reports.forEach(r => {
        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border);">
            <td style="padding: 10px 16px; font-family: monospace; font-size: 12px; color: var(--az-text-secondary); white-space: nowrap;">${r.date}</td>
            <td class="arz-col-player" style="padding: 10px 16px; font-weight: 600; color: var(--az-text); font-size: 13px;">${r.player}</td>
            <td class="arz-col-question" style="padding: 10px 16px; color: var(--az-text-secondary); font-size: 13px; line-height: 1.4;">${r.question}</td>
            <td class="arz-col-answer" style="padding: 10px 16px; color: var(--az-accent-hover); font-weight: 600; font-size: 13px; line-height: 1.4;">${r.answer}</td>
          </tr>
        `;
        copyLines.push(`[${r.date}] Игрок: ${r.player} | Вопрос: ${r.question} | Ответ: ${r.answer}`);
      });
      const copyText = copyLines.join('\n');

      const uniqueDays = new Set();
      res.reports.forEach(r => {
        const dPart = r.date.split(' ')[0];
        if (dPart) uniqueDays.add(dPart);
      });
      const totalReports = res.reports.length;
      const daysCount = uniqueDays.size || 1;
      const avgReports = (totalReports / daysCount).toFixed(1);

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 800px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-comments"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Статистика репортов</div>
              <div class="arz-modal-subtitle" style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span style="color: #ffffff; font-weight: 600; background: var(--az-accent); padding: 2px 8px; border-radius: 12px; font-size: 11px;">${res.player}</span>
                <span>Всего ответов: ${totalReports} | Дней: ${daysCount} | Ср. в день: ${avgReports}</span>
              </div>
            </div>
            <button id="arz-report-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--az-border); display: flex; gap: 12px; background: var(--az-bg-sidebar);">
            <input type="text" id="arz-reports-search" class="arz-input" placeholder="Поиск по игроку, вопросу или ответу..." style="width: 100%; box-sizing: border-box; font-size: 13px; padding: 8px 12px;">
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 140px;">Дата</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 120px;">Игрок</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Вопрос</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Ответ</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-report-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать репорты</button>
            <button id="arz-report-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый пробив</button>
            <button id="arz-report-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);
      overlay.querySelector('#arz-report-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-report-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);


      const searchInput = overlay.querySelector('#arz-reports-search');
      const tableBody = overlay.querySelector('tbody');
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase().trim();
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
          const playerText = row.querySelector('.arz-col-player')?.textContent.toLowerCase() || '';
          const questionText = row.querySelector('.arz-col-question')?.textContent.toLowerCase() || '';
          const answerText = row.querySelector('.arz-col-answer')?.textContent.toLowerCase() || '';
          if (playerText.includes(query) || questionText.includes(query) || answerText.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      };

      overlay.querySelector('#arz-report-copy-btn').onclick = () => {
        navigator.clipboard.writeText(copyText).then(() => {
          const btn = overlay.querySelector('#arz-report-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать репорты', 2000);
        });
      };

      overlay.querySelector('#arz-report-reopen-btn').onclick = () => {
        closeOverlay(overlay);
        window.ArizonaLookupManager.openModal('report');
      };
    }

    async function processMultiplePlayers(nicks, dateFrom, dateTo) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper" style="background: rgba(var(--az-accent-rgb), 0.12); color: var(--az-accent-hover);"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробив репортов</div>
              <div class="arz-modal-subtitle">Сбор репортов...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-player" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Запуск...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Подготовка запросов</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 0%; height: 100%; background: var(--az-accent); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const playerTextEl = progressOverlay.querySelector('#arz-progress-player');
      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const barFillEl = progressOverlay.querySelector('#arz-progress-bar-fill');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Сбор данных отменен', 'warning');
      };

      const results = [];
      for (let i = 0; i < nicks.length; i++) {
        if (cancelBatch) break;
        const player = nicks[i];

        playerTextEl.textContent = player;
        statusTextEl.textContent = `Загрузка данных (${i + 1} из ${nicks.length})`;
        barFillEl.style.width = `${Math.round((i / nicks.length) * 100)}%`;

        try {
          const fetchUrl = new URL(window.location.href);
          fetchUrl.searchParams.set('player', player);

          fetchUrl.searchParams.delete('type[]');
          fetchUrl.searchParams.append('type[]', 'report_answer');

          fetchUrl.searchParams.set('limit', '1000');
          fetchUrl.searchParams.set('sort', 'desc');
          fetchUrl.searchParams.delete('arz_online');
          fetchUrl.searchParams.delete('arz_punish');

          if (dateFrom) fetchUrl.searchParams.set('min_period', dateFrom + ' 00:00:00');
          if (dateTo) fetchUrl.searchParams.set('max_period', dateTo + ' 23:59:59');

          const response = await fetchWithRetry(fetchUrl.href);
          if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
          }
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, 'text/html');

          const res = parsePlayerReports(doc, player);
          results.push(res);
        } catch (err) {
          console.error(`Error fetching reports for ${player}:`, err);
          results.push({
            player,
            reports: [],
            error: err.message || 'Ошибка загрузки'
          });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        if (results.length === 1) {
          if (results[0].reports.length === 0 && !results[0].error) {
            window.ArizonaNotifications.show('Репортов не найдено', 'info');
          } else if (results[0].error) {
            window.ArizonaNotifications.show(results[0].error, 'error');
          } else {
            showSingleResultsModal(results[0]);
          }
        } else {
          showMultiResultsModal(results);
        }
      }
    }

    function showMultiResultsModal(results) {
      let rowsHtml = '';
      results.forEach((res, index) => {
        const hasError = !!res.error;
        const hasReports = res.reports && res.reports.length > 0;
        const countStr = hasError ? `<span style="color: var(--az-danger); font-size: 12px;">${res.error}</span>` : `${res.reports.length} реп.`;

        let detailsHtml = '';
        if (hasReports) {
          let detailRows = '';
          res.reports.forEach(r => {
            detailRows += `
              <div style="display: flex; flex-direction: column; padding: 10px 20px; border-bottom: 1px solid var(--az-border); gap: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; align-items: center;">
                  <span style="color: var(--az-text-secondary); font-family: monospace;">${r.date}</span>
                  <span style="color: var(--az-text); font-weight: 500;">Игрок: ${r.player}</span>
                </div>
                <div style="color: var(--az-text-secondary); font-size: 13px; line-height: 1.4;"><span style="color: var(--az-text-secondary);">Вопрос:</span> ${r.question}</div>
                <div style="color: var(--az-accent-hover); font-weight: 600; font-size: 13px; line-height: 1.4;"><span style="color: var(--az-text-secondary);">Ответ:</span> ${r.answer}</div>
              </div>
            `;
          });
          detailsHtml = `
            <tr id="arz-report-details-row-${index}" class="arz-details-row" style="display: none; background: var(--az-table-row-hover);">
              <td colspan="3" style="padding: 0; border-bottom: 1px solid var(--az-border);">
                <div style="max-height: 280px; overflow-y: auto; padding: 4px 0;">
                  ${detailRows}
                </div>
              </td>
            </tr>
          `;
        }

        rowsHtml += `
          <tr style="border-bottom: 1px solid var(--az-border); cursor: pointer;" class="arz-player-row" data-index="${index}" data-player="${res.player}">
            <td style="padding: 12px 16px; font-weight: 600; color: var(--az-text); font-size: 13px;">
              <span class="arz-toggle-details-btn" style="margin-right: 8px; color: var(--az-text-secondary);"><i class="fa-solid fa-chevron-right"></i></span>
              ${res.player}
            </td>
            <td style="padding: 12px 16px; font-weight: 700; color: ${hasError ? 'var(--az-text-secondary)' : 'var(--az-accent-hover)'}; font-size: 13px;">
              ${countStr}
            </td>
            <td style="padding: 12px 16px; text-align: right;">
              <button class="arz-btn-icon arz-copy-single-report-btn" data-index="${index}" title="Копировать репорты игрока" style="background: none; border: none; color: var(--az-text-secondary); cursor: pointer; padding: 4px 8px; font-size: 14px; transition: color 0.2s;"><i class="fa-regular fa-copy"></i></button>
            </td>
          </tr>
          ${detailsHtml}
        `;
      });

      const allPlayersSummaryLines = ['Сводка репортов администраторов:'];
      results.forEach((res) => {
        allPlayersSummaryLines.push(`\nАдминистратор: ${res.player}`);
        if (res.error) {
          allPlayersSummaryLines.push(`- ${res.error}`);
        } else if (res.reports && res.reports.length > 0) {
          res.reports.forEach(r => {
            allPlayersSummaryLines.push(`- [${r.date}] Игрок: ${r.player} | Вопрос: ${r.question} | Ответ: ${r.answer}`);
          });
        } else {
          allPlayersSummaryLines.push(`- Репортов не найдено`);
        }
      });
      const allPlayersSummaryText = allPlayersSummaryLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 700px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-comments"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результаты пробива репортов</div>
              <div class="arz-modal-subtitle">Статистика ответов администраторов</div>
            </div>
            <button id="arz-report-multi-close-header-btn" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--az-border); display: flex; gap: 12px; background: var(--az-bg-sidebar);">
            <input type="text" id="arz-reports-multi-search" class="arz-input" placeholder="Поиск по имени администратора..." style="width: 100%; box-sizing: border-box; font-size: 13px; padding: 8px 12px;">
          </div>
          <div class="online-result-table-wrapper" style="max-height: 550px; overflow-y: auto; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            <table class="online-result-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--az-border); background: var(--az-bg-sidebar); position: sticky; top: 0; z-index: 1;">
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Администратор</th>
                  <th style="text-align: left; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase;">Репорты</th>
                  <th style="text-align: right; padding: 12px 16px; color: var(--az-text-secondary); font-size: 11px; text-transform: uppercase; width: 50px;">Копировать</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-report-multi-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать все репорты</button>
            <button id="arz-report-multi-reopen-btn" class="arz-btn-secondary" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Новый пробив</button>
            <button id="arz-report-multi-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);

      overlay.querySelector('#arz-report-multi-close-btn').onclick = () => closeOverlay(overlay);
      const closeHeader = overlay.querySelector('#arz-report-multi-close-header-btn');
      if (closeHeader) closeHeader.onclick = () => closeOverlay(overlay);


      const searchInput = overlay.querySelector('#arz-reports-multi-search');
      searchInput.oninput = () => {
        const query = searchInput.value.toLowerCase().trim();
        const rows = overlay.querySelectorAll('.arz-player-row');
        rows.forEach(row => {
          const adminName = row.getAttribute('data-player').toLowerCase();
          const detailsRow = overlay.querySelector(`#arz-report-details-row-${row.getAttribute('data-index')}`);
          if (adminName.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
            if (detailsRow) detailsRow.style.display = 'none';
          }
        });
      };

      overlay.querySelector('#arz-report-multi-reopen-btn').onclick = () => {
        closeOverlay(overlay);
        window.ArizonaLookupManager.openModal('report');
      };

      overlay.querySelector('#arz-report-multi-copy-btn').onclick = () => {
        navigator.clipboard.writeText(allPlayersSummaryText).then(() => {
          const btn = overlay.querySelector('#arz-report-multi-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать все репорты', 2000);
        });
      };

      overlay.querySelectorAll('.arz-player-row').forEach(row => {
        row.onclick = (e) => {
          if (e.target.closest('.arz-copy-single-report-btn')) return;

          const index = row.getAttribute('data-index');
          const detailsRow = overlay.querySelector(`#arz-report-details-row-${index}`);
          if (detailsRow) {
            const isVisible = detailsRow.style.display !== 'none';
            detailsRow.style.display = isVisible ? 'none' : 'table-row';
            const icon = row.querySelector('.arz-toggle-details-btn i');
            if (icon) {
              icon.className = isVisible ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-down';
            }
          }
        };
      });

      overlay.querySelectorAll('.arz-copy-single-report-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const index = parseInt(btn.getAttribute('data-index'), 10);
          const res = results[index];
          if (!res) return;

          let textToCopy = '';
          if (res.error) {
            textToCopy = `${res.player}: ${res.error}`;
          } else {
            const singleLines = [`Репорты администратора ${res.player}:`];
            res.reports.forEach(r => {
              singleLines.push(`- [${r.date}] Игрок: ${r.player} | Вопрос: ${r.question} | Ответ: ${r.answer}`);
            });
            textToCopy = singleLines.join('\n');
          }

          navigator.clipboard.writeText(textToCopy).then(() => {
            const icon = btn.querySelector('i');
            icon.className = 'fa-solid fa-check';
            btn.style.color = 'var(--az-success)';
            setTimeout(() => {
              icon.className = 'fa-regular fa-copy';
              btn.style.color = 'var(--az-text-secondary)';
            }, 2000);
          });
        };
      });
    }

    return {
      init: function (s) {
        settings = s || {};
        if (settings.tools?.online !== false && settings.tools?.report !== false) {
          this.checkAutoCalculation();
        }
      },
      updateSettings: function (s) {
        settings = s || {};
        if (settings.tools?.online !== false && settings.tools?.report !== false) {
          this.checkAutoCalculation();
        }
      },
      checkAutoCalculation: function () {
        const params = new URLSearchParams(window.location.search);
        if (params.get('arz_report') === '1' && !calculated) {
          calculated = true;
          setTimeout(calculate, 1000);
        }
      },
      processMultiplePlayers: processMultiplePlayers
    };
  })();

  window.ArizonaLookupManager = (function () {
    let settings = {};
    let activeTab = 'online';

    const modalHTML = `
      <div id="arz-lookup-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container" style="max-width: 850px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-user-shield"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Панель пробива игрока</div>
              <div class="arz-modal-subtitle">Все проверки в одном модальном окне</div>
            </div>
            <button id="arz-lookup-close" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div class="arz-lookup-tabs">
            <button class="arz-tab-btn active" data-tab="online"><i class="fa-solid fa-clock"></i> Онлайн</button>
            <button class="arz-tab-btn" data-tab="punish"><i class="fa-solid fa-gavel"></i> Наказания</button>
            <button class="arz-tab-btn" data-tab="report"><i class="fa-solid fa-comments"></i> Репорты</button>
            <button class="arz-tab-btn" data-tab="ip"><i class="fa-solid fa-network-wired"></i> IP-адреса</button>
            <button class="arz-tab-btn" data-tab="idnick"><i class="fa-solid fa-id-badge"></i> ID / Ник</button>
          </div>

          <div class="arz-modal-body" style="gap: 16px !important;">
            <div class="arz-modal-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="arz-modal-label" id="arz-lookup-input-label" style="margin: 0;"><i class="fa-solid fa-users"></i> Ник(и) игрока(ов)</label>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px; white-space: nowrap;">Введено: <strong id="arz-lookup-count-num" style="color: var(--az-accent-hover);">0</strong></span>
                  <span id="arz-lookup-extract-btn" style="font-size: 11px; color: var(--az-accent-hover); cursor: pointer; display: flex; align-items: center; gap: 4px; user-select: none; border-bottom: 1px dashed currentColor; white-space: nowrap;" title="Извлечь ники Nick_Name из любого текста"><i class="fa-solid fa-wand-magic-sparkles"></i> Извлечь ники</span>
                  <span id="arz-lookup-my-nick-btn" style="font-size: 11px; color: var(--az-accent-hover); cursor: pointer; display: flex; align-items: center; gap: 4px; user-select: none; border-bottom: 1px dashed currentColor; white-space: nowrap;" title="Добавить ваш авторизованный никнейм"><i class="fa-solid fa-user-plus"></i> Свой никнейм</span>
                </div>
              </div>
              <textarea id="arz-lookup-nicks" class="arz-textarea" rows="4" placeholder="Введите никнеймы (каждый с новой строки или через запятую) или вставьте текст для извлечения"></textarea>
            </div>

            <div id="arz-lookup-date-group" style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; gap: 12px; width: 100%; box-sizing: border-box;">
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата от</label>
                  <input type="date" id="arz-lookup-date-from" class="arz-input">
                </div>
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата до</label>
                  <input type="date" id="arz-lookup-date-to" class="arz-input">
                </div>
              </div>
              <div class="arz-date-shortcuts" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; width: 100% !important; box-sizing: border-box !important; margin-top: -4px !important;">
                <button type="button" class="arz-btn-shortcut" data-range="day">За день</button>
                <button type="button" class="arz-btn-shortcut" data-range="week">За неделю</button>
                <button type="button" class="arz-btn-shortcut" data-range="month">За месяц</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-week">С начала недели</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-month">С начала месяца</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-year">С начала года</button>
              </div>
            </div>

            <div id="arz-lookup-tab-online" class="arz-tab-content active" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="arz-modal-form-group" style="display: flex; align-items: center; gap: 8px; flex-direction: row !important;">
                <input type="checkbox" id="arz-lookup-stealth" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--az-accent);">
                <label for="arz-lookup-stealth" class="arz-modal-label" style="margin: 0; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none; text-transform: none !important;">
                  <i class="fa-solid fa-user-secret"></i> Скрытный режим (анализ общих логов)
                </label>
              </div>
              <div class="arz-accordion">
                <div class="arz-accordion-header">
                  <div class="arz-accordion-header-left"><i class="fa-solid fa-filter"></i> <span>Чистый онлайн</span></div>
                  <i class="fa-solid fa-chevron-down arz-accordion-chevron"></i>
                </div>
                <div class="arz-accordion-content" style="display: none; flex-direction: column !important; gap: 14px !important; padding: 16px !important; border-top: 1px solid var(--az-border) !important; background: var(--az-bg) !important;">
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--az-text-secondary);"><i class="fa-solid fa-circle-info"></i> Учитывать только указанный промежуток суток</div>
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <span style="font-size: 12px; color: var(--az-text); min-width: 70px;">Будние дни</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="time" id="arz-lookup-wd-from" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                      <span style="color: var(--az-text-secondary);">-</span>
                      <input type="time" id="arz-lookup-wd-to" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <span style="font-size: 12px; color: var(--az-text); min-width: 70px;">Выходные</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="time" id="arz-lookup-we-from" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                      <span style="color: var(--az-text-secondary);">-</span>
                      <input type="time" id="arz-lookup-we-to" class="arz-input" style="padding: 6px 10px !important; width: auto !important;">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="arz-lookup-tab-punish" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; color: var(--az-text-secondary); line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info" style="color: var(--az-accent-hover);"></i>
                <span>Будут выгружены все наказания игроков за выбранный период (баны, муты, джайлы и др.)</span>
              </div>
            </div>

            <div id="arz-lookup-tab-ip" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; color: var(--az-text-secondary); line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info" style="color: var(--az-accent-hover);"></i>
                <span>Поиск IP-адресов по последнему выходу с сервера. Поиск производится вглубь истории.</span>
              </div>
            </div>

            <div id="arz-lookup-tab-idnick" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; color: var(--az-text-secondary); line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info" style="color: var(--az-accent-hover);"></i>
                <span>Поиск ID аккаунта по никнейму или наоборот. Можно вводить как Nick_Name, так и числовые ID.</span>
              </div>
            </div>

            <div id="arz-lookup-tab-report" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; color: var(--az-text-secondary); line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info" style="color: var(--az-accent-hover);"></i>
                <span>Вывод количества отвеченных репортов за выбранный период и детальная статистика ответов.</span>
              </div>
            </div>
          </div>

          <div class="arz-modal-footer">
            <button id="arz-lookup-close-bottom" class="arz-btn-danger" style="flex: 1;">Закрыть</button>
            <button id="arz-lookup-start-btn" class="arz-btn-primary" style="flex: 1.5;"><i class="fa-solid fa-magnifying-glass"></i> Пробить онлайн</button>
          </div>
        </div>
      </div>
    `;

    function switchTab(modal, tabName) {
      activeTab = tabName;

      modal.querySelectorAll('.arz-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      modal.querySelectorAll('.arz-tab-content').forEach(content => {
        if (content.id === `arz-lookup-tab-${tabName}`) {
          content.style.display = 'flex';
        } else {
          content.style.display = 'none';
        }
      });

      const dateGroup = modal.querySelector('#arz-lookup-date-group');
      if (tabName === 'online' || tabName === 'punish' || tabName === 'report') {
        dateGroup.style.display = 'flex';
      } else {
        dateGroup.style.display = 'none';
      }

      const nicksTextarea = modal.querySelector('#arz-lookup-nicks');
      const inputLabel = modal.querySelector('#arz-lookup-input-label');
      const startBtn = modal.querySelector('#arz-lookup-start-btn');

      if (tabName === 'idnick') {
        inputLabel.innerHTML = `<i class="fa-solid fa-id-card"></i> Никнеймы или ID аккаунтов`;
        nicksTextarea.placeholder = 'Введите никнеймы (Nick_Name) или ID аккаунтов (числа)\nКаждый элемент с новой строки или через запятую';
        startBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Узнать данные`;
      } else {
        inputLabel.innerHTML = `<i class="fa-solid fa-users"></i> Ник(и) игрока(ов)`;
        nicksTextarea.placeholder = 'Введите один или несколько ников (каждый с новой строки или через запятую)';

        if (tabName === 'online') {
          startBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Пробить онлайн`;
        } else if (tabName === 'punish') {
          startBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Пробить наказания`;
        } else if (tabName === 'ip') {
          startBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Пробить IP`;
        } else if (tabName === 'report') {
          startBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Пробить репорты`;
        }
      }
    }

    function openModal(defaultTab) {
      if (defaultTab) {
        activeTab = defaultTab;
      }
      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = modalHTML;
      openOverlay(overlay);

      const tabEnabled = {
        online: settings.tools?.online !== false,
        punish: settings.tools?.punishment !== false,
        report: settings.tools?.report !== false,
        ip: settings.tools?.ipBatch !== false,
        idnick: settings.tools?.idNick !== false
      };
      overlay.querySelectorAll('.arz-tab-btn').forEach((button) => {
        button.style.display = tabEnabled[button.dataset.tab] ? '' : 'none';
      });
      const firstEnabledTab = Object.keys(tabEnabled).find(tab => tabEnabled[tab]);
      if (!firstEnabledTab) {
        closeOverlay(overlay);
        return;
      }
      if (!tabEnabled[activeTab]) {
        activeTab = firstEnabledTab;
      }

      setupNickCounter(overlay, '#arz-lookup-nicks', 'arz-lookup-count-num');

      const params = new URLSearchParams(window.location.search);
      const urlMin = params.get('min_period');
      const urlMax = params.get('max_period');
      if (urlMin) {
        overlay.querySelector('#arz-lookup-date-from').value = urlMin.split(' ')[0];
      }
      if (urlMax) {
        overlay.querySelector('#arz-lookup-date-to').value = urlMax.split(' ')[0];
      }
      const urlPlayer = params.get('player');
      if (urlPlayer) {
        overlay.querySelector('#arz-lookup-nicks').value = urlPlayer;
      }

      overlay.querySelector('#arz-lookup-wd-from').value = localStorage.getItem('arz-clean-weekday-from') || '';
      overlay.querySelector('#arz-lookup-wd-to').value = localStorage.getItem('arz-clean-weekday-to') || '';
      overlay.querySelector('#arz-lookup-we-from').value = localStorage.getItem('arz-clean-weekend-from') || '';
      overlay.querySelector('#arz-lookup-we-to').value = localStorage.getItem('arz-clean-weekend-to') || '';

      const isStealth = localStorage.getItem('arz-online-stealth-enabled') === 'true';
      overlay.querySelector('#arz-lookup-stealth').checked = isStealth;

      const contentEl = overlay.querySelector('.arz-accordion-content');
      const chevron = overlay.querySelector('.arz-accordion-chevron');
      overlay.querySelector('.arz-accordion-header').onclick = () => {
        const show = contentEl.style.display === 'none' || contentEl.style.display === '';
        contentEl.style.display = show ? 'flex' : 'none';
        chevron.style.transform = show ? 'rotate(180deg)' : '';
      };

      setupDateShortcuts(overlay, 'arz-lookup-date-from', 'arz-lookup-date-to');

      overlay.querySelector('#arz-lookup-close').onclick = () => closeOverlay(overlay);
      overlay.querySelector('#arz-lookup-close-bottom').onclick = () => closeOverlay(overlay);


      overlay.querySelector('#arz-lookup-extract-btn').onclick = (e) => {
        e.preventDefault();
        const textarea = overlay.querySelector('#arz-lookup-nicks');
        const text = textarea.value;
        const nickRegex = /\b[A-Z][a-zA-Z0-9]*_[A-Za-z0-9_]+\b/g;
        const matches = text.match(nickRegex);
        const validMatches = matches ? matches.filter(isValidNickname) : [];
        if (validMatches.length === 0) {
          window.ArizonaNotifications.show('Никнеймы Nick_Name не найдены!', 'error');
          return;
        }

        const uniqueNicks = Array.from(new Set(validMatches));
        textarea.value = uniqueNicks.join(',');
        textarea.dispatchEvent(new Event('input'));
        window.ArizonaNotifications.show(`Извлечено никнеймов: ${uniqueNicks.length}`, 'success');
      };

      overlay.querySelector('#arz-lookup-my-nick-btn').onclick = (e) => {
        e.preventDefault();

        const getNavNick = () => {
          const el = document.querySelector('a#navbarDropdown');
          if (!el) return '';
          let text = '';
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
          }
          text = text.trim();
          return text || el.textContent.split('\n')[0].trim();
        };

        const myNick = getNavNick();
        if (!myNick) {
          window.ArizonaNotifications.show('Никнейм авторизованного пользователя не найден', 'error');
          return;
        }

        const textarea = overlay.querySelector('#arz-lookup-nicks');
        const currentVal = textarea.value.trim();
        const nicksList = currentVal ? currentVal.split(/[\n,]+/).map(n => n.trim()).filter(Boolean) : [];

        if (nicksList.includes(myNick)) {
          window.ArizonaNotifications.show('Ваш никнейм уже есть в списке!', 'info');
          return;
        }

        nicksList.push(myNick);
        textarea.value = nicksList.join('\n');
        textarea.dispatchEvent(new Event('input'));
        window.ArizonaNotifications.show(`Добавлен никнейм: ${myNick}`, 'success');
      };

      overlay.querySelectorAll('.arz-tab-btn').forEach(btn => {
        btn.onclick = () => {
          switchTab(overlay, btn.dataset.tab);
        };
      });

      overlay.querySelector('#arz-lookup-start-btn').onclick = () => {
        const inputVal = overlay.querySelector('#arz-lookup-nicks').value.trim();
        const inputs = inputVal.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);

        if (inputs.length === 0) {
          window.ArizonaNotifications.show(
            activeTab === 'idnick' ? 'Введите хотя бы один ник или ID' : 'Введите хотя бы один ник',
            'error'
          );
          return;
        }

        const dateFrom = overlay.querySelector('#arz-lookup-date-from').value;
        const dateTo = overlay.querySelector('#arz-lookup-date-to').value;

        if (activeTab === 'online') {
          const stealthOn = overlay.querySelector('#arz-lookup-stealth').checked;
          const cleanOn = contentEl.style.display === 'flex';

          localStorage.setItem('arz-clean-weekday-from', cleanOn ? overlay.querySelector('#arz-lookup-wd-from').value.trim() : '');
          localStorage.setItem('arz-clean-weekday-to', cleanOn ? overlay.querySelector('#arz-lookup-wd-to').value.trim() : '');
          localStorage.setItem('arz-clean-weekend-from', cleanOn ? overlay.querySelector('#arz-lookup-we-from').value.trim() : '');
          localStorage.setItem('arz-clean-weekend-to', cleanOn ? overlay.querySelector('#arz-lookup-we-to').value.trim() : '');
          localStorage.setItem('arz-online-stealth-enabled', stealthOn ? 'true' : 'false');

          closeOverlay(overlay);
          if (stealthOn) {
            window.ArizonaOnlineManager.processStealthOnline(inputs, dateFrom, dateTo);
          } else {
            window.ArizonaOnlineManager.processMultiplePlayers(inputs, dateFrom, dateTo);
          }
        } else if (activeTab === 'punish') {
          closeOverlay(overlay);
          window.ArizonaPunishmentManager.processMultiplePlayers(inputs, dateFrom, dateTo);
        } else if (activeTab === 'report') {
          closeOverlay(overlay);
          window.ArizonaReportManager.processMultiplePlayers(inputs, dateFrom, dateTo);
        } else if (activeTab === 'ip') {
          closeOverlay(overlay);
          window.ArizonaIpBatchManager.processMultiplePlayers(inputs);
        } else if (activeTab === 'idnick') {
          closeOverlay(overlay);
          window.ArizonaIdNickManager.processMultipleInputs(inputs);
        }
      };

      switchTab(overlay, activeTab);
    }

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const hasLookupTab = [
          settings.tools?.online,
          settings.tools?.punishment,
          settings.tools?.report,
          settings.tools?.ipBatch,
          settings.tools?.idNick
        ].some(value => value !== false);
        const isEnabled = currentSettings['extension-toggle'] !== false &&
          settings.tools?.lookup !== false && hasLookupTab;
        const existingBtn = document.getElementById('arz-lookup-btn');
        if (isEnabled) {
          runWhenElementExists('.filter-buttons', () => this.injectButton());
        } else {
          if (existingBtn) existingBtn.remove();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-lookup-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-lookup-btn';
        btn.className = 'btn btn-success';
        btn.style.cssText = 'margin-left: 10px; background: var(--az-accent) !important;';
        btn.innerHTML = `<i class="fa-solid fa-user-shield" style="margin-right: 6px;"></i> Пробив`;
        btn.onclick = () => openModal();
        container.appendChild(btn);
      },
      openModal: openModal
    };
  })();

  window.ArizonaDateShortcut = (function () {
    let settings = {};

    function getRelativeDateStr(daysAgo) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function setDate(date) {
      if (!date) return;
      const min = document.querySelector('input[name="min_period"]');
      const max = document.querySelector('input[name="max_period"]');
      if (min && max) {
        min.value = `${date} 00:00:00`;
        max.value = `${date} 23:59:59`;
        ['change', 'input'].forEach(e => {
          min.dispatchEvent(new Event(e, { bubbles: true }));
          max.dispatchEvent(new Event(e, { bubbles: true }));
        });
        window.ArizonaNotifications.show(`Установлен период: ${date}`, 'success');
      }
    }

    function formatDate(date, time) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d} ${time}`;
    }

    function setMinPeriod(range) {
      const min = document.querySelector('input[name="min_period"]');
      if (!min) return;
      const date = new Date();
      if (range === '1y') {
        date.setFullYear(date.getFullYear() - 1);
      } else if (range === '3m') {
        date.setMonth(date.getMonth() - 3);
      } else if (range === '1w') {
        date.setDate(date.getDate() - 7);
      }
      min.value = formatDate(date, '00:00:00');
      ['change', 'input'].forEach(e => {
        min.dispatchEvent(new Event(e, { bubbles: true }));
      });
      window.ArizonaNotifications.show(`Установлено начало периода: ${min.value}`, 'success');
    }

    function setMaxPeriod(range) {
      const max = document.querySelector('input[name="max_period"]');
      if (!max) return;
      const date = new Date();
      if (range === '1y') {
        date.setFullYear(date.getFullYear() - 1);
      } else if (range === '3m') {
        date.setMonth(date.getMonth() - 3);
      } else if (range === '1w') {
        date.setDate(date.getDate() - 7);
      }
      max.value = formatDate(date, '23:59:59');
      ['change', 'input'].forEach(e => {
        max.dispatchEvent(new Event(e, { bubbles: true }));
      });
      window.ArizonaNotifications.show(`Установлен конец периода: ${max.value}`, 'success');
    }

    function setSortOrder(val) {
      const container = document.querySelector('.js_component_filter_item_sort');
      if (!container) return;
      const select = container.querySelector('select[name="sort"]') || container.querySelector('select');
      if (!select) return;

      select.value = val;
      ['change', 'input'].forEach(eName => {
        select.dispatchEvent(new Event(eName, { bubbles: true }));
      });

      if (window.jQuery) {
        window.jQuery(select).val(val).trigger('change');
      }

      const valLabel = val === 'desc' ? 'Сначала новые' : 'Сначала старые';
      if (window.ArizonaNotifications) {
        window.ArizonaNotifications.show(`Сортировка: ${valLabel}`, 'success');
      }
    }

    function getMyNickname() {
      const el = document.querySelector('a#navbarDropdown');
      if (!el) return '';
      let text = '';
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      }
      text = text.trim();
      if (!text) {
        text = el.textContent.split('\n')[0].trim();
      }
      return text;
    }

    async function readClipboardText() {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) return text.trim();
        }
      } catch (e) {
        console.warn('[Content] Failed to read clipboard:', e);
      }
      return '';
    }

    function setPlayerInputValue(input, val) {
      if (!input) return;
      input.value = val;
      ['input', 'change', 'keyup'].forEach(eName => {
        input.dispatchEvent(new Event(eName, { bubbles: true }));
      });
      input.focus();
    }

    function getPlayerContainers() {
      const containers = [];
      const selectors = [
        '.js_component_filter_item_player',
        '.js_component_filter_item_target',
        '.js_component_filter_item_player1',
        '.js_component_filter_item_player2'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (!containers.includes(el)) containers.push(el);
        });
      });

      document.querySelectorAll('.js_component_filter_item').forEach(item => {
        if (!containers.includes(item)) {
          const input = item.querySelector('input[name="player"], input[name="target"], input[name="player1"], input[name="player2"]');
          if (input) containers.push(item);
        }
      });

      return containers;
    }

    function getTypeContainers() {
      const containers = [];
      const selectors = [
        '.js_component_filter_item_type',
        '.js_component_filter_item_types',
        '.js_component_filter_item_type_id',
        '.js_component_filter_item_action',
        '.js_component_filter_item_actions'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (!containers.includes(el)) containers.push(el);
        });
      });

      document.querySelectorAll('.js_component_filter_item').forEach(item => {
        if (!containers.includes(item)) {
          const label = item.querySelector('label');
          const input = item.querySelector('input, select, textarea');
          if (label && /Тип|Типы|Action/i.test(label.textContent.trim())) {
            containers.push(item);
          } else if (input && /type|action/i.test(input.name || '')) {
            containers.push(item);
          }
        }
      });

      return containers;
    }

    function appendEmojiToType(container, emoji) {
      const select2Selection = container.querySelector('.select2-selection');
      if (select2Selection && !document.querySelector('.select2-container--open')) {
        select2Selection.click();
      }

      setTimeout(() => {
        const openSelect2Input = document.querySelector('.select2-container--open .select2-search__field');
        const containerInput = container.querySelector('.select2-search__field, input[type="text"], input:not([type="hidden"]), textarea');
        const targetInput = openSelect2Input || containerInput;

        if (targetInput) {
          targetInput.focus();
          const val = targetInput.value || '';
          const newVal = val ? (val.endsWith(' ') ? val + emoji : val + ' ' + emoji) : emoji;
          targetInput.value = newVal;

          ['input', 'change', 'keyup', 'keydown'].forEach(eventType => {
            targetInput.dispatchEvent(new Event(eventType, { bubbles: true }));
          });
        }
      }, select2Selection ? 60 : 0);
    }

    function createShortcutLink(label, onClick) {
      const btn = document.createElement('a');
      btn.href = '#';
      btn.className = 'arz-shortcut-link';
      btn.textContent = label;
      btn.style.cssText = 'color: var(--az-text-secondary); text-decoration: none; border-bottom: 1px dashed currentColor; display: inline-block; font-size: 11px; margin-right: 8px; margin-bottom: 4px; transition: color 0.15s; cursor: pointer;';
      btn.onmouseover = () => {
        btn.style.color = 'var(--az-accent-hover)';
      };
      btn.onmouseout = () => {
        btn.style.color = 'var(--az-text-secondary)';
      };
      btn.onclick = (e) => {
        e.preventDefault();
        onClick();
      };
      return btn;
    }

    function createEmojiShortcutButton(item, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'arz-type-emoji-btn';
      btn.innerHTML = `<i class="${item.icon}" aria-hidden="true"></i>`;
      btn.title = item.title;
      btn.setAttribute('aria-label', item.title);
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--az-input-bg);
        border: 1px solid var(--az-input-border);
        border-radius: 6px;
        padding: 5px 9px;
        color: var(--az-text-secondary);
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
        transition: all 0.15s ease;
      `;
      btn.onmouseover = () => {
        btn.style.background = 'var(--az-table-row-hover)';
        btn.style.borderColor = 'var(--az-accent-hover)';
        btn.style.color = 'var(--az-accent-hover)';
        btn.style.transform = 'translateY(-1px)';
      };
      btn.onmouseout = () => {
        btn.style.background = 'var(--az-input-bg)';
        btn.style.borderColor = 'var(--az-input-border)';
        btn.style.color = 'var(--az-text-secondary)';
        btn.style.transform = 'none';
      };
      btn.onclick = (e) => {
        e.preventDefault();
        onClick();
      };
      return btn;
    }

    return {
      init: function (s) {
        settings = s || {};
        if (settings.tools?.dateShortcutEnabled) {
          runWhenElementExists('.js_component_filter_item_sort', () => {
            this.addButton();
            this.addSortShortcuts();
          });
          runWhenElementExists('.js_component_filter_item_min_period', () => this.addMinPeriodButtons());
          runWhenElementExists('.js_component_filter_item_max_period', () => this.addMaxPeriodButtons());
          this.addTypeEmojiButtons();
          this.addPlayerShortcuts();
          setTimeout(() => {
            this.addTypeEmojiButtons();
            this.addPlayerShortcuts();
          }, 500);
          setTimeout(() => {
            this.addTypeEmojiButtons();
            this.addPlayerShortcuts();
          }, 1500);
        }
      },
      createClearShortcut: function (onClick) {
        const button = createShortcutLink('X', onClick);
        button.classList.add('arz-filter-clear-shortcut');
        button.title = 'Очистить поле';
        button.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        return button;
      },
      addButton: function () {
        if (document.getElementById('arz-date-shortcut-wrap')) return;
        const container = document.querySelector('.js_component_filter_item_sort');
        if (!container) return;
        const wrap = document.createElement('div');
        wrap.id = 'arz-date-shortcut-wrap';
        wrap.className = 'col-sm-3 mb-2';
        wrap.innerHTML = `
          <label class="mb-1 mt-2 text-muted">Выбор конкретной даты</label>
          <div class="form-group">
            <input id="arz-date-shortcut-input" type="text" placeholder="год-месяц-день" class="form-control" style="background: var(--az-input-bg); border: 1px solid var(--az-input-border); color: var(--az-accent); border-radius: var(--az-border-radius-small); padding: 8px;">
          </div>
          <div id="arz-specific-date-shortcuts" style="margin-top: 6px; display: flex; flex-wrap: wrap;"></div>
        `;

        const input = wrap.querySelector('#arz-date-shortcut-input');
        input.onchange = (e) => setDate(e.target.value.trim());

        const shortcutsWrap = wrap.querySelector('#arz-specific-date-shortcuts');
        const applySpecificDate = (daysAgo) => {
          const dateStr = getRelativeDateStr(daysAgo);
          input.value = dateStr;
          setDate(dateStr);
        };

        shortcutsWrap.appendChild(createShortcutLink('Сегодня', () => applySpecificDate(0)));
        shortcutsWrap.appendChild(createShortcutLink('Вчера', () => applySpecificDate(1)));
        shortcutsWrap.appendChild(createShortcutLink('Позавчера', () => applySpecificDate(2)));
        shortcutsWrap.appendChild(createShortcutLink('Неделю назад', () => applySpecificDate(7)));
        shortcutsWrap.appendChild(this.createClearShortcut(() => { input.value = ''; setDate(''); }));

        container.insertAdjacentElement('afterend', wrap);
      },
      addSortShortcuts: function () {
        if (document.getElementById('arz-sort-shortcuts')) return;
        const container = document.querySelector('.js_component_filter_item_sort');
        if (!container) return;

        const wrap = document.createElement('div');
        wrap.id = 'arz-sort-shortcuts';
        wrap.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;';

        wrap.appendChild(createShortcutLink('Сначала новые', () => setSortOrder('desc')));
        wrap.appendChild(createShortcutLink('Сначала старые', () => setSortOrder('asc')));

        container.appendChild(wrap);
      },
      addMinPeriodButtons: function () {
        if (document.getElementById('arz-min-period-shortcuts')) return;
        const container = document.querySelector('.js_component_filter_item_min_period');
        if (!container) return;
        const formGroup = container.querySelector('.form-group');
        if (!formGroup) return;

        const wrap = document.createElement('div');
        wrap.id = 'arz-min-period-shortcuts';
        wrap.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap;';

        wrap.appendChild(createShortcutLink('От 1 год назад', () => setMinPeriod('1y')));
        wrap.appendChild(createShortcutLink('От 3 месяца назад', () => setMinPeriod('3m')));
        wrap.appendChild(createShortcutLink('От 1 недели назад', () => setMinPeriod('1w')));
        wrap.appendChild(createShortcutLink('От сегодня 00:00', () => setMinPeriod('today')));

          formGroup.insertAdjacentElement('afterend', wrap);
      },
      addMaxPeriodButtons: function () {
        if (document.getElementById('arz-max-period-shortcuts')) return;
        const container = document.querySelector('.js_component_filter_item_max_period');
        if (!container) return;
        const formGroup = container.querySelector('.form-group');
        if (!formGroup) return;

        const wrap = document.createElement('div');
        wrap.id = 'arz-max-period-shortcuts';
        wrap.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap;';

        wrap.appendChild(createShortcutLink('До сегодня', () => setMaxPeriod('today')));
        wrap.appendChild(createShortcutLink('До 1 недели назад', () => setMaxPeriod('1w')));
        wrap.appendChild(createShortcutLink('До 3 месяца назад', () => setMaxPeriod('3m')));
        wrap.appendChild(createShortcutLink('До 1 год назад', () => setMaxPeriod('1y')));

          formGroup.insertAdjacentElement('afterend', wrap);
          const clear = this.createClearShortcut(() => { const input = container.querySelector('input[name="max_period"]'); if (input) { input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true })); } });
          wrap.appendChild(clear);
      },
      addTypeEmojiButtons: function () {
        const typeContainers = getTypeContainers();
        typeContainers.forEach((container, idx) => {
          if (container.querySelector('.arz-type-emoji-shortcuts')) return;

          const formGroup = container.querySelector('.form-group') || container;
          const wrap = document.createElement('div');
          wrap.className = 'arz-type-emoji-shortcuts';
          wrap.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px;';

          const emojis = [
            { char: '➕', icon: 'fa-solid fa-plus', title: 'Прибавление / Взял / Получил' },
            { char: '➖', icon: 'fa-solid fa-minus', title: 'Потерял / Положил / Отдал' },
            { char: '🎒', icon: 'fa-solid fa-bag-shopping', title: 'Инвентарь / Предметы' },
            { char: '💰', icon: 'fa-solid fa-money-bill-wave', title: 'Деньги / Наличные / Перевод' },
            { char: '🏦', icon: 'fa-solid fa-building-columns', title: 'Банк / Банковский счет' },
            { char: '🤝', icon: 'fa-solid fa-handshake', title: 'Трейд / Сделка / Обмен' },
            { char: '🪙', icon: 'fa-solid fa-coins', title: 'AZ-Coins' },
            { char: '🚗', icon: 'fa-solid fa-car-side', title: 'Действия с багажником' }
          ];

          emojis.forEach(item => {
            const btn = createEmojiShortcutButton(item, () => appendEmojiToType(container, item.char));
            wrap.appendChild(btn);
          });

          formGroup.insertAdjacentElement('beforeend', wrap);
          wrap.appendChild(this.createClearShortcut(() => {
            container.querySelectorAll('select').forEach(select => {
              Array.from(select.options).forEach(option => option.selected = false);
              select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            container.querySelectorAll('.select2-selection__rendered').forEach(el => el.textContent = '');
          }));
        });
      },
      addPlayerShortcuts: function () {
        const playerContainers = getPlayerContainers();
        playerContainers.forEach((container) => {
          if (container.querySelector('.arz-player-shortcuts')) return;

          const input = container.querySelector('input[type="text"], input:not([type="hidden"])');
          if (!input) return;

          const wrap = document.createElement('div');
          wrap.className = 'arz-player-shortcuts';
          wrap.style.cssText = 'margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;';

          wrap.appendChild(createShortcutLink('Из буфера', async () => {
            const text = await readClipboardText();
            if (text) {
              setPlayerInputValue(input, text);
              if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Вставлено из буфера: ${text}`, 'success');
            } else {
              if (window.ArizonaNotifications) window.ArizonaNotifications.show('Буфер обмена пуст или доступ запрещён', 'warning');
            }
          }));

          wrap.appendChild(createShortcutLink('Свой никнейм', () => {
            const nick = getMyNickname();
            if (nick) {
              setPlayerInputValue(input, nick);
              if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Вставлен свой никнейм: ${nick}`, 'success');
            } else {
              if (window.ArizonaNotifications) window.ArizonaNotifications.show('Никнейм авторизованного пользователя не найден', 'warning');
            }
          }));

          wrap.appendChild(createShortcutLink('Конверт в ID/Никнейм', async () => {
            const currentVal = input.value.trim();
            if (!currentVal) {
              if (window.ArizonaNotifications) window.ArizonaNotifications.show('Введите Никнейм или ID в поле!', 'warning');
              return;
            }

            if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Поиск данных для ${currentVal}...`, 'info');

            const isId = /^\d+$/.test(currentVal);
            const res = await window.ArizonaIdNickManager.resolveSingle(currentVal);

            if (!res) {
              if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Не удалось найти данные для ${currentVal}`, 'error');
              return;
            }

            if (isId) {
              if (res.nickname && res.nickname !== '-') {
                setPlayerInputValue(input, res.nickname);
                if (window.ArizonaNotifications) window.ArizonaNotifications.show(`ID ${currentVal} → Ник: ${res.nickname}`, 'success');
              } else {
                if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Никнейм не найден для ID ${currentVal}`, 'error');
              }
            } else {
              if (res.accountId && res.accountId !== '-') {
                setPlayerInputValue(input, res.accountId);
                if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Ник ${currentVal} → ID: ${res.accountId}`, 'success');
              } else {
                if (window.ArizonaNotifications) window.ArizonaNotifications.show(`ID аккаунта не найден для ника ${currentVal}`, 'error');
              }
            }
          }));

          container.appendChild(wrap);
          wrap.appendChild(this.createClearShortcut(() => setPlayerInputValue(input, '')));
        });
      },
      reposition: function () {
        if (settings.tools?.dateShortcutEnabled) {
          this.addButton();
          this.addSortShortcuts();
          this.addMinPeriodButtons();
          this.addMaxPeriodButtons();
          this.addTypeEmojiButtons();
          this.addPlayerShortcuts();
        }
      }
    };
  })();

  window.ArizonaMultiPlayersManager = (function () {
    let settings = {};
    let progressOverlay = null;
    let loading = false;

    async function readClipboardText() {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          return text ? text.trim() : '';
        }
      } catch (error) {
        console.warn('[MultiPlayers] Failed to read clipboard:', error);
      }
      return '';
    }

    function getPlayerFields() {
      return Array.from(document.querySelectorAll('input[name="player"], input[name="target"], input[name="player1"], input[name="player2"]'));
    }

    function setFieldsDisabled(disabled) {
      getPlayerFields().forEach(field => {
        field.disabled = disabled;
        field.title = disabled ? 'Очистите поле нескольких ID/никнеймов, чтобы использовать это поле' : '';
      });
    }

    function inject() {
      if (document.getElementById('arz-multi-player-wrap')) return;
      const ipContainer = document.querySelector('.js_component_filter_item_ip');
      if (!ipContainer) return;
      const wrap = document.createElement('div');
      wrap.id = 'arz-multi-player-wrap';
      wrap.className = 'col-sm-3 mb-2';
      wrap.innerHTML = `<label class="mb-1 mt-2 text-muted"><i class="fa-solid fa-users"></i> Ввод нескольких ID/никнеймов</label><div class="form-group"><textarea id="arz-multi-player-input" class="form-control" rows="2" placeholder="Nick_One, Nick_Two Nick_Three&#10;Можно разделять пробелом или запятой" style="resize:vertical; background:var(--az-input-bg);border:1px solid var(--az-input-border);color:var(--az-input-text);"></textarea></div><div class="arz-multi-player-shortcuts"></div>`;
      ipContainer.insertAdjacentElement('afterend', wrap);
      const input = wrap.querySelector('#arz-multi-player-input');
      const shortcuts = wrap.querySelector('.arz-multi-player-shortcuts');
      try { input.value = sessionStorage.getItem('arzMultiPlayersInput') || ''; } catch (error) { }
      shortcuts.appendChild(createShortcut('Из буфера', async () => {
        const text = await readClipboardText();
        if (text) { input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); }
      }));
      shortcuts.appendChild(createClearShortcut(() => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }));
      const update = () => setFieldsDisabled(input.value.trim().length > 0);
      input.addEventListener('input', () => {
        update();
        try {
          if (input.value.trim()) sessionStorage.setItem('arzMultiPlayersInput', input.value);
          else sessionStorage.removeItem('arzMultiPlayersInput');
        } catch (error) { }
      });
      update();
    }

    function createShortcut(label, onClick) {
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'arz-shortcut-link';
      link.textContent = label;
      link.onclick = (event) => { event.preventDefault(); onClick(); };
      return link;
    }

    function createClearShortcut(onClick) {
      const link = createShortcut('', onClick);
      link.classList.add('arz-filter-clear-shortcut');
      link.title = 'Очистить поле';
      link.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      return link;
    }

    function addIpShortcuts() {
      const container = document.querySelector('.js_component_filter_item_ip');
      if (!container || container.querySelector('.arz-ip-filter-shortcuts')) return;
      const input = container.querySelector('input, textarea');
      if (!input) return;
      const shortcuts = document.createElement('div');
      shortcuts.className = 'arz-ip-filter-shortcuts';
      shortcuts.appendChild(createShortcut('Из буфера', async () => {
        const text = await readClipboardText();
        if (text) { input.value = text; ['input', 'change'].forEach(type => input.dispatchEvent(new Event(type, { bubbles: true }))); }
      }));
      shortcuts.appendChild(createClearShortcut(() => {
        input.value = '';
        ['input', 'change'].forEach(type => input.dispatchEvent(new Event(type, { bubbles: true })));
      }));
      container.appendChild(shortcuts);
    }

    function sortRowsByDate() {
      const tbody = document.querySelector('table.table tbody');
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const getTime = row => {
        const value = row.querySelector('td:first-child')?.textContent.replace(/\s+/g, ' ').trim() || '';
        const isoMatch = value.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
        if (isoMatch) return Date.parse(`${isoMatch[1]}T${isoMatch[2]}`);
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? -Infinity : parsed;
      };
      rows.sort((a, b) => {
        const difference = getTime(b) - getTime(a);
        return Number.isNaN(difference) ? 0 : difference;
      });
      rows.forEach(row => tbody.appendChild(row));
    }

    function showProgress(total) {
      progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `<div class="arz-modal-container" style="max-width:420px;width:90%;"><div class="arz-modal-header"><div class="arz-modal-icon-wrapper"><i class="fa-solid fa-users"></i></div><div class="arz-modal-title-block"><div class="arz-modal-title">Загрузка логов игроков</div><div class="arz-modal-subtitle">Логи добавляются на текущую страницу</div></div></div><div class="arz-modal-body" style="text-align:center;"><div id="arz-multi-progress-text">Подготовка...</div><div style="height:7px;background:var(--az-input-bg);border-radius:4px;margin-top:14px;overflow:hidden;"><div id="arz-multi-progress-bar" style="height:100%;width:0;background:var(--az-accent);transition:width .25s ease;"></div></div></div><div class="arz-modal-footer"><button id="arz-multi-progress-cancel" class="arz-btn-danger" style="flex:1;"><i class="fa-solid fa-ban"></i> Отмена</button></div></div>`;
      openOverlay(progressOverlay);
      progressOverlay.querySelector('#arz-multi-progress-cancel').onclick = () => { loading = false; closeOverlay(progressOverlay); };
    }

    async function loadOthers(players) {
      if (loading || players.length < 2 || !document.querySelector('table.table tbody')) return;
      loading = true;
      showProgress(players.length - 1);
      const base = new URL(window.location.href);
      base.searchParams.delete('player'); base.searchParams.delete('target'); base.searchParams.delete('page'); base.searchParams.set('limit', '1000');
      const tbody = document.querySelector('table.table tbody');
      const known = new Set(Array.from(tbody.querySelectorAll('tr')).map(row => row.innerHTML));
      let done = 0;
      for (const player of players.slice(1)) {
        if (!loading) break;
        const url = new URL(base.href);
        url.searchParams.set('player', player);
        try {
          const response = await fetchWithRetry(url.href);
          const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
          doc.querySelectorAll('table.table tbody tr').forEach(row => {
            if (!known.has(row.innerHTML)) { known.add(row.innerHTML); row.removeAttribute('data-arz-processed'); row.removeAttribute('data-arz-ip-processed'); tbody.appendChild(row); }
          });
          sortRowsByDate();
        } catch (error) { console.warn('[Arizona] Ошибка загрузки игрока:', player, error); }
        done++;
        const text = progressOverlay?.querySelector('#arz-multi-progress-text');
        const bar = progressOverlay?.querySelector('#arz-multi-progress-bar');
        if (text) text.textContent = `Загружено игроков: ${done} из ${players.length - 1}`;
        if (bar) bar.style.width = `${done / (players.length - 1) * 100}%`;
        if (typeof processTable === 'function') processTable();
      }
      loading = false;
      sortRowsByDate();
      if (progressOverlay) closeOverlay(progressOverlay);
      try { sessionStorage.removeItem('arzMultiPlayersQueue'); } catch (error) { }
      if (window.ArizonaNotifications) window.ArizonaNotifications.show(`Загрузка завершена: добавлено игроков ${done}`, 'success');
    }

    return {
      init(s) {
        settings = s || {};
        runWhenElementExists('.js_component_filter_item_ip', () => {
          if (settings.tools?.multiPlayersEnabled !== false) inject();
          addIpShortcuts();
        });
        if (settings.tools?.multiPlayersEnabled !== false) {
          setTimeout(() => {
            try {
              const players = JSON.parse(sessionStorage.getItem('arzMultiPlayersQueue') || '[]');
              if (players.length > 1) loadOthers(players);
            } catch (error) { }
          }, 800);
        }
      },
      updateSettings(s) {
        settings = s || {};
        const disabled = settings.tools?.multiPlayersEnabled === false;
        if (disabled) {
          document.getElementById('arz-multi-player-wrap')?.remove();
          setFieldsDisabled(false);
        } else {
          inject();
          const input = document.getElementById('arz-multi-player-input');
          if (input) setFieldsDisabled(input.value.trim().length > 0);
        }
      }
    };
  })();

  window.ArizonaIdenticalIpHighlight = {
    init: function (s) {
      arizonaSettings = s || {};
      this.apply();
    },
    updateSettings: function (s) {
      arizonaSettings = s || {};
      if (!arizonaSettings.tools?.identicalIPs) {
        document.querySelectorAll('table.table tbody tr').forEach(row => {
          row.style.color = '';
          const ipCell = row.cells[3];
          if (ipCell) {
            ipCell.querySelectorAll('a[title="последний"]').forEach(l => l.style.color = '');
          }
        });
      } else {
        this.apply();
      }
    },
    apply: function () {
      document.querySelectorAll('table.table tbody tr').forEach(row => {
        highlightIdenticalIps(row);
      });
    }
  };

  window.ArizonaAnalyticsManager = (function () {
    let settings = {};
    let currentModeIP = 'exact';
    let currentModeRepeats = 'exact';
    let currentThresholdRepeats = 2;
    let activeTab = 'similar-ips';

    const LEADER_ACTION_REGEX = /(снял.*выговор|снял.*спец.\s*выговор|принял во фракцию|принял в фракцию|повысил|изменил ранг|уволил|выдал выговор|выдал скин|выдал ранг|принял в орг)/i;
    const ADMIN_ACTION_REGEX = /(телепортировал|выдал|спавн|заспавнил|снял наказание|разбанил|выдал лицензию|пополнил|вылечил|выдал хп|выдал армор|выдал оружие|назначил|выдал скины|выдал аз)/i;
    const TRANSFER_REGEX = /(перевёл|перевел).*\$|перевёл.*на банк|перевел.*на банк|получил от игрока.*\$|передал игроку.*\$|потерял из инвентаря|причина:\s*(перевод денег|передача денег|передача предметов|трейд|торговля)|на банк|в банке/i;

    const modalHTML = `
      <div id="arz-analytics-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container" style="max-width: 950px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper">
              <i class="fa-solid fa-chart-simple"></i>
            </div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Аналитика логов</div>
              <div class="arz-modal-subtitle">Поиск совпадений, повторов и пробив подозрительных сделок</div>
            </div>
            <button id="arz-analytics-close" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div class="arz-lookup-tabs" style="gap: 2px !important;">
            <button class="arz-tab-btn" data-tab="similar-ips"><i class="fa-solid fa-network-wired"></i> Похожие IP</button>
            <button class="arz-tab-btn" data-tab="repeats"><i class="fa-solid fa-rotate"></i> Повторы</button>
            <button class="arz-tab-btn" data-tab="leader-sales"><i class="fa-solid fa-user-tie"></i> Продажа лид. действий</button>
            <button class="arz-tab-btn" data-tab="admin-sales"><i class="fa-solid fa-user-ninja"></i> Продажа адм. действий</button>
          </div>
          
          <div class="arz-modal-body" style="gap: 16px !important; padding-top: 12px !important;">
            <div id="arz-analytics-tab-similar-ips" class="arz-tab-content" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="arz-modal-form-group">
                <label class="arz-modal-label"><i class="fa-solid fa-sliders"></i> Режим сравнения IP (по текущей странице)</label>
                <div style="display: flex; gap: 8px; background: var(--az-input-bg); padding: 6px; border-radius: 14px; border: 1px solid var(--az-border);">
                  <button type="button" class="similar-mode-btn active" data-mode="exact" style="flex: 1; padding: 8px 12px; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: var(--az-accent); color: white;">Точный IP</button>
                  <button type="button" class="similar-mode-btn" data-mode="subnet24" style="flex: 1; padding: 8px 12px; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--az-text-secondary);">Подсеть /24 (Похожие)</button>
                  <button type="button" class="similar-mode-btn" data-mode="subnet16" style="flex: 1; padding: 8px 12px; border: none; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--az-text-secondary);">Подсеть /16 (Провайдер)</button>
                </div>
              </div>
              
              <div class="arz-modal-form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="arz-modal-label"><i class="fa-solid fa-list-check"></i> Найденные совпадения</label>
                  <span id="arz-similar-groups-count" style="background: var(--az-accent); color: white; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 30px;">0 групп</span>
                </div>
                <div id="arz-similar-groups-list" class="arz-list-container" style="max-height: 450px; overflow-y: auto;"></div>
              </div>
            </div>

            <div id="arz-analytics-tab-repeats" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="display: flex; gap: 12px; align-items: flex-end;">
                <div class="arz-modal-form-group" style="flex: 2;">
                  <label class="arz-modal-label"><i class="fa-solid fa-sliders"></i> Режим сопоставления</label>
                  <div style="display: flex; gap: 6px; background: var(--az-input-bg); padding: 4px; border-radius: 12px; border: 1px solid var(--az-border);">
                    <button type="button" class="repeats-mode-btn active" data-mode="exact" style="flex: 1; padding: 6px 10px; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: var(--az-accent); color: white;">Полный лог</button>
                    <button type="button" class="repeats-mode-btn" data-mode="actionOnly" style="flex: 1; padding: 6px 10px; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--az-text-secondary);">Только действие</button>
                  </div>
                </div>
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-solid fa-arrow-up-9-1"></i> Повторов от</label>
                  <input type="number" id="arz-repeats-threshold" class="arz-input" min="2" max="100" value="2" style="padding: 6px 10px !important; text-align: center;">
                </div>
              </div>
              
              <div class="arz-modal-form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label class="arz-modal-label"><i class="fa-solid fa-list-check"></i> Обнаруженные повторы</label>
                  <span id="arz-repeats-groups-count" style="background: var(--az-accent); color: white; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 30px;">0 групп</span>
                </div>
                <div id="arz-repeats-groups-list" class="arz-list-container" style="max-height: 450px; overflow-y: auto;"></div>
              </div>
            </div>

            <div id="arz-analytics-tab-leader-sales" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; color: var(--az-text-secondary); line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--az-danger);"></i>
                <span>Пробив истории логов лидеров: Поиск пар "Лидерское действие + Передача средств от того же игрока за 15 минут".</span>
              </div>
              <div class="arz-modal-form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label class="arz-modal-label" style="margin: 0;"><i class="fa-solid fa-user-tie"></i> Ник(и) лидеров / заместителей</label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px; white-space: nowrap;">Введено: <strong id="arz-leader-sales-count-num" style="color: var(--az-accent-hover);">0</strong></span>
                    <span id="arz-leader-extract-btn" style="font-size: 11px; color: var(--az-accent-hover); cursor: pointer; display: flex; align-items: center; gap: 4px; user-select: none; border-bottom: 1px dashed currentColor; white-space: nowrap;" title="Извлечь ники Nick_Name из любого текста"><i class="fa-solid fa-wand-magic-sparkles"></i> Извлечь ники</span>
                  </div>
                </div>
                <textarea id="arz-leader-sales-nicks" class="arz-textarea" rows="3" placeholder="Введите никнеймы лидеров (каждый с новой строки или через запятую)"></textarea>
              </div>
              <div style="display: flex; gap: 12px; width: 100%; box-sizing: border-box;">
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата от</label>
                  <input type="date" id="arz-leader-sales-date-from" class="arz-input">
                </div>
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата до</label>
                  <input type="date" id="arz-leader-sales-date-to" class="arz-input">
                </div>
              </div>
              <div class="arz-date-shortcuts" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; width: 100% !important; box-sizing: border-box !important; margin-top: -4px !important;">
                <button type="button" class="arz-btn-shortcut" data-range="day">За день</button>
                <button type="button" class="arz-btn-shortcut" data-range="week">За неделю</button>
                <button type="button" class="arz-btn-shortcut" data-range="month">За месяц</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-week">С начала недели</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-month">С начала месяца</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-year">С начала года</button>
              </div>
              <button type="button" id="arz-start-leader-sales-btn" class="arz-btn-primary" style="margin-top: 4px;"><i class="fa-solid fa-magnifying-glass"></i> Пробить логи лидеров</button>
            </div>

            <div id="arz-analytics-tab-admin-sales" class="arz-tab-content" style="display: none; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; color: var(--az-text-secondary); line-height: 1.4; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--az-danger);"></i>
                <span>Пробив истории логов админов: Поиск пар "Админское действие + Передача средств от того же игрока за 15 минут".</span>
              </div>
              <div class="arz-modal-form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label class="arz-modal-label" style="margin: 0;"><i class="fa-solid fa-user-ninja"></i> Ник(и) администраторов</label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: var(--az-text-secondary); background: var(--az-input-bg); border: 1px solid var(--az-border); padding: 2px 8px; border-radius: 12px; white-space: nowrap;">Введено: <strong id="arz-admin-sales-count-num" style="color: var(--az-accent-hover);">0</strong></span>
                    <span id="arz-admin-extract-btn" style="font-size: 11px; color: var(--az-accent-hover); cursor: pointer; display: flex; align-items: center; gap: 4px; user-select: none; border-bottom: 1px dashed currentColor; white-space: nowrap;" title="Извлечь ники Nick_Name из любого текста"><i class="fa-solid fa-wand-magic-sparkles"></i> Извлечь ники</span>
                  </div>
                </div>
                <textarea id="arz-admin-sales-nicks" class="arz-textarea" rows="3" placeholder="Введите никнеймы админов (каждый с новой строки или через запятую)"></textarea>
              </div>
              <div style="display: flex; gap: 12px; width: 100%; box-sizing: border-box;">
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата от</label>
                  <input type="date" id="arz-admin-sales-date-from" class="arz-input">
                </div>
                <div class="arz-modal-form-group" style="flex: 1;">
                  <label class="arz-modal-label"><i class="fa-regular fa-calendar"></i> Дата до</label>
                  <input type="date" id="arz-admin-sales-date-to" class="arz-input">
                </div>
              </div>
              <div class="arz-date-shortcuts" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; width: 100% !important; box-sizing: border-box !important; margin-top: -4px !important;">
                <button type="button" class="arz-btn-shortcut" data-range="day">За день</button>
                <button type="button" class="arz-btn-shortcut" data-range="week">За неделю</button>
                <button type="button" class="arz-btn-shortcut" data-range="month">За месяц</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-week">С начала недели</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-month">С начала месяца</button>
                <button type="button" class="arz-btn-shortcut" data-range="start-year">С начала года</button>
              </div>
              <button type="button" id="arz-start-admin-sales-btn" class="arz-btn-primary" style="margin-top: 4px;"><i class="fa-solid fa-magnifying-glass"></i> Пробить логи админов</button>
            </div>
          </div>
          
          <div class="arz-modal-footer">
            <button id="arz-analytics-reset" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-rotate-left"></i> Сбросить фильтр</button>
            <button id="arz-analytics-show-all" class="arz-btn-primary" style="flex: 1.5;"><i class="fa-solid fa-eye"></i> Показать все на странице</button>
          </div>
        </div>
      </div>
    `;

    function extractNicksFromRow(row) {
      const nicks = new Set();
      row.querySelectorAll('a[href*="player="], a[href*="player"]').forEach(lnk => {
        let text = '';
        if (lnk.href) {
          try {
            const url = new URL(lnk.href, window.location.origin);
            text = url.searchParams.get('player') || '';
          } catch (e) { }
        }
        if (!text) text = lnk.textContent.trim();
        if (text && isValidNickname(text)) nicks.add(text);
      });
      row.querySelectorAll('a strong').forEach(el => {
        const text = el.textContent.trim();
        if (text && isValidNickname(text)) nicks.add(text);
      });
      const textContent = (row.cells[1]?.textContent || '') + ' ' + (row.cells[2]?.textContent || '');
      const nickRegex = /\b[A-Z][a-zA-Z0-9]*_[A-Za-z0-9_]+\b/g;
      const matches = textContent.match(nickRegex);
      if (matches) {
        matches.forEach(m => {
          if (isValidNickname(m)) nicks.add(m);
        });
      }
      return Array.from(nicks);
    }

    function parseLogRowTime(row) {
      const cell = row.cells[0];
      if (!cell) return null;
      const text = cell.textContent.trim();
      const m = text.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (m) {
        return new Date(`${m[1]}T${m[2]}`);
      }
      return null;
    }

    function extractIpsFromRow(row) {
      const ips = new Set();
      const ipCell = getIpCellFromRow(row);
      if (!ipCell) return [];

      if (typeof parseAllIpsFromCell === 'function') {
        const pairs = parseAllIpsFromCell(ipCell);
        if (pairs && pairs.length > 0) {
          pairs.forEach(pair => {
            if (pair.lastIp && !pair.lastIp.includes('*')) ips.add(pair.lastIp);
            if (pair.regIp && !pair.regIp.includes('*')) ips.add(pair.regIp);
          });
        }
      }

      const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      const textMatches = ipCell.textContent.match(ipRegex);
      if (textMatches) {
        textMatches.forEach(ip => ips.add(ip));
      }

      return Array.from(ips);
    }

    function getIpKey(ip, mode) {
      const parts = ip.split('.');
      if (parts.length < 4) return null;
      if (mode === 'subnet24') {
        return parts.slice(0, 3).join('.') + '.X';
      }
      if (mode === 'subnet16') {
        return parts.slice(0, 2).join('.') + '.X.X';
      }
      return ip;
    }

    function extractNickIpPairsFromRow(row) {
      const nicks = extractNicksFromRow(row);
      const ipCell = getIpCellFromRow(row);
      if (!ipCell || nicks.length === 0) return [];

      const pairs = typeof parseAllIpsFromCell === 'function' ? parseAllIpsFromCell(ipCell) : [];
      const result = [];

      if (pairs.length > 0) {
        pairs.forEach((pair, idx) => {
          let targetNick = null;
          const prefix = (pair.prefix || '').toUpperCase();

          if (prefix.includes('II') || prefix.includes('2')) {
            targetNick = nicks[1] || null;
          } else if (prefix.includes('I') || prefix.includes('1') || idx === 0) {
            targetNick = nicks[0] || null;
          }

          if (targetNick) {
            if (pair.lastIp && !pair.lastIp.includes('*')) {
              result.push({ nick: targetNick, ip: pair.lastIp });
            }
            if (pair.regIp && !pair.regIp.includes('*') && pair.regIp !== '255.255.255.255') {
              result.push({ nick: targetNick, ip: pair.regIp });
            }
          }
        });
      } else {
        const rawIps = extractIpsFromRow(row);
        if (nicks[0] && rawIps.length > 0) {
          rawIps.forEach(ip => result.push({ nick: nicks[0], ip: ip }));
        }
      }

      return result;
    }

    function scanAndGroupIPs(mode) {
      const rows = document.querySelectorAll('table.table tbody tr');
      const groups = {};

      rows.forEach(row => {
        const nickIpPairs = extractNickIpPairsFromRow(row);
        if (nickIpPairs.length === 0) return;

        nickIpPairs.forEach(({ nick, ip }) => {
          const key = getIpKey(ip, mode);
          if (!key) return;

          if (!groups[key]) {
            groups[key] = {
              key: key,
              ips: new Set(),
              nicks: new Set(),
              nickDistances: {},
              rows: []
            };
          }
          groups[key].ips.add(ip);
          groups[key].nicks.add(nick);

          let distanceText = '';
          const ipCell = getIpCellFromRow(row);
          if (ipCell && typeof parseAllIpsFromCell === 'function') {
            const pairs = parseAllIpsFromCell(ipCell);
            if (pairs && pairs[0]) {
              const pair = pairs[0];
              const regData = pair.regIp ? ipDetailsCache[pair.regIp] : null;
              const lastData = pair.lastIp ? ipDetailsCache[pair.lastIp] : null;
              if (regData && lastData && regData.lat && regData.lon && lastData.lat && lastData.lon) {
                const dist = calculateHaversineDistance(regData.lat, regData.lon, lastData.lat, lastData.lon);
                if (dist !== null) {
                  distanceText = `~${Math.round(dist)}km`;
                }
              }
            }
          }
          if (distanceText) {
            if (!groups[key].nickDistances[nick]) {
              groups[key].nickDistances[nick] = new Set();
            }
            groups[key].nickDistances[nick].add(distanceText);
          }

          if (!groups[key].rows.includes(row)) {
            groups[key].rows.push(row);
          }
        });
      });

      return Object.values(groups).filter(g => g.nicks.size > 1);
    }

    function scanAndGroupRepeats(mode, threshold) {
      const rows = document.querySelectorAll('table.table tbody tr');
      const groups = {};

      rows.forEach(row => {
        const nicks = extractNicksFromRow(row);

        const actionCell = row.cells[1];
        const dataCell = row.cells[2];
        if (!actionCell) return;

        const cleanCell = (cell) => {
          if (!cell) return '';
          const clone = cell.cloneNode(true);
          clone.querySelectorAll('.arz-row-actions-wrapper, .arz-cell-copy-btn, .arz-log-copy-menu-btn, .arz-col-eye-btn, .badge, .bi, svg, i, .az-geo-inserted').forEach(el => el.remove());
          const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
          return clone.textContent.replace(ipGeoRegex, '').replace(/\s+/g, ' ').trim();
        };

        let actionText = cleanCell(actionCell);
        if (mode === 'exact' && dataCell) {
          actionText += ' | ' + cleanCell(dataCell);
        }
        if (!actionText) return;

        if (nicks.length > 0) {
          nicks.forEach(nick => {
            const key = nick + '::' + actionText;
            if (!groups[key]) {
              groups[key] = {
                nick: nick,
                actionText: actionText,
                rows: []
              };
            }
            groups[key].rows.push(row);
          });
        } else {
          const key = 'NO_NICK::' + actionText;
          if (!groups[key]) {
            groups[key] = {
              nick: 'Без ника',
              actionText: actionText,
              rows: []
            };
          }
          groups[key].rows.push(row);
        }
      });

      return Object.values(groups).filter(g => g.rows.length >= threshold);
    }

    async function processSalesProbing(nicks, dateFrom, dateTo, type) {
      let cancelBatch = false;

      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'arz-modal-overlay';
      progressOverlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 400px; width: 90%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper" style="background: rgba(var(--az-danger-rgb), 0.15); color: var(--az-danger);"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Пробив продажи услуг</div>
              <div class="arz-modal-subtitle">Анализ истории логов ${type === 'leader' ? 'лидеров' : 'админов'}...</div>
            </div>
          </div>
          <div class="arz-modal-body" style="padding: 24px; text-align: center;">
            <div id="arz-progress-player" style="font-size: 16px; font-weight: 600; color: var(--az-text); margin-bottom: 8px;">Запуск...</div>
            <div id="arz-progress-status" style="font-size: 13px; color: var(--az-text-secondary); margin-bottom: 20px;">Загрузка логов с сервера</div>
            
            <div class="arz-progress-bar-container" style="width: 100%; height: 6px; background: var(--az-border); border-radius: 3px; overflow: hidden; margin-bottom: 24px;">
              <div id="arz-progress-bar-fill" style="width: 0%; height: 100%; background: var(--az-danger); transition: width 0.3s ease; border-radius: 3px;"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-progress-cancel-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-ban"></i> Отмена</button>
          </div>
        </div>
      `;
      openOverlay(progressOverlay);

      const playerTextEl = progressOverlay.querySelector('#arz-progress-player');
      const statusTextEl = progressOverlay.querySelector('#arz-progress-status');
      const barFillEl = progressOverlay.querySelector('#arz-progress-bar-fill');
      const cancelBtn = progressOverlay.querySelector('#arz-progress-cancel-btn');

      cancelBtn.onclick = () => {
        cancelBatch = true;
        closeOverlay(progressOverlay);
        window.ArizonaNotifications.show('Пробив отменен', 'warning');
      };

      const allMatches = [];

      for (let i = 0; i < nicks.length; i++) {
        if (cancelBatch) break;
        const mainNick = nicks[i];

        playerTextEl.textContent = mainNick;
        statusTextEl.textContent = `Загрузка логов (${i + 1} из ${nicks.length})`;
        barFillEl.style.width = `${Math.round((i / nicks.length) * 100)}%`;

        try {
          const fetchUrl = new URL(window.location.href);
          fetchUrl.searchParams.set('player', mainNick);
          fetchUrl.searchParams.set('limit', '1000');
          fetchUrl.searchParams.set('sort', 'desc');
          fetchUrl.searchParams.delete('type[]');
          fetchUrl.searchParams.delete('arz_online');
          fetchUrl.searchParams.delete('arz_punish');

          if (dateFrom) fetchUrl.searchParams.set('min_period', dateFrom + ' 00:00:00');
          if (dateTo) fetchUrl.searchParams.set('max_period', dateTo + ' 23:59:59');

          const response = await fetchWithRetry(fetchUrl.href);
          if (!response.ok) {
            throw new Error(`Ошибка запроса: ${response.status}`);
          }
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, 'text/html');

          const rows = doc.querySelectorAll('table.table tbody tr');
          const parsedLogs = [];

          rows.forEach(row => {
            const cells = row.cells;
            if (cells.length < 2) return;
            const timeStr = cells[0]?.textContent?.trim() || '';
            const actionText = (cells[1]?.textContent || '').replace(/\s+/g, ' ').trim();
            const dateObj = parseLogRowTime(row);
            if (!dateObj) return;

            const nicksInLine = extractNicksFromRow(row);

            parsedLogs.push({
              timeStr,
              timestamp: dateObj.getTime(),
              text: actionText,
              nicks: nicksInLine
            });
          });

          const actionRegex = type === 'leader' ? LEADER_ACTION_REGEX : ADMIN_ACTION_REGEX;
          const actionLogs = parsedLogs.filter(p => actionRegex.test(p.text));
          const transferLogs = parsedLogs.filter(p => TRANSFER_REGEX.test(p.text));

          actionLogs.forEach(actLog => {
            transferLogs.forEach(transLog => {
              if (actLog === transLog) return;
              const diffSec = Math.abs(actLog.timestamp - transLog.timestamp) / 1000;
              if (diffSec <= 900) {
                const commonNicks = actLog.nicks.filter(n => transLog.nicks.includes(n));
                if (commonNicks.length >= 2) {
                  allMatches.push({
                    mainNick,
                    actionLog: actLog,
                    transferLog: transLog,
                    nicks: commonNicks,
                    diffSec: Math.round(diffSec)
                  });
                }
              }
            });
          });

        } catch (err) {
          console.error(`Error probing sales for ${mainNick}:`, err);
        }

        await new Promise(r => setTimeout(r, 250));
      }

      if (!cancelBatch) {
        closeOverlay(progressOverlay);
        renderSalesResultsModal(allMatches, type);
      }
    }

    function renderSalesResultsModal(matches, type) {
      let cardsHtml = '';
      const copyLines = [`Результаты пробива продажи ${type === 'leader' ? 'лидерских' : 'админских'} услуг:`];

      if (matches.length === 0) {
        cardsHtml = `
          <div class="arz-empty-state">
            <i class="fa-solid fa-circle-check" style="font-size: 28px; color: var(--az-success);"></i>
            <span>Подозрительных совпадений за указанный период не обнаружено</span>
          </div>
        `;
      } else {
        matches.forEach((m, idx) => {
          const timeDiffStr = m.diffSec < 60 ? `${m.diffSec} сек.` : `${Math.round(m.diffSec / 60)} мин.`;
          const titleIcon = type === 'leader' ? 'fa-user-tie' : 'fa-user-ninja';

          cardsHtml += `
            <div class="arz-sales-card">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 700; color: var(--az-text);">
                  <i class="fa-solid ${titleIcon}" style="color: var(--az-danger); margin-right: 6px;"></i> ${m.nicks.join(' ↔ ')}
                </span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="arz-sales-badge"><i class="fa-solid fa-stopwatch"></i> разница: ${timeDiffStr}</span>
                  <button type="button" class="arz-btn-secondary arz-copy-pair-btn" data-index="${idx}" title="Скопировать эту пару логов" style="padding: 2px 8px !important; font-size: 11px !important; height: auto !important;">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                </div>
              </div>
              <div class="arz-sales-log-item">
                <div style="font-size: 10px; color: var(--az-text-secondary); margin-bottom: 2px;">${m.actionLog.timeStr}</div>
                <div>${window.ArizonaUtils.escapeHtml(m.actionLog.text)}</div>
              </div>
              <div class="arz-sales-log-item transfer">
                <div style="font-size: 10px; color: var(--az-text-secondary); margin-bottom: 2px;">${m.transferLog.timeStr}</div>
                <div>${window.ArizonaUtils.escapeHtml(m.transferLog.text)}</div>
              </div>
            </div>
          `;

          copyLines.push(`${m.actionLog.timeStr} | ${m.actionLog.text}\n${m.transferLog.timeStr} | ${m.transferLog.text}\n`);
        });
      }

      const copyText = copyLines.join('\n');

      const overlay = document.createElement('div');
      overlay.className = 'arz-modal-overlay';
      overlay.innerHTML = `
        <div class="arz-modal-container" style="max-width: 950px; width: 95%;">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper" style="background: rgba(var(--az-danger-rgb), 0.15); color: var(--az-danger);"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Результаты пробива продажи услуг</div>
              <div class="arz-modal-subtitle">Обнаружено совпадений: ${matches.length}</div>
            </div>
            <button id="arz-sales-results-close-header" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="online-result-table-wrapper" style="max-height: 420px; overflow-y: auto; padding: 16px; background: var(--az-input-bg); border-bottom: 1px solid var(--az-border);">
            ${cardsHtml}
          </div>
          <div class="arz-modal-footer">
            <button id="arz-sales-copy-btn" class="arz-btn-primary" style="flex: 2;"><i class="fa-regular fa-copy"></i> Скопировать все найденные логи</button>
            <button id="arz-sales-close-btn" class="arz-btn-danger" style="flex: 1;"><i class="fa-solid fa-xmark"></i> Закрыть</button>
          </div>
        </div>
      `;

      openOverlay(overlay);

      overlay.querySelector('#arz-sales-close-btn').onclick = () => closeOverlay(overlay);
      overlay.querySelector('#arz-sales-results-close-header').onclick = () => closeOverlay(overlay);

      overlay.querySelectorAll('.arz-copy-pair-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          const item = matches[idx];
          if (!item) return;

          const pairText = `${item.actionLog.timeStr} | ${item.actionLog.text}\n${item.transferLog.timeStr} | ${item.transferLog.text}`;
          navigator.clipboard.writeText(pairText).then(() => {
            const icon = btn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-check';
            btn.style.color = 'var(--az-success)';
            setTimeout(() => {
              if (icon) icon.className = 'fa-regular fa-copy';
              btn.style.color = '';
            }, 1500);
          });
        };
      });

      overlay.querySelector('#arz-sales-copy-btn').onclick = () => {
        navigator.clipboard.writeText(copyText).then(() => {
          const btn = overlay.querySelector('#arz-sales-copy-btn');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
          setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Скопировать все найденные логи', 2000);
        });
      };
    }

    function renderIPs(modal, groups) {
      const listContainer = modal.querySelector('#arz-similar-groups-list');
      const countBadge = modal.querySelector('#arz-similar-groups-count');
      if (!listContainer) return;

      listContainer.innerHTML = '';
      countBadge.textContent = `${groups.length} групп`;

      if (groups.length === 0) {
        listContainer.innerHTML = `
          <div class="arz-empty-state">
            <i class="fa-solid fa-face-smile" style="font-size: 24px; color: var(--az-text-secondary);"></i>
            <span>Совпадений не найдено</span>
          </div>
        `;
        return;
      }

      groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'arz-similar-group-card';
        card.style.cursor = 'pointer';

        const sortedIps = Array.from(group.ips).join(', ');
        const formattedNicks = Array.from(group.nicks).map(nick => {
          const distSet = group.nickDistances && group.nickDistances[nick];
          const distArray = distSet ? Array.from(distSet).filter(Boolean) : [];
          if (distArray.length > 0) {
            return `${nick} (${distArray.join('/')})`;
          }
          return nick;
        }).join(', ');

        const countText = group.nicks.size > 0 ? `${group.nicks.size} акк.` : `${group.rows.length} лог.`;
        const accountListText = formattedNicks.length > 0 ? formattedNicks : `${group.rows.length} записей`;

        card.innerHTML = `
          <div class="arz-similar-group-title">
            <span><i class="fa-solid fa-network-wired" style="color: var(--az-accent-hover); margin-right: 6px;"></i> ${group.key}</span>
            <span class="badge" style="background: rgba(var(--az-accent-rgb), 0.1); color: var(--az-accent-hover); border: 1px solid rgba(var(--az-accent-rgb), 0.2);">${countText}</span>
          </div>
          <div class="arz-similar-group-nicks">
            Аккаунты: <strong>${accountListText}</strong>
          </div>
          <div class="arz-similar-group-ips">
            IP: ${sortedIps}
          </div>
        `;

        card.onclick = () => {
          const tableRows = document.querySelectorAll('table.table tbody tr');
          tableRows.forEach(row => {
            if (group.rows.includes(row)) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          });
          window.ArizonaNotifications.show(`Показано ${group.rows.length} логов для ${group.key}`, 'success');
          closeOverlay(modal);
        };

        listContainer.appendChild(card);
      });
    }

    function renderRepeats(modal, groups) {
      const listContainer = modal.querySelector('#arz-repeats-groups-list');
      const countBadge = modal.querySelector('#arz-repeats-groups-count');
      if (!listContainer) return;

      listContainer.innerHTML = '';
      countBadge.textContent = `${groups.length} групп`;

      if (groups.length === 0) {
        listContainer.innerHTML = `
          <div class="arz-empty-state">
            <i class="fa-solid fa-face-smile" style="font-size: 24px; color: var(--az-text-secondary);"></i>
            <span>Повторов не найдено</span>
          </div>
        `;
        return;
      }

      groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'arz-repeat-group-card';
        card.style.cursor = 'pointer';

        card.innerHTML = `
          <div class="arz-repeat-group-title">
            <span><i class="fa-solid fa-user" style="color: var(--az-accent-hover); margin-right: 6px;"></i> ${group.nick}</span>
            <span class="badge" style="background: rgba(var(--az-accent-rgb), 0.1); color: var(--az-accent-hover); border: 1px solid rgba(var(--az-accent-rgb), 0.2);">${group.rows.length} повт.</span>
          </div>
          <div class="arz-repeat-group-desc">
            Действие: <strong>${window.ArizonaUtils.escapeHtml(group.actionText)}</strong>
          </div>
        `;

        card.onclick = () => {
          const tableRows = document.querySelectorAll('table.table tbody tr');
          tableRows.forEach(row => {
            if (group.rows.includes(row)) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          });
          window.ArizonaNotifications.show(`Показано ${group.rows.length} повторов для ${group.nick}`, 'success');
          closeOverlay(modal);
        };

        listContainer.appendChild(card);
      });
    }

    async function setupModal(modal) {
      modal.querySelector('#arz-analytics-close').onclick = () => closeOverlay(modal);

      const tabs = modal.querySelectorAll('.arz-tab-btn');
      const footer = modal.querySelector('.arz-modal-footer');

      tabs.forEach(tab => {
        tab.onclick = () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          activeTab = tab.dataset.tab;

          modal.querySelector('#arz-analytics-tab-similar-ips').style.display = activeTab === 'similar-ips' ? 'flex' : 'none';
          modal.querySelector('#arz-analytics-tab-repeats').style.display = activeTab === 'repeats' ? 'flex' : 'none';
          modal.querySelector('#arz-analytics-tab-leader-sales').style.display = activeTab === 'leader-sales' ? 'flex' : 'none';
          modal.querySelector('#arz-analytics-tab-admin-sales').style.display = activeTab === 'admin-sales' ? 'flex' : 'none';

          if (footer) {
            if (activeTab === 'similar-ips' || activeTab === 'repeats') {
              footer.style.display = 'flex';
            } else {
              footer.style.display = 'none';
            }
          }
        };
      });

      const leaderTabContainer = modal.querySelector('#arz-analytics-tab-leader-sales');
      const adminTabContainer = modal.querySelector('#arz-analytics-tab-admin-sales');

      if (leaderTabContainer) setupDateShortcuts(leaderTabContainer, 'arz-leader-sales-date-from', 'arz-leader-sales-date-to');
      if (adminTabContainer) setupDateShortcuts(adminTabContainer, 'arz-admin-sales-date-from', 'arz-admin-sales-date-to');

      if (typeof setupNickCounter === 'function') {
        setupNickCounter(modal, '#arz-leader-sales-nicks', 'arz-leader-sales-count-num');
        setupNickCounter(modal, '#arz-admin-sales-nicks', 'arz-admin-sales-count-num');
      }

      const setupExtractBtn = (btnId, textareaId) => {
        const btn = modal.querySelector('#' + btnId);
        if (btn) {
          btn.onclick = (e) => {
            e.preventDefault();
            const textarea = modal.querySelector('#' + textareaId);
            if (!textarea) return;
            const text = textarea.value;
            const nickRegex = /\b[A-Z][a-zA-Z0-9]*_[A-Za-z0-9_]+\b/g;
            const matches = text.match(nickRegex);
            const validMatches = matches ? matches.filter(isValidNickname) : [];
            if (validMatches.length === 0) {
              window.ArizonaNotifications.show('Никнеймы Nick_Name не найдены!', 'error');
              return;
            }
            const uniqueNicks = Array.from(new Set(validMatches));
            textarea.value = uniqueNicks.join(',');
            textarea.dispatchEvent(new Event('input'));
            window.ArizonaNotifications.show(`Извлечено никнеймов: ${uniqueNicks.length}`, 'success');
          };
        }
      };

      setupExtractBtn('arz-leader-extract-btn', 'arz-leader-sales-nicks');
      setupExtractBtn('arz-admin-extract-btn', 'arz-admin-sales-nicks');

      const params = new URLSearchParams(window.location.search);
      const urlMin = params.get('min_period');
      const urlMax = params.get('max_period');
      if (urlMin) {
        modal.querySelector('#arz-leader-sales-date-from').value = urlMin.split(' ')[0];
        modal.querySelector('#arz-admin-sales-date-from').value = urlMin.split(' ')[0];
      }
      if (urlMax) {
        modal.querySelector('#arz-leader-sales-date-to').value = urlMax.split(' ')[0];
        modal.querySelector('#arz-admin-sales-date-to').value = urlMax.split(' ')[0];
      }

      modal.querySelector('#arz-start-leader-sales-btn').onclick = () => {
        const val = modal.querySelector('#arz-leader-sales-nicks').value.trim();
        const nicks = val.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
        if (nicks.length === 0) {
          window.ArizonaNotifications.show('Введите хотя бы один ник лидера', 'error');
          return;
        }
        const df = modal.querySelector('#arz-leader-sales-date-from').value;
        const dt = modal.querySelector('#arz-leader-sales-date-to').value;
        closeOverlay(modal);
        processSalesProbing(nicks, df, dt, 'leader');
      };

      modal.querySelector('#arz-start-admin-sales-btn').onclick = () => {
        const val = modal.querySelector('#arz-admin-sales-nicks').value.trim();
        const nicks = val.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
        if (nicks.length === 0) {
          window.ArizonaNotifications.show('Введите хотя бы один ник админа', 'error');
          return;
        }
        const df = modal.querySelector('#arz-admin-sales-date-from').value;
        const dt = modal.querySelector('#arz-admin-sales-date-to').value;
        closeOverlay(modal);
        processSalesProbing(nicks, df, dt, 'admin');
      };

      modal.querySelector('[data-tab="similar-ips"]').classList.add('active');
      modal.querySelector('#arz-analytics-tab-similar-ips').style.display = 'flex';
      if (footer) footer.style.display = 'flex';

      if (typeof loadIpDetailsCache === 'function') {
        await loadIpDetailsCache();
      }

      const similarModeButtons = modal.querySelectorAll('.similar-mode-btn');
      similarModeButtons.forEach(btn => {
        btn.onclick = async () => {
          similarModeButtons.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--az-text-secondary)';
          });
          btn.classList.add('active');
          btn.style.background = 'var(--az-accent)';
          btn.style.color = 'white';

          currentModeIP = btn.dataset.mode;
          if (typeof loadIpDetailsCache === 'function') {
            await loadIpDetailsCache();
          }
          const groups = scanAndGroupIPs(currentModeIP);
          renderIPs(modal, groups);
        };
      });

      const thresholdInput = modal.querySelector('#arz-repeats-threshold');
      if (thresholdInput) {
        thresholdInput.oninput = () => {
          let val = parseInt(thresholdInput.value);
          if (isNaN(val) || val < 2) val = 2;
          currentThresholdRepeats = val;
          const groups = scanAndGroupRepeats(currentModeRepeats, currentThresholdRepeats);
          renderRepeats(modal, groups);
        };
      }

      const repeatsModeButtons = modal.querySelectorAll('.repeats-mode-btn');
      repeatsModeButtons.forEach(btn => {
        btn.onclick = () => {
          repeatsModeButtons.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--az-text-secondary)';
          });
          btn.classList.add('active');
          btn.style.background = 'var(--az-accent)';
          btn.style.color = 'white';

          currentModeRepeats = btn.dataset.mode;
          const groups = scanAndGroupRepeats(currentModeRepeats, currentThresholdRepeats);
          renderRepeats(modal, groups);
        };
      });

      modal.querySelector('#arz-analytics-reset').onclick = () => {
        document.querySelectorAll('table.table tbody tr').forEach(row => {
          row.style.display = '';
        });
        window.ArizonaNotifications.show('Фильтр сброшен', 'info');
        closeOverlay(modal);
      };

      modal.querySelector('#arz-analytics-show-all').onclick = () => {
        const tableRows = document.querySelectorAll('table.table tbody tr');
        const allMatchingRows = new Set();
        let shown = 0;

        if (activeTab === 'similar-ips') {
          const groups = scanAndGroupIPs(currentModeIP);
          groups.forEach(g => g.rows.forEach(r => allMatchingRows.add(r)));
        } else if (activeTab === 'repeats') {
          const groups = scanAndGroupRepeats(currentModeRepeats, currentThresholdRepeats);
          groups.forEach(g => g.rows.forEach(r => allMatchingRows.add(r)));
        }

        tableRows.forEach(row => {
          if (allMatchingRows.has(row)) {
            row.style.display = '';
            shown++;
          } else {
            row.style.display = 'none';
          }
        });
        window.ArizonaNotifications.show(`Показано ${shown} совпадающих логов`, 'success');
        closeOverlay(modal);
      };

      const ipGroups = scanAndGroupIPs(currentModeIP);
      renderIPs(modal, ipGroups);

      const repeatsGroups = scanAndGroupRepeats(currentModeRepeats, currentThresholdRepeats);
      renderRepeats(modal, repeatsGroups);
    }

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const hasSimilar = settings.tools?.similarIPsFinder !== false;
        const hasRepeats = settings.tools?.actionRepeatsFinder !== false;
        const isEnabled = currentSettings['extension-toggle'] !== false &&
          settings.tools?.analytics !== false && (hasSimilar || hasRepeats);

        const existingBtn = document.getElementById('arz-analytics-btn');
        if (isEnabled) {
          runWhenElementExists('.filter-buttons', () => this.injectButton());
        } else {
          if (existingBtn) existingBtn.remove();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-analytics-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-analytics-btn';
        btn.className = 'btn btn-success';
        btn.style.cssText = 'margin-left: 10px;';
        btn.innerHTML = `<i class="fa-solid fa-chart-simple" style="margin-right: 6px;"></i> Аналитика`;

        btn.onclick = async () => {
          const overlay = document.createElement('div');
          overlay.className = 'arz-modal-overlay';
          overlay.innerHTML = modalHTML;
          const el = overlay;
          openOverlay(el);
          await setupModal(el);
        };

        container.appendChild(btn);
      }
    };
  })();

  window.ArizonaCopyLogsManager = (function () {
    let settings = {};
    function formatAction(cell) {
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('.btn, button, .js_entry_format_button, .arz-col-eye-btn, .badge, .bi, svg, i, .app__hidden, .az-geo-inserted').forEach(el => el.remove());
      clone.querySelectorAll('a[href*="?player="]').forEach(lnk => {
        const b = lnk.querySelector('b, strong');
        if (b) {
          const l = document.createElement('a');
          l.href = lnk.href;
          l.target = '_blank';
          l.style.cssText = 'color: var(--az-accent-hover); font-weight: bold; text-decoration: none;';
          l.textContent = b.textContent;
          b.parentNode.replaceChild(l, b);
        }
      });
      clone.querySelectorAll('span[style*="color"], font').forEach(sp => {
        const sty = sp.getAttribute('style');
        if (sty?.includes('color')) {
          const s = document.createElement('span');
          s.setAttribute('style', sty);
          s.innerHTML = sp.innerHTML;
          sp.parentNode.replaceChild(s, sp);
        }
      });
      let html = clone.innerHTML;
      const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
      html = html.replace(ipGeoRegex, '');
      return html.trim();
    }

    function formatData(cell) {
      const txt = cell.textContent.trim();
      const parts = [];
      const iMatch = txt.match(/I:\s*([\d,\s]+\/[\d,\s]+\/[\d,\s]+)/i);
      const iiMatch = txt.match(/II:\s*([\d,\s]+\/[\d,\s]+\/[\d,\s]+)/i);
      if (iMatch) {
        const v = iMatch[1].split('/').map(x => x.trim());
        parts.push(`<span style="color: var(--az-accent-hover); font-weight: bold;">I:</span> <span style="color: var(--az-accent-hover);">${v[0]}</span> / <span style="color: var(--az-accent-hover);">${v[1]}</span> / <span style="color: var(--az-accent-hover);">${v[2]}</span>`);
      }
      if (iiMatch) {
        const v = iiMatch[1].split('/').map(x => x.trim());
        parts.push(`<span style="color: var(--az-accent-hover); font-weight: bold;">II:</span> <span style="color: var(--az-accent-hover);">${v[0]}</span> / <span style="color: var(--az-accent-hover);">${v[1]}</span> / <span style="color: var(--az-accent-hover);">${v[2]}</span>`);
      }
      return parts.length > 0 ? parts.join('<br>') : txt;
    }

    function formatIP(cell) {
      const clone = cell.cloneNode(true);
      const blocks = clone.querySelectorAll('.table-ip');
      const res = [];
      if (blocks.length > 0) {
        blocks.forEach(b => {
          const lbl = b.querySelector('strong code')?.textContent.trim() || '';
          const ips = Array.from(b.querySelectorAll('a[href*="ip="]')).map(lnk => {
            const ip = lnk.textContent.trim().replace(/\*/g, '***');
            return `<a href="${lnk.href}" target="_blank" style="color: var(--az-accent-hover); text-decoration: none;">${ip}</a>`;
          });
          if (ips.length) res.push(`<span style="color: var(--az-accent-hover); font-weight: bold;">${lbl}</span> ${ips.join(' · ')}`);
        });
        return res.join('<br>');
      }
      const links = clone.querySelectorAll('a[href*="ip="]');
      if (links.length > 0) {
        return Array.from(links).map(lnk => `<a href="${lnk.href}" target="_blank" style="color: var(--az-accent-hover); text-decoration: none;">${lnk.textContent.trim().replace(/\*/g, '***')}</a>`).join(' · ');
      }
      return clone.textContent;
    }

    function isRowVisible(row) {
      if (!row) return false;
      if (row.classList.contains('arz-row-hidden')) return false;
      if (row.style.display === 'none') return false;
      const style = window.getComputedStyle(row);
      return style && style.display !== 'none' && style.visibility !== 'hidden';
    }

    function copyTable(rows) {
      const visibleRows = (rows || []).filter(isRowVisible);
      const tbl = document.querySelector('table.table');
      if (!tbl || visibleRows.length === 0) return;
      const headers = tbl.querySelectorAll('thead th');
      const visible = [];
      headers.forEach((th, idx) => {
        const eye = th.querySelector('.arz-col-eye-btn');
        if (!eye || !eye.querySelector('.fa-eye-slash')) visible.push(idx);
      });
      if (visible.length === 0) visible.push(0, 1);

      let html = '<table width="100%" cellpadding="3" cellspacing="0" border="0" style="border-collapse: collapse; font-family: Nunito, sans-serif; font-size: 13px;">';
      let plain = '';
      visibleRows.forEach(row => {
        html += '<tr>';
        const cells = row.querySelectorAll('td');
        const plainCells = [];
        visible.forEach(idx => {
          if (cells[idx]) {
            let inner = '';
            if (idx === 0) inner = cells[idx].textContent.trim();
            else if (idx === 1) inner = formatAction(cells[idx]);
            else if (idx === 2) inner = formatData(cells[idx]);
            else if (idx === 3) inner = formatIP(cells[idx]);
            html += `<td style="padding: 4px 8px; border: 1px solid #ddd; vertical-align: top; ${idx !== 1 ? 'white-space: nowrap;' : ''}">${inner}</td>`;
            plainCells.push(cells[idx].textContent.replace(/\s+/g, ' ').trim());
          }
        });
        html += '</tr>';
        plain += plainCells.join('\t') + '\n';
      });
      html += '</table>';

      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain.trim()], { type: 'text/plain' })
        })
      ]);
    }

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.tools?.copyAllLogsEnabled !== false;
        const existingBtn = document.getElementById('arz-copy-page-logs-btn');
        if (isEnabled) {
          runWhenElementExists('.filter-buttons', () => this.injectButton());
        } else {
          if (existingBtn) existingBtn.remove();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-copy-page-logs-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-copy-page-logs-btn';
        btn.className = 'btn btn-primary';
        btn.style.cssText = 'margin-left: 10px;';
        btn.innerHTML = `<i class="fa-regular fa-copy" style="margin-right: 6px;"></i> Копировать страницу`;
        btn.onclick = () => {
          this.copyAllPageLogs();
          const oldHTML = btn.innerHTML;
          btn.innerHTML = `<i class="fa-solid fa-check" style="margin-right: 6px;"></i> Скопировано!`;
          setTimeout(() => {
            btn.innerHTML = oldHTML;
          }, 2000);
        };
        container.appendChild(btn);
      },
      copyAllPageLogs: function () {
        const tbl = document.querySelector('table.table');
        if (!tbl) return;
        const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(isRowVisible);
        if (rows.length === 0) return;

        const formattedLines = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const time = cells[0].textContent.trim();
            const actionCell = cells[1].cloneNode(true);
            actionCell.querySelectorAll('.btn, button, .js_entry_format_button, .arz-col-eye-btn, .badge, .bi, svg, i, .app__hidden, .az-geo-inserted').forEach(el => el.remove());
            let logText = actionCell.textContent;
            const ipGeoRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?:\s*\([^)]*\))?(?:\s*~\d+(?:\.\d+)?km)?/g;
            logText = logText.replace(ipGeoRegex, '').replace(/\s+/g, ' ').trim();
            formattedLines.push(`[${time}] ${logText}`);
          }
        });

        const textToCopy = formattedLines.join('\n');
        navigator.clipboard.writeText(textToCopy).then(() => {
          window.ArizonaNotifications.show('Логи скопированы!', 'success');
        }).catch(err => {
          console.error('Failed to copy logs:', err);
          window.ArizonaNotifications.show('Ошибка копирования', 'error');
        });
      },
      copyAllLogs: function () {
        const tbl = document.querySelector('table.table');
        if (!tbl) return;
        const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter(isRowVisible);
        if (rows.length > 0) copyTable(rows);
      }
    };
  })();

  window.ArizonaSidebarManager = (function () {
    let settings = {};

    return {
      init: function (s) {
        settings = s || {};
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const isToggleEnabled = currentSettings['extension-toggle'] !== false && currentSettings['visual-toggle-sidebar'] !== false;
        const btn = document.getElementById('arz-sidebar-toggle-btn');

        if (isToggleEnabled) {
          document.body.classList.add('arz-toggle-sidebar-active');
          if (!btn) {
            this.createButton();
          }
          const savedState = localStorage.getItem('arz_sidebar_collapsed');
          if (savedState === 'true') {
            document.body.classList.add('arz-sidebar-collapsed');
            this.updateButtonLabel(true);
          } else {
            document.body.classList.remove('arz-sidebar-collapsed');
            this.updateButtonLabel(false);
          }
        } else {
          document.body.classList.remove('arz-toggle-sidebar-active', 'arz-sidebar-collapsed');
          if (btn) btn.remove();
        }
      },
      createButton: function () {
        if (document.getElementById('arz-sidebar-toggle-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'arz-sidebar-toggle-btn';
        btn.type = 'button';
        btn.title = 'Открыть / скрыть боковое меню';
        btn.innerHTML = `<i class="fa-solid fa-bars-staggered" style="font-size: 13px;"></i> <span class="arz-sidebar-btn-text" style="font-size: 12px;">Меню</span>`;
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isCollapsed = document.body.classList.toggle('arz-sidebar-collapsed');
          localStorage.setItem('arz_sidebar_collapsed', isCollapsed ? 'true' : 'false');
          this.updateButtonLabel(isCollapsed);
        };

        const logoContainer = document.querySelector('.app-nav-logo, .navbar-brand.logo, .navbar-brand');
        if (logoContainer) {
          logoContainer.prepend(btn);
        } else {
          const nav = document.querySelector('.app-nav, .app-header');
          if (nav) nav.prepend(btn);
          else document.body.appendChild(btn);
        }
      },
      updateButtonLabel: function (isCollapsed) {
        const btn = document.getElementById('arz-sidebar-toggle-btn');
        if (!btn) return;
        if (isCollapsed) {
          btn.innerHTML = `<i class="fa-solid fa-bars" style="font-size: 13px; color: var(--az-accent-hover);"></i> <span class="arz-sidebar-btn-text" style="font-size: 12px;">Меню</span>`;
        } else {
          btn.innerHTML = `<i class="fa-solid fa-bars-staggered" style="font-size: 13px;"></i> <span class="arz-sidebar-btn-text" style="font-size: 12px;">Меню</span>`;
        }
      }
    };
  })();

  window.ArizonaTemplatesManager = (function () {
    let settings = {};
    let templates = [];
    let currentModal = null;

    function getCurrentFilterState() {
      const state = {
        formParams: {},
        formParamSummary: [],
        searchText: '',
        searchMode: 'show',
        searchAuto: false
      };

      const form = document.querySelector('form.filter');
      if (form) {
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
          if (value !== '') {
            if (!state.formParams[key]) {
              state.formParams[key] = [];
            }
            state.formParams[key].push(value);
          }
        }

        const selectedTypeLabels = [];
        form.querySelectorAll('select[name*="type"] option:checked, select[name*="types"] option:checked').forEach(opt => {
          const txt = opt.textContent.trim();
          if (txt && !selectedTypeLabels.includes(txt)) selectedTypeLabels.push(txt);
        });

        form.querySelectorAll('.select2-selection__choice, .tag-item, .badge, .label').forEach(b => {
          const txt = b.textContent.replace('×', '').trim();
          if (txt && !selectedTypeLabels.includes(txt) && !txt.includes('Сбросить') && !txt.includes('Применить')) {
            selectedTypeLabels.push(txt);
          }
        });

        const playerInput = form.querySelector('input[name="player"]');
        if (playerInput && playerInput.value.trim()) {
          state.formParamSummary.push(`Игрок: ${playerInput.value.trim()}`);
        }

        if (selectedTypeLabels.length > 0) {
          state.formParamSummary.push(`Типы: ${selectedTypeLabels.slice(0, 3).join(', ')}${selectedTypeLabels.length > 3 ? '...' : ''}`);
        } else if (state.formParams['type[]'] || state.formParams['types[]'] || state.formParams['type'] || state.formParams['types']) {
          const arr = state.formParams['type[]'] || state.formParams['types[]'] || state.formParams['type'] || state.formParams['types'];
          state.formParamSummary.push(`Типов: ${arr.length}`);
        }
      }

      const filterTa = document.getElementById('arz-filter-logs');
      if (filterTa && filterTa.value.trim()) {
        state.searchText = filterTa.value.trim();
        state.searchMode = document.querySelector('input[name="arz-filter-logs-mode"]:checked')?.value || 'show';
        state.searchAuto = !!document.getElementById('arz-filter-logs-auto')?.checked;
        state.formParamSummary.push(`Поиск: ${state.searchText}`);
      }

      return state;
    }

    function render() {
      const container = document.getElementById('arz-templates-list');
      const search = document.getElementById('arz-templates-search');
      if (!container) return;

      const term = search ? search.value.toLowerCase() : '';
      const filtered = templates.filter(t => t.name.toLowerCase().includes(term) || (t.filters && t.filters.toLowerCase().includes(term)));
      document.getElementById('arz-templates-total-count').textContent = templates.length;

      if (filtered.length === 0) {
        container.innerHTML = `<div class="arz-empty-state"><i class="fa-regular fa-folder-open" style="font-size:24px;margin-bottom:8px;color:var(--az-danger);"></i> Нет сохраненных шаблонов</div>`;
        return;
      }

      container.innerHTML = filtered.map(t => `
        <div class="arz-template-card" data-id="${t.id}">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;">
            <div class="arz-template-card-title">${window.ArizonaUtils.escapeHtml(t.name)}</div>
            <div class="arz-template-card-subtitle">${window.ArizonaUtils.escapeHtml(t.filters || 'Шаблон фильтров')}</div>
          </div>
          <div style="display:flex;align-items:center;">
            <button class="btn-delete arz-list-item-btn" data-id="${t.id}"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.arz-template-card').forEach(card => {
        card.onclick = (e) => {
          if (e.target.closest('.btn-delete')) {
            const id = parseInt(e.target.closest('.btn-delete').dataset.id);
            templates = templates.filter(t => t.id !== id);
            localStorage.setItem('filter_templates', JSON.stringify(templates));
            render();
            window.ArizonaNotifications.show('Шаблон удален', 'info');
            return;
          }
          const id = parseInt(card.dataset.id);
          const t = templates.find(item => item.id === id);
          if (!t) return;

          if (t.formParams && Object.keys(t.formParams).length > 0) {
            const targetUrl = new URL(window.location.origin + window.location.pathname);

            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get('server_number') && !t.formParams['server_number']) {
              targetUrl.searchParams.set('server_number', currentUrl.searchParams.get('server_number'));
            }

            for (const key in t.formParams) {
              const vals = t.formParams[key];
              if (Array.isArray(vals)) {
                vals.forEach(v => targetUrl.searchParams.append(key, v));
              } else if (vals) {
                targetUrl.searchParams.append(key, vals);
              }
            }

            if (t.searchFilter) {
              chrome.storage.local.set({
                arzLogFilter: {
                  text: t.searchFilter.text || '',
                  mode: t.searchFilter.mode || 'show',
                  auto: t.searchFilter.auto !== false
                }
              });
            }

            window.ArizonaNotifications.show('Применение шаблона...', 'info');
            closeModal();
            setTimeout(() => {
              window.location.href = targetUrl.toString();
            }, 50);
            return;
          }

          const filterText = t.searchFilter?.text || t.filters || '';
          const ta = document.getElementById('arz-filter-logs');
          if (ta && filterText) {
            ta.value = filterText;
            if (t.searchFilter?.mode) {
              const rad = document.querySelector(`input[name="arz-filter-logs-mode"][value="${t.searchFilter.mode}"]`);
              if (rad) rad.checked = true;
            }
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            window.ArizonaNotifications.show('Шаблон применен', 'success');
            closeModal();
          } else {
            window.ArizonaNotifications.show('Шаблон применен', 'info');
            closeModal();
          }
        };
      });
    }

    function closeModal() {
      if (currentModal) {
        closeOverlay(currentModal);
        currentModal = null;
      }
    }

    const modalHTML = `
      <div id="arz-templates-overlay" class="arz-modal-overlay">
        <div class="arz-modal-container">
          <div class="arz-modal-header">
            <div class="arz-modal-icon-wrapper"><i class="fa-solid fa-folder-open"></i></div>
            <div class="arz-modal-title-block">
              <div class="arz-modal-title">Шаблоны фильтров</div>
              <div class="arz-modal-subtitle">Быстрый доступ к сохраненным фильтрам</div>
            </div>
            <button id="arz-templates-close" class="arz-modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="arz-modal-body">
            <div class="arz-modal-form-group">
              <label class="arz-modal-label"><i class="fa-solid fa-square-plus"></i> Новый шаблон</label>
              <div style="display:flex;gap:12px;width:100%;box-sizing:border-box;">
                <input type="text" id="arz-new-template-name" class="arz-input" placeholder="Название шаблона..." style="flex:1;">
                <button id="arz-add-template-btn" class="arz-btn-primary" style="padding: 10px 20px !important;">Сохранить</button>
              </div>
            </div>
            <div class="arz-modal-form-group">
              <label class="arz-modal-label"><i class="fa-solid fa-magnifying-glass"></i> Поиск</label>
              <input type="text" id="arz-templates-search" class="arz-input" placeholder="Поиск шаблонов...">
            </div>
            <div class="arz-modal-form-group">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <label class="arz-modal-label"><i class="fa-solid fa-bookmark"></i> Сохраненные шаблоны</label>
                <span style="font-size:10px;color:var(--az-text-secondary);background:var(--az-border);padding:3px 8px;border-radius:12px;">Всего: <span id="arz-templates-total-count">0</span></span>
              </div>
              <div id="arz-templates-list" class="arz-list-container"></div>
            </div>
          </div>
          <div class="arz-modal-footer">
            <button id="arz-templates-close-bottom" class="arz-btn-danger" style="flex:1;">Закрыть</button>
          </div>
        </div>
      </div>
    `;

    return {
      init: function (s) {
        settings = s || {};
        try {
          templates = JSON.parse(localStorage.getItem('filter_templates')) || [];
        } catch (e) { templates = []; }
        this.update();
      },
      updateSettings: function (s) {
        settings = s || {};
        this.update();
      },
      update: function () {
        const isEnabled = currentSettings['extension-toggle'] !== false && settings.templatesEnabled !== false;
        const existingBtn = document.getElementById('arz-templates-btn');
        if (isEnabled) {
          runWhenElementExists('.filter-buttons', () => this.injectButton());
        } else {
          if (existingBtn) existingBtn.remove();
        }
      },
      injectButton: function () {
        if (document.getElementById('arz-templates-btn')) return;
        const container = document.querySelector('.filter-buttons');
        if (!container) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'arz-templates-btn';
        btn.className = 'btn btn-success';
        btn.style.cssText = 'margin-left: 10px;';
        btn.innerHTML = `<i class="fa-solid fa-folder-open" style="margin-right: 6px;"></i> Шаблоны`;
        btn.onclick = () => {
          const overlay = document.createElement('div');
          overlay.innerHTML = modalHTML;
          const el = overlay.firstElementChild;
          openOverlay(el);
          currentModal = el;
          render();

          el.querySelector('#arz-templates-close').onclick = closeModal;
          el.querySelector('#arz-templates-close-bottom').onclick = closeModal;
          el.querySelector('#arz-templates-search').oninput = () => render();
          el.querySelector('#arz-add-template-btn').onclick = () => {
            const nameInput = el.querySelector('#arz-new-template-name');
            const name = nameInput.value.trim();
            if (!name) { window.ArizonaNotifications.show('Введите название шаблона', 'error'); return; }

            const state = getCurrentFilterState();
            const hasFormParams = Object.keys(state.formParams).some(k => state.formParams[k].length > 0);
            const hasSearch = !!state.searchText;

            if (!hasFormParams && !hasSearch) {
              window.ArizonaNotifications.show('Фильтры не установлены!', 'error');
              return;
            }

            let summaryText = state.formParamSummary.join(' | ');
            if (!summaryText) {
              summaryText = state.searchText ? `Поиск: ${state.searchText}` : 'Сохраненные фильтры';
            }

            templates.unshift({
              id: Date.now(),
              name: name,
              filters: summaryText,
              formParams: state.formParams,
              searchFilter: {
                text: state.searchText,
                mode: state.searchMode,
                auto: state.searchAuto
              }
            });

            localStorage.setItem('filter_templates', JSON.stringify(templates));
            nameInput.value = '';
            render();
            window.ArizonaNotifications.show('Шаблон сохранен!', 'success');
          };
        };
        container.appendChild(btn);
      }
    };
  })();



  let resetBtnElement = null;
  let originalResetBtnHTML = null;
  let originalResetBtnParent = null;
  let originalResetBtnStyle = null;
  let originalResetBtnClasses = null;

  function styleResetButton() {
    const container = document.querySelector('.filter-buttons');
    if (!container) return;

    if (resetBtnElement && !document.body.contains(resetBtnElement)) {
      resetBtnElement = null;
    }

    let resetBtn = resetBtnElement;
    if (!resetBtn) {
      const candidates = Array.from(document.querySelectorAll('.filter-buttons a, .filter-buttons button, form a, form button'));
      resetBtn = candidates.find(el => {
        if (el.id && el.id.startsWith('arz-')) return false;
        if (el.getAttribute('type') === 'submit') return false;

        const text = el.textContent.trim().toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();

        return text.includes('сбросить') ||
          text.includes('очистить') ||
          el.getAttribute('type') === 'reset' ||
          href.replace(/^http:/, 'https:').replace(/\/$/, '') === LOGS_ORIGIN;
      });
      if (resetBtn) {
        resetBtnElement = resetBtn;
      }
    }

    if (!resetBtn) return;

    const isEnabled = currentSettings['extension-toggle'] !== false && arizonaSettings.tools?.styleResetButtonEnabled !== false;

    if (originalResetBtnHTML === null) {
      originalResetBtnHTML = resetBtn.innerHTML;
      originalResetBtnParent = resetBtn.parentElement;
      originalResetBtnStyle = resetBtn.getAttribute('style') || '';
      originalResetBtnClasses = Array.from(resetBtn.classList);
    }

    if (!isEnabled) {
      resetBtn.innerHTML = originalResetBtnHTML;
      resetBtn.style.cssText = originalResetBtnStyle;
      resetBtn.className = '';
      originalResetBtnClasses.forEach(c => resetBtn.classList.add(c));
      if (resetBtn.parentElement !== originalResetBtnParent && originalResetBtnParent) {
        originalResetBtnParent.appendChild(resetBtn);
      }
      return;
    }

    resetBtn.classList.remove('btn-danger', 'btn-outline-danger', 'btn-default');
    resetBtn.classList.add('btn', 'btn-success');
    resetBtn.style.color = 'white !important';

    if (!resetBtn.querySelector('i')) {
      const text = resetBtn.textContent.replace(/\s+/g, ' ').trim();
      resetBtn.innerHTML = `<i class="fa-solid fa-rotate-left" style="margin-right: 6px;"></i> ${text}`;
    }

    if (resetBtn.parentElement !== container) {
      container.insertBefore(resetBtn, container.children[1] || null);
    }
  }

  function isRealSubmitButton(el) {
    if (!el) return false;
    if (el.id && el.id.startsWith('arz-')) return false;
    if (el.tagName === 'A') return false;
    if (el.getAttribute('type') === 'submit') return true;
    if (el.tagName === 'BUTTON' && el.classList.contains('btn-success') && !el.id && (el.closest('form.filter') || el.closest('.filter-buttons'))) {
      return true;
    }
    return false;
  }

  function handleFilterSubmit(form, submitBtn) {
    if (!submitBtn) {
      submitBtn = form ? form.querySelector('button[type="submit"]:not([id^="arz-"]), input[type="submit"]:not([id^="arz-"])') : null;
    }
    if (!submitBtn) {
      submitBtn = document.querySelector('.filter-buttons button[type="submit"]:not([id^="arz-"]), .filter-buttons button.btn-success:not([id^="arz-"])');
    }

    if (submitBtn && isRealSubmitButton(submitBtn)) {
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
      submitBtn.style.pointerEvents = 'none';
    }

    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(window.location.origin + window.location.pathname);

    currentUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });

    const actualForm = form || document.querySelector('form.filter');
    const multiInput = document.getElementById('arz-multi-player-input');
    const multiPlayers = multiInput ? multiInput.value.split(/[\s,]+/).map(value => value.trim()).filter(Boolean) : [];
    if (multiPlayers.length > 0) {
      const firstPlayer = multiPlayers[0];
      if (actualForm) {
        const playerInput = actualForm.querySelector('input[name="player"]');
        if (playerInput) {
          playerInput.value = firstPlayer;
          playerInput.disabled = false;
        }
      }
      try {
        sessionStorage.setItem('arzMultiPlayersQueue', JSON.stringify(multiPlayers));
      } catch (error) {
        console.warn('[Arizona] Не удалось сохранить очередь игроков:', error);
      }
    } else {
      try { sessionStorage.removeItem('arzMultiPlayersQueue'); } catch (error) { }
    }
    if (actualForm) {
      const formData = new FormData(actualForm);

      const allFormNames = new Set(formData.keys());
      actualForm.querySelectorAll('[name]').forEach(el => {
        const name = el.getAttribute('name');
        if (name) allFormNames.add(name);
      });

      allFormNames.forEach(key => {
        targetUrl.searchParams.delete(key);
        if (key.endsWith('[]')) {
          targetUrl.searchParams.delete(key.slice(0, -2));
        } else {
          targetUrl.searchParams.delete(`${key}[]`);
        }
      });

      for (const [key, value] of formData.entries()) {
        if (value !== '') {
          targetUrl.searchParams.append(key, value);
        }
      }

      if (multiPlayers.length > 0) {
        targetUrl.searchParams.set('player', multiPlayers[0]);
      }
    }

    const limitSelect = document.querySelector('select[name="limit"]');
    if (limitSelect && limitSelect.value) {
      targetUrl.searchParams.set('limit', limitSelect.value);
    }

    setTimeout(() => {
      window.location.href = targetUrl.toString();
    }, 20);
  }

  function fixSubmitLag() {
    const forms = document.querySelectorAll('form.filter');
    forms.forEach(form => {
      if (form.getAttribute('data-arz-submit-bound') === 'true') return;
      form.setAttribute('data-arz-submit-bound', 'true');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const btn = form.querySelector('button[type="submit"]:not([id^="arz-"]), input[type="submit"]:not([id^="arz-"])');
        handleFilterSubmit(form, btn);
      }, true);
    });

    const buttons = document.querySelectorAll('form.filter button:not([id^="arz-"]), .filter-buttons button:not([id^="arz-"])');
    buttons.forEach(btn => {
      if (!isRealSubmitButton(btn)) return;
      if (btn.getAttribute('data-arz-click-bound') === 'true') return;
      btn.setAttribute('data-arz-click-bound', 'true');

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const form = btn.closest('form.filter') || document.querySelector('form.filter');
        handleFilterSubmit(form, btn);
      }, true);
    });
  }

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form && form.matches('form.filter')) {
      e.preventDefault();
      e.stopPropagation();
      const btn = form.querySelector('button[type="submit"]:not([id^="arz-"]), input[type="submit"]:not([id^="arz-"])');
      handleFilterSubmit(form, btn);
    }
  }, true);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"]');
    if (btn && isRealSubmitButton(btn) && (btn.closest('form.filter') || btn.closest('.filter-buttons'))) {
      e.preventDefault();
      e.stopPropagation();
      const form = btn.closest('form.filter') || document.querySelector('form.filter');
      handleFilterSubmit(form, btn);
    }
  }, true);

  let isInitialized = false;

  window.ArizonaMultiSelectManager = (function () {
    let isEnabled = true;
    let barElement = null;

    function createBar() {
      if (document.getElementById('arz-bulk-actions-bar')) return;
      barElement = document.createElement('div');
      barElement.id = 'arz-bulk-actions-bar';
      barElement.innerHTML = `
        <div class="arz-bulk-bar-count">
          <i class="fa-solid fa-check-double" style="color: var(--az-accent-hover);"></i>
          Выделено логов: <strong id="arz-bulk-count-num">0</strong>
        </div>
        <div class="arz-bulk-bar-actions">
          <button type="button" class="arz-btn-secondary" id="arz-bulk-copy-logs" title="Копировать в формате Время + Лог">
            <i class="fa-regular fa-copy"></i> Время + Лог
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-copy-nicks" title="Скопировать никнеймы">
            <i class="fa-solid fa-user"></i> Никнеймы
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-copy-full" title="Скопировать всю информацию">
            <i class="fa-solid fa-align-left"></i> Вся инфо
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-download-txt" title="Скачать выделенные логи в файл .txt">
            <i class="fa-solid fa-file-arrow-down"></i> В .txt
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-mark" title="Отметить выделенные логи">
            <i class="fa-solid fa-bookmark" style="color: var(--az-warning);"></i> Отметить
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-unmark" title="Снять метки с выделенных логов">
            <i class="fa-regular fa-bookmark"></i> Снять метку
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-show" title="Показать скрытые логи">
            <i class="fa-solid fa-eye"></i> Показать
          </button>
          <button type="button" class="arz-btn-secondary" id="arz-bulk-hide" title="Скрыть выделенные логи">
            <i class="fa-solid fa-eye-slash"></i> Скрыть
          </button>
          <button type="button" class="arz-btn-danger" id="arz-bulk-deselect" title="Снять выделение со всех">
            <i class="fa-solid fa-xmark"></i> Отмена
          </button>
        </div>
      `;
      document.body.appendChild(barElement);

      barElement.querySelector('#arz-bulk-copy-logs').onclick = copyLogsTimeText;
      barElement.querySelector('#arz-bulk-copy-nicks').onclick = copyNicks;
      barElement.querySelector('#arz-bulk-copy-full').onclick = copyFullInfo;
      barElement.querySelector('#arz-bulk-download-txt').onclick = downloadSelectedAsTxt;
      barElement.querySelector('#arz-bulk-mark').onclick = markSelected;
      barElement.querySelector('#arz-bulk-unmark').onclick = unmarkSelected;
      barElement.querySelector('#arz-bulk-show').onclick = showSelected;
      barElement.querySelector('#arz-bulk-hide').onclick = hideSelected;
      barElement.querySelector('#arz-bulk-deselect').onclick = deselectAll;
    }

    function updateBarVisibility() {
      if (!barElement) createBar();
      const selectedCheckboxes = document.querySelectorAll('table.table tbody tr input.arz-row-checkbox:checked');
      const count = selectedCheckboxes.length;
      const numEl = document.getElementById('arz-bulk-count-num');
      if (numEl) numEl.textContent = count;

      const isMultiEnabled = currentSettings['extension-toggle'] !== false && currentSettings['tweak-multi-select'] !== false;
      if (count > 0 && isMultiEnabled) {
        barElement.classList.add('visible');
      } else {
        if (barElement) barElement.classList.remove('visible');
      }
    }

    function injectCheckbox(tr) {
      const isMultiEnabled = currentSettings['extension-toggle'] !== false && currentSettings['tweak-multi-select'] !== false;
      if (!isMultiEnabled) return;
      if (tr.querySelector('.arz-row-checkbox')) return;
      const firstCell = tr.cells[0];
      if (!firstCell) return;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'arz-row-checkbox';
      cb.title = 'Выделить лог';

      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        tr.classList.toggle('arz-row-selected', cb.checked);
        updateBarVisibility();
      });

      firstCell.insertBefore(cb, firstCell.firstChild);
    }

    function getSelectedRows() {
      const checked = document.querySelectorAll('table.table tbody tr input.arz-row-checkbox:checked');
      return Array.from(checked).map(cb => cb.closest('tr')).filter(Boolean);
    }

    function copyLogsTimeText() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      const lines = rows.map(tr => {
        const date = getCleanCellText(tr.cells[0]);
        const action = getCleanCellText(tr.cells[1]);
        return `[${date}] ${action}`;
      });
      writeToClipboard(lines.join('\n')).then(() => {
        window.ArizonaNotifications.show(`Скопировано логов: ${lines.length}`, 'success');
      });
    }

    function copyNicks() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      const nicksSet = new Set();
      rows.forEach(tr => {
        const actionCell = tr.cells[1];
        if (actionCell) {
          actionCell.querySelectorAll('a[href*="player="], a strong').forEach(el => {
            const text = el.textContent.trim();
            if (isValidNickname(text)) nicksSet.add(text);
          });
          const textContent = actionCell.textContent || '';
          const matches = textContent.match(/\b[A-Z][a-zA-Z0-9]*_[A-Za-z0-9_]+\b/g);
          if (matches) {
            matches.forEach(m => { if (isValidNickname(m)) nicksSet.add(m); });
          }
        }
      });
      const nicks = Array.from(nicksSet);
      if (nicks.length === 0) {
        window.ArizonaNotifications.show('Никнеймы в выделенных логах не найдены', 'warning');
        return;
      }
      writeToClipboard(nicks.join('\n')).then(() => {
        window.ArizonaNotifications.show(`Скопировано уникальных никнеймов: ${nicks.length}`, 'success');
      });
    }

    function copyFullInfo() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      const lines = rows.map(tr => {
        const date = getCleanCellText(tr.cells[0]);
        const action = getCleanCellText(tr.cells[1]);
        const data = getCleanCellText(tr.cells[2]);
        const ipCell = getIpCellFromRow(tr);
        const ip = getCleanCellText(ipCell, true);

        const parts = [date, action, data, ip].map(x => x.trim());
        while (parts.length > 0 && !parts[parts.length - 1]) {
          parts.pop();
        }
        return parts.join(' | ');
      });

      writeToClipboard(lines.join('\n')).then(() => {
        window.ArizonaNotifications.show(`Скопировано полных строк: ${lines.length}`, 'success');
      });
    }

    function downloadTxtFile(filename, text) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function downloadSelectedAsTxt() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;

      const lines = rows.map(tr => {
        const date = getCleanCellText(tr.cells[0]);
        const action = getCleanCellText(tr.cells[1]);
        return `[${date}] ${action}`;
      });

      const textToSave = lines.join('\r\n');

      const serverNum = new URLSearchParams(window.location.search).get('server_number') || '0';
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      const filename = `logs_server_${serverNum}_${dateStr}_${timeStr}.txt`;

      downloadTxtFile(filename, textToSave);
      window.ArizonaNotifications.show(`Сохранено логов в файл: ${lines.length}`, 'success');
    }

    function markSelected() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      rows.forEach(tr => {
        tr.classList.add('arz-row-marked');
      });
      if (window.ArizonaNotifications) {
        window.ArizonaNotifications.show(`Отмечено логов: ${rows.length}`, 'success');
      }
    }

    function unmarkSelected() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      rows.forEach(tr => {
        tr.classList.remove('arz-row-marked');
      });
      if (window.ArizonaNotifications) {
        window.ArizonaNotifications.show(`Сняты метки с логов: ${rows.length}`, 'info');
      }
    }

    function showSelected() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      let count = 0;
      rows.forEach(tr => {
        if (tr.classList.contains('arz-row-hidden')) {
          tr.classList.remove('arz-row-hidden');
          count++;
        }
      });

      if (count > 0) {
        window.ArizonaNotifications.show(`Раскрыто скрытых логов: ${count}`, 'success');
      } else {
        window.ArizonaNotifications.show('Среди выделенных нет скрытых логов', 'info');
      }
      deselectAll();
    }

    function hideSelected() {
      const rows = getSelectedRows();
      if (rows.length === 0) return;
      rows.forEach(tr => {
        tr.classList.add('arz-row-hidden');
      });
      window.ArizonaNotifications.show(`Скрыто логов: ${rows.length}`, 'info');
      deselectAll();
    }

    function deselectAll() {
      document.querySelectorAll('table.table tbody tr input.arz-row-checkbox').forEach(cb => {
        cb.checked = false;
        const tr = cb.closest('tr');
        if (tr) tr.classList.remove('arz-row-selected');
      });
      updateBarVisibility();
    }

    function selectAllVisible() {
      const rows = document.querySelectorAll('table.table tbody tr');
      let count = 0;
      rows.forEach(tr => {
        if (tr.style.display !== 'none') {
          const cb = tr.querySelector('.arz-row-checkbox');
          if (cb) {
            cb.checked = true;
            tr.classList.add('arz-row-selected');
            count++;
          }
        }
      });
      updateBarVisibility();
      window.ArizonaNotifications.show(`Выделено логов: ${count}`, 'info');
    }

    function injectSelectAllButton() {
      const isMultiEnabled = currentSettings['extension-toggle'] !== false && currentSettings['tweak-multi-select'] !== false;
      const existingBtn = document.getElementById('arz-select-all-logs-btn');
      if (!isMultiEnabled) {
        if (existingBtn) existingBtn.remove();
        return;
      }
      if (existingBtn) return;

      const container = document.querySelector('.filter-buttons');
      if (!container) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'arz-select-all-logs-btn';
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-left: 10px;';
      btn.innerHTML = `<i class="fa-solid fa-check-double" style="margin-right: 6px;"></i> Выделить всё на странице`;
      btn.onclick = () => selectAllVisible();

      const copyPageBtn = document.getElementById('arz-copy-page-logs-btn');
      if (copyPageBtn && copyPageBtn.parentNode) {
        copyPageBtn.parentNode.insertBefore(btn, copyPageBtn.nextSibling);
      } else {
        container.appendChild(btn);
      }
    }

    function removeUI() {
      document.querySelectorAll('.arz-row-checkbox').forEach(cb => cb.remove());
      document.querySelectorAll('tr.arz-row-selected').forEach(tr => tr.classList.remove('arz-row-selected'));
      if (barElement) {
        barElement.remove();
        barElement = null;
      }
      const btn = document.getElementById('arz-select-all-logs-btn');
      if (btn) btn.remove();
    }

    return {
      init: function (s) {
        this.update();
      },
      updateSettings: function (s) {
        this.update();
      },
      update: function () {
        const isMultiEnabled = currentSettings['extension-toggle'] !== false && currentSettings['tweak-multi-select'] !== false;
        if (isMultiEnabled) {
          createBar();
          runWhenElementExists('.filter-buttons', () => injectSelectAllButton());
        } else {
          removeUI();
        }
      },
      injectCheckbox: injectCheckbox,
      updateBarVisibility: updateBarVisibility,
      selectAllVisible: selectAllVisible,
      deselectAll: deselectAll
    };
  })();

  window.ArizonaFormCheckManager = (function () {
    const PANEL_ID = 'arz-form-check-panel';
    const DOSSIER_KEY = 'arz_form_dossier';
    let dossier = null;
    let panel = null;
    let isAnalyzing = false;
    let lastReportText = '';
    let tableObserver = null;
    let observerTimer = null;
    let initialized = false;

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeLocation(value) {
      return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
    }

    function levenshteinDistance(a, b) {
      const s = String(a || '');
      const t = String(b || '');
      if (s === t) return 0;
      if (!s.length) return t.length;
      if (!t.length) return s.length;
      let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
      for (let i = 0; i < s.length; i++) {
        const next = [i + 1];
        for (let j = 0; j < t.length; j++) {
          next.push(Math.min(
            next[j] + 1,
            prev[j + 1] + 1,
            prev[j] + (s[i] === t[j] ? 0 : 1)
          ));
        }
        prev = next;
      }
      return prev[t.length];
    }

    function sameLocation(a, b) {
      const left = normalizeLocation(a);
      const right = normalizeLocation(b);
      if (!left || !right) return false;
      return left === right || left.includes(right) || right.includes(left) || levenshteinDistance(left, right) <= 2;
    }

    function sameProvider(a, b) {
      const left = normalizeLocation(a);
      const right = normalizeLocation(b);
      if (!left || !right) return false;
      if (left.includes(right) || right.includes(left)) return true;
      const aliases = [
        ['билайн', 'beeline'],
        ['мтс', 'mts'],
        ['мегафон', 'megafon'],
        ['теле2', 'tele2', 't2'],
        ['ростелеком', 'rostelecom', 'rt'],
        ['домру', 'domru'],
        ['йота', 'yota'],
        ['ттк', 'ttk']
      ];
      return aliases.some(group => group.some(alias => left.includes(alias)) && group.some(alias => right.includes(alias)));
    }

    function formatDate(date) {
      if (!date || isNaN(date.getTime())) return '-';
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function truncateText(value, maxLength = 90) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
    }

    function rowSummary(row) {
      if (!row) return '-';
      const date = row.date ? formatDate(row.date) : 'без даты';
      const action = row.action ? ` ${row.action}` : '';
      const data = row.data ? `: ${truncateText(row.data, 70)}` : '';
      return `${date}${action}${data}`;
    }

    function loadDossier() {
      return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve(null);
          return;
        }
        chrome.storage.local.get([DOSSIER_KEY], (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(result && result[DOSSIER_KEY] ? result[DOSSIER_KEY] : null);
        });
      });
    }

    function collectRows() {
      const rows = Array.from(document.querySelectorAll('table.table tbody tr'));
      return rows.map((row) => {
        if (!row.cells || row.cells.length < 3) return null;
        if (row.hidden || row.style.display === 'none') return null;

        const date = typeof parseLogRowTime === 'function' ? parseLogRowTime(row) : null;
        const action = (row.cells[1]?.innerText || '').trim();
        const data = (row.cells[2]?.innerText || '').trim();
        const ipCell = typeof getIpCellFromRow === 'function'
          ? getIpCellFromRow(row)
          : (row.cells[3] || row.cells[2]);
        const pairs = typeof parseAllIpsFromCell === 'function' ? parseAllIpsFromCell(ipCell) : [];

        return {
          date,
          action,
          data,
          pairs,
          text: `${action} ${data} ${ipCell?.innerText || ''}`
        };
      }).filter(Boolean);
    }

    function compareRegistrationDate(firstDate, claimed) {
      if (!firstDate) {
        return { level: 'warn', text: 'Не удалось определить дату первого лога.' };
      }
      if (!claimed || !claimed.month || !claimed.year) {
        return { level: 'info', text: 'Дата регистрации в форме не распознана - сверка по первому логу недоступна.' };
      }

      const claimStart = new Date(claimed.year, claimed.month - 1, 1);
      const claimEnd = new Date(claimed.year, claimed.month, 0, 23, 59, 59);

      if (firstDate < claimStart) {
        return {
          level: 'danger',
          text: `Первый лог (${formatDate(firstDate)}) раньше заявленной регистрации (${claimed.label}) - аккаунт существовал до указанного срока.`
        };
      }
      if (firstDate > claimEnd) {
        return {
          level: 'warn',
          text: `Первый доступный лог (${formatDate(firstDate)}) позже заявленного месяца (${claimed.label}) - проверьте полноту логов или дату.`
        };
      }
      return {
        level: 'ok',
        text: `Первый лог (${formatDate(firstDate)}) попадает в заявленный месяц (${claimed.label}).`
      };
    }

    function buildDateAndNickChecks(analysis) {
      const checks = [
        {
          level: analysis.nickCheckLevel,
          text: analysis.nickCheckText
        },
        analysis.dateCheck
      ];
      return checks;
    }

    function analyzeGeo(ip, data, expectedCity, role) {
      if (!ip) {
        return { level: 'warn', text: `${role}: IP в логах не найден.` };
      }
      if (!data) {
        return { level: 'info', text: `${role} ${ip}: GeoIP не загружен.` };
      }
      if (data.status !== 'success') {
        return { level: 'info', text: `${role} ${ip}: GeoIP недоступен.` };
      }

      const location = [data.city, data.regionName, data.country].filter(Boolean).join(', ');
      const provider = data.isp || data.org || '';
      const claimProvider = dossier.values.provider || '';
      const parts = [`${role} ${ip}: ${location || 'геоданные без города'}${provider ? `, ${provider}` : ''}.`];
      let level = 'info';

      if (expectedCity && data.city) {
        if (sameLocation(data.city, expectedCity)) {
          level = 'ok';
          parts.push(`Город совпадает с формой (${expectedCity}).`);
        } else {
          level = 'warn';
          parts.push(`Город в форме: ${expectedCity}.`);
        }
      }

      if (claimProvider && provider) {
        if (sameProvider(provider, claimProvider)) {
          if (level !== 'warn' && level !== 'danger') level = 'ok';
          parts.push(`Провайдер совпадает с формой (${claimProvider}).`);
        } else {
          level = 'warn';
          parts.push(`Провайдер в форме: ${claimProvider}.`);
        }
      }

      if (data.proxy) {
        level = 'danger';
        parts.push('IP определяется как прокси/VPN.');
      } else if (data.hosting) {
        if (level !== 'danger') level = 'warn';
        parts.push('IP принадлежит хостингу или дата-центру.');
      }
      if (data.mobile) {
        parts.push('Мобильный оператор.');
      }

      return { level, text: parts.join(' ') };
    }

    function fetchGeoData(ips) {
      return new Promise((resolve) => {
        const cached = {};
        ips.forEach(ip => {
          const data = window.ArizonaIpLookupManager && window.ArizonaIpLookupManager.getIpData
            ? window.ArizonaIpLookupManager.getIpData(ip)
            : null;
          if (data) cached[ip] = data;
        });

        const remaining = ips.filter(ip => !cached[ip]);
        if (!remaining.length || !window.ArizonaUtils || !window.ArizonaUtils.sendMessageToBackground) {
          resolve(cached);
          return;
        }

        window.ArizonaUtils.sendMessageToBackground({ action: 'fetch_ip_geo_batch', ips: remaining })
          .then((response) => {
            const data = response && response.data;
            if (Array.isArray(data)) {
              data.forEach((item, index) => {
                if (item && item.query) {
                  cached[item.query] = item;
                } else if (remaining[index]) {
                  cached[remaining[index]] = item;
                }
              });
            }
            resolve(cached);
          })
          .catch(() => resolve(cached));
      });
    }

    function compareRows(rows) {
      const params = new URLSearchParams(window.location.search);
      const nick = String(dossier.values.nick || '');
      const nickLower = nick.toLowerCase();
      const matchingRows = nickLower
        ? rows.filter(row => row.text.toLowerCase().includes(nickLower))
        : [];
      const isFiltered = params.has('player') || params.has('ip') || params.has('dynamic[109]') || params.has('type[]');
      const scope = isFiltered ? rows : matchingRows;

      let firstDate = null;
      let lastDate = null;
      scope.forEach(row => {
        if (!row.date) return;
        if (!firstDate || row.date < firstDate) firstDate = row.date;
        if (!lastDate || row.date > lastDate) lastDate = row.date;
      });

      const pairs = [];
      scope.forEach(row => {
        row.pairs.forEach(pair => {
          if (pair.regIp || pair.lastIp) {
            pairs.push({ regIp: pair.regIp, lastIp: pair.lastIp, row });
          }
        });
      });

      const regIp = (pairs.find(pair => pair.regIp) || {}).regIp || '';
      const lastPair = [...pairs].reverse().find(pair => pair.lastIp);
      const lastIp = lastPair ? lastPair.lastIp : '';
      const uniqueIps = Array.from(new Set(
        pairs.flatMap(pair => [pair.regIp, pair.lastIp]).filter(Boolean)
      ));

      let nickCheckLevel = 'ok';
      let nickCheckText = nick ? `Ник в досье: ${nick}.` : 'В досье нет игрового ника.';
      if (!nick) {
        nickCheckLevel = 'danger';
      } else if (isFiltered) {
        if (!scope.length) {
          nickCheckLevel = 'warn';
          nickCheckText = 'В выборке логов нет записей - возможно, таблица ещё загружается.';
        } else {
          nickCheckText = `Выборка логов: ${scope.length} записей по текущему фильтру.`;
        }
      } else if (!matchingRows.length) {
        nickCheckLevel = 'warn';
        nickCheckText = 'Совпадений по нику в видимых логах нет.';
      } else {
        nickCheckText = `Найдено записей по нику: ${matchingRows.length}.`;
      }

      const socialRows = scope.filter(row => /(vk|вконтакте|telegram|телеграм|почт|email|e-mail|mail)/i.test(row.text));
      const donationRows = scope.filter(row => /(донат|пополн|платеж|платёж|покупк|shop|баланс|деньги)/i.test(row.text));

      let socialCheck;
      if (!scope.length) {
        socialCheck = { level: 'info', text: 'Соцсети и почта: нет записей для проверки.' };
      } else if (!socialRows.length) {
        socialCheck = { level: 'info', text: 'Явных событий привязки/отвязки соцсетей и почты в видимых логах нет.' };
      } else {
        const latest = [...socialRows].sort((a, b) => (b.date || 0) - (a.date || 0))[0];
        const hasRemoval = socialRows.some(row => /удал|отвяз|смен|взлом/i.test(row.text));
        socialCheck = {
          level: dossier.values.socialHacked ? (hasRemoval ? 'ok' : 'warn') : 'info',
          text: `События соцсетей/почты: ${socialRows.length}. Последнее: ${rowSummary(latest)}`
        };
        if (dossier.values.socialHacked && !hasRemoval) {
          socialCheck.text += ' Событий удаления или отвязки не найдено - проверьте полный список логов.';
        }
      }

      let donationCheck;
      const donationUnknown = /не помню|не знаю|не помн|не мало|без суммы/i.test(dossier.values.donations || '');
      if (!scope.length) {
        donationCheck = { level: 'info', text: 'Платежи: нет записей для проверки.' };
      } else if (!donationRows.length) {
        donationCheck = {
          level: donationUnknown ? 'warn' : 'info',
          text: 'Платёжных записей в видимых логах нет - проверьте фильтр по почте или донатам.'
        };
      } else {
        const latest = [...donationRows].sort((a, b) => (b.date || 0) - (a.date || 0))[0];
        donationCheck = {
          level: 'info',
          text: `Платёжные записи: ${donationRows.length}. Последняя: ${rowSummary(latest)}`
        };
      }

      const dateCheck = compareRegistrationDate(firstDate, dossier.values.date);

      return {
        nick,
        scope,
        matchingRows,
        isFiltered,
        firstDate,
        lastDate,
        regIp,
        lastIp,
        uniqueIps,
        socialRows,
        donationRows,
        nickCheckLevel,
        nickCheckText,
        socialCheck,
        donationCheck,
        dateCheck
      };
    }

    function buildGeoChecks(analysis, geo) {
      const checks = [];
      const claimProvider = dossier.values.provider || '';

      if (analysis.regIp) {
        checks.push(analyzeGeo(analysis.regIp, geo[analysis.regIp], dossier.values.regCity, 'IP регистрации'));
      } else {
        checks.push({ level: 'warn', text: 'IP регистрации в логах не найден.' });
      }

      if (analysis.lastIp && analysis.lastIp !== analysis.regIp) {
        checks.push(analyzeGeo(analysis.lastIp, geo[analysis.lastIp], dossier.values.currentCity, 'Последний IP'));
      } else if (analysis.lastIp) {
        const lastData = geo[analysis.lastIp];
        const city = lastData && lastData.status === 'success' ? (lastData.city || '') : '';
        checks.push({
          level: city && dossier.values.currentCity && sameLocation(city, dossier.values.currentCity) ? 'ok' : 'info',
          text: `Последний IP совпадает с регистрационным (${analysis.lastIp})${city ? `, город: ${city}` : ''}.`
        });
      } else {
        checks.push({ level: 'warn', text: 'Последний IP в логах не найден.' });
      }

      if (analysis.uniqueIps.length > 1) {
        checks.push({
          level: analysis.uniqueIps.length > 15 ? 'warn' : 'info',
          text: `Уникальных IP в выборке: ${analysis.uniqueIps.length}${analysis.uniqueIps.length > 15 ? ' - проверьте VPN и динамические адреса.' : '.'}`
        });
      }

      if (claimProvider && analysis.regIp && geo[analysis.regIp] && geo[analysis.regIp].status === 'success') {
        const provider = geo[analysis.regIp].isp || geo[analysis.regIp].org || '';
        if (provider && sameProvider(provider, claimProvider)) {
          checks.push({ level: 'ok', text: `Провайдер регистрационного IP совпадает с формой (${claimProvider}).` });
        }
      }

      return checks;
    }

    function statusLabel(status) {
      return status === 'danger' ? 'Есть расхождения' : status === 'warn' ? 'Требует внимания' : 'Противоречий не найдено';
    }

    function statusIcon(status) {
      return status === 'danger' ? 'fa-circle-exclamation' : status === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    }

    function renderRow(label, value) {
      return `
        <div class="arz-fc-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value || '-')}</strong>
        </div>
      `;
    }

    function renderNote(check) {
      return `
        <div class="arz-fc-note is-${check.level}">
          <i class="fa-solid ${check.level === 'danger' ? 'fa-circle-exclamation' : check.level === 'warn' ? 'fa-triangle-exclamation' : check.level === 'ok' ? 'fa-circle-check' : 'fa-circle-info'}"></i>
          <span>${escapeHtml(check.text)}</span>
        </div>
      `;
    }

    function renderSection(title, icon, rows, notes) {
      return `
        <div class="arz-fc-section">
          <div class="arz-fc-section-title"><i class="fa-solid ${icon}"></i>${escapeHtml(title)}</div>
          ${rows.join('')}
          ${notes.filter(Boolean).map(renderNote).join('')}
        </div>
      `;
    }

    function renderAnalysis(analysis, geo) {
      if (!panel) return;
      const body = panel.querySelector('.arz-fc-body');
      if (!body) return;

      const geoChecks = buildGeoChecks(analysis, geo);
      const checks = [
        { level: analysis.nickCheckLevel, text: analysis.nickCheckText },
        analysis.dateCheck,
        ...geoChecks,
        analysis.socialCheck,
        analysis.donationCheck
      ];
      const dangerCount = checks.filter(check => check.level === 'danger').length;
      const warnCount = checks.filter(check => check.level === 'warn').length;
      const okCount = checks.filter(check => check.level === 'ok').length;
      const status = dangerCount ? 'danger' : warnCount ? 'warn' : 'ok';
      const values = dossier.values;

      const formWarnings = (dossier.notes || []).filter(note => note.level === 'danger' || note.level === 'warn');

      body.innerHTML = `
        <div class="arz-fc-verdict is-${status}">
          <i class="fa-solid ${statusIcon(status)}"></i>
          <div>
            <strong>${escapeHtml(statusLabel(status))}</strong>
            <span>${okCount} совпадений · ${warnCount} замечаний · ${dangerCount} расхождений</span>
          </div>
        </div>

        <div class="arz-fc-summary">
          <div class="arz-fc-fact"><span>Ник</span><strong>${escapeHtml(values.nick || '-')}</strong></div>
          <div class="arz-fc-fact"><span>Регистрация</span><strong>${escapeHtml(values.date?.label || values.regDate || '-')}</strong></div>
          <div class="arz-fc-fact"><span>Город</span><strong>${escapeHtml(values.regCity || '-')}</strong></div>
          <div class="arz-fc-fact"><span>Сейчас</span><strong>${escapeHtml(values.currentCity || '-')}</strong></div>
          <div class="arz-fc-fact"><span>Провайдер</span><strong>${escapeHtml(values.provider || '-')}</strong></div>
          <div class="arz-fc-fact"><span>Донаты</span><strong>${escapeHtml(values.amounts?.length ? values.amounts.join(', ') : 'не указана')}</strong></div>
        </div>

        ${renderSection('Дата и ник', 'fa-user-clock', [
          renderRow('Записей в выборке', String(analysis.scope.length)),
          renderRow('Первый лог', formatDate(analysis.firstDate)),
          renderRow('Последний лог', formatDate(analysis.lastDate))
        ], [analysis.dateCheck, { level: analysis.nickCheckLevel, text: analysis.nickCheckText }])}

        ${renderSection('IP и география', 'fa-location-dot', [
          renderRow('IP регистрации', analysis.regIp),
          renderRow('Последний IP', analysis.lastIp),
          renderRow('Уникальных IP', String(analysis.uniqueIps.length))
        ], geoChecks)}

        ${renderSection('Соцсети и платежи', 'fa-share-nodes', [
          renderRow('Почта в форме', values.email),
          renderRow('События соцсетей', String(analysis.socialRows.length)),
          renderRow('Платёжные записи', String(analysis.donationRows.length))
        ], [analysis.socialCheck, analysis.donationCheck])}

        ${formWarnings.length ? renderSection('Замечания к форме', 'fa-file-signature', [], formWarnings) : ''}
      `;

      lastReportText = [
        `Проверка формы: ${values.nick || '-'}`,
        `Статус: ${statusLabel(status)}`,
        `Заявлено: регистрация ${values.date?.label || '-'}, город ${values.regCity || '-'}, сейчас ${values.currentCity || '-'}, провайдер ${values.provider || '-'}.`,
        `Логи: ${analysis.scope.length} записей; первый ${formatDate(analysis.firstDate)}; последний ${formatDate(analysis.lastDate)}.`,
        `IP: регистрационный ${analysis.regIp || '-'}; последний ${analysis.lastIp || '-'}; уникальных ${analysis.uniqueIps.length}.`,
        '',
        ...checks.map(check => `[${check.level === 'ok' ? 'OK' : check.level === 'warn' ? '!' : check.level === 'danger' ? '!!' : 'i'}] ${check.text}`)
      ].join('\n');

      panel.setAttribute('data-status', status);
    }

    async function analyze() {
      if (!panel || !dossier || isAnalyzing) return;
      if (!dossier.values || !dossier.values.nick) return;

      isAnalyzing = true;
      const body = panel.querySelector('.arz-fc-body');
      if (body) {
        body.innerHTML = '<div class="arz-fc-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Сверяю форму с логами…</div>';
      }

      try {
        const rows = collectRows();
        const analysis = compareRows(rows);
        const ips = Array.from(new Set([analysis.regIp, analysis.lastIp].filter(Boolean)));
        const geo = ips.length ? await fetchGeoData(ips) : {};
        if (!panel) return;
        renderAnalysis(analysis, geo);
        startTableObserver();
      } finally {
        isAnalyzing = false;
      }
    }

    function startTableObserver() {
      if (tableObserver) return;
      const tbody = document.querySelector('table.table tbody');
      if (!tbody) return;
      tableObserver = new MutationObserver(() => {
        clearTimeout(observerTimer);
        observerTimer = setTimeout(() => {
          if (panel && !isAnalyzing) analyze();
        }, 700);
      });
      tableObserver.observe(tbody, { childList: true, subtree: true });
    }

    function stopTableObserver() {
      clearTimeout(observerTimer);
      if (tableObserver) {
        tableObserver.disconnect();
        tableObserver = null;
      }
    }

    function notify(message, type) {
      if (window.ArizonaNotifications && typeof window.ArizonaNotifications.show === 'function') {
        window.ArizonaNotifications.show(message, type || 'info');
      }
    }

    function createPanel() {
      if (!document.body) {
        setTimeout(createPanel, 100);
        return;
      }
      if (document.getElementById(PANEL_ID)) {
        panel = document.getElementById(PANEL_ID);
        return;
      }

      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'arz-form-check-panel';
      panel.innerHTML = `
        <div class="arz-fc-header">
          <div class="arz-fc-heading">
            <div class="arz-fc-kicker">Сверка формы с логами</div>
            <div class="arz-fc-title">${escapeHtml(dossier.values.nick || 'Проверка формы')}</div>
          </div>
          <div class="arz-fc-actions">
            <button type="button" class="arz-fc-icon-btn" data-fc-action="refresh" title="Обновить">
              <i class="fa-solid fa-rotate"></i>
            </button>
            <button type="button" class="arz-fc-icon-btn" data-fc-action="collapse" title="Свернуть">
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <button type="button" class="arz-fc-icon-btn" data-fc-action="close" title="Закрыть">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="arz-fc-body">
          <div class="arz-fc-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Ожидаю загрузку логов…</div>
        </div>
        <div class="arz-fc-footer">
          <button type="button" class="arz-fc-btn" data-fc-action="copy">
            <i class="fa-regular fa-copy"></i> Скопировать отчёт
          </button>
          <button type="button" class="arz-fc-btn is-danger" data-fc-action="delete">
            <i class="fa-solid fa-trash-can"></i> Удалить досье
          </button>
        </div>
      `;

      panel.addEventListener('click', (event) => {
        const button = event.target.closest('[data-fc-action]');
        if (!button) return;
        const action = button.getAttribute('data-fc-action');

        if (action === 'refresh') {
          analyze();
          return;
        }
        if (action === 'collapse') {
          panel.classList.toggle('is-collapsed');
          const icon = button.querySelector('i');
          if (icon) {
            icon.className = panel.classList.contains('is-collapsed')
              ? 'fa-solid fa-chevron-up'
              : 'fa-solid fa-chevron-down';
          }
          return;
        }
        if (action === 'close') {
          stopTableObserver();
          panel.remove();
          panel = null;
          const url = new URL(window.location.href);
          url.searchParams.delete('arz_form_check');
          try {
            window.history.replaceState({}, '', url.toString());
          } catch (e) { }
          return;
        }
        if (action === 'copy') {
          if (!lastReportText) return;
          writeToClipboard(lastReportText)
            .then(() => notify('Отчёт скопирован', 'success'))
            .catch(() => notify('Не удалось скопировать отчёт', 'error'));
          return;
        }
        if (action === 'delete') {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove([DOSSIER_KEY, 'arz_form_last_text']);
          }
          stopTableObserver();
          panel.remove();
          panel = null;
          notify('Досье удалено', 'info');
        }
      });

      document.body.appendChild(panel);
    }

    return {
      init: function (settingsData) {
        if (initialized) return;
        initialized = true;
        const params = new URLSearchParams(window.location.search);
        if (!params.has('arz_form_check')) return;

        loadDossier().then((stored) => {
          if (!stored || !stored.values || !stored.values.nick) return;
          dossier = stored;
          createPanel();
          if (!panel) return;

          let started = false;
          const begin = () => {
            if (started) return;
            started = true;
            setTimeout(analyze, 300);
          };
          runWhenElementExists('table.table tbody tr', begin);
          setTimeout(() => {
            if (!started) {
              started = true;
              analyze();
            }
          }, 12000);
        });
      },
      analyze: analyze,
      updateSettings: function () { }
    };
  })();

  async function init() {
    if (isInitialized) return;

    const host = window.location.hostname;

    if (host.includes('logsparser.cypher-team.com')) {

      if (document.body && (document.body.innerText.includes('Processing your request') ||
        document.body.innerText.includes('please wait'))) {
        const obs = new MutationObserver(() => {
          if (document.body && !document.body.innerText.includes('Processing your request')) {
            obs.disconnect();
            setTimeout(init, 50);
          }
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        return;
      }

      await loadAndApplySettings();

      try { window.ArizonaIpLookupManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaIpLookupManager.init:', e); }
      try { window.ArizonaMaskingManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaMaskingManager.init:', e); }
      try { window.ArizonaTuningAHKManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaTuningAHKManager.init:', e); }
      try { window.ArizonaTgVkDetector.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaTgVkDetector.init:', e); }
      try { window.ArizonaEmailDetector.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaEmailDetector.init:', e); }
      try { window.ArizonaColumnEyeButtons.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaColumnEyeButtons.init:', e); }
      try { window.ArizonaLogFilter.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaLogFilter.init:', e); }
      try { window.ArizonaFormsManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaFormsManager.init:', e); }
      try { window.ArizonaFormCheckManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaFormCheckManager.init:', e); }
      try { window.ArizonaOnlineManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaOnlineManager.init:', e); }
      try { window.ArizonaPunishmentManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaPunishmentManager.init:', e); }
      try { window.ArizonaIpBatchManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaIpBatchManager.init:', e); }
      try { window.ArizonaIdNickManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaIdNickManager.init:', e); }
      try { window.ArizonaReportManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaReportManager.init:', e); }
      try { window.ArizonaLookupManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaLookupManager.init:', e); }
      try { window.ArizonaDateShortcut.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaDateShortcut.init:', e); }
      try { window.ArizonaMultiPlayersManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaMultiPlayersManager.init:', e); }
      try { window.ArizonaIdenticalIpHighlight.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaIdenticalIpHighlight.init:', e); }

      try { window.ArizonaAnalyticsManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaAnalyticsManager.init:', e); }
      try { window.ArizonaTemplatesManager.init(arizonaSettings, arizonaTemplates); } catch (e) { console.error('Error in ArizonaTemplatesManager.init:', e); }
      try {
        window.ArizonaThemeManager.init({
          ...arizonaSettings,
          themeEnabled: currentSettings['extension-toggle'] !== false &&
            currentSettings['visual-theme-enabled'] !== false
        });
      } catch (e) { console.error('Error in ArizonaThemeManager.init:', e); }
      try { window.ArizonaCopyLogsManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaCopyLogsManager.init:', e); }
      try { window.ArizonaSidebarManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaSidebarManager.init:', e); }

      try { window.ArizonaMultiSelectManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaMultiSelectManager.init:', e); }
      try { window.ArizonaLoadMoreManager.init(arizonaSettings); } catch (e) { console.error('Error in ArizonaLoadMoreManager.init:', e); }
      try { window.ArizonaLoadMoreManager.updateSettings(arizonaSettings); } catch (e) { }

      document.addEventListener('copy', (e) => {
        try {
          window.ArizonaMaskingManager.handleCopy(e, arizonaSettings);
        } catch (err) {
          console.error(err);
        }
      }, true);

      document.addEventListener('click', (e) => {
        const snippet = e.target.closest('.arz-copyable-snippet');
        if (snippet && currentSettings['extension-toggle'] !== false && currentSettings['tweak-copy-cells'] !== false) {
          e.stopPropagation();
          e.preventDefault();
          const text = snippet.textContent.trim();
          copyTextToClipboard(text, snippet);
          return;
        }

        const anchor = e.target.closest('a');
        if (anchor && anchor.href) {
          try {
            const target = anchor.getAttribute('target');
            if (target && target !== '_self') {
              const url = new URL(anchor.href, window.location.href);
              if (url.hostname === window.location.hostname) {
                anchor.setAttribute('target', '_self');
              }
            }
          } catch (err) {
          }
        }
      }, true);

      document.addEventListener('submit', (e) => {
        const form = e.target;
        if (form) {
          try {
            if (typeof isModalOpen === 'function' && isModalOpen() && form.matches('form.filter')) {
              if (typeof closeFilterModal === 'function') {
                closeFilterModal();
              }
            }

            const target = form.getAttribute('target');
            if (target && target !== '_self') {
              const action = form.getAttribute('action') || '';
              const url = new URL(action, window.location.href);
              if (url.hostname === window.location.hostname) {
                form.setAttribute('target', '_self');
              }
            }
          } catch (err) {
            const target = form.getAttribute('target');
            if (target && target !== '_self') {
              form.setAttribute('target', '_self');
            }
          }
        }
      }, true);

      try {
        processTable();
        styleResetButton();
        fixSubmitLag();
      } catch (e) {
        console.error('Error in initial processTable:', e);
      }

      try {
        window.ArizonaObservers.init(arizonaSettings, () => {
          try {
            processTable();
            styleResetButton();
            fixSubmitLag();
          } catch (e) {
            console.error('Error in observer processTable:', e);
          }
        });
      } catch (e) {
        console.error('Error in ArizonaObservers.init:', e);
      }


      isInitialized = true;
    }
  }

  function loadAndApplySettings() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['arz_logsparser_helper_settings', 'arizonaSettings', 'arizonaTemplates'], (result) => {
            try {
              if (result && result.arz_logsparser_helper_settings) {
                currentSettings = { ...DEFAULT_SETTINGS, ...result.arz_logsparser_helper_settings };
              }
              const limitVal = currentSettings['tweak-always-limit'];
              if (limitVal && limitVal !== 'none') {
                try {
                  const url = new URL(window.location.href);
                  if (url.searchParams.get('limit') !== limitVal) {
                    url.searchParams.set('limit', limitVal);
                    window.location.replace(url.toString());
                    return;
                  }
                } catch (e) {
                  console.error('Redirection failed:', e);
                }
              }
              arizonaSettings = (result && result.arizonaSettings) || {};
              arizonaTemplates = (result && result.arizonaTemplates) || [];

              if (!arizonaSettings.masking) {
                arizonaSettings.masking = { enabled: true, maskIp: true, maskEmail: true, maskTG: true, maskVK: true };
              }
              if (!arizonaSettings.tools) {
                arizonaSettings.tools = {
                  identicalIPs: true, identicalIPsColor: '#d33b45', columnEyeButtons: true,
                  filterWindow: true, formsEnabled: true, online: true, punishment: true,
                  ipBatch: true, idNick: true, report: true, lookup: true, analytics: true,
                  dateShortcutEnabled: true, styleResetButtonEnabled: true,
                  copyAllLogsEnabled: true, tgVkDetectorEnabled: true, markLogsEnabled: true
                };
              } else {
                if (arizonaSettings.tools.punishment === undefined) arizonaSettings.tools.punishment = true;
                if (arizonaSettings.tools.ipBatch === undefined) arizonaSettings.tools.ipBatch = true;
                if (arizonaSettings.tools.idNick === undefined) arizonaSettings.tools.idNick = true;
                if (arizonaSettings.tools.report === undefined) arizonaSettings.tools.report = true;
                if (arizonaSettings.tools.lookup === undefined) arizonaSettings.tools.lookup = true;
                if (arizonaSettings.tools.analytics === undefined) arizonaSettings.tools.analytics = true;
                if (arizonaSettings.tools.styleResetButtonEnabled === undefined) arizonaSettings.tools.styleResetButtonEnabled = true;
                if (arizonaSettings.tools.copyAllLogsEnabled === undefined) arizonaSettings.tools.copyAllLogsEnabled = true;
                if (arizonaSettings.tools.tgVkDetectorEnabled === undefined) arizonaSettings.tools.tgVkDetectorEnabled = true;
                if (arizonaSettings.tools.markLogsEnabled === undefined) arizonaSettings.tools.markLogsEnabled = true;
                if (arizonaSettings.tools.multiPlayersEnabled === undefined) arizonaSettings.tools.multiPlayersEnabled = true;
                if (arizonaSettings.tools.duplicatePaginationTop === undefined) arizonaSettings.tools.duplicatePaginationTop = true;
              }
              if (!arizonaSettings.tuningParts) {
                arizonaSettings.tuningParts = { enabled: false, scanDelay: 500, highlightColor: '#d33b45', outlineWidth: 2, timePattern: '30:01,30:02,00:03,00:01,00:02,00:03', highlightOnlyMatching: true, autoScrollToMatch: false, playSoundOnMatch: false };
              }
              if (!arizonaSettings.emailCheck) {
                arizonaSettings.emailCheck = { enabled: true, duplicateDetection: true, threshold: 3, lowColor: '#3fb950', mediumColor: '#d29922', highColor: '#f85149' };
              }
              if (!arizonaSettings.ipFields) {
                arizonaSettings.ipFields = { country: true, city: true, regionName: true, isp: true, org: true, as: true, mobile: false, proxy: false, hosting: true };
              } else {
                if (arizonaSettings.ipFields.hosting === undefined) arizonaSettings.ipFields.hosting = true;
              }

              applySettings(currentSettings);
              styleResetButton();
              resolve();
            } catch (err) {
              resolve();
            }
          });
        } else {
          resolve();
        }
      } catch (e) {
        resolve();
      }
    });
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.onChanged.addListener((changes) => {
        try {
          if (changes['arz_logsparser_helper_settings']) {
            const newSettings = changes['arz_logsparser_helper_settings'].newValue;
            if (newSettings) {
              const oldTweakState = currentSettings['tweak-ip-info'];
              currentSettings = { ...DEFAULT_SETTINGS, ...newSettings };
              if (window.location.hostname.includes('logsparser.cypher-team.com')) {
                applySettings(currentSettings);
                styleResetButton();
              }
            }
          }
          if (changes['arizonaSettings']) {
            arizonaSettings = { ...arizonaSettings, ...changes['arizonaSettings'].newValue };
            if (window.location.hostname.includes('logsparser.cypher-team.com')) {
              if (window.ArizonaIpLookupManager) window.ArizonaIpLookupManager.updateSettings(arizonaSettings);
              if (window.ArizonaMaskingManager) window.ArizonaMaskingManager.updateSettings(arizonaSettings);
              if (window.ArizonaTuningAHKManager) window.ArizonaTuningAHKManager.updateSettings(arizonaSettings);
              if (window.ArizonaThemeManager) {
                window.ArizonaThemeManager.updateSettings({
                  ...arizonaSettings,
                  themeEnabled: currentSettings['visual-theme-enabled'] !== false
                });
              }
              if (window.ArizonaCopyLogsManager) window.ArizonaCopyLogsManager.updateSettings(arizonaSettings);
              if (window.ArizonaIdenticalIpHighlight) window.ArizonaIdenticalIpHighlight.updateSettings(arizonaSettings);
              if (window.ArizonaTgVkDetector) window.ArizonaTgVkDetector.updateSettings(arizonaSettings);
              if (window.ArizonaEmailDetector) window.ArizonaEmailDetector.updateSettings(arizonaSettings);
              if (window.ArizonaColumnEyeButtons) window.ArizonaColumnEyeButtons.updateSettings(arizonaSettings);
              if (window.ArizonaLookupManager) window.ArizonaLookupManager.updateSettings(arizonaSettings);
              if (window.ArizonaTemplatesManager) window.ArizonaTemplatesManager.updateSettings(arizonaSettings);
              if (window.ArizonaFormsManager) window.ArizonaFormsManager.updateSettings(arizonaSettings);

              if (window.ArizonaAnalyticsManager) window.ArizonaAnalyticsManager.updateSettings(arizonaSettings);
              if (window.ArizonaLogFilter) window.ArizonaLogFilter.updateSettings(arizonaSettings);
              if (window.ArizonaSidebarManager) window.ArizonaSidebarManager.updateSettings(arizonaSettings);
              if (window.ArizonaMultiSelectManager) window.ArizonaMultiSelectManager.updateSettings(arizonaSettings);
              if (window.ArizonaLoadMoreManager) window.ArizonaLoadMoreManager.updateSettings(arizonaSettings);
              if (window.ArizonaMultiPlayersManager) window.ArizonaMultiPlayersManager.updateSettings(arizonaSettings);
              document.querySelectorAll('table.table tbody tr').forEach((tr) => {
                if (arizonaSettings.tools?.markLogsEnabled === false) removeMarkHandle(tr);
                else injectMarkHandle(tr);
              });
              styleResetButton();
            }
          }
        } catch (e) {
        }
      });
    }
  } catch (e) {
  }



  setInterval(() => {
    try {
      const isEnabled = currentSettings['extension-toggle'] !== false;
      if (!isEnabled) return;
      const table = document.querySelector('table.table');
      if (table) {
        const unprocessed = table.querySelectorAll('tbody tr:not([data-arz-processed="true"])');
        if (unprocessed.length > 0) {
          processTable();
        }
      }
    } catch (e) { }
  }, 1000);

  function checkAndInit() {
    if (document.body) {
      init();
    } else {
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          bodyObserver.disconnect();
          init();
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
    }
  }

  checkAndInit();
})();
