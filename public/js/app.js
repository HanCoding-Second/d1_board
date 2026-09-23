import { api } from "./api.js";
import { h, $, mount, timeAgo, fullTime } from "./dom.js";

const CATEGORIES = ["자유", "리뷰", "추천"];

const state = { user: null };

const view = () => $("#view");

// ── 라우팅 ────────────────────────────────────────
// 해시 기반. 새로고침해도 같은 화면이 나오고, 뒤로가기도 동작한다.

function parseRoute() {
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  return { path, params: new URLSearchParams(qs ?? "") };
}

const go = (hash) => {
  location.hash = hash;
};

async function route() {
  const { path, params } = parseRoute();
  const detail = path.match(/^\/posts\/(\d+)$/);
  const edit = path.match(/^\/posts\/(\d+)\/edit$/);

  try {
    if (detail) return await renderDetail(detail[1]);
    if (edit) return await renderForm({ id: edit[1] });
    if (path === "/write") return await renderForm({});
    if (path === "/login") return renderAuth();
    return await renderList(params);
  } catch (err) {
    renderError(err);
  }
}

// ── 공통 조각 ─────────────────────────────────────

const loading = (text = "불러오는 중…") => h("p", { class: "muted pad" }, text);

function renderError(err) {
  mount(
    view(),
    h(
      "section",
      { class: "panel" },
      h("p", { class: "status err" }, err.message ?? String(err)),
      h("button", { class: "btn", onClick: () => route() }, "다시 시도")
    )
  );
}

function badge(category) {
  return h("span", { class: `badge badge-${CATEGORIES.indexOf(category)}` }, category);
}

function renderHeader() {
  const right = state.user
    ? [
        h("span", { class: "who" }, state.user.nickname),
        h(
          "button",
          {
            class: "btn btn-sm",
            onClick: async () => {
              await api.logout();
              state.user = null;
              renderHeader();
              go("/");
              route();
            },
          },
          "로그아웃"
        ),
      ]
    : [h("a", { class: "btn btn-sm btn-primary", href: "#/login" }, "로그인")];

  mount(
    $("#header-inner"),
    h("a", { class: "brand", href: "#/" }, "🎬 ", h("strong", {}, "씨네토크")),
    h("div", { class: "spacer" }),
    ...right
  );
}

// ── 목록 ──────────────────────────────────────────

async function renderList(params) {
  const category = params.get("category") ?? "";
  const page = Number(params.get("page")) || 1;

  mount(view(), loading());
  const { posts, paging } = await api.listPosts({ page, category });

  const tabs = h(
    "nav",
    { class: "tabs" },
    h("a", { class: "tab" + (category ? "" : " on"), href: "#/" }, "전체"),
    ...CATEGORIES.map((c) =>
      h(
        "a",
        {
          class: "tab" + (category === c ? " on" : ""),
          href: `#/?category=${encodeURIComponent(c)}`,
        },
        c
      )
    ),
    h("div", { class: "spacer" }),
    state.user ? h("a", { class: "btn btn-sm btn-primary", href: "#/write" }, "글쓰기") : null
  );

  const list = posts.length
    ? h(
        "ul",
        { class: "posts" },
        ...posts.map((p) =>
          h(
            "li",
            { class: "post-row" },
            h(
              "a",
              { class: "post-link", href: `#/posts/${p.id}` },
              h(
                "div",
                { class: "post-head" },
                badge(p.category),
                h("span", { class: "post-title" }, p.title),
                p.comment_count > 0 ? h("span", { class: "count" }, `[${p.comment_count}]`) : null
              ),
              h(
                "div",
                { class: "post-meta" },
                p.movie_title ? h("span", { class: "movie" }, `🎞 ${p.movie_title}`) : null,
                h("span", {}, p.author.nickname),
                h("span", {}, timeAgo(p.created_at)),
                h("span", {}, `조회 ${p.view_count}`),
                p.like_count > 0 ? h("span", {}, `♥ ${p.like_count}`) : null
              )
            )
          )
        )
      )
    : h("p", { class: "muted pad" }, "아직 글이 없습니다. 첫 글을 남겨보세요.");

  mount(view(), tabs, h("section", { class: "panel panel-flush" }, list), pager(paging, category));
}

function pager({ page, total_pages }, category) {
  if (total_pages <= 1) return null;

  const link = (p, label, disabled) =>
    disabled
      ? h("span", { class: "page-btn off" }, label)
      : h(
          "a",
          {
            class: "page-btn" + (p === page ? " on" : ""),
            href: `#/?${new URLSearchParams({
              ...(category ? { category } : {}),
              page: String(p),
            })}`,
          },
          label
        );

  const nums = [];
  for (let p = 1; p <= total_pages; p++) nums.push(link(p, String(p)));

  return h(
    "nav",
    { class: "pager" },
    link(page - 1, "‹", page <= 1),
    ...nums,
    link(page + 1, "›", page >= total_pages)
  );
}

// ── 상세 ──────────────────────────────────────────

async function renderDetail(id) {
  mount(view(), loading());
  const { post } = await api.getPost(id);

  const actions = post.is_mine
    ? h(
        "div",
        { class: "row-end" },
        h("a", { class: "btn btn-sm", href: `#/posts/${post.id}/edit` }, "수정"),
        deleteButton(post.id)
      )
    : null;

  mount(
    view(),
    h("a", { class: "back", href: "#/" }, "← 목록"),
    h(
      "article",
      { class: "panel" },
      h(
        "div",
        { class: "detail-head" },
        badge(post.category),
        post.movie_title ? h("span", { class: "movie" }, `🎞 ${post.movie_title}`) : null
      ),
      h("h1", { class: "detail-title" }, post.title),
      h(
        "div",
        { class: "detail-meta" },
        h("strong", {}, post.author.nickname),
        h("span", { title: fullTime(post.created_at) }, timeAgo(post.created_at)),
        post.edited ? h("span", { class: "muted" }, "(수정됨)") : null,
        h("span", {}, `조회 ${post.view_count}`),
        h("span", {}, `♥ ${post.like_count}`)
      ),
      // 본문은 줄바꿈만 살리고(CSS white-space) HTML 로는 해석하지 않는다.
      h("div", { class: "detail-body" }, post.content),
      actions
    )
  );
}

/** 브라우저 confirm() 대신 인라인으로 한 번 더 묻는다. */
function deleteButton(id) {
  const wrap = h("span", { class: "confirm-wrap" });

  const ask = h(
    "button",
    { class: "btn btn-sm btn-danger", onClick: () => mount(wrap, confirmRow) },
    "삭제"
  );

  const confirmRow = h(
    "span",
    { class: "confirm" },
    h("span", { class: "muted" }, "정말 삭제할까요?"),
    h(
      "button",
      {
        class: "btn btn-sm btn-danger",
        onClick: async (e) => {
          e.target.disabled = true;
          try {
            await api.deletePost(id);
            go("/");
          } catch (err) {
            mount(wrap, h("span", { class: "status err" }, err.message));
          }
        },
      },
      "삭제"
    ),
    h("button", { class: "btn btn-sm", onClick: () => mount(wrap, ask) }, "취소")
  );

  mount(wrap, ask);
  return wrap;
}

// ── 작성 / 수정 ───────────────────────────────────

async function renderForm({ id }) {
  if (!state.user) {
    mount(
      view(),
      h(
        "section",
        { class: "panel" },
        h("p", { class: "status err" }, "로그인이 필요합니다."),
        h("a", { class: "btn btn-primary", href: "#/login" }, "로그인하러 가기")
      )
    );
    return;
  }

  let post = { category: "자유", movie_title: "", title: "", content: "" };

  if (id) {
    mount(view(), loading());
    const res = await api.getPost(id);
    if (!res.post.is_mine) {
      mount(
        view(),
        h("section", { class: "panel" }, h("p", { class: "status err" }, "본인이 쓴 글만 수정할 수 있습니다."))
      );
      return;
    }
    post = res.post;
  }

  const status = h("p", { class: "status" });

  const select = h(
    "select",
    { name: "category", class: "input" },
    ...CATEGORIES.map((c) => h("option", { value: c, selected: c === post.category }, c))
  );

  const movie = h("input", {
    class: "input",
    name: "movie_title",
    value: post.movie_title ?? "",
    placeholder: "예: 기생충 (선택)",
    maxlength: "200",
  });
  const title = h("input", {
    class: "input",
    name: "title",
    value: post.title,
    placeholder: "제목",
    maxlength: "120",
  });
  const content = h("textarea", {
    class: "input textarea",
    name: "content",
    rows: "12",
    placeholder: "내용을 입력하세요",
  });
  content.value = post.content;

  const submit = h("button", { class: "btn btn-primary", type: "submit" }, id ? "수정 완료" : "등록");

  const form = h(
    "form",
    {
      onSubmit: async (e) => {
        e.preventDefault();
        submit.disabled = true;
        status.className = "status";
        status.textContent = "저장 중…";

        for (const el of [title, content, movie]) el.classList.remove("invalid");

        const body = {
          category: select.value,
          movie_title: movie.value.trim(),
          title: title.value.trim(),
          content: content.value,
        };

        try {
          const res = id ? await api.updatePost(id, body) : await api.createPost(body);
          go(`/posts/${res.post.id}`);
        } catch (err) {
          status.className = "status err";
          status.textContent = err.message;
          const target = { title, content, movie_title: movie }[err.field];
          target?.classList.add("invalid");
          target?.focus();
        } finally {
          submit.disabled = false;
        }
      },
    },
    h("label", { class: "field" }, h("span", {}, "카테고리"), select),
    h("label", { class: "field" }, h("span", {}, "영화 제목"), movie),
    h("label", { class: "field" }, h("span", {}, "제목"), title),
    h("label", { class: "field" }, h("span", {}, "내용"), content),
    status,
    h(
      "div",
      { class: "row-end" },
      h("a", { class: "btn", href: id ? `#/posts/${id}` : "#/" }, "취소"),
      submit
    )
  );

  mount(
    view(),
    h("section", { class: "panel" }, h("h1", { class: "panel-title" }, id ? "글 수정" : "글쓰기"), form)
  );
}

// ── 로그인 / 회원가입 ─────────────────────────────

function renderAuth() {
  if (state.user) {
    go("/");
    return;
  }

  const status = h("p", { class: "status" });

  const makeForm = (kind) => {
    const fields = {
      email: h("input", {
        class: "input",
        name: "email",
        type: "email",
        placeholder: "you@example.com",
        autocomplete: "email",
      }),
      password: h("input", {
        class: "input",
        name: "password",
        type: "password",
        placeholder: kind === "signup" ? "8자 이상" : "비밀번호",
        autocomplete: kind === "signup" ? "new-password" : "current-password",
      }),
    };
    if (kind === "signup") {
      fields.nickname = h("input", {
        class: "input",
        name: "nickname",
        placeholder: "2~20자",
        autocomplete: "nickname",
      });
    }

    const btn = h(
      "button",
      { class: "btn btn-primary btn-block", type: "submit" },
      kind === "signup" ? "가입하기" : "로그인"
    );

    return h(
      "form",
      {
        onSubmit: async (e) => {
          e.preventDefault();
          btn.disabled = true;
          status.className = "status";
          status.textContent = "처리 중…";
          Object.values(fields).forEach((el) => el.classList.remove("invalid"));

          const body = Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.value]));

          try {
            const res = kind === "signup" ? await api.signup(body) : await api.login(body);
            state.user = res.user;
            renderHeader();
            go("/");
          } catch (err) {
            status.className = "status err";
            status.textContent = err.message;
            fields[err.field]?.classList.add("invalid");
            fields[err.field]?.focus();
          } finally {
            btn.disabled = false;
          }
        },
      },
      h("label", { class: "field" }, h("span", {}, "이메일"), fields.email),
      fields.nickname ? h("label", { class: "field" }, h("span", {}, "닉네임"), fields.nickname) : null,
      h("label", { class: "field" }, h("span", {}, "비밀번호"), fields.password),
      btn
    );
  };

  mount(
    view(),
    h("a", { class: "back", href: "#/" }, "← 목록"),
    h(
      "div",
      { class: "cols" },
      h(
        "section",
        { class: "panel" },
        h("h1", { class: "panel-title" }, "로그인"),
        makeForm("login"),
        h("p", { class: "hint" }, "시드 계정: kim@example.com / test1234")
      ),
      h("section", { class: "panel" }, h("h1", { class: "panel-title" }, "회원가입"), makeForm("signup"))
    ),
    h("section", { class: "panel" }, status)
  );
}

// ── 시작 ──────────────────────────────────────────

async function start() {
  try {
    const { user } = await api.me();
    state.user = user;
  } catch {
    state.user = null; // 서버가 죽어 있어도 화면은 뜨게 한다.
  }
  renderHeader();
  window.addEventListener("hashchange", route);
  route();
}

start();
