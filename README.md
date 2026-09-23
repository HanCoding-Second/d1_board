# 씨네토크 — 영화 커뮤니티

Cloudflare Pages + D1 위에서 동작하는 영화 커뮤니티입니다.
프레임워크 없이 HTML / CSS / JavaScript 로만 만들었습니다.

## 구조

```
public/            정적 프론트엔드 (그대로 배포됨)
  index.html       앱 셸
  styles.css
  js/
    app.js         해시 라우터 + 화면 렌더
    api.js         API 호출 래퍼
    dom.js         DOM 생성 헬퍼 (innerHTML 미사용)

functions/api/     Pages Functions — 파일 경로가 곧 라우트
  _middleware.js   세션 조회 후 context.data.user 주입
  auth/            signup · login · logout · me
  posts/           목록 · 작성 · 상세 · 수정 · 삭제

lib/               Functions 가 공유하는 모듈
  http.js          응답 형식 통일, 메서드 가드
  password.js      PBKDF2-SHA256 해싱
  session.js       세션 · 쿠키
  validate.js      입력 검증
  guard.js         requireAuth()

schema.sql         테이블 정의
seed.sql           개발용 더미 데이터
```

## 로컬 실행

```bash
npm install
npm run db:reset:local   # 스키마 + 시드 데이터 적용
npm run dev              # http://127.0.0.1:8788
```

시드 계정: `kim@example.com` / `test1234`

> `index.html` 을 파일로 직접 열면 동작하지 않습니다.
> Pages Functions 가 서버에서 돌아야 하므로 반드시 위 주소로 접속해야 합니다.

## npm 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 로컬 개발 서버 |
| `npm run db:reset:local` | 로컬 D1 초기화 + 시드 |
| `npm run db:init:remote` | 실제 D1 에 스키마 적용 |
| `npm run deploy` | Pages 배포 |

## 데이터 모델

| 테이블 | 비고 |
|---|---|
| `users` | email · nickname UNIQUE |
| `sessions` | 쿠키 토큰의 SHA-256 해시를 저장 |
| `posts` | 카테고리 CHECK, 소프트 삭제 |
| `comments` | 소프트 삭제 |
| `likes` | (post_id, user_id) 복합 PK 로 중복 차단 |

## 배포 전 확인 사항

- `wrangler.toml` 의 `database_id` 가 자리표시자입니다.
  `wrangler d1 create movie-community-db` 실행 후 실제 ID 로 교체해야 합니다.
- 로그인·회원가입은 PBKDF2 10만 회 반복으로 요청당 약 36ms 의 CPU 를 씁니다.
  Workers 무료 플랜의 요청당 CPU 한도(10ms)를 넘기므로, 유료 플랜을 쓰거나
  `lib/password.js` 의 `ITERATIONS` 를 낮춰야 합니다.
  해시 문자열에 반복 횟수가 함께 저장되어 있어 값을 바꿔도 기존 계정은 그대로 로그인됩니다.

## 진행 상황

- [x] 1단계 — Pages ↔ D1 파이프라인
- [x] 2단계 — 스키마 설계
- [x] 3단계 — 인증 (회원가입 · 로그인 · 세션)
- [x] 4단계 — 게시판 CRUD
- [ ] 5단계 — 댓글 · 좋아요
- [ ] 6단계 — 배포
