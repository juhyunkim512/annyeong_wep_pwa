-- ============================================================
-- ANNYEONG 인덱스 최적화 (Phase 1-1)
-- Supabase SQL Editor에서 실행
-- ============================================================
-- 실행 전 참고:
--   • IF NOT EXISTS 사용으로 중복 실행해도 안전합니다
--   • CONCURRENTLY 옵션으로 테이블 락 없이 생성합니다
--   • 운영 중에도 안전하게 실행할 수 있습니다
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. post (커뮤니티 게시글)
-- ─────────────────────────────────────────────

-- 최신글 목록 (community, home 에서 가장 자주 사용)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_created_at_desc
  ON post (created_at DESC);

-- 카테고리별 최신글
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_category_created
  ON post (category, created_at DESC);

-- 트렌딩 (like_count >= 1, 최근 N일 필터)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_like_count_created
  ON post (like_count DESC, created_at DESC);

-- 내 글 조회 (my-page/posts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_author_id
  ON post (author_id);

-- ─────────────────────────────────────────────
-- 2. comment (댓글)
-- ─────────────────────────────────────────────

-- 게시글별 댓글 목록 (가장 빈번한 쿼리)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_post_id_created
  ON comment (post_id, created_at ASC);

-- 댓글 작성자 (RLS / 삭제 권한 확인)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_author_id
  ON comment (author_id);

-- ─────────────────────────────────────────────
-- 3. post_like (좋아요)
-- ─────────────────────────────────────────────

-- "내가 이 글 좋아요 눌렀나?" 확인 (가장 빈번)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_post_like_user_post
  ON post_like (user_id, post_id);

-- 내가 좋아요한 글 목록 (my-page/liked)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_like_user_id
  ON post_like (user_id);

-- ─────────────────────────────────────────────
-- 4. comment_like (댓글 좋아요)
-- ─────────────────────────────────────────────

-- "내가 이 댓글 좋아요 눌렀나?" 확인
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_like_user_comment
  ON comment_like (user_id, comment_id);

-- ─────────────────────────────────────────────
-- 5. user_follow (팔로우)
-- ─────────────────────────────────────────────

-- 내가 팔로우하는 사람 목록 + 특정 관계 확인
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_follow_follower_following
  ON user_follow (follower_id, following_id);

-- 나를 팔로우하는 사람 목록
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_follow_following_follower
  ON user_follow (following_id, follower_id);

-- 팔로잉 목록 최신순 정렬
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_follow_follower_created
  ON user_follow (follower_id, created_at DESC);

-- ─────────────────────────────────────────────
-- 6. user_block (차단)
-- ─────────────────────────────────────────────

-- 차단 관계 확인 (chat, profile modal)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_block_blocker_blocked
  ON user_block (blocker_id, blocked_id);

-- 내 차단 목록
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_block_blocker_created
  ON user_block (blocker_id, created_at DESC);

-- ─────────────────────────────────────────────
-- 7. chat_room (채팅방)
-- ─────────────────────────────────────────────

-- 내 채팅방 목록 (user_a 또는 user_b로 참여)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_user_a
  ON chat_room (user_a, last_message_at DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_room_user_b
  ON chat_room (user_b, last_message_at DESC NULLS LAST);

-- ─────────────────────────────────────────────
-- 8. chat_message (채팅 메시지)
-- ─────────────────────────────────────────────

-- 채팅방 메시지 목록 (가장 핵심)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_message_room_created
  ON chat_message (room_id, created_at ASC);

-- optimistic UI dedupe용 (client_message_id가 있는 경우만)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_message_client_msg_id
  ON chat_message (client_message_id)
  WHERE client_message_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 9. content_translation_cache (번역 캐시)
-- ─────────────────────────────────────────────

-- 5-column 복합 조회 (getOrTranslate 핵심 쿼리)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_translation_cache_lookup
  ON content_translation_cache (content_type, content_id, field_name, target_language, source_text_hash);

-- ─────────────────────────────────────────────
-- 10. push_subscription (웹 푸시)
-- ─────────────────────────────────────────────

-- 유저별 구독 목록
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_subscription_user_id
  ON push_subscription (user_id);

-- ─────────────────────────────────────────────
-- 12. signup_email_verification (이메일 인증)
-- ─────────────────────────────────────────────

-- 이메일로 최신 인증 요청 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_verification_email_created
  ON signup_email_verification (email, created_at DESC);

-- ─────────────────────────────────────────────
-- 13. profile (프로필)
-- ─────────────────────────────────────────────

-- 닉네임 검색 (check-nickname, find-id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_nickname
  ON profile (nickname);
