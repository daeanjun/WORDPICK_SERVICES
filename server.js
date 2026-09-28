// 2026-09-28 신설 — Railway 내부 테스트 배포 전용 서버.
// GitHub Pages(daeanjun.github.io/WORDPICK_SERVICES)는 이 파일과 무관하게 public/ 폴더를
// 그대로 정적 서빙하므로 항상 전체 메뉴가 보인다. 이 서버는 그와 별도로, WGEX 관계자에게
// "WGEX 주문내역 업로드" 그룹만 먼저 보여주기 위한 레일웨이 전용 경로다.
// 환경변수 MENU_SCOPE=wgex가 설정된 경우에만 index.html에 window.WORDPICK_MENU_SCOPE를
// 주입해 portal.js가 사이드바를 WGEX 그룹만 남기고 필터링하게 한다(값이 없으면 평소와 동일).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MENU_SCOPE = process.env.MENU_SCOPE || '';
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (urlPath === '/index.html') {
      fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        const withScope = MENU_SCOPE
          ? html.replace(
              '<head>',
              '<head>\n    <script>window.WORDPICK_MENU_SCOPE = ' + JSON.stringify(MENU_SCOPE) + ';</script>'
            )
          : html;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(withScope);
      });
      return;
    }

    sendFile(res, filePath);
  })
  .listen(PORT, () => {
    console.log('WORDPICK 포털 서버 실행 중 (PORT=' + PORT + ', MENU_SCOPE=' + (MENU_SCOPE || '(전체)') + ')');
  });
