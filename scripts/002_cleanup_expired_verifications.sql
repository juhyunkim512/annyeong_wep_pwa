-- ============================================================
-- ANNYEONG Phase 3-2: 만료된 이메일 인증 row 자동 정리
-- Supabase SQL Editor에서 실행
-- ============================================================
-- Supabase는 pg_cron 확장이 기본 활성화되어 있습니다.
-- 아래 SQL은 매일 새벽 3시(UTC)에 24시간 지난 row를 삭제합니다.
-- ============================================================

-- 1. pg_cron 확장 활성화 (이미 있으면 무시)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 기존 동일 이름 job이 있으면 삭제 (재실행 안전)
SELECT cron.unschedule('cleanup_expired_verifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_verifications'
);

-- 3. cron job 등록: 매일 UTC 03:00 실행
SELECT cron.schedule(
  'cleanup_expired_verifications',       -- job 이름
  '0 3 * * *',                           -- 매일 03:00 UTC (한국 12:00 정오)
  $$
    DELETE FROM public.signup_email_verification
    WHERE expires_at < now() - interval '24 hours';
  $$
);

-- 4. (선택) 지금 즉시 한 번 정리하고 싶으면 아래 실행
-- DELETE FROM public.signup_email_verification
-- WHERE expires_at < now() - interval '24 hours';
