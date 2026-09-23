# 진행 상황 및 다음 작업

영화 커뮤니티 **씨네토크** — Cloudflare Pages + D1, 프레임워크 없이 HTML/CSS/JS 로 구현.

마지막 갱신: 2026-09-23

---

## 완료된 단계

### 1단계 — 파이프라인 구축 ✅

`브라우저 → Pages Functions → D1` 왕복이 실제로 동작하는지 먼저 확인했다.
기능을 만들기 전에 이 경로가 막히면 이후 작업이 전부 헛수고가 되기 때문이다.

- `wrangler.toml` 에 D1 바인딩(`env.DB`) 연결
- `functions/` 디렉터리 구조 확정 — 파일 경로가 곧 라우트가 된다
- 읽기/쓰기/한글 저장 모두 확인

**이때 겪은 문제:** `compatibility_date` 를 당일 날짜(2026-09-23)로 넣었더니
설치된 Wrangler 4.104 의 런타임이 2026-06-30 까지만 지원해서 기동에 실패했다.
현재 `2026-06-30` 으로 고정해 둔 상태다.

---

### 2단계 — 스키마 설계 ✅

`schema.sql` 에 5개 테이블 정의.

| 테이블 | 핵심 |
|---|---|
| `users` | email · nickname UNIQUE |
| `sessions` | 쿠키 토큰의 SHA-256 해시를 저장 (원본 토큰 저장 안 함) |
| `posts` | category CHECK, 소프트 삭제(`deleted_at`) |
| `comments` | post_id CASCADE, 소프트 삭제 |
| `likes` | `(post_id, user_id)` 복합 PK 로 중복 좋아요 차단 |

**설계 판단**

- **소프트 삭제**를 택했다. 실제 `DELETE` 를 쓰면 "삭제된 댓글입니다" 표시가 불가능하고,
  글이 지워질 때 댓글이 통째로 사라져 대화 맥락이 끊긴다.
- **부분 인덱스** (`WHERE deleted_at IS NULL`) 를 썼다. 삭제된 글은 애초에 인덱스에 넣지 않아
  크기를 줄인다. `EXPLAIN QUERY PLAN` 으로 `SCAN p USING INDEX idx_posts_created` 확인 완료.
- **`sessions` 테이블을 2단계에 미리 만들었다.** 원래 3단계 항목이지만 나중에 추가하면
  마이그레이션이 한 번 더 필요해서 같이 넣었다.
- **카테고리는 별도 테이블 없이 컬럼 하나**(`'자유'/'리뷰'/'추천'`)로 시작했다.
  게시판이 실제로 늘어날 때 분리해도 늦지 않다.

**검증:** 좋아요 중복 / 없는 사용자 참조 / 잘못된 카테고리 / 닉네임 중복 / 빈 제목
— 5종 제약 모두 DB 단에서 차단되는 것을 확인했다.

---

### 3단계 — 인증 ✅

```
lib/password.js   PBKDF2-SHA256 해싱 (외부 의존성 없이 Web Crypto 만 사용)
lib/session.js    세션 생성·조회·파기, 쿠키 속성
lib/validate.js   이메일·비밀번호·닉네임 검증
lib/guard.js      requireAuth()
lib/http.js       응답 형식 통일, 메서드 가드

functions/api/_middleware.js        세션 1회 조회 → context.data.user 주입
functions/api/auth/signup.js        POST  회원가입 (가입 즉시 로그인)
functions/api/auth/login.js         POST  로그인
functions/api/auth/logout.js        POST  로그아웃 (멱등)
functions/api/auth/me.js            GET   현재 로그인 사용자
```

**보안 처리**

- 쿠키: `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`
  `Secure` 는 https 일 때만 붙인다 — 로컬 개발(http://127.0.0.1)에서 쿠키가 저장되지 않는 것을 막기 위함.
- **DB 에는 토큰 원본이 아닌 SHA-256 해시를 저장한다.** DB 가 유출돼도 유효한 쿠키를 만들 수 없다.
- 계정 열거 방지: 없는 이메일에도 더미 해시를 계산해 응답 시간을 맞추고, 실패 메시지를 통일했다.

**미들웨어를 `functions/api/` 아래 둔 이유**

루트(`functions/_middleware.js`)에 두면 CSS·JS 같은 정적 파일 요청에도 전부 걸려서
파일을 받을 때마다 불필요한 DB 조회가 발생한다.

**이때 발견해 고친 문제**

`GET /api/auth/login` 이 405 가 아니라 **HTML 을 200 으로** 반환했다.
매칭되지 않은 `/api/*` 요청이 정적 파일 폴백으로 새어나가 `index.html` 을 내려주고 있었다.
프런트에서 `res.json()` 이 엉뚱한 파싱 오류를 내는 원인이 된다. 두 겹으로 막았다.

1. 각 라우트에 `export const onRequest = methodNotAllowed([...])` — 정확한 405 + `Allow` 헤더
2. 미들웨어에서 `/api/*` 응답이 HTML 이면 JSON 404 로 교체

---

### 4단계 — 게시판 CRUD ✅

```
functions/api/posts/index.js   GET  목록(페이지네이션·카테고리 필터) / POST 작성
functions/api/posts/[id].js    GET  상세(조회수 +1) / PATCH 수정 / DELETE 삭제

public/index.html              앱 셸
public/js/app.js               해시 라우터 + 화면 렌더
public/js/api.js               API 호출 래퍼
public/js/dom.js               DOM 생성 헬퍼
```

**화면 라우트**

```
#/                  목록 (카테고리 탭, 페이지네이션)
#/posts/:id         상세
#/write             글쓰기
#/posts/:id/edit    수정
#/login             로그인 / 회원가입
```

**권한:** 수정·삭제는 작성자 본인만. 비로그인 401, 타인 403, 없는 글 404.

**XSS 차단:** `innerHTML` 을 아예 쓰지 않는다. `dom.js` 의 `h()` 헬퍼로만 DOM 을 만들고,
`html` 속성을 넘기면 예외를 던지게 해뒀다. 본문 줄바꿈은 CSS `white-space: pre-wrap` 으로 살린다.
제목에 `<img src=x onerror=...>`, 본문에 `<script>` 를 넣어 실제 브라우저에서 확인했고
둘 다 실행되지 않고 글자 그대로 표시됐다.

**작은 판단들**

- 브라우저 `confirm()` 대신 **인라인 확인**을 쓴다 (삭제 버튼 → "정말 삭제할까요? [삭제] [취소]").
- **본인 글을 볼 때는 조회수를 올리지 않는다.**
- `updated_at` 은 SQLite 에 `ON UPDATE` 가 없어 수정 API 에서 직접 갱신한다.

---

## 남은 작업

### 5단계 — 댓글 · 좋아요 ⬜ (다음 차례)

- [ ] `GET /api/posts/:id/comments` — 댓글 목록 (오래된 순)
- [ ] `POST /api/posts/:id/comments` — 댓글 작성 (로그인)
- [ ] `PATCH /api/comments/:id` — 댓글 수정 (작성자)
- [ ] `DELETE /api/comments/:id` — 댓글 삭제 (작성자, 소프트)
- [ ] `PUT /api/posts/:id/like` · `DELETE /api/posts/:id/like` — 좋아요 토글
- [ ] 상세 화면 하단에 댓글 목록 + 입력폼
- [ ] 좋아요 버튼 (누른 상태 표시)
- [ ] 상세 API 응답에 `liked_by_me` 추가

테이블(`comments`, `likes`)은 2단계에서 이미 만들어 뒀고 시드 데이터도 들어 있다.
`lib/guard.js` 의 `requireAuth()` 를 그대로 쓰면 된다.

### 6단계 — 배포 ⬜

- [ ] Cloudflare 계정 로그인 (`npx wrangler login`)
- [ ] `npx wrangler d1 create movie-community-db` 실행
- [ ] 출력된 실제 ID 로 `wrangler.toml` 의 `database_id` 교체 (현재 자리표시자 `0000…`)
- [ ] `npm run db:init:remote` 로 실제 D1 에 스키마 적용 (**시드는 넣지 말 것**)
- [ ] `npm run deploy` 또는 Pages 의 GitHub 연동 설정
- [ ] 로그인·회원가입이 CPU 한도에 걸리는지 실측 (아래 참고)

---

## 결정이 필요한 사항

### ⚠️ PBKDF2 CPU 한도 — 배포 전 반드시 확인

비밀번호 해싱은 **일부러 무겁게** 만든 계산이다. 빠른 해시는 DB 유출 시
공격자가 초당 수십억 번 대입할 수 있어 오히려 위험하기 때문이다.

현재 설정(100,000회)은 요청당 약 36ms 의 CPU 를 쓴다.
**Workers 무료 플랜의 요청당 CPU 한도는 10ms** 라서, 무료로 배포하면
로그인·회원가입이 실패할 가능성이 크다.

| 반복 횟수 | CPU |
|---|---|
| 10,000 | 3.7 ms |
| 25,000 | 9.0 ms |
| 50,000 | 17.8 ms |
| **100,000 (현재)** | **35.7 ms** |

대응 세 가지:

1. **유료 플랜($5/월)** — CPU 한도 30초. 보안 강도를 그대로 유지하는 방법이라 권장.
2. **`lib/password.js` 의 `ITERATIONS` 를 25,000 으로 낮춤** — 크래킹 저항이 1/4 로 줄어든다.
   해시 문자열에 반복 횟수를 함께 저장해뒀기 때문에 **상수만 바꾸면 기존 계정 로그인은 그대로 동작**한다.
3. 배포 후 실측해서 결정.

> CPU 시간은 "실제로 계산기를 돌린 시간"이지 응답 시간이 아니다.
> DB 응답을 기다리는 시간은 포함되지 않으므로, 게시글·댓글 API 는 이 문제와 무관하다.
> 걸리는 건 `login` 과 `signup` 둘뿐이다.

### 저장소가 공개(Public) 상태

6단계에서 `wrangler.toml` 에 실제 D1 ID 가 들어간다. ID 자체는 인증 수단이 아니라
노출돼도 접근은 불가능하지만, 원치 않으면 그 전에 비공개로 전환할 것.

```bash
gh repo edit HanCoding-Second/d1_board --visibility private
```

---

## MVP 범위상 보류한 것

| 항목 | 메모 |
|---|---|
| 게시글 검색 | D1 은 SQLite 라 `LIKE` 는 인덱스를 못 탄다. 글이 쌓이면 FTS5 가상 테이블 필요 |
| 로그인 속도 제한 | 무차별 대입 방어. 실제 공개 전에는 필요 |
| 이메일 인증 / 비밀번호 재설정 | 메일 발송 수단이 따로 필요 |
| CSRF 토큰 | `SameSite=Lax` + JSON 전용 API 라 실질 위험은 낮음 |
| 조회수 중복 방지 | 새로고침마다 계속 오른다. D1 무료 쓰기 한도(10만 행/일)를 소모하는 점도 유의 |
| 프로필 이미지 | D1 은 이미지 저장에 부적합. R2 추가 필요 |
| TMDB 연동 | 현재는 `posts.movie_title` 에 텍스트로 직접 입력. 연동 시 `movies` 테이블로 이전하는 마이그레이션 필요 |

---

## 다른 컴퓨터에서 이어서 작업하기

> 아래 절차는 실제로 빈 디렉터리에 새로 클론해서 끝까지 실행해 확인했다.
> 클론 → 설치 → DB 생성 → 서버 실행 → 시드 계정 로그인까지 오류 없이 동작한다.

### 1. 사전 준비

| 도구 | 확인한 버전 |
|---|---|
| Node.js | v26.7.0 (LTS 이상이면 무방) |
| git | 2.55.0 |
| GitHub CLI (`gh`) | 2.93.0 — 선택 사항이지만 푸시 인증에 편함 |

### 2. 클론

```bash
git clone https://github.com/HanCoding-Second/d1_board.git
cd d1_board
```

### 3. git 사용자 정보 설정 ⚠️

**클론해도 따라오지 않는다.** 이 프로젝트는 계정이 두 개라 전역 설정을 건드리지 않고
저장소 단위(`--local`)로만 지정했기 때문이다. 새 환경에서 다시 설정해야 한다.

```bash
git config user.name "HanCoding-Second"
git config user.email "hancoding.second@gmail.com"
```

### 4. GitHub 인증

`gh` 를 쓴다면 이 저장소의 소유자 계정으로 전환해야 푸시된다.

```bash
gh auth login          # 처음이라면
gh auth switch --user HanCoding-Second
gh auth setup-git
```

### 5. 의존성 설치

```bash
npm install
```

`wrangler` 만 설치된다(devDependency). 런타임 의존성은 없다.

> npm 11 이상에서는 `esbuild` · `workerd` 의 postinstall 스크립트가 차단됐다는
> 경고가 뜬다. 깨끗한 클론으로 확인한 결과 **그대로 둬도 정상 동작**하므로 무시해도 된다.
>
> 버전은 `^4.104.0` 으로 잡혀 있어 새로 설치하면 최신 4.x 가 들어온다
> (확인 시점 4.136.3). `compatibility_date = "2026-06-30"` 은 구·신 버전 모두에서 동작한다.

### 6. 로컬 데이터베이스 만들기 ⚠️

**로컬 D1 데이터(`.wrangler/`)는 저장소에 포함되지 않는다.** 새 환경에서는 비어 있으므로
반드시 아래를 실행해야 한다. 실행하지 않으면 "no such table" 오류가 난다.

```bash
npm run db:reset:local
```

스키마 적용 + 시드 데이터 투입이 한 번에 된다. Cloudflare 계정 로그인 없이도 동작한다.

### 7. 실행

```bash
npm run dev
```

→ http://127.0.0.1:8788

시드 계정 (비밀번호 모두 `test1234`)

| 이메일 | 닉네임 |
|---|---|
| kim@example.com | 영화광김씨 |
| lee@example.com | 심야극장 |
| park@example.com | 팝콘없인못봄 |

> **`public/index.html` 을 파일로 직접 열면 동작하지 않는다.**
> `file://` 로 열면 `/styles.css` 가 `file:///C:/styles.css` 로 해석돼 디자인이 깨지고,
> Pages Functions 는 서버에서 도는 코드라 API 호출도 불가능하다.
> 반드시 위 주소로 접속할 것.

---

## npm 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 로컬 개발 서버 (http://127.0.0.1:8788) |
| `npm run db:init:local` | 로컬 D1 에 스키마만 적용 (기존 데이터 삭제됨) |
| `npm run db:seed:local` | 시드 데이터 투입 |
| `npm run db:reset:local` | 위 둘을 순서대로 실행 |
| `npm run db:init:remote` | **실제** D1 에 스키마 적용 |
| `npm run deploy` | Pages 배포 |

---

## 작업 방식 메모

- 큰 수정이나 새 기능 개발이 끝나면 별도 확인 없이 커밋 후 푸시한다.
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 본문에 적는다.
- 푸시 전에 토큰·키·개인정보가 섞이지 않았는지 확인한다.
