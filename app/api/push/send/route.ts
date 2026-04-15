import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
}

export async function POST(req: Request) {
  try {
    ensureVapid();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const admin = createAdminClient();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const { targetUserId, title, body, url } = await req.json();

    // 자기 자신에게는 보내지 않음
    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ success: true });
    }

    // 수신자 구독 정보 조회
    const { data: subs } = await admin
      .from("push_subscription")
      .select("endpoint, p256dh, auth")
      .eq("user_id", targetUserId);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true });
    }

    const payload = JSON.stringify({ title, body, url });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          .catch(async (err: unknown) => {
            // 410 Gone = 구독 만료 → DB에서 삭제
            if ((err as { statusCode?: number })?.statusCode === 410) {
              await admin.from("push_subscription").delete().eq("endpoint", sub.endpoint);
            }
          })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
