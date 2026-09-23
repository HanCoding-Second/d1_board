// GET /api/ping - DB 연결 및 스키마 상태 확인

import { ok, fail, methodNotAllowed } from "../../lib/http.js";

const TABLES = ["users", "posts", "comments", "likes", "sessions"];

export async function onRequestGet({ env }) {
  if (!env.DB) return fail("D1 바인딩(DB)을 찾을 수 없습니다.", 500);

  try {
    // batch() 는 여러 쿼리를 한 번의 왕복으로 처리한다.
    const results = await env.DB.batch(
      TABLES.map((t) => env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`))
    );

    const counts = {};
    TABLES.forEach((t, i) => {
      counts[t] = results[i].results[0].n;
    });

    const recent = await env.DB.prepare(
      `SELECT p.id, p.category, p.title, u.nickname AS author
         FROM posts p
         JOIN users u ON u.id = p.user_id
        WHERE p.deleted_at IS NULL
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 5`
    ).all();

    return ok({ counts, recent_posts: recent.results });
  } catch (err) {
    console.error("[ping]", err);
    return fail("DB 조회 중 오류가 발생했습니다.", 500);
  }
}

export const onRequest = methodNotAllowed(["GET"]);
