import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';

// 공통 레이아웃. 디자인 토큰은 public/static/app.css (DESIGN.md 기반)

export const RIOT_DISCLAIMER =
  "WGM.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

type Props = { title?: string; description?: string; darkNav?: boolean; children: Child; script?: string };

export function Layout({ title, description, darkNav, children, script }: Props) {
  // DOCTYPE 이 없으면 브라우저가 호환(quirks) 모드로 그려서 form 여백 등이 어긋난다 (2020년 원본부터 빠져 있던 것)
  return (
    <>
      {raw('<!DOCTYPE html>')}
      <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} · WGM.GG` : 'WGM.GG · 우리 정글 뭐함?'}</title>
        <meta name="description" content={description ?? 'Riot ID만 입력하면 최근 솔로랭크 경기를 분석해 장점과 약점, 추천 챔피언을 알려드려요.'} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="stylesheet" href="/static/app.css" />
        <link rel="icon" href="/static/img/WGMimgresize.png" />
      </head>
      <body>
        <header class={`nav${darkNav ? ' on-dark' : ''}`}>
          <div class="container">
            <a class="wordmark" href="/">
              WGM.GG
            </a>
            <nav class="nav-links">
              <a href="/champions">챔피언 티어</a>
              <a href="/champions/all">챔피언 정보</a>
            </nav>
            <form class="nav-search" action="/search">
              <input class="search-pill" name="q" placeholder="Riot ID 검색 (이름#태그)" aria-label="Riot ID 검색" />
            </form>
          </div>
        </header>

        <main>{children}</main>

        <footer class="footer">
          <div class="container">
            <a class="wordmark" href="/">
              WGM.GG
            </a>
            <p class="muted" style="margin-top:8px">우리 정글 뭐함? · 로그인 없이 쓰는 리그 오브 레전드 전적 분석</p>
            <p class="legal">{RIOT_DISCLAIMER}</p>
            <p class="legal">© 2019–2026 JinhoLee</p>
          </div>
        </footer>
        {script && <script>{raw(script)}</script>}
      </body>
      </html>
    </>
  );
}

// 없는 소환사, 404, 500, 한도 초과 안내
export function MessagePage({ title, message, action }: { title: string; message: string; action?: { href: string; label: string } }) {
  return (
    <section class="band dark">
      <div class="container" style="max-width:760px">
        <p class="eyebrow">WGM.GG</p>
        <h1 class="display-lg" style="margin-top:16px">
          {title}
        </h1>
        <p style="margin-top:20px;font-size:18px">{message}</p>
        <form class="hero-search" action="/search">
          <input class="input" name="q" placeholder="Hide on bush#KR1" aria-label="Riot ID" required />
          <button class="btn" type="submit">
            다시 검색
          </button>
        </form>
        {action && (
          <p style="margin-top:24px">
            <a href={action.href}>{action.label} →</a>
          </p>
        )}
      </div>
    </section>
  );
}
