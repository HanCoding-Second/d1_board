// GET    /api/posts/:id   상세 (조회수 +1)
// PATCH  /api/posts/:id   수정 (작성자 본인만)
// DELETE /api/posts/:id   삭제 (작성자 본인만, 소프트 삭제)

import { ok, fail, readJson, methodNotAllowed } from "../../../lib/http.js";
import { requireAuth } from "../../../lib/guard.js";
import {
  validateCategory,
  validateTitle,
  validateContent,
  validateMovieTitle,
  parseId,
} from "../../../lib/validate.js";
import { shapePost } from "./index.js";

const SELECT_POST = `
  SELECT p.id, p.user_id, p.category, p.movie_title, p.title, p.content,
         p.view_count, p.created_at, p.updated_at,
         u.id AS author_id, u.nickname AS author_nickname,
         (SELECT COUNT(*) FROM comments c
           WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count,
         (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
   WHERE p.id = ? AND p.deleted_at IS NULL`;

export async function onRequestGet({ params, env, data }) {
  const id = parseId(params.id);
  if (!id) return fail("잘못된 글 번호입니다.", 400);

  try {
    const row = await env.DB.prepare(SELECT_POST).bind(id).first();
    if (!row) return fail("글을 찾을 수 없습니다.", 404);

    // 본인 글을 볼 때는 조회수를 올리지 않는다.
    const countUp = !data.user || data.user.id !== row.user_id;
    if (countUp) {
      await env.DB.prepare("UPDATE posts SET view_count = view_count + 1 WHERE id = ?")
        .bind(id)
        .run();
    }

    return ok({
      post: {
        ...shapePost({ ...row, view_count: row.view_count + (countUp ? 1 : 0) }, data.user),
        content: row.content,
      },
    });
  } catch (err) {
    console.error("[posts:detail]", err);
    return fail("글을 불러오지 못했습니다.", 500);
  }
}

export async function onRequestPatch({ params, request, env, data }) {
  const auth = requireAuth(data);
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return fail("잘못된 글 번호입니다.", 400);

  const body = await readJson(request);
  if (!body) return fail("JSON 본문이 필요합니다.", 400);

  // 보내온 항목만 검증하고 수정한다(부분 수정).
  const fields = [];
  const values = [];

  if ("category" in body) {
    const bad = validateCategory(body.category);
    if (bad) return fail(bad.error, 400, bad.field);
    fields.push("category = ?");
    values.push(body.category || "자유");
  }
  if ("title" in body) {
    const bad = validateTitle(body.title);
    if (bad) return fail(bad.error, 400, bad.field);
    fields.push("title = ?");
    values.push(body.title.trim());
  }
  if ("content" in body) {
    const bad = validateContent(body.content);
    if (bad) return fail(bad.error, 400, bad.field);
    fields.push("content = ?");
    values.push(body.content.trim());
  }
  if ("movie_title" in body) {
    const bad = validateMovieTitle(body.movie_title);
    if (bad) return fail(bad.error, 400, bad.field);
    fields.push("movie_title = ?");
    values.push(body.movie_title?.trim() || null);
  }

  if (fields.length === 0) return fail("수정할 항목이 없습니다.", 400);

  try {
    const owner = await checkOwner(env.DB, id, auth.user.id);
    if (owner.response) return owner.response;

    // SQLite에는 ON UPDATE 가 없어서 updated_at 을 직접 갱신한다.
    await env.DB.prepare(
      `UPDATE posts SET ${fields.join(", ")}, updated_at = datetime('now')
        WHERE id = ? AND deleted_at IS NULL`
    )
      .bind(...values, id)
      .run();

    const row = await env.DB.prepare(SELECT_POST).bind(id).first();

    return ok({
      post: { ...shapePost(row, auth.user), content: row.content },
    });
  } catch (err) {
    console.error("[posts:update]", err);
    return fail("글을 수정하지 못했습니다.", 500);
  }
}

export async function onRequestDelete({ params, env, data }) {
  const auth = requireAuth(data);
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return fail("잘못된 글 번호입니다.", 400);

  try {
    const owner = await checkOwner(env.DB, id, auth.user.id);
    if (owner.response) return owner.response;

    // 실제 DELETE 대신 deleted_at 을 채운다. 댓글은 그대로 남는다.
    await env.DB.prepare(
      "UPDATE posts SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
    )
      .bind(id)
      .run();

    return ok({ message: "삭제되었습니다.", id });
  } catch (err) {
    console.error("[posts:delete]", err);
    return fail("글을 삭제하지 못했습니다.", 500);
  }
}

/** 글이 존재하고 요청자가 작성자인지 확인한다. */
async function checkOwner(db, id, userId) {
  const row = await db
    .prepare("SELECT user_id FROM posts WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first();

  if (!row) return { response: fail("글을 찾을 수 없습니다.", 404) };
  if (row.user_id !== userId) return { response: fail("권한이 없습니다.", 403) };
  return { response: null };
}

export const onRequest = methodNotAllowed(["GET", "PATCH", "DELETE"]);
