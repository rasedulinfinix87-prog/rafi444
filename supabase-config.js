// supabase-config.js

const SUPABASE_URL = "https://gccxrpvmokaqotywrtgx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY3hycHZtb2thcW90eXdydGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTU5MDQsImV4cCI6MjEwNjgzMTkwNH0.QEaExOgv5dIX42KqCjdG258amvR0rXTYYjFs4-yxmaI";

// Initialize Supabase Client safely
let supabaseClient;
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
} else {
  console.error("Supabase CDN library not loaded properly!");
}

// Get User From Local Storage
function getStoredCurrentUser() {
  try {
    const stored = localStorage.getItem("current_user");

    if (!stored) return null;

    const parsed = JSON.parse(stored);

    if (typeof parsed === "string") {
      return { id: parsed };
    }

    if (parsed && (parsed.id || parsed.user_id || parsed.uid)) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error("Error reading stored user:", error);
    return null;
  }
}

// Auth Helper Functions
async function getCurrentUser() {
  try {
    // First check the actual Supabase login session
    const { data, error } = await supabaseClient.auth.getSession();

    if (!error && data && data.session && data.session.user) {
      return data.session.user;
    }

    // Fallback for projects that also store the logged-in user locally
    const storedUser = getStoredCurrentUser();

    if (storedUser) {
      return storedUser;
    }

    return null;
  } catch (error) {
    console.error("Error checking login session:", error);

    // Fallback to the locally stored user
    return getStoredCurrentUser();
  }
}

// Get Login Page URL
function getLoginPageUrl() {
  const path = window.location.pathname;

  // Pages inside the game folder
  if (path.includes("/game/")) {
    return "../login-signup.html";
  }

  // Pages at the website root
  return "login-signup.html";
}

// Require Authentication
async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = getLoginPageUrl();
    return null;
  }

  return user;
}

// Get User Profile
async function getUserProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

// Logout User
async function logoutUser() {
  try {
    await supabaseClient.auth.signOut();
  } catch (error) {
    console.error("Error signing out:", error);
  }

  localStorage.removeItem("current_user");

  window.location.href = getLoginPageUrl();
}
