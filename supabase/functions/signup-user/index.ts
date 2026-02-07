import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student';
  student_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: SignupRequest = await req.json();
    
    console.log('Signup request received:', { email: body.email, role: body.role });

    // Validate required fields
    if (!body.email || !body.password || !body.full_name || !body.role) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Missing required fields: email, password, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password length
    if (body.password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    if (!['admin', 'teacher', 'student'].includes(body.role)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Invalid role. Must be admin, teacher, or student' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate student_id for students
    if (body.role === 'student' && !body.student_id) {
      return new Response(
        JSON.stringify({ error: 'Bad Request', message: 'Student ID is required for student accounts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BOOTSTRAP LOGIC: Check if admin signup is allowed
    if (body.role === 'admin') {
      const { count, error: countError } = await adminClient
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (countError) {
        console.error('Error checking admin count:', countError);
        return new Response(
          JSON.stringify({ error: 'Internal Server Error', message: 'Failed to verify admin eligibility' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only allow first admin via public signup
      if (count && count > 0) {
        console.log('Admin already exists, blocking public admin signup');
        return new Response(
          JSON.stringify({ 
            error: 'Forbidden', 
            message: 'An admin account already exists. New admin accounts must be created by an existing admin.' 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('No admin exists, allowing first admin signup');
    }

    // Create the auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirm for demo stability
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
        student_id: body.student_id
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      
      if (authError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Conflict', message: 'A user with this email already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: 'User creation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('Auth user created:', userId);

    // Create profile using service role (bypasses RLS)
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: userId,
        email: body.email,
        full_name: body.full_name,
        student_id: body.role === 'student' ? body.student_id : null
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Rollback: delete the auth user
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: 'Failed to create user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile created for:', userId);

    // Create user role
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({
        user_id: userId,
        role: body.role
      });

    if (roleError) {
      console.error('Error creating role:', roleError);
      // Rollback: delete profile and auth user
      await adminClient.from('profiles').delete().eq('id', userId);
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: 'Failed to assign user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User created successfully: ${body.email} with role ${body.role}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: body.role === 'admin' 
          ? 'Admin account created successfully! You can now sign in.'
          : 'Account created successfully! You can now sign in.',
        user: {
          id: userId,
          email: body.email,
          full_name: body.full_name,
          role: body.role
        }
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', message: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
