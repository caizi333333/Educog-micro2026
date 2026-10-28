/* vLayout sticky tabs (#68).
   On a narrow viewport, a tab strip keeps about five or six targets.
   Anything past that goes behind 「更多」, except the tab that is already
   selected, so a deep link such as #int-6 stays visible.
   Lesson rows (课次) are not folded. */
(function (root) {
  var NARROW_QUERY = '(max-width: 760px)';
  var VISIBLE_BEFORE_MORE = 5;
  var applying = false;

  function foldPlan(count, selectedIndex, narrow, open) {
    var fold = !!narrow && count > VISIBLE_BEFORE_MORE + 1;
    var hidden = [];
    var index;
    for (index = 0; index < count; index += 1) {
      hidden.push(!!(fold && !open && index >= VISIBLE_BEFORE_MORE && index !== selectedIndex));
    }
    return { fold: fold, hidden: hidden };
  }

  function isHost(node) {
    return node && node.classList && (
      node.classList.contains('tabs') ||
      node.classList.contains('kp-tabs') ||
      node.classList.contains('kp-nav')
    );
  }

  function isTab(node) {
    if (!node || !node.classList || node.classList.contains('vlayout-more')) return false;
    if (node.classList.contains('is-off') || node.hidden) return false;
    return node.classList.contains('tab') ||
      node.classList.contains('kp-tab') ||
      node.classList.contains('kp-nav-i');
  }

  function isSelected(node) {
    return node.getAttribute('aria-selected') === 'true' ||
      node.getAttribute('aria-current') === 'page' ||
      node.classList.contains('on');
  }

  function hosts() {
    return Array.prototype.filter.call(document.querySelectorAll('.tabs, .kp-tabs, .kp-nav'), isHost);
  }

  function ensureMore(host) {
    var button = host.querySelector(':scope > .vlayout-more');
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'vlayout-more';
    button.textContent = '更多';
    button.setAttribute('aria-expanded', 'false');
    button.hidden = true;
    button.addEventListener('click', function () {
      var open = host.classList.toggle('vlayout-more-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.textContent = open ? '收起' : '更多';
      layout();
    });
    host.appendChild(button);
    return button;
  }

  function layout() {
    if (applying || typeof document === 'undefined') return;
    applying = true;
    var narrow = window.matchMedia(NARROW_QUERY).matches;
    hosts().forEach(function (host) {
      var items = Array.prototype.filter.call(host.children, isTab);
      var button = host.querySelector(':scope > .vlayout-more');
      var selectedIndex = -1;
      items.forEach(function (item, index) {
        if (isSelected(item)) selectedIndex = index;
      });
      var open = host.classList.contains('vlayout-more-open');
      var plan = foldPlan(items.length, selectedIndex, narrow, open);
      if (!plan.fold) host.classList.remove('vlayout-more-open');
      open = plan.fold && host.classList.contains('vlayout-more-open');
      plan = foldPlan(items.length, selectedIndex, narrow, open);
      if (button) {
        button.hidden = !plan.fold;
        if (plan.fold) {
          var expanded = open ? 'true' : 'false';
          var label = open ? '收起' : '更多';
          if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
          if (button.textContent !== label) button.textContent = label;
        }
      } else if (plan.fold) {
        button = ensureMore(host);
        button.hidden = false;
      }
      items.forEach(function (item, index) {
        item.classList.toggle('vlayout-overflow', plan.hidden[index]);
      });
      Array.prototype.forEach.call(host.children, function (node) {
        if (node.classList && node.classList.contains('vlayout-overflow') && !isTab(node)) {
          node.classList.remove('vlayout-overflow');
        }
      });
    });
    applying = false;
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      layout();
    });
  }

  function relevant(mutation) {
    if (applying) return false;
    var target = mutation.target;
    if (mutation.type === 'childList') return isHost(target);
    return isTab(target) || isHost(target);
  }

  function boot() {
    schedule();
    window.addEventListener('resize', schedule);
    if (window.matchMedia) {
      var media = window.matchMedia(NARROW_QUERY);
      if (media.addEventListener) media.addEventListener('change', schedule);
    }
    if (!document.body || typeof MutationObserver !== 'function') return;
    var observer = new MutationObserver(function (mutations) {
      if (mutations.some(relevant)) schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-selected', 'aria-current', 'aria-pressed'],
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { foldPlan: foldPlan };
  } else if (root && root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : this);
