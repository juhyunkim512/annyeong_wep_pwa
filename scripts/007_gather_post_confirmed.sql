-- gather_post 테이블에 확정 상태 컬럼 추가
-- confirmed가 모임 확정 여부의 단일 기준이 된다

ALTER TABLE gather_post
  ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_chat_room_id uuid REFERENCES gather_chat_room(id);

-- 기존 데이터 백필: chat_room_id가 있는 글은 이미 확정된 것으로 간주
UPDATE gather_post
SET
  confirmed = true,
  confirmed_at = COALESCE(updated_at, created_at),
  confirmed_chat_room_id = chat_room_id
WHERE chat_room_id IS NOT NULL;

-- confirmed = true인 글에 대한 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_gather_post_confirmed ON gather_post (confirmed);
