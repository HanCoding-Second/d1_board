// API 응답 형식을 한 곳에서 통일한다.
// 성공: { ok: true, ...data }   실패: { ok: false, error, field? }

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const ok = (data = {}, status = 200, headers = {}) =>
  json({ ok: true, ...data }, status, headers);

export const fail = (error, status = 400, field = null, headers = {}) =>
  json(field ? { ok: false, error, field } : { ok: false, error }, status, headers);

/** JSON 본문을 안전하게 파싱한다. 실패 시 null. */
export async function readJson(request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return null;
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/**
 * 라우트가 지원하지 않는 메서드를 405로 돌려준다.
 *
 * Pages Functions 는 메서드별 핸들러(onRequestPost 등)가 우선하고,
 * 나머지 메서드는 onRequest 로 내려온다. 이걸 export 하지 않으면
 * 정적 파일 폴백으로 새어나가 index.html 이 200으로 응답된다.
 *
 *   export const onRequest = methodNotAllowed(["POST"]);
 */
export const methodNotAllowed = (allowed) => () =>
  fail(`${allowed.join(", ")} 메서드만 허용됩니다.`, 405, null, {
    allow: allowed.join(", "),
  });
