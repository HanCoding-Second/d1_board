-- 영화 커뮤니티 스키마 (2단계)
-- 적용: npm run db:init:local
--
-- 삭제 정책: 소프트 삭제(deleted_at). 조회 시 항상 `WHERE deleted_at IS NULL` 을 건다.
-- 날짜: SQLite 에 DATETIME 타입이 없으므로 TEXT(UTC, 'YYYY-MM-DD HH:MM:SS')로 통일한다.

PRAGMA foreign_keys = ON;

-- 자식 테이블부터 지워야 외래키 제약에 걸리지 않는다.
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS health_check;  -- 1단계 검증용 테이블 제거


-- ────────────────────────────────────────────────
-- users : 계정
-- ────────────────────────────────────────────────
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,          -- PBKDF2 결과. 형식: pbkdf2$<반복수>$<salt>$<hash>
  nickname      TEXT    NOT NULL UNIQUE,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);
-- email, nickname 은 UNIQUE 제약이 인덱스를 자동 생성하므로 따로 만들지 않는다.


-- ────────────────────────────────────────────────
-- sessions : 로그인 세션 (3단계에서 사용)
-- id 에 예측 불가능한 랜덤 토큰을 넣고 쿠키로 내려준다.
-- ────────────────────────────────────────────────
CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);


-- ────────────────────────────────────────────────
-- posts : 게시글
-- ────────────────────────────────────────────────
CREATE TABLE posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT    NOT NULL DEFAULT '자유'
                      CHECK (category IN ('자유', '리뷰', '추천')),
  movie_title TEXT,                        -- 6단계에서 movies 테이블로 이전 예정
  title       TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  content     TEXT    NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  view_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

-- 목록 페이지(최신순)용. 삭제된 글은 애초에 인덱스에 넣지 않는 부분 인덱스.
CREATE INDEX idx_posts_created  ON posts(created_at DESC) WHERE deleted_at IS NULL;
-- 카테고리별 목록용
CREATE INDEX idx_posts_category ON posts(category, created_at DESC) WHERE deleted_at IS NULL;
-- 내가 쓴 글 조회용
CREATE INDEX idx_posts_user     ON posts(user_id, created_at DESC);


-- ────────────────────────────────────────────────
-- comments : 댓글
-- ────────────────────────────────────────────────
CREATE TABLE comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT    NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- 글 상세에서 댓글을 오래된 순으로 뽑을 때 쓴다.
CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_comments_user ON comments(user_id);


-- ────────────────────────────────────────────────
-- likes : 좋아요
-- (post_id, user_id) UNIQUE 로 한 사람이 같은 글에 두 번 누르는 것을 DB 차원에서 막는다.
-- ────────────────────────────────────────────────
CREATE TABLE likes (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

-- PK 가 (post_id, user_id) 라 글별 집계는 커버되고, 사용자 기준 조회만 따로 만든다.
CREATE INDEX idx_likes_user ON likes(user_id, created_at DESC);
