import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// country 값 → 기본 UI 언어 매핑
function getDefaultLanguageFromCountry(country: string): string {
  const map: Record<string, string> = {
    korea: "korean",
    japan: "japanese",
    china: "chinese",
    vietnam: "vietnamese",
    spain: "spanish",
    mexico: "spanish",
  };
  return map[country] ?? "english";
}

export async function POST(req: Request) {
  try {
    const { email, password, nickname, flag, purpose, current_status, gender } =
      await req.json();

    if (!email || !password || !nickname || !flag || !purpose || !current_status) {
      return NextResponse.json(
        { success: false, message: "All fields are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format." },
        { status: 400 }
      );
    }

    const nicknameRegex = /^[a-z0-9_]{3,15}$/;
    if (!nicknameRegex.test(nickname)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Nickname must be 3-15 characters using lowercase letters, numbers, or _ only.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // signup_email_verification 테이블에서 이메일 인증 완료 여부 확인
    const { data: verificationRows, error: verifyFetchError } = await admin
      .from("signup_email_verification")
      .select("id")
      .eq("email", email)
      .eq("is_verified", true)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (verifyFetchError || !verificationRows || verificationRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email not verified. Please verify your email first.",
        },
        { status: 403 }
      );
    }

    // auth 중복 확인 (email_confirmed_at 있는 유저만)
    const { data: listData } = await admin.auth.admin.listUsers();
    const alreadyExists = (listData?.users ?? []).some(
      (u) => u.email === email && !!u.email_confirmed_at
    );
    if (alreadyExists) {
      return NextResponse.json(
        { success: false, message: "This email is already registered." },
        { status: 409 }
      );
    }

    // 닉네임 중복 확인
    const { data: existingNickname } = await admin
      .from("profile")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();

    if (existingNickname) {
      return NextResponse.json(
        { success: false, message: "This nickname is already taken." },
        { status: 400 }
      );
    }

    // auth user 생성 (이 시점에서만 생성)
    const { data: newUser, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !newUser.user) {
      console.error("[signup] createUser error:", createError);
      return NextResponse.json(
        {
          success: false,
          message: createError?.message ?? "Failed to create account.",
        },
        { status: 500 }
      );
    }

    const uselanguage = getDefaultLanguageFromCountry(flag);

    // profile 생성
    const { error: profileError } = await admin.from("profile").insert({
      id: newUser.user.id,
      nickname,
      flag,
      uselanguage,
      purpose,
      current_status,
      ...(gender ? { gender } : {}),
    });

    if (profileError) {
      // 롤백: profile 실패 시 생성된 auth user 삭제
      await admin.auth.admin.deleteUser(newUser.user.id);
      console.error("[signup] profile insert error:", profileError);
      return NextResponse.json(
        { success: false, message: profileError.message },
        { status: 500 }
      );
    }

    // 인증 row 정리
    await admin
      .from("signup_email_verification")
      .delete()
      .eq("email", email);

    return NextResponse.json({
      success: true,
      message: "Sign up completed successfully.",
    });
  } catch (err) {
    console.error("[signup] error:", err);
    return NextResponse.json(
      { success: false, message: "Invalid request." },
      { status: 400 }
    );
  }
}