
/* =====================================================
   Rafi444 Game Security
   File: game/security.js

   Verifies Supabase Auth users and checks ownership.
   Requires ../supabase-config.js to load first.
===================================================== */

(function () {
  "use strict";

  const GameSecurity = {
    client: null,

    init() {
      if (
        !window.supabaseClient &&
        typeof supabaseClient === "undefined"
      ) {
        throw new Error("Supabase client is not initialized.");
      }

      this.client =
        typeof supabaseClient !== "undefined"
          ? supabaseClient
          : window.supabaseClient;

      return this;
    },

    // Verify the current user with the Supabase Auth server.
    async verifyUser() {
      try {
        if (!this.client) this.init();

        const {
          data: { user },
          error
        } = await this.client.auth.getUser();

        if (error || !user || !user.id) {
          return {
            ok: false,
            user: null,
            error: "Authentication required."
          };
        }

        return {
          ok: true,
          user: user,
          userId: user.id,
          error: null
        };
      } catch (error) {
        console.error("Game security verification failed:", error);

        return {
          ok: false,
          user: null,
          error: "Unable to verify your login."
        };
      }
    },

    // Require a real Supabase Auth user.
    async requireAuth(loginUrl) {
      const result = await this.verifyUser();

      if (!result.ok) {
        window.location.replace(
          loginUrl || "../login-signup.html"
        );

        return null;
      }

      return result.user;
    },

    // Obtain the authenticated user's ID from Supabase Auth.
    async getMyUserId() {
      const user = await this.requireAuth();

      return user ? user.id : null;
    },

    // Reject attempts to act as another user.
    async verifyOwnership(targetUserId) {
      const user = await this.requireAuth();

      if (!user) {
        throw new Error("Please log in first.");
      }

      if (
        typeof targetUserId !== "string" ||
        targetUserId !== user.id
      ) {
        throw new Error("Access denied: user ID mismatch.");
      }

      return user;
    },

    // Read only the authenticated user's own profile.
    async getMyProfile() {
      const user = await this.requireAuth();

      if (!user) return null;

      const { data, error } = await this.client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Profile access failed:", error);
        throw new Error("Unable to load your profile.");
      }

      return data;
    },

    // Sign out the real Supabase Auth session.
    async logout() {
      if (!this.client) this.init();

      const { error } = await this.client.auth.signOut();

      if (error) {
        throw new Error("Logout failed.");
      }

      try {
        localStorage.removeItem("current_user");
      } catch (_) {}

      window.location.replace("../login-signup.html");
    }
  };

  // Expose one shared security helper for game files.
  window.GameSecurity = GameSecurity;

})();
