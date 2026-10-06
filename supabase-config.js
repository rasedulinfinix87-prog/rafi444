// supabase-config.js
const SUPABASE_URL = "https://gccxrpvmokaqotywrtgx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY3hycHZtb2thcW90eXdydGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTU5MDQsImV4cCI6MjEwNjgzMTkwNH0.QEaExOgv5dIX42KqCjdG258amvR0rXTYYjFs4-yxmaI";

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth Helper Functions
async function getCurrentUser() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "../login-signup.html";
  }
  return user;
}

async function getUserProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  return data;
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.href = "../login-signup.html";
}
