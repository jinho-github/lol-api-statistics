# 6년 전 롤 전적 사이트를 AI로 뜯어고쳐 본 후기, 그리고 서비스는 하지 않기로 한 이유

2020년 2월, 대학생 때 Python Flask로 롤 전적 검색 사이트 **WGM.GG**(우리 정글 뭐함?, 줄여서 우정머)를 만들었다.
([만들기 0편](https://yeowool0217.tistory.com/581) · [1편](https://yeowool0217.tistory.com/580) · [2편](https://yeowool0217.tistory.com/583) · [배포편](https://yeowool0217.tistory.com/622))

6년 만에 이 코드를 꺼내서 **Claude Code와 바이브 코딩으로** 고쳐 봤다. 결과부터 말하면 한 번의 작업 세션, **약 3시간 20분** 만에 두 가지를 끝냈다.

1. 예전 기능을 그대로 되살려서 내 도메인에 배포했다.
2. 로그인을 전부 걷어내고, 분석·챔피언 추천·장단점에 집중한 사이트로 갈아엎었다.

> 사이트: https://wgm.nori.day

---

## 한눈에 보는 변화

| | 2020 | 2026 |
|---|---|---|
| 언어 / 실행 환경 | Python Flask, AWS EC2 | TypeScript + Hono, Cloudflare Workers |
| DB | MongoDB Atlas | Supabase (Postgres) |
| 로그인 | 이메일 회원가입 (bcrypt 직접 구현) | 없음 |
| Riot API | 소환사 이름 검색, match/v4 (지금은 폐지) | Riot ID 검색, match-v5 |
| 챔피언 추천 | op.gg 크롤링 | 직접 모은 경기 데이터로 집계 |
| 데이터 | 검색할 때마다 새로 요청 | 5분마다 티어별 자동 수집 + 저장 |
| 디자인 | MDB Bootstrap | DESIGN.md 기반 자체 CSS |

---

## 바뀐 사이트 둘러보기

### 메인

![메인 화면](https://wgm.nori.day/static/blog/01-home.jpg)

Riot ID(이름#태그)만 넣으면 바로 분석한다. 오른쪽 카드에는 최근 2주 동안 라인별로 승률이 가장 높은 챔피언과, 지금까지 모은 경기 수가 나온다.

### 소환사 분석

![소환사 분석 화면](https://wgm.nori.day/static/blog/02-summoner.jpg)

- 최근 솔로랭크 20게임에서 KDA, 킬 관여율, 분당 CS·골드·피해량, 시야 점수, 데스를 계산한다.
- 이 값을 **같은 티어·같은 라인 평균**과 비교해서, 10% 이상 앞서면 장점, 뒤처지면 약점으로 보여 준다. 약점에는 개선 팁이 붙는다.
- 추천 챔피언은 "지금 성적이 좋은 챔피언", "내 티어에서 승률이 높고 주력과 역할이 같은 챔피언", "숙련도가 높은 챔피언" 세 갈래다.

### 챔피언 티어

![챔피언 티어 화면](https://wgm.nori.day/static/blog/03-tier-list.jpg)

2020년에 이 사이트를 만든 이유가 "상위 티어 통계는 하위 티어에게 도움이 안 된다"였다. 그래서 아이언–실버, 골드–플래티넘처럼 **티어 구간별로 따로** 집계한다. 게임 수가 적은 챔피언이 1위로 튀지 않도록 표본 수를 보정한 승률로 등급을 매긴다.

### 챔피언 정보

![챔피언 정보 화면](https://wgm.nori.day/static/blog/04-champion.jpg)

장점과 약점, 상대하기 쉬운·어려운 챔피언, 핵심 아이템과 룬, 게임 시간대별 승률을 보여 준다. 장단점은 Riot 공식 능력치와 공식 플레이 팁에, 직접 모은 데이터(30분 이후 승률, 상대 전적)를 더해서 만든다.

![챔피언 목록 화면](https://wgm.nori.day/static/blog/06-champion-index.jpg)

### 모바일

![모바일 소환사 분석 화면](https://wgm.nori.day/static/blog/05-summoner-mobile.jpg)

### 2020년 화면과 비교

![2020년 메인 화면](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FciirYQ%2FbtqBFwKvuJE%2FdTNEc4cMDu2zcGL3kgK6k0%2Fimg.png)

![2020년 소환사 정보 화면](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=https%3A%2F%2Fk.kakaocdn.net%2Fdn%2FoVqCU%2FbtqBGZ58UYo%2FBdn9gNURZQ3UUjh2mXake0%2Fimg.png)

위 두 장이 2020년 버전이다. 티어 엠블럼, MOST ONE, 최근 20게임 표 같은 구성은 그때 만든 것을 그대로 가져갔다.

---

## AI로 해 보니 생각보다 간단했다

처음에 한 말은 "깃허브에 있는 프로젝트 받아서 폴더 하나 만들고 프로젝트 시작하면 안될까?"가 전부였다. 그 뒤로 AI가 한 일은 이렇다.

- 6년 전 코드를 읽고 문제부터 찾았다. 폐지된 Riot API, 깨진 op.gg 크롤러, 존재하지 않는 파일을 가리키는 배포 설정, 그리고 **공개 저장소에 그대로 올라가 있던 DB 비밀번호**까지.
- Flask를 TypeScript로, MongoDB를 Supabase로 옮기고 Cloudflare에 배포했다.
- 디자인은 `npx getdesign@latest add coinbase` 한 줄로 받은 `DESIGN.md`를 기준으로 전부 새로 입혔다. 색, 글꼴, 간격, 버튼 모양 규칙이 문서 한 장에 있어서 AI가 그대로 따라 그렸다.
- 5분마다 티어별 경기를 모으는 자동 수집을 붙이고, 데이터가 차자 실제 화면을 캡처해 가며 겹침이나 색 문제를 직접 고쳤다.

내가 한 일은 결정과 권한이 필요한 일뿐이었다. Riot API 키 발급, Supabase에 SQL 붙여 넣기, 대시보드 설정, 도메인 연결, 그리고 "무엇을 만들지" 고르기.

가장 효과가 컸던 건 중간에 한 이 말이었다.

> 진행하기 전에 전부 나에게 응답을 받고 바이브코딩으로 한번에 진행하고싶어

그 뒤로 AI는 코드를 건드리기 전에 질문을 한꺼번에 가져왔고, 답을 정하면 끝까지 한 번에 진행했다. **결정은 먼저, 구현은 한 번에.** 이게 이번 작업의 요령이었다.

---

## 예전 코드를 뜯어고치는 재미

솔직히 기능을 새로 만드는 것보다 **6년 전 내 코드를 다시 보는 게** 더 재미있었다.

- **비밀번호가 공개 저장소에 있었다.** `.gitignore`에 `conf.py`를 넣어 놓고도, 이미 커밋된 파일은 그대로 올라가 있었다.
- **"승률 :" 칸이 비어 있었다.** 유저매칭 화면에 라벨만 만들고 값은 끝내 안 채웠더라. 이번에 Riot API로 채웠다.
- **6년 동안 `<!DOCTYPE html>`이 없었다.** 검색창이 8px 위로 치우친 원인을 찾다 보니 원본부터 빠져 있었다.
- **2020년 글에 적었던 한계를 이번에 풀었다.** 그때는 "데이터를 매번 가져와서 느리고, DB 비용이 부담된다"고 썼다. 이번에는 끝난 경기를 저장해 두고(같은 검색 2.3초 → 0.5초), 경기 원본(약 85KB) 대신 필요한 값만 남겨서(약 3.5KB) 무료 요금제 안에서 해결했다.
- **그 사이 게임도 바뀌었다.** 에메랄드 티어가 생겼고, 소환사 이름 대신 Riot ID를 쓰게 됐다.

---

## 서비스는 하지 않기로 했다

여기까지 만들고 나니 자연스럽게 "이걸 정식으로 운영해 볼까?"라는 생각이 들었다. 결론은 **서비스는 하지 않는다**이다.

- **롤 전적 분석은 이미 op.gg가 대명사처럼 자리 잡았다.** 친구 전적이 궁금하면 다들 습관처럼 op.gg부터 연다. 비슷한 기능을 하나 더 만든다고 그 습관이 바뀌지는 않는다.
- **데이터 규모가 다르다.** 내 사이트는 한 시간에 경기 약 100개를 모은다. 티어 구간별 통계가 의미 있으려면 훨씬 많은 데이터가 필요하고, 그만큼 API 한도와 저장 비용이 든다.
- **운영은 만드는 것과 다른 일이다.** 정식 서비스를 하려면 Riot Production 키 심사를 받아야 하고, 패치마다 데이터를 관리하고, 장애에 대응해야 한다. 개인 사이드 프로젝트로 감당하기엔 부담이 크다.

그래서 WGM.GG는 **포트폴리오이자 학습 기록**으로 남기기로 했다. 지금은 개발용 키로 돌고 있어서, 키가 만료되면 검색이 멈출 수 있다.

---

## 마무리

6년 전에는 기능 하나 붙이는 데 며칠씩 걸렸는데, 이번에는 AI와 대화하면서 하룻밤 사이에 되살리고 갈아엎기까지 했다. **이 정도로 AI를 활용하면 예전 프로젝트도 간단하게 고칠 수 있다**는 걸 직접 확인했다.

무엇보다 재미있었다. 예전 코드를 한 줄씩 다시 읽으면서 그때 무엇을 몰랐는지, 지금은 무엇을 아는지가 보였다. 서랍 속에 묵혀 둔 프로젝트가 있다면 한 번 꺼내서 AI와 같이 뜯어고쳐 보길 추천한다.

---

*WGM.GG isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
