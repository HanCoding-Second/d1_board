// 로그인이 필요한 라우트에서 사용한다.
//
//   const auth = requireAuth(data);
//   if (auth.response) return auth.response;
//   // auth.user 사용

import { fail } from "./http.js";

export function requireAuth(data) {
  if (!data?.user) {
    return { user: null, response: fail("로그인이 필요합니다.", 401) };
  }
  return { user: data.user, response: null };
}
