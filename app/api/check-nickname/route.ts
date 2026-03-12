import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { nickname } = await req.json();

    if (!nickname) {
      return NextResponse.json(
        { available: false, message: "Nickname is required." },
        { status: 400 }
      );
    }

    const nicknameRegex = /^[a-z0-9_]{3,15}$/;

    if (!nicknameRegex.test(nickname)) {
      return NextResponse.json(
        {
          available: false,
          message:
            "Nickname must be 3-15 characters using lowercase letters, numbers, or _ only.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profile")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { available: false, message: error.message },
        { status: 500 }
      );
    }

    const exists = !!data;

    return NextResponse.json({
      available: !exists,
      message: exists
        ? "This nickname is already taken."
        : "Nickname is available.",
    });
  } catch {
    return NextResponse.json(
      { available: false, message: "Invalid request." },
      { status: 400 }
    );
  }
}