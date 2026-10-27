# WGM.GG - 우리 정글 뭐함?

로그인 없이 쓰는 리그 오브 레전드 전적 분석 사이트. https://wgm.nori.day

2020년에 Python Flask + MongoDB 로 만든 프로젝트를 2026년에 AI 바이브 코딩으로 되살리고(1편), 분석 플랫폼으로 개편했다(2편).

- **소환사 분석**: 최근 솔로랭크 20게임 지표를 같은 티어·라인 평균과 비교해서 장점/약점, 개선 팁, 추천 챔피언
- **챔피언 티어**: 라인 × 티어 구간(아이언–실버, 골드–플래티넘, 에메랄드–다이아, 마스터+)별 승률·픽률·밴률
- **챔피언 정보**: 장점/약점, 상대하기 쉬운·어려운 챔피언, 핵심 아이템·룬·주문, 게임 시간대별 승률, 스킬
- **자동 수집**: Workers Cron 이 5분마다 티어별 플레이어의 최근 경기를 모음 (30일 지난 경기는 삭제)

## 기술 스택

| | 2020 | 2026 |
|---|---|---|
| 런타임 | Python Flask (AWS EC2) | TypeScript + Hono (Cloudflare Workers + Cron) |
| DB | MongoDB Atlas | Supabase Postgres (RLS, 집계는 SQL 함수) |
| 로그인 | 직접 구현 (bcrypt) | 없음 |
| Riot API | summoner/v4 by-name, match/v4 | account-v1, summoner/league/mastery by-puuid, match-v5 |
| 화면 | MDB Bootstrap + Jinja2 | 자체 CSS ([DESIGN.md](DESIGN.md) 토큰) + Hono JSX |

원본 코드는 [`legacy/flask`](legacy/flask) 에 그대로 남겨 두었다.

## 구조

```
src/
  index.tsx      라우트 + Cron 핸들러
  riot.ts        Riot API 클라이언트 (429 재시도, 동시 요청 제한)
  store.ts       match-v5 → 분석용 행으로 축약 저장 / 조회
  collector.ts   자동 수집
  analysis.ts    지표 계산, 장단점 비교, 추천 챔피언
  ddragon.ts     Data Dragon (챔피언/아이템/룬/주문)
  meta.ts        티어 구간, 라인, 등급
  views/         Layout, Home, Summoner, Champions(티어표/목록), Champion(상세)
supabase/migrations/
  0001_init.sql       1편 스키마
  0002_analytics.sql  2편 스키마 (1편 테이블 삭제 포함)
```

## 로컬 실행

```bash
npm install
cp .env.example .dev.vars   # RIOT_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY
npx wrangler dev --test-scheduled   # http://localhost:8787
curl "localhost:8787/__scheduled?cron=*/5+*+*+*+*"   # 자동 수집 1회 실행
```

## 배포

```bash
npx wrangler secret put RIOT_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npm run deploy
```

개발 키는 24시간마다 만료된다. 자동 수집을 계속 돌리려면 Personal API Key 가 필요하다 ([신청 가이드](docs/riot-api-key-guide.md)).

---

WGM.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
