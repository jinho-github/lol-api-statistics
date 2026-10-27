# Riot API 키 신청 가이드

## 1. 키 종류와 추천 순서

| 키 | 만료 | 호출 한도 | 심사 | 용도 |
|---|---|---|---|---|
| Development Key | 24시간 | 20회/1초, 100회/2분 | 없음 (로그인하면 바로 발급) | 로컬 개발 |
| Personal API Key | 만료 없음 | Development와 같음 | 간단 (URL 검증 없음) | 개인·포트폴리오, 소수 사용자 |
| Production API Key | 만료 없음 | 훨씬 높음 | 엄격 (**운영 중인 URL 필수**) | 일반 공개 서비스 |

**추천 순서**

1. 지금은 **Development Key**로 개발해요. 매일 새로 발급받아서 `.env`의 `RIOT_API_KEY`에 넣어 주세요.
2. 배포 주소가 생기기 전이라도 **Personal API Key**는 바로 신청할 수 있어요. 키가 매일 만료되지 않도록 함께 신청해 두면 좋아요.
3. 배포가 끝나서 실제 URL이 생기면 **Production API Key**를 신청해요.
   - Production은 "실제 운영 중인 URL"을 확인하기 때문에 배포 전에 신청하면 반려돼요.
   - 포트폴리오용 사이트라면 Personal 키로도 충분해요.

신청 위치: [developer.riotgames.com](https://developer.riotgames.com) → 로그인 → **REGISTER PRODUCT** → Personal 또는 Production 선택

---

## 2. 신청서 항목별 작성 예시

> 심사자는 영어권 담당자일 가능성이 높아요. **설명은 영어로 쓰는 것이 안전하고**, 한국어 번역을 아래에 함께 붙여도 돼요.

### 제품명

```
WGM - LoL Stats for Every Tier
```

(원본 프로젝트의 로고 이미지 `WGMimgresize.png`에서 따온 이름이에요. 원하는 이름으로 바꿔도 돼요.)

### 제품 설명 (복사해서 붙여 넣기용)

```
WGM is a web-based League of Legends statistics site focused on low- and
mid-tier players in the Korean server. Most stats sites only show analysis
based on high-elo data, which is not very helpful for beginners. WGM lets
players look up their own recent ranked games and learn from community tips
written for each lane.

Features
1. Summoner search: A user enters a Riot ID (gameName#tagLine). We show the
   player's current solo/flex rank, LP, win/loss, most-played champions and
   KDA of the last 20 ranked solo games, with a per-game breakdown
   (duration, result, towers/inhibitors/barons/heralds, team members).
2. Lane tips board: Logged-in users post tips and video links for each lane.
3. Duo matching: Users voluntarily register their own Riot ID, main lane and
   main champion, and can browse other registered users to find a duo
   partner.

APIs used
- ACCOUNT-V1: convert Riot ID to PUUID
- SUMMONER-V4: profile icon and summoner level by PUUID
- LEAGUE-V4: ranked entries by PUUID
- MATCH-V5: match IDs (queue=420) and match details for the last 20 games
- Data Dragon: champion names and images

Rate limit handling
- API calls are made only from our Flask backend; the API key is never
  exposed to the browser.
- Match details are cached in MongoDB so the same match is never requested
  twice, and we respect Retry-After on 429 responses.

We do not sell data, we do not offer any paid features, and we follow the
Riot Games developer policies including the legal disclaimer on every page.

Tech stack: Python Flask, MongoDB Atlas, Bootstrap. Source code:
https://github.com/jinho-github/<repository>
```

<details>
<summary>한국어 번역 (참고용)</summary>

WGM은 한국 서버의 하위·중위 티어 플레이어를 위한 리그 오브 레전드 전적/통계 웹사이트입니다. 기존 전적 사이트는 상위 티어 데이터 위주라서 초보자에게는 도움이 적습니다. WGM에서는 자신의 최근 랭크 게임을 확인하고, 커뮤니티가 라인별로 작성한 팁을 볼 수 있습니다.

1. 소환사 검색: Riot ID로 현재 티어/LP/승패, 모스트 챔피언, 최근 솔로랭크 20게임 KDA와 게임별 상세 정보를 보여줍니다.
2. 라인별 팁 게시판: 로그인한 사용자가 라인별 팁과 영상 링크를 등록합니다.
3. 듀오 매칭: 사용자가 직접 자신의 Riot ID, 주 라인, 주 챔피언을 등록하고 다른 사용자를 찾아봅니다.

사용 API: ACCOUNT-V1, SUMMONER-V4, LEAGUE-V4, MATCH-V5, Data Dragon. API 호출은 서버에서만 하며, 매치 상세는 DB에 캐싱하고 429 응답 시 Retry-After를 지킵니다.
</details>

> 기능을 바꾸면(예: 카카오 로그인 추가, 매칭 기능 제거) 설명도 실제 기능에 맞게 고쳐야 해요. **설명과 실제 사이트가 다르면 반려되는 경우가 많아요.**

### 제품 그룹

```
Default Group
```

혼자 개발한다면 기본 그룹을 그대로 둬요.

### 제품 URL

- **Personal**: GitHub 저장소 주소를 써도 돼요. 예: `https://github.com/jinho-github/lol-api-statistics`
- **Production**: 배포한 사이트 주소를 써요. 예: `https://wgm-lol.onrender.com`
  - 심사 기간 동안 사이트가 접속되는 상태여야 해요.
  - Render 무료 요금제는 잠들었다가 깨어나는 데 시간이 걸려요. 심사 기간에는 미리 한 번 접속해 두면 좋아요.

### 제품 게임 초점

```
League of Legends
```

### 토너먼트를 주최하시나요?

```
아니요 (No)
```

---

## 3. 신청 전 체크리스트

배포할 때 아래 항목도 함께 처리할게요.

- [ ] **모든 페이지 footer에 Riot 법적 고지문 넣기**

  ```
  WGM isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
  ```

- [ ] **사이트 소유 인증 파일(`riot.txt`)**: Production 신청 후 포털이 인증 코드를 주면, `https://<내 도메인>/riot.txt`에서 그 코드가 보이도록 Flask 라우트를 추가해요.
- [ ] **API 키는 서버에서만 사용**: 템플릿이나 JS에 키가 노출되면 안 돼요. 키는 `.env`(로컬)와 배포 서비스의 환경변수에만 둬요.
- [ ] **op.gg 크롤링 제거**: 다른 사이트를 크롤링하는 기능은 심사에 불리해서 이번 리뉴얼에서 빼요.
- [ ] **유료 기능이나 광고는 나중에**: 수익화하려면 별도 정책 확인이 필요해요.
- [ ] **기존 공개 저장소의 키 정리**: `legacy-fusion`의 `conf.py`에 예전 키가 남아 있어요. 그 Riot 키는 이미 만료됐겠지만 MongoDB 비밀번호는 꼭 바꿔요.
