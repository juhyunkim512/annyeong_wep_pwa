import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { available: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { available: false, message: "Invalid email format." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json(
        { available: false, message: error.message },
        { status: 500 }
      );
    }

    // email_confirmed_at이 있는 유저만 "이미 등록됨"으로 판단
    // OTP 발송 후 가입 미완료 시 생성된 미인증 유저는 재시도 가능하도록 허용
    const exists = data.users.some(
      (user) => user.email === email && !!user.email_confirmed_at
    );

    return NextResponse.json({
      available: !exists,
      message: exists
        ? "This email is already registered."
        : "Email is available.",
    });
  } catch {
    return NextResponse.json(
      { available: false, message: "Invalid request." },
      { status: 400 }
    );
  }
}
