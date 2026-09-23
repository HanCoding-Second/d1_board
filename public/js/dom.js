// DOM 생성 헬퍼.
//
// innerHTML 대신 이 함수로만 화면을 만든다. 사용자가 쓴 제목·본문·닉네임을
// innerHTML 에 넣으면 <script> 가 그대로 실행되므로(XSS), 문자열은 전부
// textContent 로 들어가게 강제한다.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "html") throw new Error("html 속성은 허용하지 않습니다.");
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** 자식을 모두 비우고 새 내용으로 교체한다. */
export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.flat().filter(Boolean));
}

/** DB의 'YYYY-MM-DD HH:MM:SS'(UTC)를 로컬 시간 기준 상대 표기로 바꾼다. */
export function timeAgo(sqlTime) {
  const t = new Date(sqlTime.replace(" ", "T") + "Z");
  const diff = (Date.now() - t.getTime()) / 1000;

  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;

  return t.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function fullTime(sqlTime) {
  const t = new Date(sqlTime.replace(" ", "T") + "Z");
  return t.toLocaleString("ko-KR");
}
