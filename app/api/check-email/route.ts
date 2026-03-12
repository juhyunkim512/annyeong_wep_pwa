import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { available: false, message: "Email is required." },
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

    const exists = data.users.some((user) => user.email === email);

    return NextResponse.json({
      available: !exists,
      message: exists
        ? "This email is already in use."
        : "Email is available.",
    });
  } catch {
    return NextResponse.json(
      { available: false, message: "Invalid request." },
      { status: 400 }
    );
  }
}