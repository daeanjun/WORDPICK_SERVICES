(function () {
  'use strict';

  // 1단계(정적 뼈대) 범위: 실제 기능 연결 없이 목록/전환 구조만 만든다.
  // 각 기능은 README §2 2단계에서 순서대로 ④ 영역에 실제 연결될 예정.
  var APPS = {
    hsct: {
      label: 'HSCT',
      features: [
        { id: 'order-export', label: '발주 데이터 엑셀 업로드', status: 'pending' },
        { id: 'translate', label: '일본어 상품명 → 한국어 번역', status: 'pending' },
        { id: 'train', label: '학습 데이터 직접 업로드', status: 'pending' },
        { id: 'order-status', label: '주문내역 재검토(AI분석실패)', status: 'pending' }
      ]
    }
  };

  var state = {
    activeApp: 'hsct',
    activeFeature: null
  };

  var appTabsEl = document.getElementById('appTabs');
  var sidebarEl = document.getElementById('sidebar');
  var mainAreaEl = document.getElementById('mainArea');
  var homeLinkEl = document.getElementById('homeLink');

  function statusLabel(status) {
    return status === 'ready' ? '연결됨' : '준비 중';
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

  function renderSidebar() {
    sidebarEl.innerHTML = '';
    var app = APPS[state.activeApp];
    app.features.forEach(function (feature) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sidebar-item' + (feature.id === state.activeFeature ? ' is-active' : '');

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

      sidebarEl.appendChild(btn);
    });
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
    var feature = app.features.filter(function (f) {
      return f.id === state.activeFeature;
    })[0];

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

  renderAppTabs();
  renderSidebar();
  renderMain();
})();
