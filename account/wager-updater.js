// wager-updater.js - সেন্ট্রাল ওয়াগার এবং ভিআইপি লেভেল আপডেট করার ফাংশন
async function updateUserWagerAndVIP(userId, betAmount) {
  try {
    if (!userId || !betAmount || betAmount <= 0) return;

    // ১. ইউজারের বর্তমান প্রোফাইল এবং ভিআইপি সেটিংস ফেচ করা
    const [profileRes, vipSettingsRes] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabaseClient.from('vip_level_settings').select('*').order('level_number', { ascending: true })
    ]);

    if (profileRes.error || !profileRes.data) {
      console.error('Error fetching user profile for wager update');
      return;
    }

    const profile = profileRes.data;
    const levels = vipSettingsRes.data || [];

    const currentTotalWager = Number(profile.total_wager || 0) + Number(betAmount);
    const currentWeeklyWager = Number(profile.weekly_wager || 0) + Number(betAmount);
    const currentMonthlyWager = Number(profile.monthly_wager || 0) + Number(betAmount);
    const currentLast7DaysWager = Number(profile.last_7_days_wager || 0) + Number(betAmount);

    // ২. ইউজারের বর্তমান লেভেল অনুযায়ী ইনস্ট্যান্ট রেকেব্যাক হিসাব করা
    const currentLevelNum = Number(profile.current_vip_level || 1);
    const activeLevelObj = levels.find(l => l.level_number === currentLevelNum) || levels[0];
    const rakebackPercent = Number(activeLevelObj?.instant_rakeback_percent || 0);
    
    const earnedRakeback = (Number(betAmount) * rakebackPercent) / 100;
    const newRakebackBalance = Number(profile.rakeback_balance || 0) + earnedRakeback;

    // ৩. নতুন মোট ওয়াগার অনুযায়ী লেভেল আপগ্রেড চেক করা
    let newVipLevel = currentLevelNum;
    for (const lvl of levels) {
      if (currentTotalWager >= Number(lvl.required_wager)) {
        newVipLevel = lvl.level_number;
      }
    }

    // ৪. সুপাবেসের profiles টেবিলে আপডেট পাঠানো
    const { error: updateError } = await supabaseClient
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

    if (updateError) {
      console.error('Failed to update profile wager:', updateError.message);
    } else {
      console.log('Wager and VIP stats updated successfully!');
    }

  } catch (err) {
    console.error('Unexpected error in updateUserWagerAndVIP:', err);
  }
}
