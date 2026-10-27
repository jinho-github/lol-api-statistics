---
title: "AI랑 6년 전 코드를 살려서 배포까지 — 롤 전적 검색 사이트 WGM.GG 리뉴얼"
tags: [바이브코딩, Claude Code, Cloudflare Workers, Hono, TypeScript, Supabase, Riot API]
---

# AI랑 6년 전 코드를 살려서 배포까지

2020년 2월, 대학생 때 Python Flask로 롤 전적 검색 사이트 **WGM.GG (우리 정글 뭐함?, 줄여서 우정머)** 를 만들었다.
([만들기 0편](https://yeowool0217.tistory.com/581) · [1편](https://yeowool0217.tistory.com/580) · [2편](https://yeowool0217.tistory.com/583) · [배포편](https://yeowool0217.tistory.com/622))

6년이 지난 지금, 이 코드를 **AI(Claude Code)와 바이브 코딩으로** 되살려서 실제 도메인에 배포해 봤다.
이 글에는 AI에게 한 말을 **그대로** 적고, 중간에 막혔던 부분도 숨기지 않고 남겼다.

> 결과: **https://wgm.nori.day**

---

## 1. 시작: "폴더 하나 만들고 프로젝트 시작하면 안될까?"

처음에 AI에게 한 말은 이게 전부였다.

> 깃허브에 있는 프로젝트 받아서 폴더 하나 만들고 프로젝트 시작하면 안될까?

AI가 저장소 주소를 물어봐서 주소와 예전 블로그 글 4편을 넘겼다.

> 기존에 진행했던 프로젝트인데 AI 로 배포까지 진행해보려고해
> (블로그 링크 4개)
> 참고하면 좋고
> AI 바이브 코딩으로 기존 프로젝트 배포까지 진행하는 기술 블로그 포스팅도 작성하려고 하니까 md 파일로 잘 만들어줘
> 우선 바이브 코딩으로 진행하는게 목적이니까 내용 보고 프로젝트 구성에 필요한걸 구체적으로 나에게 요청해

AI는 원본 저장소에서 프로젝트 하위 폴더만 받아(sparse checkout) 새 폴더에 옮겼다. 그리고 코드와 블로그 글을 읽고 **진단 결과**부터 알려줬다.

### AI가 찾은 6년 전 코드의 문제

| 문제 | 내용 |
|---|---|
| 코드가 두 벌 | `main_back.py`에는 기능이 다 있고, `application.py`는 블루프린트로 나누다가 멈춘 상태 |
| 배포 설정 오류 | `Procfile`이 `main:app`을 가리키는데 `main.py`가 없음 |
| **Riot API 폐지** | 소환사 이름 검색(`summoner/v4/by-name`)과 `match/v4`가 모두 없어짐 |
| 크롤링 깨짐 | op.gg 구조가 바뀌어 라인별 추천 챔피언 크롤러가 동작하지 않음 |
| 라이브러리 노후화 | Flask 1.1, pymongo 3.9 등 2019~2020년 버전 |
| **비밀 정보 유출** | 공개 저장소의 `conf.py`에 Riot 키와 **MongoDB 접속 주소·비밀번호**가 커밋되어 있음 😱 |

마지막 항목이 가장 뜨끔했다. 당시에는 `.gitignore`에 `conf.py`를 넣어 놓고도 이미 커밋된 파일은 그대로 올라가 있었다.

---

## 2. Riot API 키: Production 신청은 배포 후에

> 프로덕션 신청 하려고하는데 가이드좀 해주고 테스트 아이디 그대로 Hide on bush 로 해줘

신청서 항목(제품명, 설명, 그룹, URL, 게임, 토너먼트 여부)을 붙여 넣었더니 AI가 먼저 순서를 바로잡아 줬다.

- **Production 키는 "실제 운영 중인 URL"을 확인한다.** 배포 전에 신청하면 반려된다.
- 순서: **Development 키(24시간 만료)로 개발 → Personal 키 → 배포 후 Production 신청**
- 설명은 영어로 쓰는 게 안전하다. 기능, 사용하는 API(ACCOUNT-V1, SUMMONER-V4, LEAGUE-V4, MATCH-V5), 호출 한도를 어떻게 지키는지를 구체적으로 적는다.
- 모든 페이지에 **Riot 법적 고지문**을 넣고, 사이트 소유를 인증하는 `riot.txt`를 준비한다.

키는 채팅에 붙이지 않고 `.env`에 직접 넣었다. 6년 전의 `conf.py` 같은 실수를 반복하지 않으려고 `.env`는 처음부터 `.gitignore`에 넣었다.

---

## 3. "진행하기 전에 전부 나에게 응답을 받고"

키를 넣고 "전적 검색부터 되게 만들어줘"라고 했는데, AI가 바로 코드를 고치기 시작해서 중간에 멈췄다.

> 진행하기 전에 전부 나에게 응답을 받고 바이브코딩으로 한번에 진행하고싶어

바이브 코딩에서 가장 중요하다고 느낀 순간이다. **결정은 사람이 먼저 다 하고, 구현은 AI가 한 번에** 하는 게 결과물이 덜 흔들린다.
AI가 물어본 것과 내가 정한 답은 이렇다.

| 질문 | 결정 |
|---|---|
| DB | MongoDB → **Supabase** (전에 써 본 것) |
| 배포 | **Cloudflare** (전에 쓰던 것) + 내 도메인 `wgm.nori.day` |
| 실행 방식 | Flask → **TypeScript + Hono (Cloudflare Workers)** |
| 로그인 | **Supabase Auth** (이메일) |
| 저장소 | 새 비공개 저장소 |
| 디자인 | **원래 MDB Bootstrap 디자인 유지** (예전 화면과 비교하려고) |
| 기능 | 전적 검색 · 나만의 팁 · 유저매칭 유지, op.gg 크롤링은 제거 |

### 왜 Python을 버리고 TypeScript로 갔나

"무료로 배포할 수 있어서"만으로는 설명이 부족한 것 같아 다시 물었다.

> 일단 TS 전환으로 가려고 하긴 하는데 이유가 무료 배포라는거 말고 기술적 이유로는 어떻게 설명이 가능한가?

AI의 답을 정리하면 이렇다.

1. **실행 모델이 다르다.** Flask는 Python 프로세스가 계속 떠 있어야 하는 WSGI 앱이다. Workers는 서버 프로세스 없이 V8 isolate에서 요청마다 실행된다. Python Workers도 있지만 Pyodide(WebAssembly) 기반 베타라서 `requests` 같은 라이브러리를 그대로 쓸 수 없다.
2. **원본의 한계를 구조로 해결할 수 있다.** 원본 글에 "매번 데이터를 가져와서 느리다"고 적었는데, 실제로 매치 20개를 순서대로 요청하고 있었다. 이제는 동시에 요청하고, 끝난 경기는 DB에 캐시한다.
3. **서버 운영 문제가 사라진다.** 배포편에 적었던 포트 충돌(Ctrl+Z로 남은 프로세스), Linux에서 Jinja macro 경로를 못 찾는 문제는 서버를 직접 운영해서 생긴 일이다.
4. **API 응답에 타입을 붙일 수 있다.** 이번에 깨진 가장 큰 이유가 Riot API v4 → v5의 필드 변경이었다. 응답 구조를 타입으로 정의해 두면 다음 변경은 컴파일 단계에서 잡힌다.
5. **비밀 정보가 코드와 분리된다.** `wrangler secret`으로 따로 관리한다.

---

## 4. 한 번에 구현

> 한 번에 진행해줘.

이 한 마디 뒤에 AI가 한 일이다.

```
lol-api-statistics/
├── legacy/flask/          # 2020년 원본 (비교용으로 보존)
├── public/static/         # 원본 MDB Bootstrap CSS/JS/이미지 그대로
├── src/
│   ├── riot.ts            # Riot API 클라이언트 + match-v5 타입
│   ├── summoner.ts        # 전적 검색 + 매치 캐시
│   ├── ddragon.ts         # Data Dragon (최신 버전 자동 조회)
│   ├── supabase.ts        # 사용자 권한 클라이언트 / 서버 전용 클라이언트
│   ├── index.tsx          # Hono 라우트
│   └── views/*.tsx        # Jinja2 템플릿 → Hono JSX 로 1:1 이식
└── supabase/migrations/0001_init.sql
```

### Riot API: 이름 검색 → Riot ID + PUUID

```ts
// 2020: GET /lol/summoner/v4/summoners/by-name/{name} → accountId → match/v4
// 2026:
const account = await riot.account(gameName, tagLine);      // ACCOUNT-V1 (asia)
const [summoner, leagues, ids] = await Promise.all([         // 서로 의존하지 않으니 동시에
  riot.summoner(account.puuid),
  riot.leagues(account.puuid),
  riot.matchIds(account.puuid, 20),                          // MATCH-V5, queue=420
]);
const matches = await loadMatches(c, riot, ids);             // 캐시에 없는 것만 Riot 에서
```

개발 키는 **1초에 20회, 2분에 100회**까지만 호출할 수 있다. 그래서 매치는 5개씩만 동시에 요청하고, 429 응답이 오면 `Retry-After`만큼 기다렸다가 다시 시도한다.

### MongoDB → Supabase

| 원본 MongoDB 컬렉션 | Supabase |
|---|---|
| `user_Info` (bcrypt 비밀번호 직접 저장) | Supabase Auth |
| `tip_List` | `tips` + RLS (누구나 조회, 로그인 사용자만 작성) |
| `matching_user_info` | `duo_profiles` + RLS (본인 것만 수정) |
| (없음) | `match_cache`, `match_participants` (서버만 접근) |

### op.gg 크롤링 대신 우리 데이터로

다른 사이트를 크롤링하는 기능은 Riot 심사에도 불리하다. 그래서 **우리 사이트에서 검색된 경기의 참가자 10명**을 쌓아서 라인별 승률을 내는 뷰를 만들었다. 검색이 많아질수록 추천이 정확해진다.

```sql
create view public.lane_champion_stats with (security_invoker = true) as
select team_position, champion_id, count(*) as games,
       round(100.0 * count(*) filter (where win) / count(*), 1) as win_rate
from public.match_participants
group by team_position, champion_id
having count(*) >= 5;
```

### 원본에서 비어 있던 칸 채우기

원본 유저매칭 화면에는 `승률 :` 라벨만 있고 값이 비어 있었다(6년 전의 나…).
이제는 등록할 때 Riot API로 **Riot ID가 실제로 있는지 확인**하고, 솔로랭크 티어와 승패도 함께 저장한다.

---

## 5. 막혔던 부분

| 증상 | 원인 | 해결 |
|---|---|---|
| 피들스틱 이미지 깨짐 | match-v5의 `championName`은 `FiddleSticks`, Data Dragon은 `Fiddlesticks` | 이름 대신 `championId`로 매핑 |
| 에메랄드 티어 엠블럼 없음 | 2023년에 생긴 티어라 원본 이미지에 없음 | Community Dragon 이미지 사용 |
| 새 챔피언 이미지 깨짐 | 원본이 Data Dragon 버전을 `9.24.2`로 고정 | 최신 버전을 자동으로 조회 |
| 첫 배포 직후 홈 500 | 시크릿 없이 먼저 배포된 버전이 응답 | `wrangler deploy --secrets-file`로 시크릿과 함께 배포 |
| 운영 테스트 중 503 | 로컬과 운영에서 연달아 검색하다 개발 키 한도(2분 100회) 초과 | 의도한 안내 화면. 캐시가 생기면 같은 경기는 다시 요청하지 않음 |
| **회원가입 실패** | Supabase 기본 메일 서버는 프로젝트 팀원 이메일로만 인증 메일을 보내고, 시간당 발송 수도 제한됨 | 포트폴리오용이라 **Confirm email 끄기** (자세한 과정은 아래) |

### 회원가입이 세 번 막힌 이야기

로그인 테스트에서 가장 오래 걸렸다. 오류 메시지가 세 번 바뀌었다.

1. `Email address "...@example.com" is invalid`
   AI가 테스트 계정을 `example.com` 주소로 만들었는데, 이 도메인은 메일을 받지 않는다고 MX 레코드에 선언되어 있다(`0 .`). Supabase가 이런 주소는 아예 받지 않는다. 메일을 받을 수 있는 내 도메인 주소로 바꿨다.
2. `email rate limit exceeded`
   Supabase 기본 메일 서버는 **프로젝트 팀원 이메일로만** 인증 메일을 보내고 시간당 발송 수도 제한한다. 일반 사용자는 가입할 수 없는 상태였다. 그래서 대시보드에서 **Confirm email**을 끄기로 했다.
3. `Email signups are disabled`
   토글을 잘못 눌러 **Enable Email provider**(이메일 가입 자체)를 꺼 버렸다. 다시 켜고 Confirm email만 끈 뒤 Save를 눌렀다.

AI는 대시보드를 직접 볼 수 없다. 그래서 공개 설정 API(`/auth/v1/settings`)의 `mailer_autoconfirm` 값으로 설정이 반영됐는지 확인했다. Save를 누르고 **약 15초 뒤에** `false`가 `true`로 바뀌었다. 대시보드에서 저장해도 바로 적용되지 않을 수 있다.

> 실제 서비스라면 Confirm email을 끄는 대신 Resend 같은 커스텀 SMTP를 붙여야 한다. 포트폴리오 사이트라서 간단한 쪽을 골랐다.

이후 로컬에서 로그인 흐름 전체를 스크립트로 검사했다(18개 항목 모두 통과).

- 가입, 로그아웃, 틀린 비밀번호, 다시 로그인, 중복 가입, 비밀번호 불일치
- 비로그인 사용자의 팁 작성 거부, 잘못된 유튜브 주소 거부, 팁 등록 후 홈 추천 영상에 노출
- 없는 Riot ID로 매칭 등록 거부, `hide on bush#kr1`로 등록하면 `Hide on bush#KR1`로 저장되고 챌린저 전적이 채워짐

DB 테이블을 만들기 전에도 전적 검색은 동작했다. 캐시 조회와 저장이 실패하면 경고만 남기고 Riot API로 진행하도록 만들었기 때문이다.

---

## 6. 결과

- **https://wgm.nori.day** (Cloudflare Workers + 커스텀 도메인)
- `Hide on bush#KR1` 검색: 캐시가 없을 때 약 1.6초, **캐시가 있을 때 약 0.8초**
- 원본 디자인(MDB Bootstrap)은 그대로, 내부는 전부 새로 작성

| | 2020 | 2026 |
|---|---|---|
| 런타임 | Python Flask (AWS EC2) | TypeScript + Hono (Cloudflare Workers) |
| DB | MongoDB Atlas | Supabase Postgres + RLS |
| 로그인 | bcrypt 직접 구현 | Supabase Auth |
| Riot API | summoner/v4 by-name, match/v4 | account-v1, by-puuid, match-v5 |
| 챔피언 추천 | op.gg 크롤링 | 자체 경기 데이터 집계 |
| 매치 20개 | 순차 요청, 매번 새로 | 5개씩 병렬 + DB 캐시 |
| 비밀 정보 | `conf.py` (공개 저장소에 커밋됨) | `wrangler secret` |

## 7. 바이브 코딩을 해 보고 느낀 점

- **결정은 먼저, 구현은 한 번에.** 중간에 끊고 "전부 물어보고 한 번에"로 바꾼 뒤부터 결과물이 흔들리지 않았다.
- **AI는 "왜"를 물으면 더 잘 설명한다.** TS 전환 이유를 다시 물었을 때 나온 답이 이 글의 뼈대가 됐다.
- **사람이 해야 하는 일은 남는다.** API 키 발급, SQL 실행, Cloudflare 로그인, Supabase 대시보드 설정, 도메인 연결은 직접 했다. 권한과 비용이 걸린 일은 AI가 대신 하지 않았다.
- **AI가 못 보는 화면은 API로 확인하게 하자.** 대시보드 설정이 제대로 됐는지 AI가 공개 설정 API로 확인해 준 덕분에 "저장했는데 왜 안 되지?"를 빨리 끝낼 수 있었다.
- **6년 전 코드의 가장 큰 문제는 기술이 아니라 보안이었다.** 공개 저장소에 비밀번호를 올려 둔 걸 AI가 가장 먼저 찾아냈다.

---

*WGM.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
