(async function () {
  'use strict';

  const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
  if (!client) {
    console.error('Supabase client not initialized.');
    window.location.href = '../index.html';
    return;
  }

  try {
    // ১. বর্তমান লগইন করা ইউজারের সেশন চেক করা
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    
    if (sessionError || !session || !session.user) {
      window.location.href = '../index.html';
      return;
    }

    const userId = session.user.id;

    // ২. profiles টেবিল থেকে ইউজারের role চেক করা
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      alert('Unauthorized access! Admins only.');
      window.location.href = '../index.html';
      return;
    }

  } catch (err) {
    console.error('Auth guard error:', err);
    window.location.href = '../index.html';
  }
})();
