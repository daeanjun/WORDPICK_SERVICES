// 실제 브라우저(Playwright)로 렌더링해 계산된 스타일(computed style)까지 확인하는
// 영구 회귀 테스트 스크립트. jsdom 기반 단위 테스트는 DOM 구조/클래스만 확인하고
// CSS 우선순위(specificity) 충돌은 잡지 못한다 — 2026-09-28 세션에서 바로 그 문제로
// ".app-tab:hover"의 color가 ".app-tab.is-active"에 밀려 무시되는 버그(호버해도
// 글자색이 안 바뀌어 흰 배경에 흰 글자로 안 보이던 문제)가 몇 주간 재배포에도 남아있었다.
// 실행: node scripts/verify-visual.js [URL]  (기본값: http://localhost:4173)
// 사전 준비: 이 저장소엔 Node 의존성을 두지 않으므로, 실행 전 임시로
//   npm init -y && npm install playwright && npx playwright install chromium
// 를 별도 폴더(또는 이 폴더, node_modules는 커밋하지 말 것)에서 한 번 해줘야 한다.

const { chromium } = require('playwright');

const url = process.argv[2] || 'http://localhost:4173';

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgb(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error('color 파싱 실패: ' + str);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
  await page.goto(url, { waitUntil: 'networkidle' });

  const tab = page.locator('.app-tab').first();
  const before = await tab.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color };
  });

  await tab.hover();
  await page.waitForTimeout(200);
  const after = await tab.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color };
  });

  console.log('hover 전:', before);
  console.log('hover 후:', after);

  const bgLum = luminance(parseRgb(after.bg));
  const colorLum = luminance(parseRgb(after.color));
  const contrast = Math.abs(bgLum - colorLum);

  await browser.close();

  // 배경과 글자색의 밝기 차이가 너무 작으면(거의 같은 색) 실제로는 안 보이는
  // 상태이므로 실패 처리한다. 40은 임의 임계값(0~255 스케일)으로, 완전히 같은
  // 색(차이 0)만 걸러내는 게 아니라 육안으로도 흐릿한 수준까지 잡기 위함.
  if (contrast < 40) {
    console.error(
      `FAIL: 호버 시 배경/글자 밝기 차이가 ${contrast.toFixed(1)}밖에 안 됨(최소 40 필요) — 텍스트가 안 보일 가능성이 높음.`
    );
    process.exit(1);
  }

  console.log(`PASS: 호버 시 배경/글자 밝기 차이 ${contrast.toFixed(1)} (기준 40 이상 충족)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
