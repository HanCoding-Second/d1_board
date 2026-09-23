// 입력 검증. DB의 CHECK 제약과 중복되지만, 사용자에게
// "어느 항목이 왜 잘못됐는지" 알려주려면 앱 단에서 한 번 더 걸러야 한다.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 한글, 영문, 숫자, 밑줄만 허용 (공백·특수문자로 인한 사칭 방지)
const NICKNAME_RE = /^[가-힣a-zA-Z0-9_]+$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/** @returns {{error: string, field: string}|null} */
export function validateEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    return { error: "이메일을 입력해 주세요.", field: "email" };
  }
  const v = email.trim();
  if (v.length > 254) {
    return { error: "이메일이 너무 깁니다.", field: "email" };
  }
  if (!EMAIL_RE.test(v)) {
    return { error: "이메일 형식이 올바르지 않습니다.", field: "email" };
  }
  return null;
}

export function validatePassword(password) {
  if (typeof password !== "string" || !password) {
    return { error: "비밀번호를 입력해 주세요.", field: "password" };
  }
  if (password.length < PASSWORD_MIN) {
    return { error: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`, field: "password" };
  }
  if (password.length > PASSWORD_MAX) {
    return { error: `비밀번호는 ${PASSWORD_MAX}자 이하여야 합니다.`, field: "password" };
  }
  return null;
}

export function validateNickname(nickname) {
  if (typeof nickname !== "string" || !nickname.trim()) {
    return { error: "닉네임을 입력해 주세요.", field: "nickname" };
  }
  const v = nickname.trim();
  if (v.length < NICKNAME_MIN || v.length > NICKNAME_MAX) {
    return {
      error: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자여야 합니다.`,
      field: "nickname",
    };
  }
  if (!NICKNAME_RE.test(v)) {
    return { error: "닉네임은 한글, 영문, 숫자, _ 만 사용할 수 있습니다.", field: "nickname" };
  }
  return null;
}

/** 이메일은 대소문자를 구분하지 않으므로 소문자로 정규화해 저장한다. */
export const normalizeEmail = (email) => email.trim().toLowerCase();


// ── 게시글 ──────────────────────────────────────

// DB의 CHECK 제약과 반드시 같은 값을 유지해야 한다 (schema.sql 참고).
export const CATEGORIES = ["자유", "리뷰", "추천"];

export const TITLE_MAX = 120;
export const CONTENT_MAX = 20000;
export const MOVIE_TITLE_MAX = 200;

export function validateCategory(category) {
  if (category === undefined || category === null || category === "") return null; // 기본값 사용
  if (!CATEGORIES.includes(category)) {
    return { error: `카테고리는 ${CATEGORIES.join(", ")} 중 하나여야 합니다.`, field: "category" };
  }
  return null;
}

export function validateTitle(title) {
  if (typeof title !== "string" || !title.trim()) {
    return { error: "제목을 입력해 주세요.", field: "title" };
  }
  if (title.trim().length > TITLE_MAX) {
    return { error: `제목은 ${TITLE_MAX}자 이하여야 합니다.`, field: "title" };
  }
  return null;
}

export function validateContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    return { error: "내용을 입력해 주세요.", field: "content" };
  }
  if (content.trim().length > CONTENT_MAX) {
    return { error: `내용은 ${CONTENT_MAX}자 이하여야 합니다.`, field: "content" };
  }
  return null;
}

export function validateMovieTitle(movieTitle) {
  if (movieTitle === undefined || movieTitle === null || movieTitle === "") return null;
  if (typeof movieTitle !== "string") {
    return { error: "영화 제목 형식이 올바르지 않습니다.", field: "movie_title" };
  }
  if (movieTitle.trim().length > MOVIE_TITLE_MAX) {
    return { error: `영화 제목은 ${MOVIE_TITLE_MAX}자 이하여야 합니다.`, field: "movie_title" };
  }
  return null;
}

/** 경로 파라미터의 id를 검증한다. 실패 시 null. */
export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER ? n : null;
}

/** 목록 페이지네이션 파라미터. 잘못된 값은 조용히 기본값으로 떨어뜨린다. */
export function parsePaging(searchParams, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const rawPage = Number(searchParams.get("page"));
  const rawLimit = Number(searchParams.get("limit"));

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;

  return { page, limit, offset: (page - 1) * limit };
}
