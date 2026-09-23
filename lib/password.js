// PBKDF2-SHA256 비밀번호 해싱 (Web Crypto만 사용, 외부 의존성 없음)
//
// 저장 형식:  pbkdf2$<반복수>$<salt-hex>$<hash-hex>
// 반복수를 해시 안에 함께 저장하므로, 나중에 ITERATIONS 를 올려도
// 기존 계정의 로그인은 그대로 동작한다.

export const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const HASH = "SHA-256";

const enc = new TextEncoder();

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex) => {
  const pairs = hex.match(/.{2}/g);
  if (!pairs || pairs.length * 2 !== hex.length) return null;
  return new Uint8Array(pairs.map((h) => parseInt(h, 16)));
};

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: HASH },
    key,
    KEY_BYTES * 8
  );
  return toHex(bits);
}

export async function hashPassword(password, iterations = ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${toHex(salt)}$${hash}`;
}

/** 길이가 같은 문자열을 상수 시간으로 비교한다(타이밍 공격 완화). */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) {
    return false;
  }

  const salt = fromHex(parts[2]);
  if (!salt) return false;

  const actual = await derive(password, salt, iterations);
  return safeEqual(actual, parts[3]);
}
