// API 호출 래퍼.
//
// credentials: "same-origin" 이 없으면 세션 쿠키가 실리지 않아
// 로그인한 상태인데도 401이 떨어진다.

class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했습니다.", 0, null);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`응답을 해석할 수 없습니다 (HTTP ${res.status})`, res.status, null);
  }

  if (!res.ok || !data.ok) {
    throw new ApiError(data.error ?? `요청 실패 (HTTP ${res.status})`, res.status, data.field);
  }
  return data;
}

export const api = {
  me: () => request("/api/auth/me"),
  signup: (body) => request("/api/auth/signup", { method: "POST", body }),
  login: (body) => request("/api/auth/login", { method: "POST", body }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  listPosts: ({ page = 1, category = "" } = {}) => {
    const qs = new URLSearchParams({ page: String(page) });
    if (category) qs.set("category", category);
    return request(`/api/posts?${qs}`);
  },
  getPost: (id) => request(`/api/posts/${id}`),
  createPost: (body) => request("/api/posts", { method: "POST", body }),
  updatePost: (id, body) => request(`/api/posts/${id}`, { method: "PATCH", body }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: "DELETE" }),
};

export { ApiError };
