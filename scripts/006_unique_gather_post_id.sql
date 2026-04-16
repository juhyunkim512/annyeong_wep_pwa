-- gather_chat_room 테이블에 gather_post_id에 대한 유니크 제약 추가
-- 모임 확정이 중복 생성되는 Race Condition 방지

ALTER TABLE gather_chat_room
ADD CONSTRAINT gather_chat_room_gather_post_id_unique UNIQUE (gather_post_id);
