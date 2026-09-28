(function () {
  'use strict';

  // "DHOLIC 주문내역 업로드"(HSCT의 주문내역 재검토·AI분석실패 기능) 2단계 실제 연결.
  // HSCT public/app.js의 uploadOrderStatus()/downloadOrderStatus()/renderOrderStatusTable()를
  // 크로스오리진 호출(HSCT server.js에 cors()가 이미 열려 있음, README §2 확인됨)로
  // 그대로 이식하되, 레이아웃·색상은 이 포털의 다크 테마에 맞게 새로 짰다.
  var API_BASE = 'https://hs-code-tool-production.up.railway.app';

  var COUNTRY_LABELS = {
    jp: '일본 (Japan)',
    tw: '대만 (Taiwan)',
    cn: '중국 (China)',
    sg: '싱가포르 (Singapore)',
    hk: '홍콩 (Hong Kong)'
  };

  var CONFIDENCE_LABELS = {
    'broker-confirmed': '최고(과거 확정 이력)',
    unique: '높음(유일 매칭)',
    matched: '높음(복수 규칙 합의)',
    ambiguous: '⚠ 낮음(규칙 간 코드 불일치)',
    'category-estimate': '⚠ 낮음(카테고리 추정)',
    none: '-'
  };

  // 파일 선택/업로드 결과는 다른 기능을 봤다가 돌아와도 유지되도록 모듈 스코프에 둔다.
  var state = {
    file: null,
    rows: null,
    uploading: false
  };

  function digitsOnly(code) {
    var s = String(code || '');
    if (!s || s.charAt(0) === '(') return s;
    return s.replace(/\D/g, '');
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function render(container) {
    container.innerHTML = '';

    var wrap = el('div', 'order-status-feature');

    wrap.appendChild(el('h2', null, 'DHOLIC 주문내역 업로드'));
    wrap.appendChild(
      el(
        'p',
        'placeholder',
        '발주관리 시스템의 "주문내역" 48컬럼 내보내기 파일을 그대로 업로드합니다. 그중 품목별HS코드상태가 정확히 "AI분석실패"인 행만 골라 URL(판매상품url) 크롤링으로 HS Code를 다시 추천합니다 — 이미 확정된 다른 행은 건드리지 않습니다.'
      )
    );

    var uploadRow = el('div', 'os-upload-row');
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    fileInput.className = 'os-file-input';
    fileInput.title = '주문내역 엑셀 파일 선택';

    var uploadBtn = el('button', 'os-button', '실행 - HS 코드 제안');
    uploadBtn.type = 'button';
    uploadBtn.disabled = !state.file || state.uploading;

    fileInput.addEventListener('change', function () {
      state.file = fileInput.files[0] || null;
      uploadBtn.disabled = !state.file || state.uploading;
    });

    uploadRow.appendChild(fileInput);
    uploadRow.appendChild(uploadBtn);

    var progressWrap = el('div', 'os-progress-wrap');
    progressWrap.hidden = true;
    var progressBar = el('div', 'os-progress-bar');
    var progressFill = el('div', 'os-progress-fill');
    progressBar.appendChild(progressFill);
    var progressText = el('div', 'os-progress-text');
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(progressText);

    var message = el('div', 'os-message');
    var tableContainer = el('div', 'os-table-container');

    var downloadBtn = el('button', 'os-button os-button-secondary', '엑셀 내려받기');
    downloadBtn.type = 'button';
    downloadBtn.disabled = !state.rows;

    function showProgress(done, total, etaMs) {
      progressWrap.hidden = false;
      var pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      progressFill.style.width = pct + '%';
      var etaText = etaMs != null && etaMs > 500 ? ' · 약 ' + Math.ceil(etaMs / 1000) + '초 남음' : '';
      progressText.textContent = total > 0 ? '처리 중... (' + done + '/' + total + ')' + etaText : '처리 준비 중...';
    }

    function hideProgress() {
      progressWrap.hidden = true;
      progressFill.style.width = '0%';
    }

    function renderTable(rows) {
      tableContainer.innerHTML = '';
      if (!rows.length) {
        tableContainer.appendChild(el('p', 'placeholder', '"AI분석실패" 상태인 행이 없습니다.'));
        return;
      }

      var table = document.createElement('table');
      table.className = 'os-table';
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');
      [
        '#',
        '주문번호',
        '품목주문번호',
        '상품명(원문)',
        '상품명(U열)',
        '도착국',
        '제안 HS Code(6자리)',
        'HSK(10자리)',
        '발송국가 HS코드',
        '신뢰도 등급',
        '최종 HS Code'
      ].forEach(function (label) {
        headRow.appendChild(el('th', null, label));
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      rows.forEach(function (row, index) {
        var tr = document.createElement('tr');
        var noMatch = !row.suggestedHsCode;
        if (noMatch) tr.className = 'os-row-unverified';

        var countryLabel = COUNTRY_LABELS[row.country] || row.country || '';
        var foreignCodeText = '-';
        if (row.foreignHsCode) {
          if (row.foreignHsCode.code) {
            foreignCodeText = digitsOnly(row.foreignHsCode.code);
          } else if (row.foreignHsCode.candidates) {
            foreignCodeText = '(HS6만 일치) ' + row.foreignHsCode.candidates.join(' / ');
          }
        }

        [
          String(index + 1),
          row.orderNumber || '',
          row.itemOrderNumber || '',
          row.productName || '',
          row.originalProductName || '',
          countryLabel,
          noMatch ? '—' : row.suggestedHsCode,
          row.hsk10Formatted ? digitsOnly(row.hsk10Formatted) : '-',
          foreignCodeText,
          CONFIDENCE_LABELS[row.confidenceTier] || '-'
        ].forEach(function (text) {
          tr.appendChild(el('td', null, text));
        });

        var finalTd = document.createElement('td');
        var finalInput = document.createElement('input');
        finalInput.type = 'text';
        finalInput.value = row.finalHsCode || row.suggestedHsCode || '';
        finalInput.placeholder = '직접 입력';
        finalInput.className = 'os-cell-input' + (noMatch ? ' os-needs-input' : '');
        finalInput.addEventListener('input', function (event) {
          rows[index].finalHsCode = event.target.value;
        });
        finalTd.appendChild(finalInput);
        tr.appendChild(finalTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      var scrollWrap = el('div', 'os-table-scroll');
      scrollWrap.appendChild(table);
      tableContainer.appendChild(scrollWrap);
    }

    function upload() {
      if (!state.file || state.uploading) return;
      state.uploading = true;
      uploadBtn.disabled = true;
      downloadBtn.disabled = true;
      message.textContent = '업로드 중입니다...';
      showProgress(0, 0);

      var formData = new FormData();
      formData.append('file', state.file);

      fetch(API_BASE + '/api/upload/order-status', { method: 'POST', body: formData })
        .then(function (response) {
          if (!response.ok || !response.body) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (result) {
                message.textContent = result.error || '업로드 중 오류가 발생했습니다.';
                return null;
              });
          }

          var reader = response.body.getReader();
          var decoder = new TextDecoder();
          var buffer = '';
          var finalRows = null;
          var errorMsg = null;
          var totalRows = 0;

          function pump() {
            return reader.read().then(function (chunk) {
              if (chunk.done) return;
              buffer += decoder.decode(chunk.value, { stream: true });

              var newlineIndex;
              while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                var line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                if (!line) continue;
                var msg = JSON.parse(line);
                if (msg.type === 'start') {
                  showProgress(0, msg.total);
                  totalRows = msg.totalRows || 0;
                } else if (msg.type === 'progress') {
                  showProgress(msg.done, msg.total, msg.etaMs);
                } else if (msg.type === 'done') {
                  finalRows = msg.rows;
                } else if (msg.type === 'error') {
                  errorMsg = msg.error;
                }
              }
              return pump();
            });
          }

          return pump().then(function () {
            if (errorMsg) {
              message.textContent = errorMsg;
              return null;
            }
            if (!finalRows) {
              message.textContent = '업로드 중 오류가 발생했습니다.';
              return null;
            }
            return { finalRows: finalRows, totalRows: totalRows };
          });
        })
        .then(function (result) {
          if (!result) return;
          state.rows = result.finalRows.map(function (row) {
            row.finalHsCode = row.suggestedHsCode || '';
            return row;
          });

          renderTable(state.rows);
          var matched = state.rows.filter(function (r) {
            return r.suggestedHsCode;
          }).length;
          var unmatched = state.rows.length - matched;
          message.innerHTML =
            '전체 <b>' +
            result.totalRows +
            '</b>행 중 "AI분석실패" <b>' +
            state.rows.length +
            '</b>건 재검토 — 매칭 <b>' +
            matched +
            '</b>건 | 미매칭 <b class="os-warn">' +
            unmatched +
            '</b>건(표시된 항목을 직접 입력해 주세요)';
          downloadBtn.disabled = false;
        })
        .catch(function (err) {
          message.textContent = '네트워크 오류로 업로드에 실패했습니다: ' + (err && err.message ? err.message : String(err));
        })
        .then(function () {
          state.uploading = false;
          uploadBtn.disabled = !state.file;
          hideProgress();
        });
    }

    function download() {
      if (!state.rows) return;
      fetch(API_BASE + '/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: state.rows, format: 'order-status' })
      })
        .then(function (response) {
          if (!response.ok) {
            message.textContent = '엑셀 파일 생성 중 오류가 발생했습니다.';
            return null;
          }
          return response.blob().then(function (blob) {
            return { blob: blob, disposition: response.headers.get('content-disposition') || '' };
          });
        })
        .then(function (result) {
          if (!result) return;
          var url = window.URL.createObjectURL(result.blob);
          var anchor = document.createElement('a');
          anchor.href = url;
          var asciiMatch = result.disposition.match(/filename="([^"]+)"/);
          // 크로스오리진 응답이라 Content-Disposition이 노출 안 될 수 있음
          // (서버가 Access-Control-Expose-Headers를 따로 안 열어둠) — 그 경우 일반 파일명으로 대체.
          anchor.download = asciiMatch ? asciiMatch[1] : 'order-status-hs-mapping.xlsx';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.URL.revokeObjectURL(url);
        })
        .catch(function (err) {
          message.textContent = '다운로드 중 오류가 발생했습니다: ' + (err && err.message ? err.message : String(err));
        });
    }

    uploadBtn.addEventListener('click', upload);
    downloadBtn.addEventListener('click', download);

    wrap.appendChild(uploadRow);
    wrap.appendChild(progressWrap);
    wrap.appendChild(message);
    wrap.appendChild(tableContainer);
    wrap.appendChild(downloadBtn);
    container.appendChild(wrap);

    if (state.rows) {
      renderTable(state.rows);
    }
  }

  window.OrderStatusFeature = { render: render };
})();
