// supabase-config.js

const SUPABASE_URL = "%%SUPABASE_URL%%";
const SUPABASE_ANON_KEY = "%%SUPABASE_ANON_KEY%%";

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

  if (
    path.includes("/game/") ||
    path.includes("/color-trading/") ||
    path.includes("/account/") ||
    path.includes("/slot/") ||
    path.includes("/baccarat/") ||
    path.includes("/dragon-tiger/") ||
    path.includes("/roulette/") ||
    path.includes("/under-over/")
  ) {
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
      supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),

      supabaseClient
        .from("vip_level_settings")
        .select("*")
        .order("level_number", { ascending: true })
    ]);

    // Error checking: profile read
    if (profileRes.error) {
      console.error(
        "VIP update failed: Could not read profiles.",
        profileRes.error
      );
      return;
    }

    if (!profileRes.data) {
      console.error(
        "VIP update failed: No profile found for user ID:",
        userId
      );
      return;
    }

    // Error checking: VIP settings read
    if (vipSettingsRes.error) {
      console.error(
        "VIP update failed: Could not read vip_level_settings.",
        vipSettingsRes.error
      );
      return;
    }

    const profile = profileRes.data;
    const levels = vipSettingsRes.data || [];

    const currentTotalWager =
      Number(profile.total_wager || 0) + Number(betAmount);

    const currentWeeklyWager =
      Number(profile.weekly_wager || 0) + Number(betAmount);

    const currentMonthlyWager =
      Number(profile.monthly_wager || 0) + Number(betAmount);

    const currentLast7DaysWager =
      Number(profile.last_7_days_wager || 0) + Number(betAmount);

    const currentLevelNum = Number(profile.current_vip_level || 1);

    // Preserve original VIP calculation
    const activeLevelObj =
      levels.find(
        l => Number(l.level_number) === currentLevelNum
      ) || levels[0];

    const rakebackPercent = Number(
      activeLevelObj?.instant_rakeback_percent || 0
    );

    const earnedRakeback =
      (Number(betAmount) * rakebackPercent) / 100;

    const newRakebackBalance =
      Number(profile.rakeback_balance || 0) + earnedRakeback;

    let newVipLevel = currentLevelNum;

    for (const lvl of levels) {
      if (currentTotalWager >= Number(lvl.required_wager)) {
        newVipLevel = Number(lvl.level_number);
      }
    }

    // Update profile and capture any Supabase error
    const updateRes = await supabaseClient
      .from("profiles")
      .update({
        total_wager: currentTotalWager,
        weekly_wager: currentWeeklyWager,
        monthly_wager: currentMonthlyWager,
        last_7_days_wager: currentLast7DaysWager,
        rakeback_balance: newRakebackBalance,
        current_vip_level: newVipLevel
      })
      .eq("id", userId)
      .select("id, total_wager, current_vip_level");

    if (updateRes.error) {
      console.error(
        "VIP UPDATE ERROR: Supabase could not update profiles. Check RLS UPDATE policy and permissions.",
        updateRes.error
      );
      return;
    }

    if (!updateRes.data || updateRes.data.length === 0) {
      console.error(
        "VIP UPDATE WARNING: No profile row was updated. Check user ID and RLS UPDATE policy.",
        { userId, newVipLevel, currentTotalWager }
      );
      return;
    }

    console.log("Wager/VIP update successful:", updateRes.data[0]);

  } catch (err) {
    console.error("Error updating wager and VIP:", err);
  }
}

// Expose globally so any game file can trigger it if needed
window.updateUserWagerAndVIP = updateUserWagerAndVIP;

// ==========================================
// Global Interceptor for Supabase Insert
// ==========================================
const originalFrom = supabaseClient.from.bind(supabaseClient);

supabaseClient.from = function (table) {
  const queryBuilder = originalFrom(table);

  if (
    table === "original_bets_history" ||
    table === "color_game_history"
  ) {
    const originalInsert = queryBuilder.insert.bind(queryBuilder);

    queryBuilder.insert = async function (values) {
      const result = await originalInsert(values);

      try {
        const betsArray = Array.isArray(values) ? values : [values];

        for (const bet of betsArray) {
          const userId = bet.user_id;
          const betAmount = Number(
            bet.bet_amount || bet.amount || 0
          );

          if (userId && betAmount > 0) {
            await updateUserWagerAndVIP(userId, betAmount);
          }
        }
      } catch (e) {
        console.error("Interceptor error:", e);
      }

      return result;
    };
  }

  return queryBuilder;
};
