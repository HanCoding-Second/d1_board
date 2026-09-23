// /api/* 요청에만 적용되는 미들웨어.
//
// functions/_middleware.js (루트)에 두면 정적 파일 요청에도 전부 걸려서
// CSS·JS 를 받을 때마다 불필요한 DB 조회가 발생한다. 그래서 api 하위에 둔다.
//
// 여기서 세션을 한 번만 조회해 context.data.user 에 담아두면,
// 이후 모든 라우트가 DB 재조회 없이 로그인 사용자를 꺼내 쓸 수 있다.

import { getSessionUser, readCookie, COOKIE_NAME } from "../../lib/session.js";
import { fail } from "../../lib/http.js";

export async function onRequest(context) {
  const { request, env, data, next } = context;

  data.user = null;

  if (env.DB) {
    const token = readCookie(request, COOKIE_NAME);
    if (token) {
      try {
        data.user = await getSessionUser(env.DB, token);
      } catch {
        // 세션 조회 실패는 비로그인으로 처리하고 요청 자체는 계속 진행한다.
      }
    }
  }

  let response;
  try {
    response = await next();
  } catch (err) {
    // 라우트에서 새어나온 예외가 스택 트레이스로 노출되지 않게 막는다.
    console.error("[api] unhandled:", err);
    return fail("서버 오류가 발생했습니다.", 500);
  }

  // 매칭되는 라우트가 없으면 Pages 가 정적 파일 폴백으로 index.html(HTML)을
  // 200으로 내려준다. /api/* 는 절대 HTML 을 반환해서는 안 되므로 JSON 404로 바꾼다.
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html")) {
    return fail("요청한 API 경로를 찾을 수 없습니다.", 404);
  }

  return response;
}
