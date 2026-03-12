import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Admin operations for server-side only
export async function deleteUser(userId: string) {
  const admin = createAdminClient()
  return admin.auth.admin.deleteUser(userId)
}

export async function getUserById(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  return { data, error }
}

export async function listUsers() {
  const admin = createAdminClient();
  return admin.auth.admin.listUsers();
}

export async function createAuthUser(email: string, password: string) {
  const admin = createAdminClient();
  return admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
}

export async function insertProfile(profile: {
  id: string;
  nickname: string;
  flag: string;
  uselanguage: string;
  purpose: string;
  current_status: string;
}) {
  const admin = createAdminClient();
  return admin.from("profile").insert(profile);
}

export async function findProfileByNickname(nickname: string) {
  const admin = createAdminClient();
  return admin
    .from("profile")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
}