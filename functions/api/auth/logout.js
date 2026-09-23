// POST /api/auth/logout
// 세션을 DB에서 지우고 쿠키도 만료시킨다.

import { ok, fail, methodNotAllowed } from "../../../lib/http.js";
import { destroySession, readCookie, clearCookieHeader, COOKIE_NAME } from "../../../lib/session.js";

export async function onRequestPost({ request, env }) {
  try {
    const token = readCookie(request, COOKIE_NAME);
    await destroySession(env.DB, token);

    // 이미 로그아웃 상태여도 성공으로 처리한다(멱등).
    return ok({ message: "로그아웃되었습니다." }, 200, clearCookieHeader(request));
  } catch (err) {
    console.error("[logout]", err);
    return fail("로그아웃 처리 중 오류가 발생했습니다.", 500);
  }
}

export const onRequest = methodNotAllowed(["POST"]);
