# WGM.GG - 우리 정글 뭐함?

하위·중위 티어 플레이어를 위한 리그 오브 레전드 전적 검색 사이트.
2020년에 Python Flask + MongoDB 로 만든 프로젝트를 2026년에 AI 바이브 코딩으로 되살렸다.

- 전적 검색: Riot ID(`이름#태그`)로 티어/LP, 모스트 챔피언, 최근 솔로랭크 20게임
- 나만의 팁: 라인별 팁 + 유튜브 영상
- 유저매칭: 내 Riot ID/주 라인/주 챔피언을 등록하고 다른 유저 찾기
- 라인별 챔피언 추천: 사이트에서 검색된 경기로 집계한 승률

## 기술 스택

| | 2020 | 2026 |
|---|---|---|
| 런타임 | Python Flask (AWS EC2) | TypeScript + Hono (Cloudflare Workers) |
| DB | MongoDB Atlas | Supabase (Postgres + RLS) |
| 로그인 | 직접 구현 (bcrypt) | Supabase Auth |
| Riot API | summoner/v4 by-name, match/v4 | account-v1, summoner/league by-puuid, match-v5 |
| 챔피언 추천 | op.gg 크롤링 | 자체 매치 데이터 집계 |
| 화면 | MDB Bootstrap + Jinja2 | MDB Bootstrap + Hono JSX |

원본 코드는 [`legacy/flask`](legacy/flask) 에 그대로 남겨 두었다.

## 로컬 실행

```bash
npm install
cp .env.example .dev.vars   # RIOT_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
npm run dev                 # http://localhost:8787
```

DB 스키마: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) 을 Supabase SQL Editor 에서 실행.

## 배포

```bash
npx wrangler secret put RIOT_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npm run deploy
```

---

WGM.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
