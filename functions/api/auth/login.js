// POST /api/auth/login
// body: { email, password }

import { ok, fail, readJson, methodNotAllowed } from "../../../lib/http.js";
import { verifyPassword, ITERATIONS } from "../../../lib/password.js";
import { createSession, purgeExpired, setCookieHeader } from "../../../lib/session.js";
import { normalizeEmail } from "../../../lib/validate.js";

// 존재하지 않는 이메일일 때도 같은 시간만큼 해시를 계산해서,
// 응답 속도 차이로 가입 여부를 알아내지 못하게 한다.
const DUMMY_HASH =
  `pbkdf2$${ITERATIONS}$` +
  "00000000000000000000000000000000$" +
  "0000000000000000000000000000000000000000000000000000000000000000";

const CREDENTIAL_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다.";

export async function onRequestPost({ request, env, data }) {
  if (data.user) return fail("이미 로그인되어 있습니다.", 400);

  const body = await readJson(request);
  if (!body) return fail("JSON 본문이 필요합니다.", 400);

  const { email, password } = body;
  if (typeof email !== "string" || typeof password !== "string") {
    return fail("이메일과 비밀번호를 입력해 주세요.", 400);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT id, email, nickname, password_hash, created_at
         FROM users
        WHERE email = ? AND deleted_at IS NULL`
    )
      .bind(normalizeEmail(email))
      .first();

    const matched = await verifyPassword(password, row ? row.password_hash : DUMMY_HASH);

    // 어느 쪽이 틀렸는지 알려주지 않는다(계정 열거 방지).
    if (!row || !matched) return fail(CREDENTIAL_ERROR, 401);

    await purgeExpired(env.DB, row.id);
    const token = await createSession(env.DB, row.id);

    const user = {
      id: row.id,
      email: row.email,
      nickname: row.nickname,
      created_at: row.created_at,
    };

    return ok({ user }, 200, setCookieHeader(request, token));
  } catch (err) {
    console.error("[login]", err);
    return fail("로그인 처리 중 오류가 발생했습니다.", 500);
  }
}

export const onRequest = methodNotAllowed(["POST"]);
