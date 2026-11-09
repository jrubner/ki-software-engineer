(function () {
  let preference = 'system';
  try {
    const stored = localStorage.getItem('bookmonkey-theme');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch {
    // Keep system mode when browser storage is unavailable.
  }

  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
