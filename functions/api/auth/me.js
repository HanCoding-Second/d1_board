// GET /api/auth/me
// 현재 로그인 사용자를 돌려준다. 프런트가 진입 시 로그인 상태를 확인하는 용도.

import { ok, methodNotAllowed } from "../../../lib/http.js";

export async function onRequestGet({ data }) {
  // 비로그인은 오류가 아니라 정상 상태이므로 200 + user: null 로 응답한다.
  return ok({ user: data.user });
}

export const onRequest = methodNotAllowed(["GET"]);
