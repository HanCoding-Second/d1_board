-- 개발용 더미 데이터. 운영 DB에는 넣지 않는다.
-- 적용: npm run db:seed:local
--
-- 시드 계정 비밀번호는 모두 test1234 (PBKDF2 100,000회, lib/password.js 와 동일 형식)

DELETE FROM likes;
DELETE FROM comments;
DELETE FROM sessions;
DELETE FROM posts;
DELETE FROM users;

INSERT INTO users (id, email, password_hash, nickname) VALUES
  (1, 'kim@example.com',  'pbkdf2$100000$fa4cf88c9e49cc13ca9d9480fc2177b3$f6043ffa8ebb24482a967bbfdfb3839dfc8e7a3e0b918ce45a0b3204d47eac18', '영화광김씨'),
  (2, 'lee@example.com',  'pbkdf2$100000$6c22c5dc886764b60aaa83b7c9071975$5b52627b0e7e3daf9a56f46d324b9226ef3ee0a2692be90026c0ac2fa670702e', '심야극장'),
  (3, 'park@example.com', 'pbkdf2$100000$d2cd2f58927801348ac4971d72b83783$df0b4b2d4f24476436d8841bd5087b080e6afecf4c608865f3ecca3fccdb4f89', '팝콘없인못봄');

INSERT INTO posts (id, user_id, category, movie_title, title, content) VALUES
  (1, 1, '리뷰', '기생충',        '기생충 다시 보니 계단이 전부더라',
      '처음 볼 땐 몰랐는데 인물이 오르내리는 계단 방향이 계급을 그대로 보여줍니다. 반지하에서 올라갈 때와 내려올 때의 카메라 높이가 다릅니다.'),
  (2, 2, '추천', '드라이브 마이 카', '조용한 영화 보고 싶을 때 추천',
      '3시간이 길게 느껴지지 않았습니다. 대사보다 침묵이 더 많은 말을 합니다.'),
  (3, 1, '자유', NULL,             '요즘 극장 관람료 어떻게들 하시나요',
      '통신사 할인이 줄어서 조조 아니면 잘 안 가게 되네요. 다들 어떻게 보시는지 궁금합니다.'),
  (4, 3, '리뷰', '듄: 파트 2',     '아이맥스로 봐야 하는 이유',
      '사운드 설계가 절반입니다. 일반관에서 한 번 더 봤는데 체감이 완전히 달랐습니다.'),
  (5, 2, '추천', '패스트 라이브즈', '올해 본 것 중 가장 오래 남는 영화',
      '크게 사건이 벌어지지 않는데도 마지막 장면에서 한참 못 일어났습니다.');

INSERT INTO comments (post_id, user_id, content) VALUES
  (1, 2, '계단 얘기 공감합니다. 비 오는 날 내려가는 장면이 특히 그렇더군요.'),
  (1, 3, '이 글 보고 다시 봐야겠네요.'),
  (2, 1, '저장해두고 주말에 보겠습니다.'),
  (4, 1, '아이맥스 예매하러 갑니다.'),
  (4, 2, '일반관과 그렇게 차이가 큰가요?'),
  (5, 3, '마지막 장면 진짜 오래 남습니다.');

INSERT INTO likes (post_id, user_id) VALUES
  (1, 2), (1, 3),
  (2, 1),
  (4, 1), (4, 2),
  (5, 1), (5, 3);
