// 세션 관리
//
// 쿠키에는 랜덤 토큰(32바이트)을 담고, DB에는 그 토큰의 SHA-256 해시를 저장한다.
// DB가 유출되어도 저장된 값만으로는 유효한 쿠키를 만들 수 없다.

export const COOKIE_NAME = "session";
export const MAX_AGE = 60 * 60 * 24 * 30; // 30일

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** SQLite datetime('now') 와 같은 'YYYY-MM-DD HH:MM:SS' UTC 문자열 */
const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

async function tokenToId(token) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(buf);
}

export async function createSession(db, userId) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const id = await tokenToId(token);
  const expiresAt = sqlTime(Date.now() + MAX_AGE * 1000);

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expiresAt)
    .run();

  return token;
}

/** 토큰으로 사용자를 찾는다. 만료·탈퇴 계정은 null. */
export async function getSessionUser(db, token) {
  if (!token) return null;
  const id = await tokenToId(token);

  return await db
    .prepare(
      `SELECT u.id, u.email, u.nickname, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
          AND s.expires_at > datetime('now')
          AND u.deleted_at IS NULL`
    )
    .bind(id)
    .first();
}

export async function destroySession(db, token) {
  if (!token) return;
  const id = await tokenToId(token);
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}

/** 만료된 세션 정리. 로그인 시점에 해당 사용자 것만 가볍게 지운다. */
export async function purgeExpired(db, userId) {
  await db
    .prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= datetime('now')")
    .bind(userId)
    .run();
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/**
 * Secure 속성은 https 일 때만 붙인다.
 * 로컬 개발(http://127.0.0.1)에서 쿠키가 저장되지 않는 것을 막기 위함이다.
 */
const isHttps = (request) => new URL(request.url).protocol === "https:";

export function setCookieHeader(request, token) {
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${MAX_AGE}`,
  ];
  if (isHttps(request)) attrs.push("Secure");
  return { "set-cookie": attrs.join("; ") };
}

export function clearCookieHeader(request) {
  const attrs = [`${COOKIE_NAME}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (isHttps(request)) attrs.push("Secure");
  return { "set-cookie": attrs.join("; ") };
}
