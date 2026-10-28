
document.addEventListener('DOMContentLoaded', () => {

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function activateTab(targetTab) {
    tabButtons.forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === targetTab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === targetTab);
    });

    const panel = document.getElementById(targetTab);
    if (panel) panel.scrollTop = 0;
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      activateTab(button.getAttribute('data-tab'));
    });
  });

  const extToggle = document.getElementById('extension-toggle');
  const statusText = document.getElementById('toggle-status-text');

  function updateStatusText(enabled) {
    if (!statusText) return;
    statusText.textContent = enabled ? 'Вкл' : 'Выкл';
    document.body.classList.toggle('pop-extension-off', !enabled);
    if (enabled) {
      statusText.style.color = 'var(--pop-accent)';
    } else {
      statusText.style.color = 'var(--pop-text-secondary)';
    }
  }

  if (extToggle) {
    extToggle.addEventListener('change', () => {
      updateStatusText(extToggle.checked);
    });
  }

  const STORAGE_KEY = 'arz_logsparser_helper_settings';

  const defaultSettings = {
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
    'tweak-show-filled-filters': true,
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

  const settingIds = Object.keys(defaultSettings);

  function loadSettings() {
    const applyLoadedSettings = (settings) => {
      const merged = { ...defaultSettings, ...settings };
      settingIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (el.tagName === 'SELECT') {
            el.value = merged[id];
          } else {
            el.checked = merged[id];
          }
          if (id === 'extension-toggle') {
            updateStatusText(merged[id]);
          }
        }
      });
    };

    const fallbackLoad = () => {
      try {
        const localData = localStorage.getItem(STORAGE_KEY);
        if (localData) {
          applyLoadedSettings(JSON.parse(localData));
        } else {
          applyLoadedSettings({});
        }
      } catch (e) {
        console.error('Failed to load settings from localStorage:', e);
        applyLoadedSettings({});
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          fallbackLoad();
        } else if (result[STORAGE_KEY]) {
          applyLoadedSettings(result[STORAGE_KEY]);
        } else {
          applyLoadedSettings({});
        }
      });
    } else {
      fallbackLoad();
    }
  }

  function saveSettings() {
    const settings = {};
    settingIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'SELECT') {
          settings[id] = el.value;
        } else {
          settings[id] = el.checked;
        }
      }
    });

    const fallbackSave = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {
        console.error('Failed to save settings to localStorage:', e);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
        if (chrome.runtime.lastError) {
          fallbackSave();
        }
      });
    } else {
      fallbackSave();
    }
  }

  settingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', saveSettings);
    }
  });


  const ARIZONA_STORAGE_KEY = 'arizonaSettings';

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

  const defaultArizonaSettings = {
    templatesEnabled: true,
    ipLookupEnabled: true,
    geoIPEnabled: true,
    ipFields: { country: true, city: true, regionName: true, isp: true, org: true, as: true, mobile: true, proxy: true, hosting: true },
    tuningParts: { enabled: true, scanDelay: 500, highlightColor: '#d33b45', outlineWidth: 2, timePattern: '30:01,30:02,00:03,00:01,00:02,00:03', highlightOnlyMatching: true, autoScrollToMatch: false, playSoundOnMatch: false },
    emailCheck: { enabled: true, duplicateDetection: true, threshold: 3, lowColor: '#3fb950', mediumColor: '#d29922', highColor: '#f85149' },
    masking: { enabled: false, maskIp: true, maskEmail: true, maskTG: true, maskVK: true },
    tools: {
      identicalIPs: true,
      identicalIPsColor: '#d33b45',
      similarIPsFinder: true,
      actionRepeatsFinder: true,
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
      dateShortcutEnabled: true,
      styleResetButtonEnabled: true,
      copyAllLogsEnabled: true,
      tgVkDetectorEnabled: true,
      markLogsEnabled: true,
      multiPlayersEnabled: true
      ,duplicatePaginationTop: true
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
    customTheme: defaultCustomTheme,
    customTriggerIcon: null,
    customTriggerEnabled: false
  };

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function deepMerge(base, override) {
    const result = { ...base };
    if (!isPlainObject(override)) return result;
    Object.entries(override).forEach(([key, value]) => {
      result[key] = isPlainObject(value) && isPlainObject(result[key])
        ? deepMerge(result[key], value)
        : value;
    });
    return result;
  }

  function getMergedArizonaSettings(value) {
    return deepMerge(defaultArizonaSettings, value || {});
  }

  function getCustomThemePalette(settings, mode) {
    const fallback = defaultCustomTheme[mode] || defaultCustomTheme.dark;
    const saved = settings?.customTheme?.[mode] || {};
    const palette = { ...fallback, ...saved };
    Object.keys(fallback).forEach(key => {
      if (!/^#[0-9a-f]{6}$/i.test(palette[key])) palette[key] = fallback[key];
    });
    return palette;
  }

  function getArizonaElementValue(path, settingsObj) {
    const parts = path.split('.');
    let cur = settingsObj;
    for (let part of parts) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function setArizonaElementValue(path, val, settingsObj) {
    const parts = path.split('.');
    let cur = settingsObj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!cur[part]) cur[part] = {};
      cur = cur[part];
    }
    cur[parts[parts.length - 1]] = val;
  }

  const arizonaMappings = {
    'masking-enabled': 'masking.enabled',
    'masking-maskIp': 'masking.maskIp',
    'masking-maskEmail': 'masking.maskEmail',
    'masking-maskTG': 'masking.maskTG',
    'masking-maskVK': 'masking.maskVK',

    'ipLookupEnabled': 'ipLookupEnabled',
    'geoIPEnabled': 'geoIPEnabled',
    'ipField-country': 'ipFields.country',
    'ipField-city': 'ipFields.city',
    'ipField-regionName': 'ipFields.regionName',
    'ipField-isp': 'ipFields.isp',
    'ipField-org': 'ipFields.org',
    'ipField-as': 'ipFields.as',
    'ipField-mobile': 'ipFields.mobile',
    'ipField-proxy': 'ipFields.proxy',
    'ipField-hosting': 'ipFields.hosting',

    'tuningParts-enabled': 'tuningParts.enabled',
    'tuningParts-scanDelay': 'tuningParts.scanDelay',
    'tuningParts-outlineWidth': 'tuningParts.outlineWidth',
    'tuningParts-highlightColor': 'tuningParts.highlightColor',
    'tuningParts-timePattern': 'tuningParts.timePattern',
    'tuningParts-highlightOnlyMatching': 'tuningParts.highlightOnlyMatching',
    'tuningParts-autoScrollToMatch': 'tuningParts.autoScrollToMatch',
    'tuningParts-playSoundOnMatch': 'tuningParts.playSoundOnMatch',

    'emailCheck-enabled': 'emailCheck.enabled',
    'emailCheck-duplicateDetection': 'emailCheck.duplicateDetection',
    'emailCheck-threshold': 'emailCheck.threshold',
    'emailCheck-lowColor': 'emailCheck.lowColor',
    'emailCheck-mediumColor': 'emailCheck.mediumColor',
    'emailCheck-highColor': 'emailCheck.highColor',

    'templatesEnabled': 'templatesEnabled',
    'tools-identicalIPs': 'tools.identicalIPs',
    'tools-identicalIPsColor': 'tools.identicalIPsColor',
    'tools-similarIPsFinder': 'tools.similarIPsFinder',
    'tools-actionRepeatsFinder': 'tools.actionRepeatsFinder',
    'tools-columnEyeButtons': 'tools.columnEyeButtons',
    'tools-filterWindow': 'tools.filterWindow',
    'tools-formsEnabled': 'tools.formsEnabled',
    'tools-online': 'tools.online',
    'tools-punishment': 'tools.punishment',
    'tools-ipBatch': 'tools.ipBatch',
    'tools-idNick': 'tools.idNick',
    'tools-report': 'tools.report',
    'tools-lookup': 'tools.lookup',
    'tools-analytics': 'tools.analytics',
    'tools-dateShortcutEnabled': 'tools.dateShortcutEnabled',
    'tools-styleResetButtonEnabled': 'tools.styleResetButtonEnabled',
    'tools-copyAllLogsEnabled': 'tools.copyAllLogsEnabled',
    'tools-tgVkDetectorEnabled': 'tools.tgVkDetectorEnabled',
    'tools-markLogsEnabled': 'tools.markLogsEnabled',
    'tools-multiPlayersEnabled': 'tools.multiPlayersEnabled',
    'tools-duplicatePaginationTop': 'tools.duplicatePaginationTop',

    'visual-theme-mode': 'theme',
    'visual-theme-enabled': 'themeEnabled',
    'visual-custom-theme-enabled': 'customThemeEnabled',
    'visual-theme-color': 'colorScheme',
    'visual-theme-radius': 'borderRadius',
    'visual-background-color': 'backgroundColor',
    'visual-background-image-url': 'backgroundImageUrl',
    'visual-card-opacity': 'cardOpacity',
    'visual-background-blur': 'backgroundImageBlur',
    'visual-card-body-border': 'cardBodyBorder'
  };

  const backgroundImageInput = document.getElementById('visual-background-image');
  const backgroundImageButton = document.getElementById('visual-background-image-btn');
  const backgroundImageReset = document.getElementById('visual-background-image-reset');
  const backgroundImageUrl = document.getElementById('visual-background-image-url');
  const backgroundImageUrlButton = document.getElementById('visual-background-image-url-btn');
  const backgroundReset = document.getElementById('visual-background-reset');
  const customThemeEditor = document.getElementById('custom-theme-editor');
  const customThemeModeButtons = document.querySelectorAll('[data-custom-theme-mode]');
  const customThemeColorInputs = document.querySelectorAll('[data-custom-theme-color]');
  const customThemeReset = document.getElementById('custom-theme-reset');
  const customThemeCopyPreset = document.getElementById('custom-theme-copy-preset');
  let customThemeMode = 'dark';
  let customThemeSaveTimer = null;

  function saveAppearanceValues(values) {
    chrome.storage.local.get([ARIZONA_STORAGE_KEY], (result) => {
      const current = getMergedArizonaSettings(result[ARIZONA_STORAGE_KEY]);
      Object.entries(values).forEach(([path, value]) => setArizonaElementValue(path, value, current));
      chrome.storage.local.set({ [ARIZONA_STORAGE_KEY]: current }, () => {
        applyThemeToPopup(current);
      });
    });
  }

  function saveAppearanceValue(path, value) {
    saveAppearanceValues({ [path]: value });
  }

  function scheduleCustomThemeSave(values) {
    clearTimeout(customThemeSaveTimer);
    customThemeSaveTimer = setTimeout(() => saveAppearanceValues(values), 80);
  }

  function setCustomThemeEditorVisible(enabled) {
    if (customThemeEditor) customThemeEditor.hidden = !enabled;
  }

  function setCustomThemeMode(mode) {
    customThemeMode = mode === 'light' ? 'light' : 'dark';
    customThemeModeButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.customThemeMode === customThemeMode);
    });
    const settings = getMergedArizonaSettings(window.__arizonaPopupSettings);
    const palette = getCustomThemePalette(settings, customThemeMode);
    const backgroundColorInput = document.getElementById('visual-background-color');
    const backgroundValue = settings.customThemeEnabled === true
      ? palette.bg
      : (settings.backgroundColor || defaultCustomTheme[customThemeMode].bg);
    if (backgroundColorInput && /^#[0-9a-f]{6}$/i.test(backgroundValue || '')) {
      backgroundColorInput.value = backgroundValue;
    }
    renderCustomThemeEditor(settings);
  }

  function renderCustomThemePreview(palette) {
    const preview = document.querySelector('.custom-theme-preview');
    if (!preview) return;
    const previewStyle = preview.style;
    previewStyle.setProperty('--custom-preview-accent', palette.accent);
    previewStyle.setProperty('--custom-preview-bg', palette.bg);
    previewStyle.setProperty('--custom-preview-card', palette.cardBg);
    previewStyle.setProperty('--custom-preview-border', palette.border);
    previewStyle.setProperty('--custom-preview-text', palette.text);
    previewStyle.setProperty('--custom-preview-text-secondary', palette.textSecondary);
  }

  function renderCustomThemeEditor(settings) {
    const merged = getMergedArizonaSettings(settings);
    const palette = getCustomThemePalette(merged, customThemeMode);
    customThemeColorInputs.forEach(input => {
      const value = palette[input.dataset.customThemeColor];
      if (value) input.value = value;
    });
    renderCustomThemePreview(palette);
    setCustomThemeEditorVisible(merged.customThemeEnabled === true);
  }

  function readCustomThemePalette() {
    const palette = {};
    customThemeColorInputs.forEach(input => {
      palette[input.dataset.customThemeColor] = input.value;
    });
    palette.bgNav = palette.bgSidebar;
    return palette;
  }

  function getPresetPalette(theme, colorSchemeName) {
    const scheme = colorSchemes[colorSchemeName] || colorSchemes.red;
    const mode = scheme[theme] || scheme.dark;
    const isLight = theme === 'light';
    return {
      ...defaultCustomTheme[theme],
      accent: scheme.accent,
      accentHover: scheme.accentHover,
      bg: mode.bg,
      cardBg: mode.cardBg,
      tableBg: isLight ? '#ffffff' : '#161a1f',
      bgSidebar: isLight ? '#ffffff' : '#14171c',
      bgNav: isLight ? '#ffffff' : '#14171c',
      text: isLight ? '#171a1f' : '#e6e8eb',
      textSecondary: isLight ? '#626a75' : '#9aa1ab',
      border: isLight ? '#e1e4e8' : '#2a2f37'
    };
  }

  function updateCustomThemePalette(mode, palette) {
    const cleanPalette = {};
    Object.entries(palette).forEach(([key, value]) => {
      if (/^#[0-9a-f]{6}$/i.test(value)) cleanPalette[key] = value;
    });
    scheduleCustomThemeSave({ [`customTheme.${mode}`]: cleanPalette });
    const nextSettings = getMergedArizonaSettings(window.__arizonaPopupSettings);
    nextSettings.customTheme[mode] = { ...nextSettings.customTheme[mode], ...cleanPalette };
    window.__arizonaPopupSettings = nextSettings;
    renderCustomThemePreview(nextSettings.customTheme[mode]);
  }

  if (backgroundReset) backgroundReset.addEventListener('click', () => {
    const activeMode = (window.__arizonaPopupSettings?.theme || 'dark') === 'light' ? 'light' : 'dark';
    const defaultBackground = defaultCustomTheme[activeMode].bg;
    document.getElementById('visual-background-color').value = defaultBackground;
    if (window.__arizonaPopupSettings?.customThemeEnabled === true) {
      saveAppearanceValues({
        backgroundColor: null,
        [`customTheme.${activeMode}.bg`]: defaultBackground
      });
    } else {
      saveAppearanceValue('backgroundColor', null);
    }
  });
  if (backgroundImageButton) backgroundImageButton.addEventListener('click', () => backgroundImageInput?.click());
  if (backgroundImageInput) backgroundImageInput.addEventListener('change', () => {
    const file = backgroundImageInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert('Размер изображения не должен превышать 5 МБ.');
    const reader = new FileReader();
    reader.onload = () => {
      saveAppearanceValues({ backgroundImage: reader.result, backgroundImageUrl: null });
      if (backgroundImageUrl) backgroundImageUrl.value = '';
    };
    reader.readAsDataURL(file);
  });
  if (backgroundImageReset) backgroundImageReset.addEventListener('click', () => {
    if (backgroundImageInput) backgroundImageInput.value = '';
    saveAppearanceValues({ backgroundImage: null, backgroundImageUrl: null });
    if (backgroundImageUrl) backgroundImageUrl.value = '';
  });
  if (backgroundImageUrlButton) backgroundImageUrlButton.addEventListener('click', () => {
    const value = backgroundImageUrl?.value.trim() || '';
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      alert('Введите корректную ссылку на изображение (http:// или https://).');
      return;
    }
    saveAppearanceValues({ backgroundImageUrl: value, backgroundImage: null });
    if (backgroundImageInput) backgroundImageInput.value = '';
  });

  customThemeModeButtons.forEach(button => {
    button.addEventListener('click', () => setCustomThemeMode(button.dataset.customThemeMode));
  });

  customThemeColorInputs.forEach(input => {
    input.addEventListener('input', () => {
      const palette = readCustomThemePalette();
      updateCustomThemePalette(customThemeMode, palette);
    });
  });

  const backgroundColorInput = document.getElementById('visual-background-color');
  if (backgroundColorInput) backgroundColorInput.addEventListener('input', () => {
    const settings = getMergedArizonaSettings(window.__arizonaPopupSettings);
    if (settings.customThemeEnabled !== true || !/^#[0-9a-f]{6}$/i.test(backgroundColorInput.value)) return;
    const mode = settings.theme === 'light' ? 'light' : 'dark';
    const palette = {
      ...settings.customTheme[mode],
      bg: backgroundColorInput.value
    };
    settings.customTheme[mode] = palette;
    window.__arizonaPopupSettings = settings;
    scheduleCustomThemeSave({ [`customTheme.${mode}`]: palette });
    renderCustomThemePreview(palette);
  });

  if (customThemeReset) customThemeReset.addEventListener('click', () => {
    const palette = { ...defaultCustomTheme[customThemeMode] };
    window.__arizonaPopupSettings = getMergedArizonaSettings(window.__arizonaPopupSettings);
    window.__arizonaPopupSettings.customTheme[customThemeMode] = palette;
    scheduleCustomThemeSave({ [`customTheme.${customThemeMode}`]: palette });
    renderCustomThemeEditor(window.__arizonaPopupSettings);
  });

  if (customThemeCopyPreset) customThemeCopyPreset.addEventListener('click', () => {
    const settings = getMergedArizonaSettings(window.__arizonaPopupSettings);
    const palette = getPresetPalette(customThemeMode, settings.colorScheme || 'red');
    settings.customTheme[customThemeMode] = palette;
    window.__arizonaPopupSettings = settings;
    scheduleCustomThemeSave({ [`customTheme.${customThemeMode}`]: palette });
    renderCustomThemeEditor(settings);
  });

  const colorSchemes = {
    red: {
      accent: '#d33b45',
      accentRgb: '211, 59, 69',
      accentHover: '#e0525c',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    ocean: {
      accent: '#3b82f6',
      accentRgb: '59, 130, 246',
      accentHover: '#60a5fa',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    emerald: {
      accent: '#10b981',
      accentRgb: '16, 185, 129',
      accentHover: '#34d399',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    gold: {
      accent: '#d97706',
      accentRgb: '217, 119, 6',
      accentHover: '#f59e0b',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    frost: {
      accent: '#64748b',
      accentRgb: '100, 116, 139',
      accentHover: '#94a3b8',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    dracula: {
      accent: '#a78bfa',
      accentRgb: '167, 139, 250',
      accentHover: '#c4b5fd',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    sunset: {
      accent: '#ea580c',
      accentRgb: '234, 88, 12',
      accentHover: '#fb923c',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    cyberpunk: {
      accent: '#e11d48',
      accentRgb: '225, 29, 72',
      accentHover: '#fb7185',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    nord: {
      accent: '#5b8def',
      accentRgb: '91, 141, 239',
      accentHover: '#7aa5f5',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    },
    matrix: {
      accent: '#16a34a',
      accentRgb: '22, 163, 74',
      accentHover: '#22c55e',
      dark: { bg: '#0f1115', cardBg: '#191d23' },
      light: { bg: '#f4f5f7', cardBg: '#ffffff' }
    }
  };

  function mixHexColors(base, mix, amount) {
    const parse = value => {
      const hex = String(value || '').replace('#', '');
      if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    };
    const a = parse(base);
    const b = parse(mix);
    if (!a || !b) return base;
    const channel = index => Math.round(a[index] + (b[index] - a[index]) * amount).toString(16).padStart(2, '0');
    return `#${channel(0)}${channel(1)}${channel(2)}`;
  }

  function applyThemeToPopup(settings) {
    const mergedSettings = getMergedArizonaSettings(settings);
    window.__arizonaPopupSettings = mergedSettings;
    const theme = mergedSettings.theme || 'dark';
    const colorSchemeName = mergedSettings.colorScheme || 'red';
    const borderRadiusVal = mergedSettings.borderRadius || '8px';
    const fontSizeVal = mergedSettings.fontSize || 14;

    const body = document.body;
    if (theme === 'light') {
      body.classList.add('pop-light-theme');
    } else {
      body.classList.remove('pop-light-theme');
    }

    body.classList.forEach(cls => {
      if (cls.startsWith('pop-theme-')) {
        body.classList.remove(cls);
      }
    });
    body.classList.add('pop-theme-' + (mergedSettings.customThemeEnabled === true ? 'custom' : colorSchemeName));

    const scheme = colorSchemes[colorSchemeName] || colorSchemes.red;
    const modeColors = scheme[theme] || scheme.dark;
    const customPalette = mergedSettings.customThemeEnabled === true
      ? getCustomThemePalette(mergedSettings, theme)
      : null;
    const activePalette = customPalette
      ? { ...modeColors, ...customPalette }
      : modeColors;

    const rootStyle = document.documentElement.style;
    const accent = customPalette?.accent || scheme.accent;
    const accentHover = customPalette?.accentHover || scheme.accentHover;
    const accentRgb = customPalette
      ? accent.replace('#', '').match(/.{2}/g).map(part => parseInt(part, 16)).join(', ')
      : scheme.accentRgb;
    rootStyle.setProperty('--pop-accent', accent);
    rootStyle.setProperty('--pop-accent2', accentHover);
    rootStyle.setProperty('--pop-accent-rgb', accentRgb);
    rootStyle.setProperty('--pop-accent-gradient', 'none');
    rootStyle.setProperty('--pop-bg', activePalette.bg);
    rootStyle.setProperty('--pop-card-bg', activePalette.cardBg || (theme === 'light' ? '#ffffff' : modeColors.cardBg));
    const baseCard = activePalette.cardBg || (theme === 'light' ? '#ffffff' : modeColors.cardBg);
    const surfaceMixColor = theme === 'light' ? '#000000' : '#ffffff';
    rootStyle.setProperty('--pop-surface', mixHexColors(baseCard, surfaceMixColor, 0.045));
    rootStyle.setProperty('--pop-elevated', mixHexColors(baseCard, surfaceMixColor, 0.08));
    rootStyle.setProperty('--pop-accent-soft', `rgba(${accentRgb}, 0.13)`);
    rootStyle.setProperty('--pop-accent-border', `rgba(${accentRgb}, 0.34)`);
    rootStyle.setProperty('--pop-radius', borderRadiusVal);

    if (customPalette) {
      rootStyle.setProperty('--pop-text', customPalette.text);
      rootStyle.setProperty('--pop-text-secondary', customPalette.textSecondary);
      rootStyle.setProperty('--pop-border', customPalette.border);
      rootStyle.setProperty('--pop-input-bg', customPalette.bgSidebar);
      rootStyle.setProperty('--pop-input-border', customPalette.border);
      rootStyle.setProperty('--pop-input-text', customPalette.text);
    } else if (theme === 'light') {
      rootStyle.setProperty('--pop-text', '#171a1f');
      rootStyle.setProperty('--pop-text-secondary', '#626a75');
      rootStyle.setProperty('--pop-border', '#e1e4e8');
      rootStyle.setProperty('--pop-input-bg', '#ffffff');
      rootStyle.setProperty('--pop-input-border', '#d6dae0');
      rootStyle.setProperty('--pop-input-text', '#171a1f');
      rootStyle.setProperty('--pop-table-row-hover', 'rgba(0, 0, 0, 0.035)');
      rootStyle.setProperty('--pop-tab-nav-bg', 'transparent');
      rootStyle.setProperty('--pop-tab-btn-hover-bg', 'rgba(0, 0, 0, 0.04)');
      rootStyle.setProperty('--pop-tab-btn-active-bg', 'transparent');
      rootStyle.setProperty('--pop-tab-btn-active-shadow', 'none');
      rootStyle.setProperty('--pop-map-real-color', '#b42f39');
      rootStyle.setProperty('--pop-map-real-bg', 'rgba(211, 59, 69, 0.07)');
      rootStyle.setProperty('--pop-map-fake-color', '#1a7f37');
      rootStyle.setProperty('--pop-map-fake-bg', 'rgba(26, 127, 55, 0.07)');
      rootStyle.setProperty('--pop-scrollbar-thumb', '#cfd4db');
      rootStyle.setProperty('--pop-card-shadow', 'none');
      rootStyle.setProperty('--pop-stats-success-bg', 'rgba(26, 127, 55, 0.07)');
      rootStyle.setProperty('--pop-stats-success-border', 'rgba(26, 127, 55, 0.22)');
      rootStyle.setProperty('--pop-stats-error-bg', 'rgba(207, 34, 46, 0.07)');
      rootStyle.setProperty('--pop-stats-error-border', 'rgba(207, 34, 46, 0.22)');
    } else {
      rootStyle.setProperty('--pop-text', '#e6e8eb');
      rootStyle.setProperty('--pop-text-secondary', '#9aa1ab');
      rootStyle.setProperty('--pop-border', '#2a2f37');
      rootStyle.setProperty('--pop-input-bg', '#12151a');
      rootStyle.setProperty('--pop-input-border', '#343a44');
      rootStyle.setProperty('--pop-input-text', '#e6e8eb');
      rootStyle.setProperty('--pop-table-row-hover', 'rgba(255, 255, 255, 0.04)');
      rootStyle.setProperty('--pop-tab-nav-bg', 'transparent');
      rootStyle.setProperty('--pop-tab-btn-hover-bg', 'rgba(255, 255, 255, 0.04)');
      rootStyle.setProperty('--pop-tab-btn-active-bg', 'transparent');
      rootStyle.setProperty('--pop-tab-btn-active-shadow', 'none');
      rootStyle.setProperty('--pop-map-real-color', '#f08a92');
      rootStyle.setProperty('--pop-map-real-bg', 'rgba(211, 59, 69, 0.08)');
      rootStyle.setProperty('--pop-map-fake-color', '#7ccf8a');
      rootStyle.setProperty('--pop-map-fake-bg', 'rgba(63, 185, 80, 0.08)');
      rootStyle.setProperty('--pop-scrollbar-thumb', '#343a44');
      rootStyle.setProperty('--pop-card-shadow', 'none');
      rootStyle.setProperty('--pop-stats-success-bg', 'rgba(63, 185, 80, 0.08)');
      rootStyle.setProperty('--pop-stats-success-border', 'rgba(63, 185, 80, 0.25)');
      rootStyle.setProperty('--pop-stats-error-bg', 'rgba(248, 81, 73, 0.08)');
      rootStyle.setProperty('--pop-stats-error-border', 'rgba(248, 81, 73, 0.25)');
    }

    const radiusPx = parseInt(borderRadiusVal) || 0;
    const smallRadius = radiusPx > 4 ? `${radiusPx - 2}px` : `${radiusPx}px`;
    rootStyle.setProperty('--pop-radius-small', smallRadius);
    rootStyle.setProperty('--pop-radius-sm', smallRadius);
    rootStyle.setProperty('--pop-radius-lg', `${radiusPx + 2}px`);

    const scale = fontSizeVal / 14;
    rootStyle.setProperty('--pop-font-scale', scale);

    updateStatusText(document.getElementById('extension-toggle').checked);
    setCustomThemeMode(theme);
  }

  function applyArizonaSettingsToUI(settings) {
    Object.keys(arizonaMappings).forEach(elId => {
      const el = document.getElementById(elId);
      if (el) {
        const val = getArizonaElementValue(arizonaMappings[elId], settings);
        if (val !== undefined) {
          if (el.type === 'checkbox') {
            el.checked = !!val;
          } else {
            el.value = val;
            if (el.type === 'range' || el.type === 'color' || el.type === 'text') {
              const valEl = document.getElementById(elId + '-val');
              if (valEl) {
                valEl.textContent = val + (elId.includes('Delay') ? ' мс' : elId.includes('Width') ? ' px' : elId === 'visual-card-opacity' ? '%' : '');
              }
            }
          }
        }
      }
    });
    applyThemeToPopup(settings);
  }

  function loadArizonaSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([ARIZONA_STORAGE_KEY], (result) => {
        applyArizonaSettingsToUI(getMergedArizonaSettings(result[ARIZONA_STORAGE_KEY]));
      });
    } else {
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(ARIZONA_STORAGE_KEY) || 'null');
      } catch (e) {
        stored = null;
      }
      applyArizonaSettingsToUI(getMergedArizonaSettings(stored));
    }
  }

  function saveArizonaSettings() {
    const collectSettings = (storedSettings) => {
      const current = getMergedArizonaSettings(storedSettings);
      Object.keys(arizonaMappings).forEach(elId => {
        const el = document.getElementById(elId);
        if (el) {
          let val;
          if (el.type === 'checkbox') {
            val = el.checked;
          } else if (el.type === 'range') {
            val = parseInt(el.value);
            const valEl = document.getElementById(elId + '-val');
            if (valEl) {
              valEl.textContent = val + (elId.includes('Delay') ? ' мс' : elId.includes('Width') ? ' px' : elId === 'visual-card-opacity' ? '%' : '');
            }
          } else {
            val = el.value;
          }
          setArizonaElementValue(arizonaMappings[elId], val, current);
        }
      });
      return current;
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([ARIZONA_STORAGE_KEY], (result) => {
        const current = collectSettings(result[ARIZONA_STORAGE_KEY]);
        chrome.storage.local.set({ [ARIZONA_STORAGE_KEY]: current }, () => {
          applyThemeToPopup(current);
        });
      });
    } else {
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(ARIZONA_STORAGE_KEY) || 'null');
      } catch (e) {
        stored = null;
      }
      const current = collectSettings(stored);
      try {
        localStorage.setItem(ARIZONA_STORAGE_KEY, JSON.stringify(current));
      } catch (e) {
        console.error('Failed to save Arizona settings:', e);
      }
      applyThemeToPopup(current);
    }
  }

  Object.keys(arizonaMappings).forEach(elId => {
    const el = document.getElementById(elId);
    if (el) {
      el.addEventListener('change', saveArizonaSettings);
      if (el.type === 'range') {
        el.addEventListener('input', () => {
          const val = el.value;
          const valEl = document.getElementById(elId + '-val');
          if (valEl) {
            valEl.textContent = val + (elId.includes('Delay') ? ' мс' : elId.includes('Width') ? ' px' : elId === 'visual-card-opacity' ? '%' : '');
          }
        });
      }
    }
  });

  const manualIpInput = document.getElementById('manual-ip-input');
  const manualIpBtn = document.getElementById('manual-ip-btn');
  const manualIpResults = document.getElementById('manual-ip-results');

  if (manualIpBtn && manualIpInput && manualIpResults) {
    manualIpBtn.addEventListener('click', () => {
      const ip = manualIpInput.value.trim();
      if (!ip) {
        alert('Введите IP адрес!');
        return;
      }

      manualIpResults.style.display = 'block';
      manualIpResults.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Получение информации...';

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'fetch_ip_geo_single', ip: ip }, (response) => {
          if (chrome.runtime.lastError) {
            manualIpResults.innerHTML = `<span style="color: var(--pop-accent2)">Ошибка: ${chrome.runtime.lastError.message}</span>`;
            return;
          }
          if (response && response.success && response.data) {
            const data = response.data;
            if (data.status === 'fail') {
              manualIpResults.innerHTML = `<span style="color: var(--pop-accent2)">Ошибка: не удалось получить информацию для этого IP.</span>`;
            } else {
              let html = `<div style="display: flex; flex-direction: column; gap: 4px;">`;
              html += `<div><strong>IP:</strong> ${data.query || ip}</div>`;
              if (data.country) html += `<div><strong>Страна:</strong> ${data.country}</div>`;
              if (data.regionName) html += `<div><strong>Регион:</strong> ${data.regionName}</div>`;
              if (data.city) html += `<div><strong>Город:</strong> ${data.city}</div>`;
              if (data.isp) html += `<div><strong>Провайдер:</strong> ${data.isp}</div>`;
              if (data.org) html += `<div><strong>Организация:</strong> ${data.org}</div>`;
              if (data.as) html += `<div><strong>AS:</strong> ${data.as}</div>`;

              const badges = [];
              if (data.mobile) badges.push('<span style="background: var(--pop-tab-btn-hover-bg); color: var(--pop-text); border: 1px solid var(--pop-border); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; margin-right: 4px;">MOBILE</span>');
              if (data.proxy) badges.push('<span style="background: rgba(var(--pop-accent-rgb), 0.12); color: var(--pop-accent2); border: 1px solid rgba(var(--pop-accent-rgb), 0.3); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; margin-right: 4px;">PROXY/VPN</span>');
              if (data.hosting) badges.push('<span style="background: var(--pop-tab-btn-hover-bg); color: var(--pop-text-secondary); border: 1px solid var(--pop-border); padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; margin-right: 4px;">HOSTING</span>');

              if (badges.length > 0) {
                html += `<div style="margin-top: 6px;">${badges.join('')}</div>`;
              }
              html += `</div>`;
              manualIpResults.innerHTML = html;
            }
          } else {
            manualIpResults.innerHTML = `<span style="color: var(--pop-accent2)">Ошибка: ${response?.error || 'неизвестная ошибка'}</span>`;
          }
        });
      } else {
        manualIpResults.innerHTML = `<span style="color: var(--pop-accent2)">Ошибка: Chrome Extension API недоступно</span>`;
      }
    });
  }

  /* ===== Работа с формами и IP ===== */

  const FORM_TEXT_KEY = 'arz_form_last_text';
  const FORM_DOSSIER_KEY = 'arz_form_dossier';
  const FORM_LOGS_ORIGIN = 'https://logsparser.cypher-team.com/';

  const FORM_FIELDS = [
    { key: 'nick', num: 1, label: 'Игровой ник', patterns: [/игровой\s+ник/i] },
    { key: 'regCity', num: 2, label: 'Город регистрации', patterns: [/город\s+регистрации/i] },
    { key: 'currentCity', num: 3, label: 'Текущий город', patterns: [/где\s+(?:вы\s+)?(?:сейчас\s+)?находитесь/i, /переезжали/i] },
    { key: 'provider', num: 4, label: 'Провайдер', patterns: [/провайдер/i] },
    { key: 'regDate', num: 5, label: 'Дата регистрации', patterns: [/когда\s+был[ао]?\s+зарегистрирован/i] },
    { key: 'donations', num: 6, label: 'Донаты', patterns: [/общая\s+сумма\s+донатов/i, /пополнени[яй]/i, /донат/i] },
    { key: 'ipProof', num: 7, label: 'Скриншот IP', patterns: [/скриншот\s+ip/i, /2ip\.ru/i] },
    { key: 'socials', num: 8, label: 'Почта / ВК / ТГ', patterns: [/была\s+ли\s+привязана/i, /привязана\s+почта/i] },
    { key: 'profileProof', num: 9, label: 'Скриншот статистики', patterns: [/скриншот\s+статистики/i, /личного\s+кабинета/i] }
  ];

  const PAYMENT_METHODS = [
    { name: 'ВТБ', pattern: /втб|vtb/i },
    { name: 'Сбербанк', pattern: /сбер|sber/i },
    { name: 'Т-Банк', pattern: /тинькофф|т-?банк|tinkoff|tbank/i },
    { name: 'Альфа-Банк', pattern: /альфа|alfa/i },
    { name: 'Райффайзен', pattern: /райф|raif/i },
    { name: 'Криптовалюта', pattern: /крипт|usdt|btc|ton/i },
    { name: 'Банковская карта', pattern: /карт/i }
  ];

  const FORM_MONTHS = [
    { num: 1, label: 'январь', forms: ['январь', 'января', 'январе', 'янв'] },
    { num: 2, label: 'февраль', forms: ['февраль', 'февраля', 'феврале', 'фев'] },
    { num: 3, label: 'март', forms: ['март', 'марта', 'марте', 'мар'] },
    { num: 4, label: 'апрель', forms: ['апрель', 'апреля', 'апреле', 'апр'] },
    { num: 5, label: 'май', forms: ['май', 'мая', 'мае'] },
    { num: 6, label: 'июнь', forms: ['июнь', 'июня', 'июне', 'июн'] },
    { num: 7, label: 'июль', forms: ['июль', 'июля', 'июле', 'июл'] },
    { num: 8, label: 'август', forms: ['август', 'августа', 'августе', 'авг'] },
    { num: 9, label: 'сентябрь', forms: ['сентябрь', 'сентября', 'сентябре', 'сен', 'сент'] },
    { num: 10, label: 'октябрь', forms: ['октябрь', 'октября', 'октябре', 'окт'] },
    { num: 11, label: 'ноябрь', forms: ['ноябрь', 'ноября', 'ноябре', 'ноя'] },
    { num: 12, label: 'декабрь', forms: ['декабрь', 'декабря', 'декабре', 'дек'] }
  ];

  const formSource = document.getElementById('form-source');
  const formParseBtn = document.getElementById('form-parse-btn');
  const formFileBtn = document.getElementById('form-file-btn');
  const formFileInput = document.getElementById('form-file-input');
  const formClearBtn = document.getElementById('form-clear-btn');
  const formResult = document.getElementById('form-result');
  const formResultTitle = document.getElementById('form-result-title');
  const formResultSubtitle = document.getElementById('form-result-subtitle');
  const formStatusBadge = document.getElementById('form-status-badge');
  const formAttention = document.getElementById('form-attention');
  const formFieldsEl = document.getElementById('form-fields');
  const formIpInput = document.getElementById('form-ip-input');
  const formIpCheckBtn = document.getElementById('form-ip-check-btn');
  const formIpResult = document.getElementById('form-ip-result');
  const formLogsBtn = document.getElementById('form-logs-btn');
  const formOpenNickBtn = document.getElementById('form-open-nick-btn');
  const formOpenIpBtn = document.getElementById('form-open-ip-btn');
  const formOpenMailBtn = document.getElementById('form-open-mail-btn');
  const formVerification = document.getElementById('form-verification');
  const formVerificationBody = document.getElementById('form-verification-body');
  const formVerifyRefresh = document.getElementById('form-verify-refresh');

  let currentFormDossier = null;
  let formVerificationTimer = null;
  let formVerificationToken = 0;
  let lastFormVerification = null;

  function escapeFormHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  function cleanFormValue(value) {
    return String(value || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^[\s:;,.\-]+/, '')
      .replace(/[\s:;,.\-]+$/, '')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function parseNumberedForm(text) {
    const numbered = {};
    const markers = [];
    const newlineRe = /(?:^|\n)\s*([1-9])\s*[.)]\s+/g;
    let match;
    while ((match = newlineRe.exec(text)) !== null) {
      const start = match.index + match[0].indexOf(match[1]);
      markers.push({ num: Number(match[1]), start, contentStart: newlineRe.lastIndex });
    }

    if (markers.length < 6) {
      const inlineRe = /(?<!\d)([1-9])\s*[.)]\s+(?=[А-ЯЁA-Z])/g;
      while ((match = inlineRe.exec(text)) !== null) {
        const start = match.index;
        if (!markers.some(item => Math.abs(item.start - start) < 3)) {
          markers.push({ num: Number(match[1]), start, contentStart: inlineRe.lastIndex });
        }
      }
      markers.sort((a, b) => a.start - b.start);
    }

    markers.forEach((marker, index) => {
      const end = index + 1 < markers.length ? markers[index + 1].start : text.length;
      numbered[marker.num] = cleanFormValue(
        text.slice(marker.contentStart, end).replace(/\s*[1-9]\s*[.)]\s*$/, '')
      );
    });

    return numbered;
  }

  function extractFormValues(rawText) {
    const text = String(rawText || '').replace(/\r\n?/g, '\n').trim();
    const values = {};
    const numbered = parseNumberedForm(text);

    const hits = FORM_FIELDS.map(def => {
      let best = null;
      def.patterns.forEach(re => {
        const match = re.exec(text);
        if (match && (!best || match.index < best.index)) {
          best = { index: match.index, length: match[0].length };
        }
      });
      return { def, hit: best };
    });

    hits.forEach(item => {
      let value = '';
      if (item.hit) {
        const next = hits
          .filter(other => other.hit && other.hit.index > item.hit.index)
          .sort((a, b) => a.hit.index - b.hit.index)[0];
        const end = next ? next.hit.index : text.length;
        const segment = text.slice(item.hit.index, end);
        const colonMatch = segment.match(/:(?!\/\/)/);
        value = colonMatch ? segment.slice(colonMatch.index + 1) : segment.slice(item.hit.length);
        if (next) {
          value = value.replace(new RegExp(`\\s*${next.def.num}\\s*[.)]\\s*$`), '');
        }
      }
      if (!cleanFormValue(value) && numbered[item.def.num]) {
        value = numbered[item.def.num];
      }
      values[item.def.key] = cleanFormValue(value);
    });

    Object.keys(values).forEach(key => {
      if (!values[key]) {
        const def = FORM_FIELDS.find(field => field.key === key);
        if (def && numbered[def.num]) values[key] = numbered[def.num];
      }
    });

    return values;
  }

  function extractNick(value) {
    const match = String(value || '').match(/[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+/);
    return match ? match[0] : String(value || '').trim().split(/[\s,;]+/)[0] || '';
  }

  function isValidFormNick(nick) {
    return /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(String(nick || ''));
  }

  function extractCity(value) {
    let city = String(value || '').split(/[.;,(]/)[0].trim();
    city = city.replace(/^(?:г\.?|город)\s*/i, '').trim();
    return city;
  }

  function extractProvider(value) {
    return String(value || '').split(/[.;,(]/)[0].replace(/\s+/g, ' ').trim();
  }

  function extractEmail(value) {
    const match = String(value || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
    return match ? match[0] : '';
  }

  function extractIp(value) {
    const match = String(value || '').match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    return match ? match[0] : '';
  }

  function isValidIpv4(value) {
    const parts = String(value || '').trim().split('.');
    return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
  }

  function extractScreenshot(value) {
    const match = String(value || '').match(/[\wа-яёА-ЯЁ .-]+\.(?:webp|png|jpe?g|gif|bmp)/i);
    return match ? match[0].trim() : '';
  }

  function detectMonth(value) {
    const normalized = String(value || '').toLowerCase().replace(/ё/g, 'е');
    const tokens = normalized.split(/[^а-яa-z0-9]+/).filter(token => token.length >= 3);
    let best = null;

    tokens.forEach(token => {
      FORM_MONTHS.forEach(month => {
        month.forms.forEach(form => {
          const direct = token === form ||
            (token.length >= 3 && form.startsWith(token)) ||
            (form.length >= 5 && token.startsWith(form));
          const distance = direct ? 0 : levenshteinDistance(token, form);
          const limit = form.length >= 5 ? 2 : 1;
          if ((direct || distance <= limit) && (!best || distance < best.distance)) {
            best = { num: month.num, label: month.label, distance };
          }
        });
      });
    });

    return best;
  }

  function parseRegistrationDate(value) {
    const normalized = String(value || '').toLowerCase().replace(/ё/g, 'е');
    let year = null;
    let month = null;

    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    if (yearMatch) year = Number(yearMatch[1]);

    const fullDate = normalized.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
    if (fullDate) {
      const first = Number(fullDate[1]);
      const second = Number(fullDate[2]);
      year = Number(fullDate[3]);
      month = first > 12 ? second : first;
    } else {
      const shortDate = normalized.match(/\b(\d{1,2})[.\/-](20\d{2})\b/);
      if (shortDate) {
        month = Number(shortDate[1]);
        year = Number(shortDate[2]);
      }
    }

    if (!month) {
      const detected = detectMonth(normalized);
      if (detected) month = detected.num;
    }

    return {
      month: month && month >= 1 && month <= 12 ? month : null,
      year,
      label: month && year ? `${FORM_MONTHS[month - 1].label} ${year}` : ''
    };
  }

  function detectPaymentMethods(value) {
    const text = String(value || '');
    return PAYMENT_METHODS.filter(method => method.pattern.test(text)).map(method => method.name);
  }

  function buildFormDossier(rawText) {
    const values = extractFormValues(rawText);
    const nick = extractNick(values.nick);
    const regCity = extractCity(values.regCity);
    const currentCity = extractCity(values.currentCity);
    const provider = extractProvider(values.provider);
    const date = parseRegistrationDate(values.regDate);
    const email = extractEmail(values.socials);
    const vkLink = (String(values.socials).match(/(?:https?:\/\/)?(?:m\.)?vk\.com\/[A-Za-z0-9_.-]+/i) || [])[0] || '';
    const tgLink = (String(values.socials).match(/(?:https?:\/\/)?t\.me\/[A-Za-z0-9_]+/i) || [])[0] || '';
    const ip = extractIp(values.ipProof);
    const screenshot = extractScreenshot(values.ipProof);
    const socialHacked = /взлом|взломал|удалил|удален|удалён|пришлось удалить|не помню|нет доступа|утер/i.test(values.socials);
    const profileLost = /не помню пароль|пароль.*не помн|забыл пароль|нет доступа/i.test(values.profileProof);
    const donationsUnknown = /не помню|не знаю|не помн|не мало|без суммы|не считается/i.test(values.donations);
    const paymentMethods = detectPaymentMethods(values.donations);
    const amountMatches = String(values.donations).match(/\d[\d\s]{1,8}(?:[.,]\d{1,2})?\s*(?:₽|руб(?:\.|лей)?|р\b|rub)/gi) || [];
    const filledCount = FORM_FIELDS.filter(field => values[field.key]).length;
    const notes = [];
    const addNote = (level, text) => notes.push({ level, text });

    if (!values.nick) {
      addNote('danger', 'Не удалось распознать игровой ник.');
    } else if (!isValidFormNick(nick)) {
      addNote('warn', `Ник «${nick}» не похож на формат Name_Surname - проверьте написание.`);
    } else {
      addNote('ok', `Ник распознан: ${nick}.`);
    }

    if (filledCount < 9) {
      addNote('warn', `Распознано ${filledCount} из 9 полей - проверьте текст формы или разметьте ответы вручную.`);
    }

    if (!regCity) addNote('warn', 'Не указан город регистрации.');
    if (!currentCity) addNote('warn', 'Не указан текущий город.');
    if (!provider) addNote('warn', 'Не указан провайдер.');

    if (!date.month || !date.year) {
      addNote('warn', 'Дата регистрации не распознана - нужны месяц и год.');
    } else if (date.year < 2010 || date.year > new Date().getFullYear()) {
      addNote('danger', `Год регистрации ${date.year} выглядит подозрительно.`);
    } else {
      addNote('info', `Заявлена регистрация: ${date.label}. Точный первый вход сверится по логам.`);
    }

    if (regCity && currentCity) {
      if (regCity.toLowerCase() === currentCity.toLowerCase()) {
        addNote('ok', 'Город регистрации и текущий город совпадают.');
      } else {
        addNote('info', `Указан переезд: ${regCity} → ${currentCity}. IP нужно проверить отдельно.`);
      }
    }

    if (!values.donations) {
      addNote('warn', 'Поле о донатах пустое - сумму и способ оплаты проверить нечем.');
    } else if (donationsUnknown || amountMatches.length === 0) {
      addNote('warn', 'Сумма донатов не указана - сверьте платежи по логам и чекам.');
    } else {
      addNote('info', `В форме указана сумма: ${amountMatches.map(item => item.trim()).join(', ')}.`);
    }

    if (paymentMethods.length) {
      addNote('info', `Способы оплаты из формы: ${paymentMethods.join(', ')}.`);
    }

    if (ip) {
      addNote('ok', `IP из формы: ${ip}. Его можно проверить ниже.`);
    } else if (screenshot) {
      addNote('info', `В форме только скриншот ${screenshot} - введите IP вручную для GeoIP.`);
    } else {
      addNote('warn', 'IP не указан и не найден в тексте формы.');
    }

    if (socialHacked) {
      addNote('warn', 'Соцсети/почта недоступны - проверьте привязки и отвязки по логам.');
    } else if (email) {
      addNote('info', `Почта из формы: ${email}. Для неё доступны логи по mail.`);
    } else if (vkLink || tgLink) {
      addNote('info', `Ссылки на соцсети: ${[vkLink, tgLink].filter(Boolean).join(', ')}.`);
    } else if (/\bнет\b/i.test(values.socials)) {
      addNote('ok', 'Соцсети не привязаны (по словам игрока).');
    } else if (!values.socials) {
      addNote('warn', 'Поле о почте/ВК/ТГ пустое.');
    }

    if (profileLost) {
      addNote('info', 'Доступ к личному кабинету утерян - статистику сверим по логам.');
    }

    const hasDanger = notes.some(note => note.level === 'danger');
    const hasWarning = notes.some(note => note.level === 'warn');
    const status = hasDanger ? 'danger' : hasWarning ? 'warn' : 'ok';

    const fieldStatuses = {
      nick: !nick ? 'danger' : isValidFormNick(nick) ? 'ok' : 'warn',
      regCity: regCity ? 'ok' : 'warn',
      currentCity: currentCity ? 'ok' : 'warn',
      provider: provider ? 'ok' : 'warn',
      regDate: date.month && date.year ? 'ok' : 'warn',
      donations: values.donations ? 'ok' : 'warn',
      ipProof: ip ? 'ok' : 'info',
      socials: values.socials ? (socialHacked ? 'warn' : 'ok') : 'warn',
      profileProof: values.profileProof ? (profileLost ? 'warn' : 'ok') : 'warn'
    };

    return {
      rawText,
      createdAt: Date.now(),
      status,
      filledCount,
      notes,
      values: {
        ...values,
        nick,
        regCity,
        currentCity,
        provider,
        date,
        email,
        vkLink,
        tgLink,
        ip,
        screenshot,
        socialHacked,
        profileLost,
        paymentMethods,
        amounts: amountMatches.map(item => item.trim())
      },
      fields: FORM_FIELDS.map(def => ({
        num: def.num,
        key: def.key,
        label: def.label,
        value: values[def.key],
        status: fieldStatuses[def.key] || (values[def.key] ? 'ok' : 'warn')
      }))
    };
  }

  function noteIcon(level) {
    return {
      ok: 'fa-circle-check',
      warn: 'fa-triangle-exclamation',
      danger: 'fa-circle-exclamation',
      info: 'fa-circle-info'
    }[level] || 'fa-circle-info';
  }

  function renderFormFields(dossier) {
    if (!formFieldsEl || !dossier) return;
    formFieldsEl.innerHTML = dossier.fields.map(field => `
      <div class="form-field">
        <span class="form-field-num">${field.num}</span>
        <div class="form-field-body">
          <div class="form-field-label">
            <span>${escapeFormHtml(field.label)}</span>
            <span class="form-field-dot is-${field.status}"></span>
          </div>
          <div class="form-field-value ${field.value ? '' : 'is-empty'}">${escapeFormHtml(field.value || 'не найдено')}</div>
        </div>
      </div>
    `).join('');
  }

  function renderFormResult(dossier) {
    if (!formResult || !dossier) return;

    const nick = dossier.values.nick || '';
    const dateLabel = dossier.values.date?.label || '';
    currentFormDossier = dossier;

    formResult.hidden = false;
    formResultTitle.textContent = nick || 'Результат разбора';
    formResultSubtitle.textContent = [
      `${dossier.filledCount}/9 полей`,
      dateLabel || 'дата не распознана',
      dossier.values.ip ? `IP ${dossier.values.ip}` : (dossier.values.screenshot || '')
    ].filter(Boolean).join(' · ');

    const badgeText = dossier.status === 'danger' ? 'Расхождения' : dossier.status === 'warn' ? 'Внимание' : 'Заполнено';
    formStatusBadge.textContent = badgeText;
    formStatusBadge.className = `form-status-badge is-${dossier.status}`;

    formAttention.innerHTML = dossier.notes.map(note => `
      <div class="form-note is-${note.level}">
        <i class="fa-solid ${noteIcon(note.level)}"></i>
        <span>${escapeFormHtml(note.text)}</span>
      </div>
    `).join('');

    renderFormFields(dossier);

    if (formIpInput) formIpInput.value = dossier.values.ip || '';
    updateFormActionButtons(dossier);
  }

  function updateFormActionButtons(dossier) {
    const current = dossier || currentFormDossier;
    const nick = current?.values?.nick || '';
    const manualIp = formIpInput?.value.trim() || '';
    const ip = isValidIpv4(manualIp) ? manualIp : (current?.values?.ip || '');
    const email = current?.values?.email || '';

    if (formLogsBtn) formLogsBtn.disabled = !nick;
    if (formOpenNickBtn) formOpenNickBtn.disabled = !nick;
    if (formOpenIpBtn) formOpenIpBtn.disabled = !isValidIpv4(ip);
    if (formOpenMailBtn) formOpenMailBtn.hidden = !email;
  }

  /* --- Автоматическая сверка с серверными логами --- */

  function formatVerificationDate(date) {
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function parseIpPairFromRow(ipCell) {
    if (!ipCell) return { regIp: '', lastIp: '', allIps: [] };

    const tableIpBlocks = Array.from(ipCell.querySelectorAll('.table-ip'));
    const containers = tableIpBlocks.length ? tableIpBlocks : [ipCell];
    const pairs = containers.map((container) => {
      const lastEl = container.querySelector('.badge-secondary, [title*="последний" i]');
      const regEl = container.querySelector('.badge-primary, .badge-danger, .badge-warning, .badge-info, [title*="регистрационный" i]');
      let lastIp = lastEl?.textContent.trim() || '';
      let regIp = regEl?.textContent.trim() || '';
      const ips = container.textContent.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
      if (!lastIp) lastIp = ips[0] || '';
      if (!regIp) regIp = ips[1] || '';
      return { lastIp, regIp };
    });

    return {
      regIp: (pairs.find(pair => pair.regIp) || {}).regIp || '',
      lastIp: (pairs[0] || {}).lastIp || '',
      allIps: pairs.flatMap(pair => [pair.lastIp, pair.regIp]).filter(Boolean)
    };
  }

  function parseLogRowsFromDocument(doc) {
    const rows = [];
    doc.querySelectorAll('table.table tbody tr').forEach(row => {
      if (!row.cells || row.cells.length < 3) return;
      const dateText = (row.cells[0]?.textContent || '').trim();
      const dateMatch = dateText.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
      const date = dateMatch ? new Date(`${dateMatch[1]}T${dateMatch[2]}`) : null;
      const action = (row.cells[1]?.textContent || '').replace(/\s+/g, ' ').trim();
      const data = (row.cells[2]?.textContent || '').replace(/\s+/g, ' ').trim();
      const ipCell = row.cells[3] || row.cells[2];
      const pair = parseIpPairFromRow(ipCell);

      rows.push({
        date: date && !isNaN(date.getTime()) ? date : null,
        action,
        data,
        text: `${action} ${data} ${ipCell?.textContent || ''}`,
        regIp: pair.regIp,
        lastIp: pair.lastIp,
        allIps: pair.allIps
      });
    });
    return rows;
  }

  function fetchGeoForIps(ips) {
    return new Promise((resolve) => {
      if (!ips.length) {
        resolve({});
        return;
      }
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve({});
        return;
      }
      chrome.runtime.sendMessage({ action: 'fetch_ip_geo_batch', ips }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        const result = {};
        const data = response && response.data;
        if (Array.isArray(data)) {
          data.forEach((item, index) => {
            if (item && item.query) {
              result[item.query] = item;
            } else if (ips[index]) {
              result[ips[index]] = item;
            }
          });
        }
        resolve(result);
      });
    });
  }

  function pluralize(count, forms) {
    const value = Math.abs(Number(count) || 0);
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function countLabel(count, forms) {
    return `${count} ${pluralize(count, forms)}`;
  }

  function parseLogsHtml(html, nick) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = parseLogRowsFromDocument(doc);

    if (!rows.length) {
      if (doc.querySelector('input[type="password"], form[action*="login"]')) {
        return { status: 'auth', message: 'Нужно войти в аккаунт на сайте логов.' };
      }
      return { status: 'empty', message: `По нику ${nick} логи не найдены.` };
    }

    return { status: 'ok', rows };
  }

  function fetchLogsViaActiveTab(url) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query || !chrome.tabs.sendMessage) {
        resolve(null);
        return;
      }

      chrome.tabs.query({ url: ['https://logsparser.cypher-team.com/*'] }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab) {
          resolve(null);
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'arz_fetch_logs_html', url }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success || !response.html) {
            resolve(null);
            return;
          }
          resolve(response.html);
        });
      });
    });
  }

  async function fetchLogsPage(nick, sort, limit = 1000) {
    const url = new URL(FORM_LOGS_ORIGIN);
    url.searchParams.set('server_number', '5');
    url.searchParams.set('player', nick);
    url.searchParams.set('sort', sort);
    url.searchParams.set('limit', String(limit));

    let result;
    try {
      const response = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'text/html,application/xhtml+xml' }
      });

      if (response.ok) {
        result = parseLogsHtml(await response.text(), nick);
      } else {
        result = { status: 'error', message: `Сервер логов вернул HTTP ${response.status}.` };
      }
    } catch (error) {
      result = { status: 'error', message: 'Не удалось запросить логи. Проверьте подключение и авторизацию на сайте.' };
    }

    if (result.status === 'ok') return result;

    const fallbackHtml = await fetchLogsViaActiveTab(url.toString());
    if (fallbackHtml) {
      const fallbackResult = parseLogsHtml(fallbackHtml, nick);
      if (fallbackResult.status === 'ok') return fallbackResult;
    }

    return result;
  }

  async function fetchFormLogsFromServer(dossier) {
    const nick = dossier?.values?.nick;
    if (!nick) return { status: 'empty', message: 'Игровой ник не распознан.' };
    if (typeof fetch !== 'function' || typeof DOMParser === 'undefined') {
      return { status: 'error', message: 'Браузер не поддерживает загрузку логов.' };
    }

    let pages;
    try {
      pages = await Promise.all([
        fetchLogsPage(nick, 'asc'),
        fetchLogsPage(nick, 'desc')
      ]);
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось запросить логи. Проверьте подключение и авторизацию на сайте.'
      };
    }

    const okPages = pages.filter(page => page.status === 'ok');
    if (!okPages.length) {
      const authPage = pages.find(page => page.status === 'auth');
      if (authPage) return authPage;
      const errorPage = pages.find(page => page.status === 'error');
      return errorPage || { status: 'empty', message: `По нику ${nick} логи не найдены.` };
    }

    const merged = new Map();
    okPages.forEach(page => {
      page.rows.forEach(row => {
        const ipKey = Array.isArray(row.allIps) ? row.allIps.join(',') : `${row.regIp || ''},${row.lastIp || ''}`;
        const key = `${row.date ? row.date.getTime() : 'none'}|${row.action}|${row.data}|${ipKey}`;
        if (!merged.has(key)) merged.set(key, row);
      });
    });

    const rows = Array.from(merged.values()).sort((a, b) => (a.date || 0) - (b.date || 0));
    return { status: 'ok', rows };
  }

  function compareClaimedRegistrationDate(firstDate, claimed) {
    if (!firstDate) {
      return { level: 'warn', text: 'Не удалось прочитать дату первого лога.' };
    }
    if (!claimed?.month || !claimed?.year) {
      return { level: 'info', text: 'Дата регистрации в форме не распознана - сравнение по первому логу недоступно.' };
    }

    const claimStart = new Date(claimed.year, claimed.month - 1, 1);
    const claimEnd = new Date(claimed.year, claimed.month, 0, 23, 59, 59);

    if (firstDate < claimStart) {
      return {
        level: 'danger',
        text: `Аккаунт существовал раньше заявленного срока: первый лог ${formatVerificationDate(firstDate)}, а в форме указан ${claimed.label}.`
      };
    }
    if (firstDate > claimEnd) {
      return {
        level: 'warn',
        text: `Первый лог ${formatVerificationDate(firstDate)} позже заявленного месяца (${claimed.label}) - проверьте полноту логов или дату в форме.`
      };
    }
    return {
      level: 'ok',
      text: `Первый лог ${formatVerificationDate(firstDate)} попадает в заявленный месяц (${claimed.label}).`
    };
  }

  function summarizeFetchedLogs(dossier, rows) {
    const checks = [];
    const dates = rows.map(row => row.date).filter(Boolean).sort((a, b) => a - b);
    const firstDate = dates[0] || null;
    const lastDate = dates[dates.length - 1] || null;
    const registrationRow = rows.find(row => /регистрац|зарегистрирован|создан|account.*created/i.test(row.text));

    const regIpCounts = new Map();
    rows.forEach(row => {
      if (!row.regIp) return;
      regIpCounts.set(row.regIp, (regIpCounts.get(row.regIp) || 0) + 1);
    });
    const regIp = Array.from(regIpCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const lastRowWithIp = [...rows].reverse().find(row => row.lastIp);
    const lastIp = lastRowWithIp?.lastIp || '';
    const uniqueIps = Array.from(new Set(rows.flatMap(row => row.allIps).filter(Boolean)));

    checks.push({
      level: 'ok',
      text: `По нику найдено ${countLabel(rows.length, ['запись', 'записи', 'записей'])} в логах.`
    });

    const dateCheck = compareClaimedRegistrationDate(firstDate, dossier.values.date);
    checks.push(dateCheck);

    if (registrationRow?.date) {
      checks.push({
        level: 'info',
        text: `Лог регистрации: ${formatVerificationDate(registrationRow.date)}${registrationRow.action ? ` - ${registrationRow.action}` : ''}.`
      });
    } else {
      checks.push({
        level: 'info',
        text: 'Отдельная запись о регистрации не найдена - дата сверена по первому логу.'
      });
    }

    const socialLogPattern = /(?:^|[^а-яёa-z])(?:вк|тг|vk|вконтакте|telegram|телеграм|email|e-mail|mail|почт|соцсет)/i;
    const socialRows = rows.filter(row => socialLogPattern.test(row.text));
    let socialCheck;
    if (!socialRows.length) {
      socialCheck = dossier.values.socialHacked
        ? { level: 'info', text: 'В форме указано, что ВК взломан или удалён, но событий соцсетей в логах не найдено.' }
        : { level: 'info', text: 'Событий привязки или отвязки соцсетей и почты в логах не найдено.' };
    } else {
      const latest = [...socialRows].sort((a, b) => (b.date || 0) - (a.date || 0))[0];
      const hasRemoval = socialRows.some(row => /удал|отвяз|смен|взлом|утрач/i.test(row.text));
      if (dossier.values.socialHacked) {
        socialCheck = hasRemoval
          ? { level: 'ok', text: `Найдено ${countLabel(socialRows.length, ['событие', 'события', 'событий'])} соцсетей или почты, включая удаление или отвязку.` }
          : { level: 'warn', text: `Найдено ${countLabel(socialRows.length, ['событие', 'события', 'событий'])} соцсетей или почты, но удаления и отвязки нет.` };
      } else {
        socialCheck = { level: 'info', text: `Найдено ${countLabel(socialRows.length, ['событие', 'события', 'событий'])} соцсетей или почты. Последнее: ${formatVerificationDate(latest.date)} - ${latest.action || latest.data}.` };
      }
    }
    checks.push(socialCheck);

    const donationRows = rows.filter(row => /(донат|пополн|платеж|платёж|покупк|shop|баланс|зачислен|деньги)/i.test(row.text));
    let donationCheck;
    if (!donationRows.length) {
      donationCheck = {
        level: /не помню|не знаю|не помн|не мало|без суммы/i.test(dossier.values.donations || '') ? 'warn' : 'info',
        text: 'Платёжных записей в логах не найдено - проверьте фильтр по почте или донатам.'
      };
    } else {
      const latest = [...donationRows].sort((a, b) => (b.date || 0) - (a.date || 0))[0];
      const paymentText = donationRows.map(row => row.text).join(' ');
      const claimedMethods = dossier.values.paymentMethods || [];
      const matchedMethods = claimedMethods.filter(name => {
        const method = PAYMENT_METHODS.find(item => item.name === name);
        return method ? method.pattern.test(paymentText) : false;
      });

      if (claimedMethods.length && !matchedMethods.length) {
        donationCheck = {
          level: 'warn',
          text: `Платежи в логах есть, но способ из формы (${claimedMethods.join(', ')}) в них не упоминается.`
        };
      } else if (matchedMethods.length) {
        donationCheck = {
          level: 'ok',
          text: `Платежи найдены, способ из формы подтверждается: ${matchedMethods.join(', ')}. Последний: ${formatVerificationDate(latest.date)}.`
        };
      } else {
        donationCheck = {
          level: 'info',
          text: `Найдено ${countLabel(donationRows.length, ['платёжная запись', 'платёжные записи', 'платёжных записей'])}. Последняя: ${formatVerificationDate(latest.date)} - ${latest.action || latest.data}.`
        };
      }
    }
    checks.push(donationCheck);

    return {
      rows,
      firstDate,
      lastDate,
      regIp,
      lastIp,
      uniqueIps,
      registrationRow,
      socialRows,
      donationRows,
      dateCheck,
      socialCheck,
      donationCheck,
      checks
    };
  }

  function buildPopupIpCheck(ip, data, expectedCity, role, claimedProvider) {
    if (!ip) return { level: 'warn', text: `${role}: IP в логах не найден.`, cityMatch: null, providerMatch: null, hasGeo: false };
    if (!data) return { level: 'info', text: `${role} ${ip}: GeoIP не загружен.`, cityMatch: null, providerMatch: null, hasGeo: false };
    if (data.status !== 'success') return { level: 'info', text: `${role} ${ip}: GeoIP недоступен.`, cityMatch: null, providerMatch: null, hasGeo: false };

    const location = [data.city, data.regionName, data.country].filter(Boolean).join(', ');
    const provider = data.isp || data.org || '';
    const parts = [`${role} ${ip}: ${location || 'геоданные без города'}${provider ? `, ${provider}` : ''}.`];
    let level = 'info';
    let cityMatch = null;
    let providerMatch = null;

    if (expectedCity && data.city) {
      cityMatch = sameLocation(data.city, expectedCity);
      if (cityMatch) {
        level = 'ok';
        parts.push(`Город совпадает с формой (${expectedCity}).`);
      } else {
        level = 'warn';
        parts.push(`В форме указан ${expectedCity}.`);
      }
    }

    if (claimedProvider && provider) {
      providerMatch = sameProvider(provider, claimedProvider);
      if (providerMatch) {
        if (level !== 'warn' && level !== 'danger') level = 'ok';
        parts.push(`Провайдер совпадает с формой (${claimedProvider}).`);
      } else {
        level = 'warn';
        parts.push(`Провайдер в форме: ${claimedProvider}.`);
      }
    }

    if (data.proxy) {
      level = 'danger';
      parts.push('IP определяется как прокси или VPN.');
    } else if (data.hosting) {
      if (level !== 'danger') level = 'warn';
      parts.push('IP принадлежит хостингу или дата-центру.');
    }
    if (data.mobile) parts.push('Мобильный оператор.');

    return { level, text: parts.join(' '), cityMatch, providerMatch, hasGeo: true };
  }

  function buildPopupVerification(dossier, summary, geo) {
    const checks = [...summary.checks];
    const regCheck = buildPopupIpCheck(summary.regIp, geo[summary.regIp], dossier.values.regCity, 'IP регистрации', dossier.values.provider);
    checks.push(regCheck);

    let lastCheck;
    if (summary.lastIp) {
      lastCheck = buildPopupIpCheck(summary.lastIp, geo[summary.lastIp], dossier.values.currentCity, 'Последний IP', dossier.values.provider);
      if (summary.lastIp === summary.regIp) {
        lastCheck.text = `Последний IP совпадает с регистрационным (${summary.lastIp}). ${lastCheck.text}`;
      }
      checks.push(lastCheck);
    } else {
      lastCheck = { level: 'warn', text: 'Последний IP в логах не найден.', cityMatch: null, providerMatch: null, hasGeo: false };
      checks.push(lastCheck);
    }

    if (summary.lastIp && summary.lastIp === summary.regIp &&
      dossier.values.regCity && dossier.values.currentCity &&
      !sameLocation(dossier.values.regCity, dossier.values.currentCity) &&
      regCheck.cityMatch === false && lastCheck.cityMatch === false) {
      checks.push({
        level: 'danger',
        text: `Один и тот же IP (${summary.lastIp}) не совпадает ни с городом регистрации (${dossier.values.regCity}), ни с текущим городом (${dossier.values.currentCity}).`
      });
    }

    if (summary.uniqueIps.length > 1) {
      checks.push({
        level: summary.uniqueIps.length > 15 ? 'warn' : 'info',
        text: `Уникальных IP в логах: ${summary.uniqueIps.length}${summary.uniqueIps.length > 15 ? ' - проверьте VPN и динамические адреса.' : '.'}`
      });
    }

    const dangerCount = checks.filter(check => check.level === 'danger').length;
    const warnCount = checks.filter(check => check.level === 'warn').length;
    const status = dangerCount ? 'danger' : warnCount ? 'warn' : 'ok';
    const verdict = status === 'danger'
      ? 'Похоже на ложь'
      : status === 'warn'
        ? 'Есть нестыковки'
        : 'Похоже на правду';

    const matchStatus = (value, fallback = 'info') => value === true ? 'ok' : value === false ? 'warn' : fallback;
    const fieldStatuses = {
      regDate: summary.dateCheck.level === 'danger' ? 'danger' : summary.dateCheck.level,
      regCity: matchStatus(regCheck.cityMatch),
      provider: matchStatus(regCheck.providerMatch),
      currentCity: matchStatus(lastCheck.cityMatch),
      ipProof: summary.regIp || summary.lastIp ? 'ok' : 'warn',
      socials: summary.socialCheck.level,
      donations: summary.donationCheck.level
    };

    return {
      ...summary,
      status,
      verdict,
      checks,
      fieldStatuses,
      regCheck,
      lastCheck,
      dangerCount,
      warnCount
    };
  }

  function renderFormVerification(result) {
    if (!formVerification || !formVerificationBody) return;
    formVerification.hidden = false;

    const { status } = result;

    if (status === 'loading') {
      if (formStatusBadge) {
        formStatusBadge.textContent = 'Проверка';
        formStatusBadge.className = 'form-status-badge is-info';
      }
      formVerificationBody.innerHTML = '<div class="form-verify-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Запрашиваю логи по нику и сверяю данные…</div>';
      return;
    }

    if (status === 'auth' || status === 'empty' || status === 'error') {
      const level = status === 'auth' ? 'info' : status === 'empty' ? 'warn' : 'danger';
      const title = status === 'auth'
        ? 'Нужна авторизация'
        : status === 'empty'
          ? 'Логи не найдены'
          : 'Не удалось получить логи';

      if (formStatusBadge) {
        formStatusBadge.textContent = title;
        formStatusBadge.className = `form-status-badge is-${level}`;
      }

      formVerificationBody.innerHTML = `
        <div class="form-verdict is-${level}">
          <i class="fa-solid ${noteIcon(level)}"></i>
          <div>
            <strong>${escapeFormHtml(title)}</strong>
            <span>${escapeFormHtml(result.message || '')}</span>
          </div>
        </div>
        <div class="form-verify-actions">
          <button type="button" class="arz-btn-secondary" data-form-verify-action="open-logs">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Открыть логи на сайте
          </button>
        </div>
      `;
      return;
    }

    if (Array.isArray(result.rows) && Array.isArray(result.checks)) {
      const value = result;
      const geoData = result.geo || {};
      const regCity = geoData[value.regIp]?.city || '';
      const lastCity = geoData[value.lastIp]?.city || '';
      const dateLabel = currentFormDossier?.values?.date?.label || '-';

      formVerificationBody.innerHTML = `
        <div class="form-verdict is-${value.status}">
          <i class="fa-solid ${value.status === 'danger' ? 'fa-circle-exclamation' : value.status === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
          <div>
            <strong>${escapeFormHtml(value.verdict)}</strong>
            <span>Сверено ${countLabel(value.rows.length, ['запись', 'записи', 'записей'])} · ${countLabel(value.dangerCount, ['расхождение', 'расхождения', 'расхождений'])} · ${countLabel(value.warnCount, ['замечание', 'замечания', 'замечаний'])}</span>
          </div>
        </div>
        <div class="form-verify-stats">
          <div><span>Заявленная регистрация</span><strong>${escapeFormHtml(dateLabel)}</strong></div>
          <div><span>Первый лог</span><strong>${escapeFormHtml(formatVerificationDate(value.firstDate))}</strong></div>
          <div><span>Последний лог</span><strong>${escapeFormHtml(formatVerificationDate(value.lastDate))}</strong></div>
          <div><span>Записей по нику</span><strong>${value.rows.length}</strong></div>
          <div><span>IP регистрации</span><strong>${escapeFormHtml(value.regIp || '-')}${regCity ? ` · ${escapeFormHtml(regCity)}` : ''}</strong></div>
          <div><span>Последний IP</span><strong>${escapeFormHtml(value.lastIp || '-')}${lastCity ? ` · ${escapeFormHtml(lastCity)}` : ''}</strong></div>
        </div>
        <div class="form-verify-notes">
          ${value.checks.map(check => `
            <div class="form-note is-${check.level}">
              <i class="fa-solid ${noteIcon(check.level)}"></i>
              <span>${escapeFormHtml(check.text)}</span>
            </div>
          `).join('')}
        </div>
        <div class="form-verify-actions">
          <button type="button" class="arz-btn-secondary" data-form-verify-action="open-logs">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Открыть логи на сайте
          </button>
        </div>
      `;

      if (currentFormDossier && value.fieldStatuses) {
        currentFormDossier.fields.forEach(field => {
          if (value.fieldStatuses[field.key]) field.status = value.fieldStatuses[field.key];
        });
        renderFormFields(currentFormDossier);
      }

      if (formStatusBadge) {
        formStatusBadge.textContent = value.verdict;
        formStatusBadge.className = `form-status-badge is-${value.status}`;
      }
    }
  }

  async function runFormVerification(force = false) {
    const dossier = ensureCurrentDossierFromText();
    if (!dossier || !formVerification || !formVerificationBody) return;

    if (!dossier.values.nick) {
      formVerification.hidden = false;
      formVerificationBody.innerHTML = `
        <div class="form-verdict is-warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div><strong>Ник не распознан</strong><span>Сверка с логами невозможна без игрового ника.</span></div>
        </div>
      `;
      return;
    }

    const cacheKey = `${dossier.values.nick}|${dossier.rawText}`;
    if (!force && lastFormVerification && lastFormVerification.cacheKey === cacheKey && Date.now() - lastFormVerification.createdAt < 120000) {
      renderFormVerification(lastFormVerification);
      return;
    }

    const token = ++formVerificationToken;
    formVerification.hidden = false;
    renderFormVerification({ status: 'loading' });

    const fetched = await fetchFormLogsFromServer(dossier);
    if (token !== formVerificationToken) return;

    if (fetched.status !== 'ok') {
      lastFormVerification = { ...fetched, cacheKey, createdAt: Date.now() };
      renderFormVerification(fetched);
      return;
    }

    const summary = summarizeFetchedLogs(dossier, fetched.rows);
    const ips = Array.from(new Set([summary.regIp, summary.lastIp].filter(Boolean)));
    const geo = await fetchGeoForIps(ips);
    if (token !== formVerificationToken) return;

    const verification = buildPopupVerification(dossier, summary, geo);
    verification.geo = geo;
    verification.cacheKey = cacheKey;
    verification.createdAt = Date.now();
    lastFormVerification = verification;
    renderFormVerification(verification);
  }

  function scheduleFormVerification() {
    clearTimeout(formVerificationTimer);
    formVerificationTimer = setTimeout(() => runFormVerification(true), 450);
  }

  function writeFormStorage(text, dossier) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [FORM_TEXT_KEY]: text, [FORM_DOSSIER_KEY]: dossier }, () => {
        if (chrome.runtime.lastError) console.warn('[Form] save failed:', chrome.runtime.lastError.message);
      });
    } else {
      try {
        localStorage.setItem(FORM_TEXT_KEY, text);
        localStorage.setItem(FORM_DOSSIER_KEY, JSON.stringify(dossier));
      } catch (e) {
        console.error('[Form] localStorage save failed:', e);
      }
    }
  }

  function readFormStorage(callback) {
    const finish = (text, dossier) => {
      if (typeof dossier === 'string') {
        try {
          dossier = JSON.parse(dossier);
        } catch (e) {
          dossier = null;
        }
      }
      callback(typeof text === 'string' ? text : '', dossier || null);
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([FORM_TEXT_KEY, FORM_DOSSIER_KEY], (result) => {
        if (chrome.runtime.lastError) {
          finish('', null);
          return;
        }
        finish(result[FORM_TEXT_KEY], result[FORM_DOSSIER_KEY]);
      });
    } else {
      try {
        finish(localStorage.getItem(FORM_TEXT_KEY) || '', localStorage.getItem(FORM_DOSSIER_KEY));
      } catch (e) {
        finish('', null);
      }
    }
  }

  function clearFormStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([FORM_TEXT_KEY, FORM_DOSSIER_KEY]);
    } else {
      try {
        localStorage.removeItem(FORM_TEXT_KEY);
        localStorage.removeItem(FORM_DOSSIER_KEY);
      } catch (e) {
        console.error('[Form] localStorage clear failed:', e);
      }
    }
  }

  function parseAndRenderForm(rawText, options = {}) {
    const text = String(rawText || '').trim();
    if (!text) {
      if (!options.silent) alert('Вставьте текст формы.');
      return null;
    }
    const dossier = buildFormDossier(text);
    renderFormResult(dossier);
    if (!options.skipSave) writeFormStorage(text, dossier);
    if (!options.skipVerify) scheduleFormVerification();
    return dossier;
  }

  function ensureCurrentDossierFromText() {
    const text = formSource?.value.trim() || '';
    if (!text) return null;
    if (!currentFormDossier || currentFormDossier.rawText !== text) {
      currentFormDossier = buildFormDossier(text);
      renderFormResult(currentFormDossier);
      writeFormStorage(text, currentFormDossier);
    }
    return currentFormDossier;
  }

  function openLogsUrl(url) {
    const target = url.toString();
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: target });
    } else {
      window.open(target, '_blank', 'noopener');
    }
  }

  function buildFormLogsUrl(kind) {
    const dossier = ensureCurrentDossierFromText();
    if (!dossier) {
      alert('Сначала вставьте и разберите форму.');
      return null;
    }
    const nick = dossier.values.nick;
    const manualIp = formIpInput?.value.trim() || '';
    const ip = isValidIpv4(manualIp) ? manualIp : dossier.values.ip;
    const email = dossier.values.email;
    const url = new URL(FORM_LOGS_ORIGIN);

    url.searchParams.set('server_number', '5');
    url.searchParams.set('limit', '100');
    url.searchParams.set('arz_form_check', '1');

    if (kind === 'ip') {
      if (!isValidIpv4(ip)) {
        alert('Укажите корректный IP.');
        return null;
      }
      url.searchParams.set('ip', ip);
      url.searchParams.set('sort', 'asc');
    } else if (kind === 'mail') {
      if (!email) {
        alert('Почта в форме не найдена.');
        return null;
      }
      url.searchParams.set('type[]', 'mail');
      url.searchParams.set('dynamic[109]', email);
      url.searchParams.set('sort', 'desc');
    } else {
      if (!nick) {
        alert('Игровой ник в форме не найден.');
        return null;
      }
      url.searchParams.set('player', nick);
      url.searchParams.set('sort', 'asc');
    }

    writeFormStorage(dossier.rawText, dossier);
    return url;
  }

  function openFormLogs(kind) {
    const url = buildFormLogsUrl(kind);
    if (url) openLogsUrl(url);
  }

  function renderFormIpResult(ip, data) {
    if (!formIpResult) return;
    formIpResult.hidden = false;

    if (!data || data.status !== 'success') {
      formIpResult.innerHTML = `
        <div class="form-ip-verdict is-danger">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>Не удалось получить GeoIP для ${escapeFormHtml(ip)}.</span>
        </div>
      `;
      return;
    }

    const dossier = currentFormDossier;
    const values = dossier?.values || {};
    const city = data.city || '';
    const provider = data.isp || data.org || '';
    const details = [
      ['IP', data.query || ip],
      ['Страна', data.country || data.countryCode || '-'],
      ['Регион', data.regionName || '-'],
      ['Город', city || '-'],
      ['Провайдер', data.isp || '-'],
      ['Организация', data.org || '-'],
      ['AS', data.as || '-']
    ];

    const verdicts = [];
    const addVerdict = (level, text) => verdicts.push({ level, text });

    if (city && (values.regCity || values.currentCity)) {
      const regMatch = values.regCity && sameLocation(city, values.regCity);
      const currentMatch = values.currentCity && sameLocation(city, values.currentCity);
      if (regMatch) {
        addVerdict('ok', `Город совпадает с городом регистрации: ${values.regCity}.`);
      } else if (currentMatch) {
        addVerdict('ok', `Город совпадает с текущим городом: ${values.currentCity}.`);
      } else if (values.regCity && values.currentCity) {
        addVerdict('danger', `Город по IP (${city}) не совпадает с регистрацией (${values.regCity}) и текущим городом (${values.currentCity}).`);
      } else {
        addVerdict('warn', `Город по IP: ${city}, в форме: ${values.regCity || values.currentCity}.`);
      }
    }

    if (provider && values.provider) {
      if (sameProvider(provider, values.provider)) {
        addVerdict('ok', `Провайдер совпадает с формой: ${values.provider}.`);
      } else {
        addVerdict('warn', `Провайдер по IP: ${provider}, в форме: ${values.provider}.`);
      }
    }

    if (data.proxy) addVerdict('danger', 'IP определяется как прокси/VPN.');
    if (data.hosting) addVerdict('warn', 'IP принадлежит хостингу или дата-центру.');
    if (data.mobile) addVerdict('info', 'IP определяется как мобильный оператор.');

    formIpResult.innerHTML = `
      <div class="form-ip-grid">
        ${details.map(([label, value]) => `
          <div class="form-ip-item">
            <span>${escapeFormHtml(label)}</span>
            <strong>${escapeFormHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
      ${verdicts.length ? verdicts.map(verdict => `
        <div class="form-ip-verdict is-${verdict.level}">
          <i class="fa-solid ${noteIcon(verdict.level)}"></i>
          <span>${escapeFormHtml(verdict.text)}</span>
        </div>
      `).join('') : ''}
    `;
  }

  function normalizeLocation(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]/g, '');
  }

  function transliterateLocation(value) {
    const map = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
      и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
      с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh',
      ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
    };
    return normalizeLocation(String(value || '').toLowerCase().replace(/[а-яё]/g, letter => map[letter] || letter));
  }

  function fuzzyLocationMatch(left, right) {
    if (!left || !right) return false;
    if (left === right || left.includes(right) || right.includes(left)) return true;
    const limit = Math.max(2, Math.floor(Math.max(left.length, right.length) * 0.2));
    return levenshteinDistance(left, right) <= limit;
  }

  function sameLocation(a, b) {
    const left = normalizeLocation(a);
    const right = normalizeLocation(b);
    if (!left || !right) return false;
    if (fuzzyLocationMatch(left, right)) return true;
    return fuzzyLocationMatch(transliterateLocation(left), transliterateLocation(right));
  }

  const PROVIDER_ALIASES = [
    ['билайн', 'beeline', 'вымпелком', 'vimpelcom', 'vimpel'],
    ['мтс', 'mts'],
    ['мегафон', 'megafon', 'megaphone'],
    ['теле2', 'tele2', 't2'],
    ['ростелеком', 'rostelecom', 'rt'],
    ['домру', 'domru'],
    ['йота', 'yota'],
    ['ттк', 'ttk'],
    ['акадо', 'akado'],
    ['мгтс', 'mgts'],
    ['эртелеком', 'ertelecom'],
    ['нетбайнет', 'netbynet'],
    ['транстелеком', 'transtelecom'],
    ['сатнет', 'satnet']
  ];

  function sameProvider(a, b) {
    const left = normalizeLocation(a);
    const right = normalizeLocation(b);
    if (!left || !right) return false;
    if (fuzzyLocationMatch(left, right)) return true;

    const leftLatin = transliterateLocation(left);
    const rightLatin = transliterateLocation(right);
    if (fuzzyLocationMatch(leftLatin, rightLatin)) return true;

    return PROVIDER_ALIASES.some(group => {
      const inGroup = (value, latin) => group.some(alias => value.includes(alias) || latin.includes(alias));
      return inGroup(left, leftLatin) && inGroup(right, rightLatin);
    });
  }

  function checkFormIp() {
    const ip = formIpInput?.value.trim() || '';
    if (!isValidIpv4(ip)) {
      if (formIpResult) {
        formIpResult.hidden = false;
        formIpResult.innerHTML = `
          <div class="form-ip-verdict is-danger">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>Введите корректный IPv4-адрес.</span>
          </div>
        `;
      }
      return;
    }

    if (!formIpResult) return;
    formIpResult.hidden = false;
    formIpResult.innerHTML = '<span class="form-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Получение GeoIP…</span>';

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      renderFormIpResult(ip, null);
      return;
    }

    chrome.runtime.sendMessage({ action: 'fetch_ip_geo_single', ip }, (response) => {
      if (chrome.runtime.lastError) {
        renderFormIpResult(ip, null);
        return;
      }
      if (response && response.success && response.data) {
        renderFormIpResult(ip, response.data);
      } else {
        renderFormIpResult(ip, null);
      }
    });
  }

  if (formParseBtn) {
    formParseBtn.addEventListener('click', () => {
      parseAndRenderForm(formSource?.value || '');
    });
  }

  if (formFileBtn && formFileInput) {
    formFileBtn.addEventListener('click', () => formFileInput.click());
    formFileInput.addEventListener('change', () => {
      const file = formFileInput.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        alert('Файл слишком большой (максимум 1 МБ).');
        formFileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        if (formSource) formSource.value = text;
        parseAndRenderForm(text);
      };
      reader.readAsText(file, 'utf-8');
      formFileInput.value = '';
    });
  }

  if (formClearBtn) {
    formClearBtn.addEventListener('click', () => {
      if (formSource) formSource.value = '';
      if (formIpInput) formIpInput.value = '';
      if (formResult) formResult.hidden = true;
      if (formIpResult) formIpResult.hidden = true;
      if (formVerification) formVerification.hidden = true;
      if (formVerificationBody) formVerificationBody.innerHTML = '';
      clearTimeout(formVerificationTimer);
      formVerificationToken += 1;
      lastFormVerification = null;
      currentFormDossier = null;
      clearFormStorage();
      updateFormActionButtons(null);
    });
  }

  if (formLogsBtn) formLogsBtn.addEventListener('click', () => runFormVerification(true));
  if (formOpenNickBtn) formOpenNickBtn.addEventListener('click', () => openFormLogs('nick'));
  if (formOpenIpBtn) formOpenIpBtn.addEventListener('click', () => openFormLogs('ip'));
  if (formOpenMailBtn) formOpenMailBtn.addEventListener('click', () => openFormLogs('mail'));
  if (formIpCheckBtn) formIpCheckBtn.addEventListener('click', checkFormIp);
  if (formVerifyRefresh) formVerifyRefresh.addEventListener('click', () => runFormVerification(true));
  if (formVerificationBody) {
    formVerificationBody.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('[data-form-verify-action="open-logs"]');
      if (actionBtn) openFormLogs('nick');
    });
  }

  if (formIpInput) {
    formIpInput.addEventListener('input', () => {
      updateFormActionButtons(currentFormDossier);
      if (formIpResult) formIpResult.hidden = true;
    });
    formIpInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        checkFormIp();
      }
    });
  }

  if (formSource) {
    formSource.addEventListener('input', () => {
      if (currentFormDossier && currentFormDossier.rawText !== formSource.value.trim()) {
        if (formStatusBadge) {
          formStatusBadge.textContent = 'Текст изменён';
          formStatusBadge.className = 'form-status-badge';
        }
      }
    });
  }

  if (formResult || formSource) {
    readFormStorage((text, dossier) => {
      if (text) {
        if (formSource) formSource.value = text;
        if (dossier && dossier.rawText === text && Array.isArray(dossier.fields)) {
          renderFormResult(dossier);
        } else {
          parseAndRenderForm(text, { silent: true, skipSave: true });
        }
      } else if (dossier && dossier.rawText) {
        if (formSource) formSource.value = dossier.rawText;
        renderFormResult(dossier);
      }
      if (ensureCurrentDossierFromText()?.values?.nick) scheduleFormVerification();
    });
  }

  /* ==================== Popup UI personalization ==================== */

  const POPUP_UI_KEY = 'arizonaPopupUi';

  const defaultPopupUi = {
    layout: 'side',
    density: 'regular',
    width: 680,
    motion: true,
    collapsible: true,
    rememberCollapsed: true,
    showCollapseAll: true,
    navSubtitles: true,
    collapsedGroups: {}
  };

  const popupPresets = {
    compact: { layout: 'side', density: 'compact', width: 600, navSubtitles: false },
    balanced: { layout: 'side', density: 'regular', width: 680, navSubtitles: true },
    spacious: { layout: 'top', density: 'relaxed', width: 760, navSubtitles: true }
  };

  const popupPresetLabels = {
    compact: 'Компактный',
    balanced: 'Баланс',
    spacious: 'Просторный'
  };

  const popupSearchAliases = {
    'popup-layout': 'расположение навигация меню попап панель сверху сбоку',
    'popup-density': 'плотность масштаб размер компактный просторный',
    'popup-width': 'ширина окна размер попап',
    'popup-nav-subtitles': 'подписи подзаголовки навигации',
    'popup-motion': 'анимации анимация движение',
    'popup-collapsible': 'сворачиваемые группы свернуть развернуть',
    'popup-remember-collapsed': 'запоминать состояние групп',
    'popup-show-collapse-all': 'кнопка свернуть все развернуть все',
    'popup-reset-ui': 'сброс настройки меню по умолчанию'
  };

  function normalizePopupUi(value) {
    const source = value && typeof value === 'object' ? value : {};
    const collapsedGroups = {};

    if (source.collapsedGroups && typeof source.collapsedGroups === 'object' && !Array.isArray(source.collapsedGroups)) {
      Object.entries(source.collapsedGroups).forEach(([key, collapsed]) => {
        if (typeof key === 'string' && collapsed === true) collapsedGroups[key] = true;
      });
    }

    const width = Number(source.width);
    return {
      layout: source.layout === 'top' ? 'top' : 'side',
      density: ['compact', 'regular', 'relaxed'].includes(source.density) ? source.density : 'regular',
      width: [600, 680, 760].includes(width) ? width : 680,
      motion: source.motion !== false,
      collapsible: source.collapsible !== false,
      rememberCollapsed: source.rememberCollapsed !== false,
      showCollapseAll: source.showCollapseAll !== false,
      navSubtitles: source.navSubtitles !== false,
      collapsedGroups
    };
  }

  let popupUi = normalizePopupUi(defaultPopupUi);
  let popupToastTimer = null;

  function showToast(message) {
    const toast = document.getElementById('ui-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(popupToastTimer);
    popupToastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function savePopupUiLocally(value) {
    try {
      localStorage.setItem(POPUP_UI_KEY, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save popup UI settings:', error);
    }
  }

  function savePopupUi() {
    const value = {
      ...popupUi,
      collapsedGroups: popupUi.rememberCollapsed ? { ...popupUi.collapsedGroups } : {}
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [POPUP_UI_KEY]: value }, () => {
        if (chrome.runtime && chrome.runtime.lastError) savePopupUiLocally(value);
      });
    } else {
      savePopupUiLocally(value);
    }
  }

  function loadPopupUi() {
    const applyStoredUi = (value) => {
      popupUi = normalizePopupUi(value);
      if (!popupUi.rememberCollapsed) popupUi.collapsedGroups = {};
      applyPopupUi();
    };

    const fallbackLoad = () => {
      try {
        const raw = localStorage.getItem(POPUP_UI_KEY);
        applyStoredUi(raw ? JSON.parse(raw) : null);
      } catch (error) {
        console.error('Failed to load popup UI settings:', error);
        applyStoredUi(null);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([POPUP_UI_KEY], (result) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          fallbackLoad();
        } else {
          applyStoredUi(result[POPUP_UI_KEY]);
        }
      });
    } else {
      fallbackLoad();
    }
  }

  function syncPopupUiControls() {
    const layout = document.getElementById('popup-layout');
    if (layout) layout.value = popupUi.layout;

    const density = document.getElementById('popup-density');
    if (density) density.value = popupUi.density;

    const width = document.getElementById('popup-width');
    if (width) width.value = String(popupUi.width);

    const setChecked = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    };

    setChecked('popup-nav-subtitles', popupUi.navSubtitles);
    setChecked('popup-motion', popupUi.motion);
    setChecked('popup-collapsible', popupUi.collapsible);
    setChecked('popup-remember-collapsed', popupUi.rememberCollapsed);
    setChecked('popup-show-collapse-all', popupUi.showCollapseAll);
  }

  function updatePresetButtons() {
    document.querySelectorAll('[data-popup-preset]').forEach(button => {
      const preset = popupPresets[button.dataset.popupPreset];
      const active = !!preset && Object.entries(preset).every(([key, value]) => popupUi[key] === value);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function getGroupTitles(panel) {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('.customizer-scroll > .control-group-title'));
  }

  function getGroupLabel(titleEl) {
    if (!titleEl) return '';
    const label = titleEl.querySelector('span');
    return (label ? label.textContent : titleEl.textContent).replace(/\s+/g, ' ').trim();
  }

  function getGroupKey(titleEl, panel) {
    const targetPanel = panel || titleEl.closest('.tab-panel');
    if (!targetPanel) return '';
    const titles = getGroupTitles(targetPanel);
    const index = titles.indexOf(titleEl);
    return `${targetPanel.id}:${index < 0 ? 0 : index}`;
  }

  function findGroupTitleForElement(element) {
    if (!element) return null;
    let card = element.closest('.control-card');
    if (!card) return null;
    let node = card.previousElementSibling;
    while (node) {
      if (node.classList && node.classList.contains('control-group-title')) return node;
      node = node.previousElementSibling;
    }
    return null;
  }

  function updateCollapseAllButton(panel) {
    const button = panel ? panel.querySelector('.panel-collapse-all') : null;
    if (!button) return;

    const titles = getGroupTitles(panel);
    const collapsedCount = titles.filter(title => title.classList.contains('is-collapsed')).length;
    const allCollapsed = titles.length > 0 && collapsedCount === titles.length;
    const icon = button.querySelector('i');
    const label = button.querySelector('span');

    if (icon) icon.className = `fa-solid ${allCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`;
    if (label) label.textContent = allCollapsed ? 'Развернуть все' : 'Свернуть все';
    button.setAttribute('aria-pressed', String(allCollapsed));
  }

  function setGroupCollapsed(titleEl, collapsed, options = {}) {
    if (!titleEl) return;
    const { persist = true, keepState = false } = options;
    const panel = titleEl.closest('.tab-panel');
    if (!panel) return;

    const key = getGroupKey(titleEl, panel);
    titleEl.classList.toggle('is-collapsed', collapsed);

    if (popupUi.collapsible) {
      titleEl.setAttribute('aria-expanded', String(!collapsed));
    } else {
      titleEl.removeAttribute('aria-expanded');
    }

    let node = titleEl.nextElementSibling;
    while (node && !node.classList.contains('control-group-title')) {
      node.hidden = collapsed;
      node = node.nextElementSibling;
    }

    if (!keepState && key) {
      if (collapsed) {
        popupUi.collapsedGroups[key] = true;
      } else {
        delete popupUi.collapsedGroups[key];
      }
    }

    updateCollapseAllButton(panel);
    if (persist && popupUi.rememberCollapsed) savePopupUi();
  }

  function applyGroupCollapseMode() {
    tabPanels.forEach(panel => {
      getGroupTitles(panel).forEach(titleEl => {
        if (!popupUi.collapsible) {
          setGroupCollapsed(titleEl, false, { persist: false, keepState: true });
          titleEl.removeAttribute('role');
          titleEl.removeAttribute('tabindex');
          titleEl.removeAttribute('aria-expanded');
          return;
        }

        titleEl.setAttribute('role', 'button');
        titleEl.tabIndex = 0;
        const key = getGroupKey(titleEl, panel);
        setGroupCollapsed(titleEl, key ? !!popupUi.collapsedGroups[key] : false, { persist: false });
      });

      updateCollapseAllButton(panel);
    });
  }

  function initGroupCollapse() {
    tabPanels.forEach(panel => {
      getGroupTitles(panel).forEach(titleEl => {
        if (titleEl.dataset.collapseReady === '1') return;
        titleEl.dataset.collapseReady = '1';

        titleEl.addEventListener('click', () => {
          if (!popupUi.collapsible) return;
          setGroupCollapsed(titleEl, !titleEl.classList.contains('is-collapsed'));
        });

        titleEl.addEventListener('keydown', event => {
          if (!popupUi.collapsible) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setGroupCollapsed(titleEl, !titleEl.classList.contains('is-collapsed'));
        });
      });
    });

    document.querySelectorAll('[data-collapse-all]').forEach(button => {
      if (button.dataset.collapseReady === '1') return;
      button.dataset.collapseReady = '1';

      button.addEventListener('click', () => {
        if (!popupUi.collapsible) return;
        const panel = document.getElementById(button.getAttribute('data-collapse-all'));
        if (!panel) return;

        const titles = getGroupTitles(panel);
        if (!titles.length) return;
        const allCollapsed = titles.every(title => title.classList.contains('is-collapsed'));

        titles.forEach(titleEl => setGroupCollapsed(titleEl, !allCollapsed, { persist: false }));
        if (popupUi.rememberCollapsed) savePopupUi();
        updateCollapseAllButton(panel);
        showToast(allCollapsed ? 'Группы развёрнуты' : 'Группы свёрнуты');
      });
    });

    applyGroupCollapseMode();
  }

  function applyPopupUi() {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty('--pop-w', `${popupUi.width}px`);

    body.classList.toggle('pop-layout-side', popupUi.layout === 'side');
    body.classList.toggle('pop-layout-top', popupUi.layout === 'top');
    body.classList.remove('pop-density-compact', 'pop-density-regular', 'pop-density-relaxed');
    body.classList.add(`pop-density-${popupUi.density}`);
    body.classList.toggle('pop-no-motion', !popupUi.motion);
    body.classList.toggle('pop-hide-nav-subtitles', !popupUi.navSubtitles);
    body.classList.toggle('pop-collapsible-off', !popupUi.collapsible);
    body.classList.toggle('pop-hide-collapse-all', !popupUi.showCollapseAll);

    syncPopupUiControls();
    updatePresetButtons();
    applyGroupCollapseMode();
  }

  function bindPopupUiControls() {
    const bindSelect = (id, key, parse) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        popupUi[key] = parse ? parse(el.value) : el.value;
        applyPopupUi();
        savePopupUi();
      });
    };

    bindSelect('popup-layout', 'layout');
    bindSelect('popup-density', 'density');
    bindSelect('popup-width', 'width', value => {
      const width = Number(value);
      return [600, 680, 760].includes(width) ? width : 680;
    });

    const bindToggle = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        popupUi[key] = el.checked;
        applyPopupUi();
        savePopupUi();

        if (key === 'collapsible') {
          showToast(el.checked ? 'Группы снова можно сворачивать' : 'Все группы развёрнуты');
        }
        if (key === 'rememberCollapsed') {
          showToast(el.checked ? 'Состояние групп запоминается' : 'Состояние групп не запоминается');
        }
      });
    };

    bindToggle('popup-nav-subtitles', 'navSubtitles');
    bindToggle('popup-motion', 'motion');
    bindToggle('popup-collapsible', 'collapsible');
    bindToggle('popup-remember-collapsed', 'rememberCollapsed');
    bindToggle('popup-show-collapse-all', 'showCollapseAll');

    document.querySelectorAll('[data-popup-preset]').forEach(button => {
      button.addEventListener('click', () => {
        const presetName = button.dataset.popupPreset;
        const preset = popupPresets[presetName];
        if (!preset) return;

        popupUi = normalizePopupUi({ ...popupUi, ...preset });
        applyPopupUi();
        savePopupUi();
        showToast(`Пресет «${popupPresetLabels[presetName] || 'Меню'}» применён`);
      });
    });

    const resetButton = document.getElementById('popup-reset-ui');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        popupUi = normalizePopupUi(defaultPopupUi);
        applyPopupUi();
        savePopupUi();
        showToast('Настройки меню сброшены');
      });
    }

    const menuSettingsButton = document.getElementById('open-menu-settings');
    if (menuSettingsButton) {
      menuSettingsButton.addEventListener('click', () => activateTab('menu-tab'));
    }
  }

  /* ==================== Command search ==================== */

  let commandEntries = [];
  let commandFiltered = [];
  let commandSelectedIndex = 0;
  let commandIndexReady = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function highlightCommandText(text, query) {
    const safe = escapeHtml(text);
    const trimmed = query.trim();
    if (!trimmed) return safe;

    const tokens = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);

    if (!tokens.length) return safe;

    try {
      return safe.replace(new RegExp(`(${tokens.join('|')})`, 'gi'), '<mark>$1</mark>');
    } catch (error) {
      return safe;
    }
  }

  function getTabInfo(tabId) {
    const panel = document.getElementById(tabId);
    const button = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const label = button?.querySelector('.nav-label')?.textContent.trim()
      || panel?.querySelector('.panel-heading h2')?.textContent.trim()
      || tabId;
    const icon = button?.querySelector('.nav-icon i');
    return { panel, button, label, iconClass: icon ? icon.className : 'fa-solid fa-gear' };
  }

  function buildCommandIndex() {
    commandEntries = [];

    tabPanels.forEach(panel => {
      const info = getTabInfo(panel.id);
      commandEntries.push({
        tabId: panel.id,
        tabOnly: true,
        element: null,
        focusElement: null,
        label: info.label,
        group: 'Раздел меню',
        tabLabel: info.label,
        iconClass: info.iconClass,
        aliases: `${info.label} раздел вкладка меню`,
        type: 'tab'
      });
    });

    tabPanels.forEach(panel => {
      const info = getTabInfo(panel.id);

      const pushEntry = (element, rawLabel, focusElement, type, extraAliases = '') => {
        const label = String(rawLabel || '').replace(/\s+/g, ' ').trim();
        if (!label) return;

        const groupTitle = element ? findGroupTitleForElement(element) : null;
        const focusId = focusElement && focusElement.id ? focusElement.id : '';
        commandEntries.push({
          tabId: panel.id,
          tabOnly: false,
          element,
          focusElement: focusElement || null,
          label,
          group: groupTitle ? getGroupLabel(groupTitle) : info.label,
          tabLabel: info.label,
          iconClass: info.iconClass,
          aliases: `${popupSearchAliases[focusId] || ''} ${extraAliases}`.trim(),
          type
        });
      };

      panel.querySelectorAll('.control-row').forEach(row => {
        const labelElement = row.querySelector(':scope > label:first-child')
          || row.querySelector('label')
          || row.querySelector('.menu-reset-copy strong')
          || row.querySelector('.range-label span:first-child');
        const label = labelElement ? labelElement.textContent : row.textContent;
        const focusElement = row.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
        pushEntry(row, label, focusElement, 'row');
      });

      panel.querySelectorAll('.check-item').forEach(item => {
        const focusElement = item.querySelector('input:not([disabled])');
        pushEntry(item, item.textContent, focusElement, 'check');
      });

      panel.querySelectorAll('.custom-color-field').forEach(field => {
        const focusElement = field.querySelector('input:not([disabled])');
        pushEntry(field, field.textContent, focusElement, 'color');
      });

      panel.querySelectorAll('.shortcut-row').forEach(row => {
        pushEntry(row, row.textContent, null, 'shortcut', 'горячие клавиши');
      });

      panel.querySelectorAll('.preset-btn').forEach(button => {
        pushEntry(
          button,
          button.querySelector('strong')?.textContent || button.textContent,
          button,
          'preset',
          button.dataset.popupPreset || ''
        );
      });
    });

    commandIndexReady = true;
  }

  function searchCommandEntries(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commandEntries.slice(0, 16);

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const scored = [];

    commandEntries.forEach((entry, index) => {
      const label = entry.label.toLowerCase();
      const group = entry.group.toLowerCase();
      const tabLabel = entry.tabLabel.toLowerCase();
      const haystack = `${label} ${group} ${tabLabel} ${(entry.aliases || '').toLowerCase()}`;

      if (!tokens.every(token => haystack.includes(token))) return;

      let score = 0;
      if (label === normalized) score += 120;
      if (label.startsWith(normalized)) score += 70;
      if (label.includes(normalized)) score += 45;

      tokens.forEach(token => {
        if (label.includes(token)) score += 14;
        if (group.includes(token)) score += 6;
        if (tabLabel.includes(token)) score += 4;
      });

      if (entry.tabOnly) score += 2;
      scored.push({ entry, score, index });
    });

    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored.slice(0, 30).map(item => item.entry);
  }

  function updateCommandSelection(scrollIntoView) {
    const results = document.getElementById('command-results');
    if (!results) return;

    const nodes = results.querySelectorAll('.command-result');
    nodes.forEach((node, index) => {
      const selected = index === commandSelectedIndex;
      node.classList.toggle('is-selected', selected);
      node.setAttribute('aria-selected', String(selected));
    });

    if (scrollIntoView) {
      const active = nodes[commandSelectedIndex];
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function renderCommandResults() {
    const input = document.getElementById('command-input');
    const results = document.getElementById('command-results');
    const hint = document.getElementById('command-hint');
    if (!results) return;

    if (!commandIndexReady) buildCommandIndex();

    const query = input ? input.value : '';
    commandFiltered = searchCommandEntries(query);

    if (commandSelectedIndex >= commandFiltered.length) commandSelectedIndex = 0;
    if (commandSelectedIndex < 0) commandSelectedIndex = 0;

    if (hint) {
      if (!query.trim()) {
        hint.textContent = 'Быстрый переход. Начните вводить название настройки.';
      } else {
        hint.textContent = commandFiltered.length ? `Найдено: ${commandFiltered.length}` : 'Ничего не найдено';
      }
    }

    if (!commandFiltered.length) {
      results.innerHTML = '<div class="command-empty"><strong>Ничего не найдено</strong>Попробуйте: тема, IP, копирование, ширина.</div>';
      results.setAttribute('role', 'listbox');
      return;
    }

    results.innerHTML = commandFiltered.map((entry, index) => {
      const selected = index === commandSelectedIndex;
      const meta = entry.tabOnly
        ? 'Перейти к разделу'
        : `${escapeHtml(entry.group)} · ${escapeHtml(entry.tabLabel)}`;

      return `
        <button type="button" class="command-result${selected ? ' is-selected' : ''}" data-command-index="${index}" role="option" aria-selected="${selected}">
          <span class="command-result-icon"><i class="${escapeHtml(entry.iconClass)}"></i></span>
          <span class="command-result-copy">
            <strong>${highlightCommandText(entry.label, query)}</strong>
            <small>${meta}</small>
          </span>
          <i class="fa-solid fa-arrow-turn-down"></i>
        </button>`;
    }).join('');

    results.setAttribute('role', 'listbox');
    updateCommandSelection(false);
  }

  function isCommandPaletteOpen() {
    const overlay = document.getElementById('command-overlay');
    return !!overlay && !overlay.hidden;
  }

  function openCommandPalette() {
    const overlay = document.getElementById('command-overlay');
    const input = document.getElementById('command-input');
    if (!overlay || !input) return;

    buildCommandIndex();
    overlay.hidden = false;
    input.value = '';
    commandSelectedIndex = 0;
    renderCommandResults();

    window.setTimeout(() => input.focus(), 0);
  }

  function closeCommandPalette(restoreFocus) {
    const overlay = document.getElementById('command-overlay');
    if (!overlay) return;
    overlay.hidden = true;

    if (restoreFocus) {
      const trigger = document.getElementById('search-trigger');
      if (trigger) trigger.focus();
    }
  }

  function jumpToCommandEntry(entry) {
    if (!entry) return;

    closeCommandPalette(false);
    activateTab(entry.tabId);

    if (entry.tabOnly) {
      showToast(`Раздел «${entry.label}»`);
      return;
    }

    const target = entry.element;
    if (!target) return;

    const themeEditor = target.closest('#custom-theme-editor');
    if (themeEditor && themeEditor.hidden) setCustomThemeEditorVisible(true);

    const groupTitle = findGroupTitleForElement(target);
    if (groupTitle && groupTitle.classList.contains('is-collapsed')) {
      setGroupCollapsed(groupTitle, false, { persist: false });
    }

    const focusTarget = entry.focusElement;

    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: popupUi.motion ? 'smooth' : 'auto' });
      target.classList.remove('is-search-hit');
      void target.offsetWidth;
      target.classList.add('is-search-hit');
      window.setTimeout(() => target.classList.remove('is-search-hit'), 1900);

      if (focusTarget && typeof focusTarget.focus === 'function') {
        window.setTimeout(() => {
          try {
            focusTarget.focus({ preventScroll: true });
          } catch (error) {
            focusTarget.focus();
          }
        }, popupUi.motion ? 220 : 0);
      }
    }, 0);
  }

  function handleGlobalShortcuts(event) {
    const key = event.key;
    const hasCommandModifier = event.ctrlKey || event.metaKey;

    if (hasCommandModifier && key.toLowerCase() === 'k') {
      event.preventDefault();
      if (isCommandPaletteOpen()) {
        closeCommandPalette(true);
      } else {
        openCommandPalette();
      }
      return;
    }

    if (isCommandPaletteOpen()) {
      if (key === 'Escape') {
        event.preventDefault();
        closeCommandPalette(true);
      }
      return;
    }

    const target = event.target;
    const isTyping = !!target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    );

    if (key === '/' && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const tabOrder = ['appearance-tab', 'logs-tab', 'tweaks-tab', 'forms-tab', 'menu-tab'];
      const tabIndex = ['1', '2', '3', '4', '5'].indexOf(key);
      if (tabIndex >= 0 && tabOrder[tabIndex]) {
        event.preventDefault();
        activateTab(tabOrder[tabIndex]);
      }
    }
  }

  function initCommandPalette() {
    const trigger = document.getElementById('search-trigger');
    const overlay = document.getElementById('command-overlay');
    const input = document.getElementById('command-input');
    const results = document.getElementById('command-results');
    const closeButton = document.getElementById('command-close');

    if (trigger) trigger.addEventListener('click', openCommandPalette);
    if (closeButton) closeButton.addEventListener('click', () => closeCommandPalette(true));

    if (overlay) {
      overlay.addEventListener('click', event => {
        if (event.target === overlay) closeCommandPalette(true);
      });
    }

    if (input) {
      input.addEventListener('input', () => {
        commandSelectedIndex = 0;
        renderCommandResults();
      });

      input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!commandFiltered.length) return;
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          commandSelectedIndex = (commandSelectedIndex + delta + commandFiltered.length) % commandFiltered.length;
          updateCommandSelection(true);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          const entry = commandFiltered[commandSelectedIndex];
          if (entry) jumpToCommandEntry(entry);
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          closeCommandPalette(true);
        }
      });
    }

    if (results) {
      results.addEventListener('click', event => {
        const item = event.target.closest('[data-command-index]');
        if (!item) return;
        const entry = commandFiltered[Number(item.dataset.commandIndex)];
        if (entry) jumpToCommandEntry(entry);
      });

      results.addEventListener('mouseover', event => {
        const item = event.target.closest('[data-command-index]');
        if (!item) return;
        const index = Number(item.dataset.commandIndex);
        if (!Number.isInteger(index) || index === commandSelectedIndex) return;
        commandSelectedIndex = index;
        updateCommandSelection(false);
      });
    }

    document.addEventListener('keydown', handleGlobalShortcuts);
  }

  applyPopupUi();
  bindPopupUiControls();
  initGroupCollapse();
  loadPopupUi();
  initCommandPalette();

  loadSettings();
  loadArizonaSettings();
});
