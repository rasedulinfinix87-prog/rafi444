
/* Rafi444 Central Game Security */
(function () {
  "use strict";

  const security = {
    client: null,

    init(client) {
      if (!client || !client.auth) {
        throw new Error("Supabase client unavailable.");
      }

      this.client = client;
      return this;
    },

    async verifyUser() {
      try {
        if (!this.client) {
          this.init(supabaseClient);
        }

        const { data, error } =
          await this.client.auth.getUser();

        if (error || !data || !data.user || !data.user.id) {
          return {
            ok: false,
            user: null
          };
        }

        return {
          ok: true,
          user: data.user,
          userId: data.user.id
        };
      } catch (error) {
        console.error("Security verification failed:", error);

        return {
          ok: false,
          user: null
        };
      }
    },

    async requireAuth() {
      const result = await this.verifyUser();

      if (!result.ok) {
        window.location.replace(getLoginPageUrl());
        return null;
      }

      return result.user;
    },

    async verifyOwnership(userId) {
      const user = await this.requireAuth();

      if (!user) {
        throw new Error("Authentication required.");
      }

      if (!userId || user.id !== userId) {
        throw new Error("Access denied.");
      }

      return user;
    },

    async getMyUserId() {
      const user = await this.requireAuth();
      return user ? user.id : null;
    }
  };

  security.init(supabaseClient);

  // Make security available to all game scripts.
  window.GameSecurity = security;

  // Replace the old localStorage-fallback authentication.
  window.getCurrentUser = async function () {
    const result = await security.verifyUser();
    return result.ok ? result.user : null;
  };

  // Require a real Supabase Auth user.
  window.requireAuth = async function () {
    return await security.requireAuth();
  };

  console.log("Rafi444 Game Security initialized.");
})();
