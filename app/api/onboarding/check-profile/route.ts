import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ hasProfile: false, authenticated: false })
  }

  const { data: profile } = await supabase
    .from('profile')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({ hasProfile: !!profile, authenticated: true, userId: user.id })
}
