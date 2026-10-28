(function () {
  let isEnabled = true;

  const stopCopy = (e) => {
    if (!isEnabled) return;
    e.stopImmediatePropagation();
  };

  const applySetting = (e) => {
    isEnabled = e?.detail?.enabled !== false;
    if (isEnabled) {
      window.addEventListener('copy', stopCopy, true);
      document.addEventListener('copy', stopCopy, true);
    } else {
      window.removeEventListener('copy', stopCopy, true);
      document.removeEventListener('copy', stopCopy, true);
    }
  };

  window.addEventListener('arizona-helper-copy-setting', applySetting);
  applySetting({ detail: { enabled: true } });
})();
