// GET  /api/posts   목록 (페이지네이션 + 카테고리 필터)
// POST /api/posts   작성 (로그인 필요)

import { ok, fail, readJson, methodNotAllowed } from "../../../lib/http.js";
import { requireAuth } from "../../../lib/guard.js";
import {
  CATEGORIES,
  validateCategory,
  validateTitle,
  validateContent,
  validateMovieTitle,
  parsePaging,
} from "../../../lib/validate.js";

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const { page, limit, offset } = parsePaging(url.searchParams);

  const category = url.searchParams.get("category");
  if (category && !CATEGORIES.includes(category)) {
    return fail("존재하지 않는 카테고리입니다.", 400, "category");
  }

  // 카테고리 유무에 따라 WHERE 절과 바인딩 값이 달라진다.
  const where = category
    ? "p.deleted_at IS NULL AND p.category = ?"
    : "p.deleted_at IS NULL";
  const filterArgs = category ? [category] : [];

  try {
    // 목록과 전체 개수를 한 번의 왕복으로 가져온다.
    const [listRes, countRes] = await env.DB.batch([
      env.DB.prepare(
        `SELECT p.id, p.category, p.movie_title, p.title, p.view_count,
                p.created_at, p.updated_at,
                u.id AS author_id, u.nickname AS author_nickname,
                (SELECT COUNT(*) FROM comments c
                  WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count
           FROM posts p
           JOIN users u ON u.id = p.user_id
          WHERE ${where}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ? OFFSET ?`
      ).bind(...filterArgs, limit, offset),

      env.DB.prepare(
        `SELECT COUNT(*) AS total FROM posts p WHERE ${where}`
      ).bind(...filterArgs),
    ]);

    const total = countRes.results[0].total;
    const posts = listRes.results.map((r) => shapePost(r, data.user));

    return ok({
      posts,
      paging: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("[posts:list]", err);
    return fail("목록을 불러오지 못했습니다.", 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  const auth = requireAuth(data);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return fail("JSON 본문이 필요합니다.", 400);

  const { category, movie_title, title, content } = body;

  const invalid =
    validateCategory(category) ||
    validateTitle(title) ||
    validateContent(content) ||
    validateMovieTitle(movie_title);
  if (invalid) return fail(invalid.error, 400, invalid.field);

  try {
    const row = await env.DB.prepare(
      `INSERT INTO posts (user_id, category, movie_title, title, content)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, category, movie_title, title, content, view_count, created_at, updated_at`
    )
      .bind(
        auth.user.id,
        category || "자유",
        movie_title?.trim() || null,
        title.trim(),
        content.trim()
      )
      .first();

    return ok(
      {
        post: {
          ...shapePost(
            {
              ...row,
              author_id: auth.user.id,
              author_nickname: auth.user.nickname,
              comment_count: 0,
              like_count: 0,
            },
            auth.user
          ),
          content: row.content,
        },
      },
      201
    );
  } catch (err) {
    console.error("[posts:create]", err);
    return fail("글을 저장하지 못했습니다.", 500);
  }
}

/** DB 행을 API 응답 형태로 바꾼다. 목록과 작성 응답이 같은 모양을 갖도록 한 곳에 모았다. */
export function shapePost(row, viewer) {
  return {
    id: row.id,
    category: row.category,
    movie_title: row.movie_title,
    title: row.title,
    view_count: row.view_count,
    comment_count: row.comment_count,
    like_count: row.like_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    edited: row.updated_at !== row.created_at,
    author: { id: row.author_id, nickname: row.author_nickname },
    is_mine: !!viewer && viewer.id === row.author_id,
  };
}

export const onRequest = methodNotAllowed(["GET", "POST"]);
