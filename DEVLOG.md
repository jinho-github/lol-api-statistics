# 바이브 코딩 작업 로그 (블로그 포스팅용 메모)

> 맨 마지막에 이 로그를 바탕으로 블로그 글(md)을 정리한다.

## 0. 시작 (2026-10-27)
- 원본: https://github.com/jinho-github/legacy-fusion/tree/master/LOL-API-Statistics (2020년 작성)
- 참고 글: 롤 전적 검색 사이트 만들기 (0)(1)(2)(4) — yeowool0217.tistory.com 581, 580, 583, 622
- AI에게 요청한 것: "깃허브 프로젝트 받아서 폴더 만들고 배포까지 진행"
- 하위 폴더만 sparse checkout 해서 `~/workspace/lol-api-statistics` 로 복사 (`conf.py`, `__pycache__` 제외)

## 1. AI가 진단한 원본 상태
- 코드가 두 벌: `main_back.py`(실제 기능 전부, 템플릿은 `templates_back/`) / `application.py`(블루프린트로 리팩터링하다 멈춤, 홈 화면만 있고 카카오 로그인은 미완성)
- `Procfile`은 `main:app`을 가리키는데 `main.py`가 없음 → 그대로는 배포 불가
- Riot API `summoner/v4/by-name`, `match/v4`는 이미 폐지됨 → Riot ID(이름#태그) + `account-v1` + `match-v5`로 다시 짜야 함
- op.gg 크롤링(`opgg_crawling.py`)은 사이트 구조가 바뀌어서 동작 안 함
- 의존성이 2019~2020년 버전(Flask 1.1, pymongo 3.9, gevent 1.4) → 현재 Python에서 설치 실패 가능성이 큼
- **공개 저장소에 `conf.py`(Riot 키, MongoDB 접속 주소+비밀번호)가 커밋돼 있음** → 비밀번호 교체 필요
- 카카오 REST 키가 템플릿/코드에 하드코딩됨

## 2. Riot API 키 준비
- 비밀 정보는 `conf.py` 대신 `.env`로 관리 (`.env.example`만 커밋, `.env`는 `.gitignore`)
- 테스트 Riot ID: `Hide on bush#KR1`
- 키 전략: Development Key로 개발 → Personal Key 신청 → 배포 후 Production 신청
  - Production은 운영 중인 URL이 있어야 해서 배포 전에 신청하면 반려됨
- 신청서 작성 가이드: `docs/riot-api-key-guide.md`

## 3. 구현 전 결정 사항 (한 번에 진행하기 위해 먼저 전부 확정)
> 사용자 요청: "진행하기 전에 전부 나에게 응답을 받고 바이브코딩으로 한번에 진행하고싶어"

- 블로그: "AI랑 6년 전 코드를 살려서 배포까지" 흐름, 막힌 부분과 AI에게 한 요청을 그대로 싣기
- DB: MongoDB → **Supabase** (Postgres)
- 로그인: **Supabase Auth** (이메일), 카카오 로그인 제외
- 배포: **Cloudflare Workers** + 내 도메인
- 런타임: Flask(Python) → **TypeScript + Hono** 전환
- GitHub: 새 비공개 저장소 `lol-api-statistics`
- 기능: 전적 검색, 라인별 팁 게시판, 듀오 매칭 유지 / op.gg 크롤링 제거
- 디자인: 기존 MDB Bootstrap 디자인 유지
- 확인된 사실: 새 Riot API(account-v1 → summoner/league by-puuid → match-v5)로 `Hide on bush#KR1` 조회 성공 (챌린저, 최근 솔랭 20경기)

## 4. 한 번에 구현 (AI 작업)
> 사용자 요청: ".env에 RIOT_API_KEY 넣었어. Hide on bush#KR1로 전적 검색부터 되게 만들어줘." → 중간에 끊고 "진행하기 전에 전부 나에게 응답을 받고 바이브코딩으로 한번에 진행하고싶어" → 결정 후 "한 번에 진행해줘."

- 원본 Flask 코드는 `legacy/flask/` 로 보존, 정적 파일(MDB Bootstrap)은 `public/static/` 으로 이동
- 구조
  - `src/riot.ts` Riot API 클라이언트 + 응답 타입(match-v5 DTO)
  - `src/summoner.ts` 전적 검색: account → (summoner, league, match ids 동시 요청) → 매치 상세(캐시 우선)
  - `src/ddragon.ts` Data Dragon 최신 버전 자동 조회, 한글 챔피언 이름
  - `src/views/*.tsx` Jinja2 템플릿을 Hono JSX 로 1:1 이식
  - `supabase/migrations/0001_init.sql` tips / duo_profiles / match_cache / match_participants + RLS
- 원본 대비 바뀐 점
  - 매치 20개 순차 요청 → 5개씩 병렬 + 429 시 Retry-After 재시도 + Supabase 캐시
  - op.gg 크롤링 → 사이트에서 검색된 경기로 라인별 승률 집계 (`lane_champion_stats` 뷰)
  - 유저매칭 "승률" 칸이 비어 있던 것 → 등록 시 Riot API 로 솔로랭크 전적 저장 + Riot ID 실존 확인
  - Riot 법적 고지문 footer, `/riot.txt` 인증 라우트, `/healthz`

### 막혔던 부분
- **이미지 이름 불일치**: match-v5 `championName` 은 "FiddleSticks", Data Dragon 은 "Fiddlesticks" → championId 로 매핑
- **에메랄드 티어 엠블럼 없음**: 2023년에 생긴 티어라 원본 이미지에 없음 → Community Dragon 이미지 사용
- **첫 배포 직후 홈 500**: 시크릿 없이 먼저 배포한 버전이 응답 → `wrangler deploy --secrets-file .dev.vars` 로 시크릿과 함께 배포
- **운영 테스트 중 503**: 로컬 + 운영에서 연달아 검색하다 개발 키 한도(2분 100회) 초과 → 안내 화면이 정상 동작한 것. 캐시가 생기면 같은 경기는 다시 요청하지 않음
- **DB 테이블이 없을 때도 검색은 동작**: 캐시 조회/저장 실패는 경고만 남기고 Riot API 로 진행하도록 처리

### 결과
- GitHub: https://github.com/jinho-github/lol-api-statistics (비공개)
- 배포: https://wgm.nori.day (workers.dev 주소: https://lol-api-statistics.jinho021712.workers.dev)
- `Hide on bush#KR1` 검색: 로컬 1.5초 / 운영 2.8초 (캐시 없이 20경기)

## 5. 검증과 도메인
> 사용자: "원래 wgm 였지? 우정머?" → 둘 다 "우리 정글 뭐함?"의 줄임말 (WGM.GG = 로고, 우정머 = 한글 별칭)
> 사용자: "sql 은 추가했고 wgm.nori.day 로 도메인 연결해둠"

- 매치 캐시 동작 확인: 같은 검색 1.6초 → 0.8초, match_cache 20행 / match_participants 200행
- RLS 확인: 비로그인 사용자는 팁 작성 불가(42501), match_cache 조회 시 빈 결과
- `wrangler.jsonc`에 `wgm.nori.day` custom_domain 라우트 추가 → 이후 배포에도 도메인 유지
- **막힘: 회원가입 실패** — `Email address "...@example.com" is invalid`. Supabase 기본 SMTP는 프로젝트 팀원 이메일로만 발송함 (시간당 발송 수도 제한) → 이메일 인증 끄기 또는 커스텀 SMTP 필요

## 6. 회원가입 해결과 전체 흐름 테스트
> 사용자: "Supabase에서 Confirm email 꺼두었어. 로그인·팁·매칭 테스트하고 블로그 TODO도 채워줘."
> → "Confirm email 끄고 Save 눌렀어. 다시 테스트해줘." → "Enable Email provider는 켜고 Confirm email만 끄고 Save 했어. 다시 테스트해줘."

- 오류 변화: `example.com is invalid`(MX 없음) → `email rate limit exceeded`(Confirm email 아직 켜짐) → `Email signups are disabled`(Email provider를 끔) → 해결
- `/auth/v1/settings`의 `mailer_autoconfirm`으로 반영 여부 확인. Save 후 약 15초 뒤 true
- 로컬 E2E 18개 항목 통과 (가입/로그인/로그아웃/오류 안내, 팁 작성·권한·유튜브 검증·홈 노출, 매칭 등록·Riot ID 검증·전적 저장)
- 테스트하면서 운영 DB에 남은 데이터: 팁 "E2E 테스트 팁: 미드 라인전 기본", 테스트 계정의 매칭 정보

## 7. 블로그용 화면 캡처
> 사용자: "일단 원래 프로젝트와 비교해서 블로그 포스팅 할 수 있게 현재 프로젝트 캡쳐좀 해봐"

- 내장 브라우저 캡처는 800px로 줄어들어 해상도가 낮음 → Mac Chrome + playwright-core로 2배 해상도 캡처
- 비로그인 화면은 운영(wgm.nori.day), 로그인 화면은 로컬에서 테스트 계정으로 캡처 (운영 DB에 글을 남기지 않기 위해)
- `docs/screenshots/2026/` 9장, 원본 화면은 2편 블로그 이미지 주소를 그대로 사용해 블로그에 나란히 배치

# 2편: 로그인 없는 분석 플랫폼으로 개편

## 8. 요청과 결정
> 사용자: "회원가입이나 로그인을 하지 않고 롤 api 만으로 통계 분석만 제대로 해주고 챔프 추천 및 장점 약점을 알려주는 특화 플렛폼으로 개션을하고싶어 이외 컨텐츠는 로그인 회원가입 하지 않고 사용할수 있는 것들로 알아서 만들어줬으면 좋겠고 / 디자인은 npx getdesign@latest add coinbase 를 사용해서 개선해줘"

- getdesign: 실행 전에 패키지 내용 확인 → DESIGN.md 한 장을 쓰고 다운로드 집계 요청 1회만 보내는 CLI. 실행해서 DESIGN.md 추가
- AI가 기획안 제시 후 4가지 질문 → 결정: 5분 자동 수집 넣기 / 콘텐츠는 티어표 + 챔피언 상세 / 팁·매칭 테이블 삭제 SQL 제공 / 블로그는 2편으로 따로
- 디자인: 라이선스 글꼴 대신 문서의 대체 글꼴(Inter, JetBrains Mono) + 한글 Pretendard. 화면에 원본 브랜드 이름은 쓰지 않음

## 9. 설계에서 바뀐 것
- **원본 JSON 저장 포기**: match-v5 응답이 1건에 약 85KB. 자동 수집(하루 약 2,900경기)을 하면 무료 DB 500MB가 며칠 만에 참 → 분석에 필요한 값만 `matches`(경기) / `match_participants`(참가자 10명) 로 축약 저장, 30일 지나면 삭제
- 장단점 비교는 SQL 함수(`position_benchmark`)로 같은 티어 구간·같은 라인 평균을 계산. 표본 100명 미만이면 전체 티어로, 그래도 부족하면 "수집 중"으로 표시 (가짜 기준값을 만들지 않음)
- 티어표 순위는 표본 수 보정 승률(베이지안 평균)로 계산해서 3게임 3승 같은 챔피언이 1위로 튀지 않게 함
- 챔피언 장단점: Riot 공식 능력치(공격/방어/마법/난이도)와 공식 플레이 팁 + 우리 데이터(시간대별 승률, 상대 전적)
- 로그인 제거로 Supabase 클라이언트는 서버 전용(secret key) 하나만 남김. 모든 테이블 RLS on + 정책 없음

### 막혔던 부분
- **Riot API 403 `error code: 1010`**: 파이썬 기본 User-Agent로 테스트하니 Cloudflare 봇 차단에 걸림 → UA 지정 (Workers 에서는 문제 없음)
- **검색창이 위로 치우침**: 페이지에 `<!DOCTYPE html>`이 없어서 호환 모드로 렌더링됨. 2020년 원본부터 빠져 있던 것
- **로컬 서버 멈춤**: 파일을 지우는 중간에 빌드가 실패한 뒤 요청이 응답 없이 대기 → wrangler dev 재시작
- **카드 글자가 전부 파란색**: 카드 전체를 `<a>`로 만들어 링크 색이 상속됨 → `a.card { color }` 지정
