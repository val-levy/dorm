// Supabase Edge Function: on_auth_signup
// Triggered when a new user signs up via Supabase Auth
// Creates user profile + auto-assigns chapter based on email domain

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const event = await req.json();
    const { user } = event.record;

    console.log(`Auth signup webhook: ${user.email}`);

    // Extract email domain
    const [, domain] = user.email.split('@');

    // Find chapter by email domain
    const { data: chapterDomain } = await supabase
      .from('chapter_domains')
      .select('chapter_id, chapters(id, name)')
      .eq('email_domain', domain)
      .single();

    const chapterId = chapterDomain?.chapter_id;

    // Create user profile
    const { error: userError } = await supabase
      .from('users')
      .insert({
        email: user.email,
        chapter_id: chapterId,
      });

    if (userError) {
      console.error('User profile creation error:', userError);
      // Don't throw; user is created, just no profile yet
    }

    // Assign MEMBER role to new user
    if (chapterId) {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userData) {
        await supabase
          .from('user_roles')
          .insert({
            user_id: userData.id,
            chapter_id: chapterId,
            role: 'MEMBER',
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User profile created',
        chapter: chapterDomain?.chapters?.name || 'Unknown',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};
