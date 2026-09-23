// POST /api/auth/signup
// body: { email, password, nickname }

import { ok, fail, readJson, methodNotAllowed } from "../../../lib/http.js";
import { hashPassword } from "../../../lib/password.js";
import { createSession, setCookieHeader } from "../../../lib/session.js";
import {
  validateEmail,
  validatePassword,
  validateNickname,
  normalizeEmail,
} from "../../../lib/validate.js";

export async function onRequestPost({ request, env, data }) {
  if (data.user) return fail("이미 로그인되어 있습니다.", 400);

  const body = await readJson(request);
  if (!body) return fail("JSON 본문이 필요합니다.", 400);

  const { email, password, nickname } = body;

  const invalid =
    validateEmail(email) || validatePassword(password) || validateNickname(nickname);
  if (invalid) return fail(invalid.error, 400, invalid.field);

  const normalizedEmail = normalizeEmail(email);
  const trimmedNickname = nickname.trim();

  try {
    const hash = await hashPassword(password);

    const user = await env.DB.prepare(
      `INSERT INTO users (email, password_hash, nickname)
       VALUES (?, ?, ?)
       RETURNING id, email, nickname, created_at`
    )
      .bind(normalizedEmail, hash, trimmedNickname)
      .first();

    const token = await createSession(env.DB, user.id);

    return ok({ user }, 201, setCookieHeader(request, token));
  } catch (err) {
    const msg = String(err);

    // UNIQUE 제약 위반을 어느 항목 때문인지 구분해 돌려준다.
    if (msg.includes("UNIQUE") && msg.includes("users.email")) {
      return fail("이미 가입된 이메일입니다.", 409, "email");
    }
    if (msg.includes("UNIQUE") && msg.includes("users.nickname")) {
      return fail("이미 사용 중인 닉네임입니다.", 409, "nickname");
    }

    console.error("[signup]", err);
    return fail("가입 처리 중 오류가 발생했습니다.", 500);
  }
}

export const onRequest = methodNotAllowed(["POST"]);
