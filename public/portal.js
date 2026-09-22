(function () {
  'use strict';

  // 1단계(정적 뼈대) 범위: 실제 기능 연결 없이 목록/전환 구조만 만든다.
  // 각 기능은 README §2 2단계에서 순서대로 ④ 영역에 실제 연결될 예정.
  // 항목 타입: 'feature'(클릭 시 ④에 패널 표시) / 'group'(하위 feature 묶음, 펼침·접힘)
  // / 'link'(외부 페이지를 같은 창에서 여는 실제 동작 항목 — 1단계 범위 밖 아님, 지금 바로 동작).
  var ICONS = {
    upload:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
    translate:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>',
    database:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="14" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="8" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="16" cy="18" r="2" fill="currentColor" stroke="none"/></svg>',
    hamburger:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>'
  };

  var APPS = {
    hsct: {
      label: 'HSCT',
      items: [
        {
          type: 'group',
          id: 'wgex-order',
          label: 'WGEX 주문내역 업로드',
          icon: 'upload',
          children: [
            { id: 'order-status', label: 'DHOLIC 주문내역 업로드', status: 'pending' },
            {
              id: 'legacy-upload',
              label: 'LEGACY FORM',
              status: 'pending',
              title: 'URL·상품명·도착국 3컬럼(레거시 업로드 방식)'
            },
            {
              id: 'order-export',
              label: 'QUERY DATA',
              status: 'pending',
              title: '발주관리 시스템에서 내보낸 발주 데이터(생성일~국가코드, 17개 컬럼)를 그대로 업로드'
            }
          ]
        },
        { type: 'feature', id: 'translate', label: '상품명 번역기', status: 'pending', icon: 'translate' },
        { type: 'feature', id: 'train', label: '학습 데이터 수동 업로드', status: 'pending', icon: 'database' },
        {
          type: 'link',
          id: 'admin',
          label: '관리자 페이지',
          icon: 'settings',
          href: 'https://hs-code-tool-production.up.railway.app/admin.html'
        }
      ]
    }
  };

  var state = {
    activeApp: 'hsct',
    activeFeature: null,
    expandedGroups: { 'wgex-order': true },
    sidebarCollapsed: false
  };

  var appTabsEl = document.getElementById('appTabs');
  var sidebarEl = document.getElementById('sidebar');
  var mainAreaEl = document.getElementById('mainArea');
  var homeLinkEl = document.getElementById('homeLink');
  var sidebarToggleEl = document.getElementById('sidebarToggle');

  sidebarToggleEl.innerHTML = ICONS.hamburger;

  function statusLabel(status) {
    return status === 'ready' ? '연결됨' : '준비 중';
  }

  function findFeature(app, featureId) {
    for (var i = 0; i < app.items.length; i++) {
      var item = app.items[i];
      if (item.type === 'group') {
        for (var j = 0; j < item.children.length; j++) {
          if (item.children[j].id === featureId) return item.children[j];
        }
      } else if (item.type === 'feature' && item.id === featureId) {
        return item;
      }
    }
    return null;
  }

  function groupContainsActiveFeature(group) {
    return group.children.some(function (child) {
      return child.id === state.activeFeature;
    });
  }

  function applyCollapsedState() {
    document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
    sidebarToggleEl.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  }

  function renderAppTabs() {
    appTabsEl.innerHTML = '';
    Object.keys(APPS).forEach(function (appId) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-tab' + (appId === state.activeApp ? ' is-active' : '');
      btn.textContent = APPS[appId].label;
      btn.addEventListener('click', function () {
        state.activeApp = appId;
        state.activeFeature = null;
        renderAppTabs();
        renderSidebar();
        renderMain();
      });
      appTabsEl.appendChild(btn);
    });
  }

  function buildFeatureButton(feature, nested) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'sidebar-item' +
      (nested ? ' is-nested' : '') +
      (feature.id === state.activeFeature ? ' is-active' : '');
    if (feature.title) {
      btn.title = feature.title;
    }

    var label = document.createElement('span');
    label.textContent = feature.label;

    var badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.textContent = statusLabel(feature.status);

    btn.appendChild(label);
    btn.appendChild(badge);

    btn.addEventListener('click', function () {
      state.activeFeature = feature.id;
      renderSidebar();
      renderMain();
    });

    return btn;
  }

  function buildGroup(group) {
    var wrap = document.createElement('div');
    wrap.className = 'sidebar-group';

    var expanded = !!state.expandedGroups[group.id];

    var header = document.createElement('button');
    header.type = 'button';
    header.className = 'sidebar-group-header';
    header.setAttribute('aria-expanded', String(expanded));

    var headerLabel = document.createElement('span');
    headerLabel.textContent = group.label;

    var chevron = document.createElement('span');
    chevron.className = 'chevron' + (expanded ? ' is-open' : '');
    chevron.textContent = '▾';
    chevron.setAttribute('aria-hidden', 'true');

    header.appendChild(headerLabel);
    header.appendChild(chevron);

    header.addEventListener('click', function () {
      state.expandedGroups[group.id] = !state.expandedGroups[group.id];
      renderSidebar();
    });

    wrap.appendChild(header);

    if (expanded) {
      var childList = document.createElement('div');
      childList.className = 'sidebar-group-children';
      group.children.forEach(function (child) {
        childList.appendChild(buildFeatureButton(child, true));
      });
      wrap.appendChild(childList);
    }

    return wrap;
  }

  function buildLink(link) {
    var a = document.createElement('a');
    a.className = 'sidebar-link';
    a.href = link.href;

    var label = document.createElement('span');
    label.textContent = link.label;

    var icon = document.createElement('span');
    icon.className = 'external-icon';
    icon.textContent = '↗';
    icon.setAttribute('aria-hidden', 'true');

    a.appendChild(label);
    a.appendChild(icon);

    return a;
  }

  function buildIconItem(item) {
    var el;
    if (item.type === 'link') {
      el = document.createElement('a');
      el.href = item.href;
    } else {
      el = document.createElement('button');
      el.type = 'button';
    }
    el.className = 'sidebar-icon-item';
    el.title = item.label;

    var iconSpan = document.createElement('span');
    iconSpan.className = 'item-icon';
    iconSpan.innerHTML = ICONS[item.icon] || '';
    el.appendChild(iconSpan);

    if (item.type === 'group') {
      if (groupContainsActiveFeature(item)) {
        el.classList.add('is-active');
      }
      el.addEventListener('click', function () {
        state.expandedGroups[item.id] = true;
        state.sidebarCollapsed = false;
        applyCollapsedState();
        renderSidebar();
      });
    } else if (item.type === 'feature') {
      if (item.id === state.activeFeature) {
        el.classList.add('is-active');
      }
      el.addEventListener('click', function () {
        state.activeFeature = item.id;
        renderSidebar();
        renderMain();
      });
    }

    return el;
  }

  function renderSidebarExpanded(app) {
    app.items.forEach(function (item) {
      if (item.type === 'group') {
        sidebarEl.appendChild(buildGroup(item));
      } else if (item.type === 'link') {
        sidebarEl.appendChild(buildLink(item));
      } else {
        sidebarEl.appendChild(buildFeatureButton(item, false));
      }
    });
  }

  function renderSidebarCollapsed(app) {
    app.items.forEach(function (item) {
      sidebarEl.appendChild(buildIconItem(item));
    });
  }

  function renderSidebar() {
    sidebarEl.innerHTML = '';
    var app = APPS[state.activeApp];
    if (state.sidebarCollapsed) {
      renderSidebarCollapsed(app);
    } else {
      renderSidebarExpanded(app);
    }
  }

  function renderMain() {
    mainAreaEl.innerHTML = '';

    if (!state.activeFeature) {
      var placeholder = document.createElement('p');
      placeholder.className = 'placeholder';
      placeholder.textContent = '왼쪽 목록에서 기능을 선택하세요.';
      mainAreaEl.appendChild(placeholder);
      return;
    }

    var app = APPS[state.activeApp];
    var feature = findFeature(app, state.activeFeature);
    if (!feature) {
      state.activeFeature = null;
      renderMain();
      return;
    }

    var panel = document.createElement('div');
    panel.className = 'feature-panel';

    var status = document.createElement('span');
    status.className = 'feature-status';
    status.textContent = statusLabel(feature.status);

    var heading = document.createElement('h2');
    heading.textContent = feature.label;

    var body = document.createElement('p');
    body.className = 'placeholder';
    body.textContent = '이 기능은 아직 이 화면에 연결되지 않았습니다(1단계: 뼈대만).';

    panel.appendChild(status);
    panel.appendChild(heading);
    panel.appendChild(body);
    mainAreaEl.appendChild(panel);
  }

  homeLinkEl.addEventListener('click', function (event) {
    event.preventDefault();
    state.activeFeature = null;
    renderSidebar();
    renderMain();
  });

  sidebarToggleEl.addEventListener('click', function () {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    applyCollapsedState();
    renderSidebar();
  });

  applyCollapsedState();
  renderAppTabs();
  renderSidebar();
  renderMain();
})();
