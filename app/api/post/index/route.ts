/**
 * POST /api/post/index
 *
 * 게시글 생성/수정 후 클라이언트에서 호출.
 * post_search_index 테이블을 6개 언어로 rebuild한다.
 *
 * Auth: Authorization: Bearer <access_token>
 * Body: { postId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSearchIndex } from '@/lib/server/buildSearchIndex';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const admin = createAdminClient();

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ error: 'postId required' }, { status: 400 });
    }

    // Fetch post — verify author
    const { data: post, error: postErr } = await admin
      .from('post')
      .select('id, title, content, language, author_id')
      .eq('id', postId)
      .maybeSingle();

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build search index for all 6 languages
    await buildSearchIndex(post.id, post.title, post.language);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/post/index]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
