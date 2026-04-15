import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const admin = createAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const subscription = await req.json();
    const { endpoint, keys } = subscription ?? {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { success: false, message: "Invalid subscription payload" },
        { status: 400 }
      );
    }

    // 기존 구독이 있으면 upsert (endpoint 변경에도 대응)
    await admin.from("push_subscription").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
