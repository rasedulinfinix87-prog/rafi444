(async function () {
  'use strict';

  // ১. সুপাবেজ ক্লায়েন্ট ও কনফিগ চেক
  const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
  if (!client) {
    console.error('Supabase client not initialized.');
    window.location.href = '../index.html';
    return;
  }

  try {
    // ২. supabase-config.js এর বিল্ট-ইন getCurrentUser() ফাংশন ব্যবহার করে ইউজার বের করা
    let user = null;
    if (typeof getCurrentUser === 'function') {
      user = await getCurrentUser();
    }

    // যদি ইউজার না পাওয়া যায়, সরাসরি সুপাবেজ সেশন চেক করা
    if (!user) {
      const { data: { session } } = await client.auth.getSession();
      if (session && session.user) {
        user = session.user;
      }
    }

    if (!user || !user.id) {
      window.location.href = '../index.html';
      return;
    }

    const userId = user.id;

    // ৩. profiles টেবিল থেকে ইউজারের role চেক করা
    let profile = null;
    if (typeof getUserProfile === 'function') {
      profile = await getUserProfile(userId);
    } else {
      const { data } = await client
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      profile = data;
    }

    // ৪. রোল অ্যাডমিন কি না যাচাই করা (ছোট হাতের অক্ষরে 'admin' চেক করবে)
    if (!profile || String(profile.role || '').trim().toLowerCase() !== 'admin') {
      alert('Unauthorized access! Admins only.');
      window.location.href = '../index.html';
      return;
    }

  } catch (err) {
    console.error('Auth guard error:', err);
    window.location.href = '../index.html';
  }
})();
