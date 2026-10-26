/* Chapter 5 theme toggle. Persists mcu-ui-theme for the classroom pages. */
(function () {
  var KEY = 'mcu-ui-theme';

  function norm(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function getTheme() {
    try {
      return norm(localStorage.getItem(KEY));
    } catch (error) {
      return 'dark';
    }
  }

  function syncButton() {
    var button = document.getElementById('kp-theme-toggle');
    if (!button) return;
    var is_light = getTheme() === 'light';
    button.textContent = is_light ? '浅色' : '深色';
    button.setAttribute('aria-pressed', is_light ? 'true' : 'false');
    button.title = is_light ? '切换为深色' : '切换为浅色';
  }

  function applyTheme(theme, persist) {
    var next_theme = norm(theme);
    document.documentElement.setAttribute('data-theme', next_theme);
    if (persist !== false) {
      try {
        localStorage.setItem(KEY, next_theme);
      } catch (error) {}
    }
    syncButton();
    return next_theme;
  }

  function injectButton() {
    if (document.getElementById('kp-theme-toggle')) {
      syncButton();
      return;
    }
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'kp-theme-toggle';
    button.className = 'kp-theme-toggle';
    button.style.position = 'fixed';
    button.onclick = function () {
      applyTheme(getTheme() === 'light' ? 'dark' : 'light', true);
    };
    document.body.appendChild(button);
    syncButton();
  }

  applyTheme(getTheme(), false);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
  addEventListener('storage', function (event) {
    if (event.key === KEY && event.newValue) applyTheme(event.newValue, false);
  });
  window.MCUTheme = {
    get: getTheme,
    set: function (theme) { return applyTheme(theme, true); },
    toggle: function () { return applyTheme(getTheme() === 'light' ? 'dark' : 'light', true); }
  };
})();
