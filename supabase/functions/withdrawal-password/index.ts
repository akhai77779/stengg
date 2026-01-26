import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashSync, compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  "https://stengg.it.com",
  "https://www.stengg.it.com",
  "https://stengg-it-com.lovable.app",
  "https://id-preview--f9a00261-b7fb-4428-ad85-88f8d5788c27.lovable.app",
  "https://f9a00261-b7fb-4428-ad85-88f8d5788c27.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin for non-preflight requests
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.error(`Unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth client to verify JWT
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT and get user
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Invalid JWT or user not found:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Create service role client for database operations (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Processing withdrawal password request for user: ${userId}`);

    // Parse request body
    const { action, currentPassword, newPassword, targetUserId } = await req.json();

    if (action === 'create') {
      // Create new withdrawal password (no current password needed)
      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already has a password
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('withdrawal_password_hash')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile?.withdrawal_password_hash) {
        return new Response(
          JSON.stringify({ error: 'Withdrawal password already exists. Use change action instead.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash password with bcrypt (includes automatic salt) - using sync version for Edge Functions
      const hashedPassword = hashSync(newPassword);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ withdrawal_password_hash: hashedPassword })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to create password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Withdrawal password created for user: ${userId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Withdrawal password created' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'change') {
      // Change existing withdrawal password (requires current password verification)
      if (!currentPassword) {
        return new Response(
          JSON.stringify({ error: 'Current password is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'New password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch current password hash
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('withdrawal_password_hash')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profile?.withdrawal_password_hash) {
        return new Response(
          JSON.stringify({ error: 'No withdrawal password set. Use create action instead.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify current password with bcrypt compare - using sync version for Edge Functions
      const isCurrentValid = compareSync(currentPassword, profile.withdrawal_password_hash);
      if (!isCurrentValid) {
        console.log(`Invalid current password attempt for user: ${userId}`);
        return new Response(
          JSON.stringify({ error: 'Current password is incorrect' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash new password with bcrypt - using sync version for Edge Functions
      const newHash = hashSync(newPassword);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ withdrawal_password_hash: newHash })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Withdrawal password changed for user: ${userId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Withdrawal password changed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'verify') {
      // Verify withdrawal password (for use during withdrawal)
      if (!currentPassword) {
        return new Response(
          JSON.stringify({ error: 'Password is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch current password hash
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('withdrawal_password_hash')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!profile?.withdrawal_password_hash) {
        return new Response(
          JSON.stringify({ error: 'No withdrawal password set' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify password with bcrypt compare - using sync version for Edge Functions
      const isValid = compareSync(currentPassword, profile.withdrawal_password_hash);

      console.log(`Withdrawal password verification for user ${userId}: ${isValid ? 'success' : 'failed'}`);
      return new Response(
        JSON.stringify({ success: true, valid: isValid }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'admin-reset') {
      // Admin reset withdrawal password (requires admin role)
      
      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'New password must be at least 6 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'Target user ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if current user is admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      if (roleError || !roleData) {
        console.error('Admin check failed:', roleError);
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash new password with bcrypt
      const newHash = hashSync(newPassword);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ withdrawal_password_hash: newHash })
        .eq('id', targetUserId);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the action in audit_logs
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'admin_withdrawal_password_reset',
        entity_type: 'user',
        entity_id: targetUserId,
        details: { changed_by: user.email },
      });

      console.log(`Admin ${userId} reset withdrawal password for user: ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Withdrawal password reset by admin' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: create, change, verify, or admin-reset' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
