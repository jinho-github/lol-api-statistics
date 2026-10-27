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
