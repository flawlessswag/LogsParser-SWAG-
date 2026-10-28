console.log('[BG] Arizona SWAG background script loaded');

const LOGS_ORIGIN = 'https://logsparser.cypher-team.com';
const IP_API_BATCH_URL = 'http://ip-api.com/batch?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query&lang=ru';
const IP_API_SINGLE_URL = 'http://ip-api.com/json';

class RateLimitedQueue {
  constructor(delayMs = 2000) {
    this.queue = [];
    this.processing = false;
    this.delayMs = delayMs;
    this.lastRequestTime = 0;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue[0];
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      const timeToWait = Math.max(0, this.delayMs - timeSinceLast);

      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }

      try {
        this.lastRequestTime = Date.now();
        const result = await task.fn();
        this.queue.shift();
        task.resolve(result);
      } catch (error) {
        this.queue.shift();
        task.reject(error);
      }
    }

    this.processing = false;
  }
}

const ipLookupQueue = new RateLimitedQueue(2000);

function fetchWithRetry(url, options = {}, maxAttempts = 3) {
  return fetch(url, options)
    .then(async res => {
      if (res.status === 429) {
        if (maxAttempts > 1) {
          console.warn('[BG] IP lookup rate limited (429). Waiting 5s before retry...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return fetchWithRetry(url, options, maxAttempts - 1);
        }
        throw new Error('HTTP error! Status: 429 Too Many Requests');
      }
      if (!res.ok) {
        if (maxAttempts > 1) {
          console.warn(`[BG] IP lookup failed with status ${res.status}. Retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(url, options, maxAttempts - 1);
        }
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      return res.json();
    })
    .catch(async err => {
      if (err.message && err.message.includes('429')) {
        throw err;
      }
      if (maxAttempts > 1) {
        console.warn(`[BG] Fetch error: ${err.message}. Retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchWithRetry(url, options, maxAttempts - 1);
      }
      throw err;
    });
}

let ipDetailsCache = {};
let isCacheLoaded = false;

function loadCache() {
  if (isCacheLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['arz_ip_details_cache'], (result) => {
        if (result && result['arz_ip_details_cache']) {
          ipDetailsCache = result['arz_ip_details_cache'];
        }
        isCacheLoaded = true;
        resolve();
      });
    } else {
      isCacheLoaded = true;
      resolve();
    }
  });
}

function saveCache() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const keys = Object.keys(ipDetailsCache);
    if (keys.length > 3000) {
      const keysToRemove = keys.slice(0, keys.length - 2000);
      keysToRemove.forEach(k => delete ipDetailsCache[k]);
    }
    chrome.storage.local.set({ 'arz_ip_details_cache': ipDetailsCache });
  }
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function requestIpBatch(ips) {
  return ipLookupQueue.enqueue(() => {
    return fetchWithRetry(IP_API_BATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ips)
    });
  });
}

function requestIpSingle(ip) {
  return ipLookupQueue.enqueue(() => {
    return fetchWithRetry(`${IP_API_SINGLE_URL}/${encodeURIComponent(ip)}`);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'arz_fetch_ips') {
    const { ips } = message;
    loadCache().then(() => {
      const results = [];
      const ipsToFetch = [];

      ips.forEach(ip => {
        if (ipDetailsCache[ip]) {
          results.push(ipDetailsCache[ip]);
        } else {
          ipsToFetch.push(ip);
        }
      });

      if (ipsToFetch.length === 0) {
        sendResponse({ success: true, data: results });
        return;
      }

      const chunkPromises = chunkArray(ipsToFetch, 15).map(chunk => requestIpBatch(chunk));

      Promise.allSettled(chunkPromises).then(settledResults => {
        let hasSuccess = false;
        settledResults.forEach(result => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            hasSuccess = true;
            result.value.forEach(item => {
              if (item && item.query) {
                ipDetailsCache[item.query] = item;
                results.push(item);
              }
            });
          }
        });

        if (hasSuccess) {
          saveCache();
        }

        sendResponse({ success: results.length > 0, data: results });
      });
    });
    return true;
  }

  if (message.action === 'ping') {
    sendResponse({ success: true, message: 'pong', timestamp: Date.now() });
    return true;
  }

  if (message.action === 'fetch_ip_geo_batch') {
    const ipsToFetch = Array.isArray(message.ips) ? message.ips.filter(Boolean) : [];
    if (ipsToFetch.length === 0) {
      sendResponse({ success: true, data: [] });
      return true;
    }

    const chunks = chunkArray(ipsToFetch, 15);
    const chunkPromises = chunks.map(chunk => requestIpBatch(chunk));

    Promise.allSettled(chunkPromises).then(async settledResults => {
      const mergedData = [];
      const now = Date.now();

      settledResults.forEach((result, chunkIdx) => {
        const chunk = chunks[chunkIdx];
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          for (let i = 0; i < result.value.length; i++) {
            const ipData = result.value[i];
            const ip = chunk[i];
            mergedData.push(ipData);
            if (ipData && ipData.status === 'success' && ip) {
              ipDetailsCache[ip] = { ...ipData, _ts: now };
            }
          }
        } else {
          console.error('[BG] fetch_ip_geo_batch chunk failed:', result.reason);
          chunk.forEach(() => {
            mergedData.push({ status: 'fail' });
          });
        }
      });

      if (mergedData.some(item => item && item.status === 'success')) {
        saveCache();
      }

      sendResponse({ success: mergedData.length > 0, data: mergedData });
    });

    return true;
  }

  if (message.action === 'fetch_ip_geo_single') {
    requestIpSingle(message.ip)
      .then((data) => {
        if (data && data.status === 'success') {
          ipDetailsCache[message.ip] = { ...data, _ts: Date.now() };
          saveCache();
        }
        sendResponse({ success: true, data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'check_ban') {
    const nickname = message.nickname;
    const url = `${LOGS_ORIGIN}/?server_number=5&type%5B%5D=ban&type%5B%5D=login&sort=desc&min_period=2026-01-16+00%3A00%3A00&player=${encodeURIComponent(nickname)}&arz-filter-logs-mode=show`;

    chrome.tabs.create({ url: url, active: false }, (tab) => {
      let isResolved = false;
      const finish = (result) => {
        if (isResolved) return;
        isResolved = true;
        if (tab && tab.id) {
          chrome.tabs.remove(tab.id, () => {});
        }
        sendResponse(result);
      };

      const timeout = setTimeout(() => {
        finish({ success: false, error: 'Timeout' });
      }, 20000);

      const onUpdated = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);

          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (playerNickname) => {
              const result = {
                bans: [],
                logins: [],
                lastBan: null,
                isBanned: false,
                unbanDate: null
              };

              const rows = document.querySelectorAll('table.table tbody tr');
              for (let row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                  const date = cells[0]?.textContent?.trim() || '';
                  const action = cells[1]?.textContent || '';

                  if (action.includes('забанил') && action.includes(playerNickname)) {
                    const durationMatch = action.match(/на\s+(\d+)\s+дней/);
                    const reasonMatch = action.match(/причина:\s+(.+?)(?:\s*\||$)/);
                    const adminMatch = action.match(/Администратор\s+(\S+)/);

                    result.bans.push({
                      date: date,
                      duration: durationMatch ? durationMatch[1] : '2000',
                      reason: reasonMatch ? reasonMatch[1].trim() : action,
                      admin: adminMatch ? adminMatch[1] : 'Unknown'
                    });
                  }

                  if (action.includes('авторизовался') && action.includes(playerNickname)) {
                    result.logins.push({ date: date });
                  }
                }
              }

              if (result.bans.length > 0) {
                result.lastBan = result.bans.reduce((latest, current) => {
                  return current.date > latest.date ? current : latest;
                }, result.bans[0]);

                const loginsAfterBan = result.logins.filter(login => login.date > result.lastBan.date);
                result.isBanned = loginsAfterBan.length === 0;

                if (result.isBanned) {
                  const banDate = new Date(result.lastBan.date);
                  const days = parseInt(result.lastBan.duration);
                  const unbanDate = new Date(banDate);
                  unbanDate.setDate(unbanDate.getDate() + days);
                  result.unbanDate = unbanDate.toLocaleString('ru-RU');
                }
              }
              return result;
            },
            args: [nickname]
          }, (results) => {
            clearTimeout(timeout);
            if (results && results[0] && results[0].result) {
              const data = results[0].result;
              let banInfo = null;
              if (data.isBanned && data.lastBan) {
                banInfo = {
                  nickname: nickname,
                  date: data.lastBan.date,
                  reason: data.lastBan.reason,
                  banDuration: parseInt(data.lastBan.duration),
                  date_unbanned: data.unbanDate,
                  admin: data.lastBan.admin
                };
              }
              finish({ success: true, data: banInfo });
            } else {
              finish({ success: false, error: 'Script execution failed' });
            }
          });
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
    return true;
  }

  if (message.type === 'showNotification' && message.text) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Arizona SWAG Helper',
      message: message.text,
      priority: 1
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'getSettings') {
    chrome.storage.local.get(['arizonaSettings'], (result) => {
      sendResponse({ settings: result.arizonaSettings || {} });
    });
    return true;
  }

  if (message.action === 'saveSettings') {
    chrome.storage.local.set({ arizonaSettings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Arizona SWAG LogsParser Helper установлен!');

  chrome.storage.local.get(['arizonaSettings'], (result) => {
    if (!result.arizonaSettings) {
      const defaultSettings = {
        templatesEnabled: true,
        ipLookupEnabled: true,
        geoIPEnabled: true,
        ipFields: { country: true, city: true, regionName: true, isp: true, org: true, as: true, mobile: true, proxy: true, hosting: true },
        tuningParts: { enabled: true, scanDelay: 500, highlightColor: '#f02849', outlineWidth: 2, timePattern: '30:01,30:02,00:03,00:01,00:02,00:03', highlightOnlyMatching: true, autoScrollToMatch: false, playSoundOnMatch: false },
        emailCheck: { enabled: true, duplicateDetection: true, threshold: 3, lowColor: '#10b981', mediumColor: '#f59e0b', highColor: '#ef4444' },
        masking: { enabled: false, maskIp: true, maskEmail: true, maskTG: true, maskVK: true },
        tools: {
          identicalIPs: true,
          identicalIPsColor: '#ff4444',
          columnEyeButtons: true,
          filterWindow: true,
          formsEnabled: true,
          online: true,
          punishment: true,
          ipBatch: true,
          idNick: true,
          report: true,
          lookup: true,
          analytics: true,
          dateShortcutEnabled: true
        },
        theme: 'dark',
        fontSize: 14,
        colorScheme: 'red',
        borderRadius: '8px',
        backgroundColor: null,
        backgroundImage: null,
        backgroundImageUrl: null,
        backgroundImageBlur: 0,
        cardOpacity: 100,
        cardBodyBorder: false,
        customThemeEnabled: false,
        customTheme: {
          dark: {
            accent: '#d40d0d',
            accentHover: '#ff4d4d',
            bg: '#0c0e12',
            bgSidebar: '#13171e',
            bgNav: '#13171e',
            cardBg: '#1c212a',
            tableBg: '#181c24',
            text: '#e2e8f0',
            textSecondary: '#94a3b8',
            border: '#334155'
          },
          light: {
            accent: '#d40d0d',
            accentHover: '#b91c1c',
            bg: '#f8fafc',
            bgSidebar: '#ffffff',
            bgNav: '#ffffff',
            cardBg: '#ffffff',
            tableBg: '#ffffff',
            text: '#0f172a',
            textSecondary: '#64748b',
            border: '#e2e8f0'
          }
        },
        customTriggerIcon: null,
        customTriggerEnabled: false
      };
      chrome.storage.local.set({ arizonaSettings: defaultSettings });
    }
  });
});
