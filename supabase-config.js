// supabase-config.js

const SUPABASE_URL = "https://gccxrpvmokaqotywrtgx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY3hycHZtb2thcW90eXdydGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTU5MDQsImV4cCI6MjEwNjgzMTkwNH0.QEaExOgv5dIX42KqCjdG258amvR0rXTYYjFs4-yxmaI";

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(
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
    const { data, error } = await supabaseClient.auth.getSession();

    if (!error && data && data.session && data.session.user) {
      return data.session.user;
    }

    const storedUser = getStoredCurrentUser();

    if (storedUser) {
      return storedUser;
    }

    return null;
  } catch (error) {
    console.error("Error checking login session:", error);
    return getStoredCurrentUser();
  }
}

// Get Login Page URL
function getLoginPageUrl() {
  const path = window.location.pathname;

  if (path.includes("/game/")) {
    return "../login-signup.html";
  }

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

// ==========================================
// Central Wager and VIP Level Update Logic
// ==========================================
async function updateUserWagerAndVIP(userId, betAmount) {
  try {
    if (!userId || !betAmount || betAmount <= 0) return;

    const [profileRes, vipSettingsRes] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseClient.from('vip_level_settings').select('*').order('level_number', { ascending: true })
    ]);

    if (profileRes.error || !profileRes.data) return;

    const profile = profileRes.data;
    const levels = vipSettingsRes.data || [];

    const currentTotalWager = Number(profile.total_wager || 0) + Number(betAmount);
    const currentWeeklyWager = Number(profile.weekly_wager || 0) + Number(betAmount);
    const currentMonthlyWager = Number(profile.monthly_wager || 0) + Number(betAmount);
    const currentLast7DaysWager = Number(profile.last_7_days_wager || 0) + Number(betAmount);

    const currentLevelNum = Number(profile.current_vip_level || 1);
    const activeLevelObj = levels.find(l => l.level_number === currentLevelNum) || levels[0];
    const rakebackPercent = Number(activeLevelObj?.instant_rakeback_percent || 0);
    
    const earnedRakeback = (Number(betAmount) * rakebackPercent) / 100;
    const newRakebackBalance = Number(profile.rakeback_balance || 0) + earnedRakeback;

    let newVipLevel = currentLevelNum;
    for (const lvl of levels) {
      if (currentTotalWager >= Number(lvl.required_wager)) {
        newVipLevel = lvl.level_number;
      }
    }

    await supabaseClient
      .from('profiles')
      .update({
        total_wager: currentTotalWager,
        weekly_wager: currentWeeklyWager,
        monthly_wager: currentMonthlyWager,
        last_7_days_wager: currentLast7DaysWager,
        rakeback_balance: newRakebackBalance,
        current_vip_level: newVipLevel
      })
      .eq('id', userId);

  } catch (err) {
    console.error('Error updating wager and VIP:', err);
  }
}

// ==========================================
// Global Interceptor for Supabase Insert
// ==========================================
const originalFrom = supabaseClient.from.bind(supabaseClient);
supabaseClient.from = function (table) {
  const queryBuilder = originalFrom(table);
  
  if (table === 'original_bets_history' || table === 'color_game_history') {
    const originalInsert = queryBuilder.insert.bind(queryBuilder);
    queryBuilder.insert = async function (values) {
      const result = await originalInsert(values);
      
      try {
        let betsArray = Array.isArray(values) ? values : [values];
        for (const bet of betsArray) {
          const userId = bet.user_id;
          const betAmount = Number(bet.bet_amount || bet.amount || 0);
          if (userId && betAmount > 0) {
            await updateUserWagerAndVIP(userId, betAmount);
          }
        }
      } catch (e) {
        console.error('Interceptor error:', e);
      }
      
      return result;
    };
  }
  
  return queryBuilder;
};
