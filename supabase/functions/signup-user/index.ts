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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    // Check if any admin exists in the system
    const { count: adminCount, error: adminCountError } = await adminClient
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (adminCountError) {
      console.error('Error checking admin count:', adminCountError);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', message: 'Failed to verify system state' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasAdminInSystem = (adminCount ?? 0) > 0;

    // BOOTSTRAP LOGIC: Allow first admin signup without authentication
    if (body.role === 'admin') {
      if (hasAdminInSystem) {
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

    // SECURITY: After bootstrap, require admin authentication for ALL signups
    if (hasAdminInSystem) {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No auth token provided for signup after bootstrap');
        return new Response(
          JSON.stringify({ 
            error: 'Unauthorized', 
            message: 'Authentication required. Only administrators can create new accounts.' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the requesting user's token and admin status
      const token = authHeader.replace('Bearer ', '');
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
      
      if (claimsError || !claimsData?.user) {
        console.error('Invalid auth token:', claimsError);
        return new Response(
          JSON.stringify({ error: 'Unauthorized', message: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if the requesting user is an admin
      const { data: requestingUserRole, error: roleError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', claimsData.user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error checking requesting user role:', roleError);
        return new Response(
          JSON.stringify({ error: 'Internal Server Error', message: 'Failed to verify permissions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (requestingUserRole?.role !== 'admin') {
        console.log('Non-admin user attempted to create account:', claimsData.user.id);
        return new Response(
          JSON.stringify({ 
            error: 'Forbidden', 
            message: 'Only administrators can create new accounts.' 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Admin user verified, proceeding with account creation');
    }

    // Check if user already exists in auth (handles orphaned users from failed signups)
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === body.email);
    
    let userId: string;
    
    if (existingUser) {
      console.log('Found existing auth user:', existingUser.id);
      
      // Check if this user already has a complete profile and role
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', existingUser.id)
        .maybeSingle();
      
      const { data: existingRole } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', existingUser.id)
        .maybeSingle();
      
      if (existingProfile && existingRole) {
        // User is fully set up, return conflict
        return new Response(
          JSON.stringify({ error: 'Conflict', message: 'A user with this email already exists. Please sign in instead.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // User exists in auth but is incomplete - we'll complete their setup
      console.log('Completing setup for orphaned auth user');
      userId = existingUser.id;
      
      // Update password if needed
      await adminClient.auth.admin.updateUserById(userId, {
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.full_name,
          role: body.role,
          student_id: body.student_id
        }
      });
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.full_name,
          role: body.role,
          student_id: body.student_id
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
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

      userId = authData.user.id;
      console.log('Auth user created:', userId);
    }

    // Create profile if it doesn't exist
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
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
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Internal Server Error', message: 'Failed to create user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Profile created for:', userId);
    } else {
      console.log('Profile already exists for:', userId);
    }

    // Create user role if it doesn't exist
    const { data: existingRole } = await adminClient
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await adminClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: body.role
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
        await adminClient.from('profiles').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Internal Server Error', message: 'Failed to assign user role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Role assigned:', body.role);
    } else {
      console.log('Role already exists for:', userId);
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
