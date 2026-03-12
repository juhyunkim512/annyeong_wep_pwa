import { NextResponse } from "next/server";
import { createAdminClient, deleteUser } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const {
      email,
      password,
      nickname,
      flag,
      uselanguage,
      purpose,
      current_status,
    } = await req.json();

    if (
      !email ||
      !password ||
      !nickname ||
      !flag ||
      !uselanguage ||
      !purpose ||
      !current_status
    ) {
      return NextResponse.json(
        { success: false, message: "All fields are required." },
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

    // 이메일 중복 확인
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();

    if (usersError) {
      return NextResponse.json(
        { success: false, message: usersError.message },
        { status: 500 }
      );
    }

    const emailExists = usersData.users.some((user) => user.email === email);
    if (emailExists) {
      return NextResponse.json(
        { success: false, message: "This email is already in use." },
        { status: 400 }
      );
    }

    // 닉네임 중복 확인
    const { data: nicknameData, error: nicknameError } = await admin
      .from("profile")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();

    if (nicknameError) {
      return NextResponse.json(
        { success: false, message: nicknameError.message },
        { status: 500 }
      );
    }

    if (nicknameData) {
      return NextResponse.json(
        { success: false, message: "This nickname is already taken." },
        { status: 400 }
      );
    }

    // auth 유저 생성
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          message: authError?.message || "Failed to create user.",
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // profile 생성
    const { error: profileError } = await admin.from("profile").insert({
      id: userId,
      nickname,
      flag,
      uselanguage,
      purpose,
      current_status,
    });

    if (profileError) {
      // auth는 생성됐는데 profile 실패하면 auth user 삭제
      await deleteUser(userId);

      return NextResponse.json(
        { success: false, message: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sign up completed successfully.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request." },
      { status: 400 }
    );
  }
}