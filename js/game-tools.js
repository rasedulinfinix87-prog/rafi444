
// js/game-tools.js
(function () {
    "use strict";

    const GameTools = {
        client: null,
        user: null,
        balance: 0,
        soundEnabled: true,
        turboEnabled: false,
        rating: 0,

        stats: {
            profit: 0,
            wagered: 0,
            wins: 0,
            losses: 0,
            history: []
        },

        balanceChannel: null,
        boundContainer: null,

        getClient() {
            if (typeof supabaseClient !== "undefined") {
                return supabaseClient;
            }
            return window.supabaseClient || null;
        },

        async init(options = {}) {
            this.client = this.getClient();
            if (!this.client) {
                console.error("GameTools: Supabase client not found.");
                return null;
            }

            try {
                let user = null;

                if (typeof getCurrentUser === "function") {
                    user = await getCurrentUser();
                } else {
                    const { data, error } =
                        await this.client.auth.getUser();
                    if (error) throw error;
                    user = data?.user || null;
                }

                if (!user) {
                    if (options.requireAuth === true) {
                        window.location.href =
                            options.loginUrl || "../login-signup.html";
                    }
                    return null;
                }

                this.user = user;

                const { data, error } = await this.client
                    .from("profiles")
                    .select("balance")
                    .eq("id", user.id)
                    .single();

                if (error) throw error;

                this.balance = Number(data?.balance) || 0;
                this.updateBalanceDisplay();
                this.subscribeBalance();

                return { user: this.user, balance: this.balance };
            } catch (error) {
                console.error("GameTools init error:", error);
                return null;
            }
        },

        async loadComponents(
            url = "../components/game-tools.html",
            containerId = "gameToolsContainer"
        ) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Could not load game-tools.html: " +
                        response.status);
                }

                const html = await response.text();
                const parsed = new DOMParser().parseFromString(
                    html, "text/html"
                );
                const template =
                    parsed.getElementById("gameToolsTemplate");

                if (!template) {
                    throw new Error("gameToolsTemplate not found.");
                }

                let container =
                    document.getElementById(containerId);

                if (!container) {
                    container = document.createElement("div");
                    container.id = containerId;
                    document.body.appendChild(container);
                }

                container.replaceChildren(
                    document.importNode(template.content, true)
                );

                this.boundContainer = null;
                this.bindComponentEvents(container);
                this.updateStatsDisplay();
                this.updateTurboDisplay();

                return true;
            } catch (error) {
                console.error("GameTools component error:", error);
                return false;
            }
        },

        async loadTopBar(
            url = "../bar/top.html",
            containerId = "topBarContainer"
        ) {
            const container =
                document.getElementById(containerId);
            if (!container) return false;

            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Top bar HTTP " + response.status);
                }

                container.innerHTML = await response.text();

                container.querySelectorAll('a[href*="deposit"]')
                    .forEach(a => {
                        a.href = "../account/deposit.html";
                    });

                container.querySelectorAll('a[href*="member"]')
                    .forEach(a => {
                        if (a.href.includes("admin/mem/member.html")) {
                            a.href = a.href.replace(
                                "admin/mem/member.html",
                                "mem/member.html"
                            );
                        }
                    });

                this.updateBalanceDisplay();
                return true;
            } catch (error) {
                console.error("GameTools top bar error:", error);
                return false;
            }
        },

        formatMoney(value) {
            return (Number(value) || 0).toFixed(2);
        },

        updateBalanceDisplay() {
            const formatted = "৳ " + this.formatMoney(this.balance);

            ["topBarBalance", "user-balance-display", "balanceText"]
                .forEach(id => {
                    const element = document.getElementById(id);
                    if (element) element.textContent = formatted;
                });
        },

        subscribeBalance() {
            if (!this.client || !this.user) return;

            if (this.balanceChannel) {
                this.client.removeChannel(this.balanceChannel);
            }

            this.balanceChannel = this.client
                .channel("game-tools-balance-" + this.user.id)
                .on("postgres_changes", {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: "id=eq." + this.user.id
                }, payload => {
                    if (payload.new?.balance !== undefined) {
                        this.balance =
                            Number(payload.new.balance) || 0;
                        this.updateBalanceDisplay();
                    }
                })
                .subscribe();
        },

        async refreshBalance() {
            if (!this.client || !this.user) return null;

            const { data, error } = await this.client
                .from("profiles")
                .select("balance")
                .eq("id", this.user.id)
                .single();

            if (error) throw error;

            this.balance = Number(data.balance) || 0;
            this.updateBalanceDisplay();
            return this.balance;
        },

        async saveBet({
            target_number,
            roll_result,
            bet_amount,
            payout = 0,
            is_bool = false
        }) {
            if (!this.client || !this.user) {
                throw new Error("User is not initialized.");
            }

            const row = {
                user_id: this.user.id,
                target_number: Number(target_number),
                roll_result: Number(roll_result),
                bet_amount: Number(bet_amount),
                payout: Number(payout),
                is_bool: Boolean(is_bool)
            };

            const { data, error } = await this.client
                .from("bets")
                .insert(row)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        // For production balance changes, use a secure server-side RPC.
        async setBalance(newBalance) {
            if (!this.client || !this.user) {
                throw new Error("User is not initialized.");
            }

            const amount = Number(newBalance);
            if (!Number.isFinite(amount) || amount < 0) {
                throw new Error("Invalid balance.");
            }

            const { error } = await this.client
                .from("profiles")
                .update({ balance: amount })
                .eq("id", this.user.id);

            if (error) throw error;

            this.balance = amount;
            this.updateBalanceDisplay();
            return this.balance;
        },

        recordRound({ betAmount, payout = 0, isWin }) {
            const bet = Number(betAmount) || 0;
            const winAmount = Number(payout) || 0;

            this.stats.wagered += bet;

            if (isWin) {
                this.stats.wins++;
                this.stats.profit += winAmount - bet;
            } else {
                this.stats.losses++;
                this.stats.profit -= bet;
            }

            this.stats.history.push(this.stats.profit);
            this.updateStatsDisplay();

            return {
                profit: this.stats.profit,
                wagered: this.stats.wagered,
                wins: this.stats.wins,
                losses: this.stats.losses,
                history: [...this.stats.history]
            };
        },

        updateStatsDisplay() {
            const values = {
                gameToolsProfit:
                    "৳ " + this.formatMoney(this.stats.profit),
                gameToolsWagered:
                    "৳ " + this.formatMoney(this.stats.wagered),
                gameToolsWins: String(this.stats.wins),
                gameToolsLosses: String(this.stats.losses)
            };

            Object.entries(values).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });

            const graph =
                document.getElementById("gameToolsStatsGraph");
            if (!graph) return;

            graph.replaceChildren();
            if (!this.stats.history.length) return;

            const max = Math.max(
                1,
                ...this.stats.history.map(value => Math.abs(value))
            );

            this.stats.history.forEach(value => {
                const bar = document.createElement("div");
                bar.style.height =
                    Math.max(8, Math.abs(value) / max * 100) + "%";
                bar.style.minWidth = "8px";
                bar.style.borderRadius = "3px";
                bar.style.background =
                    value >= 0 ? "#F5CF66" : "#eb4e3d";
                bar.title =
                    "Profit/Loss: ৳" + this.formatMoney(value);
                graph.appendChild(bar);
            });
        },

        toggleModal(id) {
            const modal = document.getElementById(id);
            if (!modal) return;

            const opening = modal.classList.contains("hidden");
            modal.classList.toggle("hidden", !opening);
            modal.classList.toggle("flex", opening);
        },

        updateTurboDisplay() {
            const button =
                document.getElementById("gameToolsTurboToggle");
            const status =
                document.getElementById("gameToolsTurboStatus");

            if (button) {
                button.setAttribute(
                    "aria-pressed", String(this.turboEnabled)
                );
                button.classList.toggle(
                    "bg-[#F5CF66]/15", this.turboEnabled
                );
            }

            if (status) {
                status.textContent =
                    this.turboEnabled ? "ON" : "OFF";
                status.classList.toggle(
                    "text-[#F5CF66]", this.turboEnabled
                );
            }
        },

        setRating(value) {
            this.rating = Math.max(
                1, Math.min(5, Number(value) || 1)
            );

            document.querySelectorAll(
                "#gameToolsRatingStars [data-game-tools-rating]"
            ).forEach(star => {
                const active =
                    Number(star.dataset.gameToolsRating) <= this.rating;
                star.classList.toggle("text-[#F5CF66]", active);
                star.classList.toggle("text-gray-500", !active);
            });

            const message =
                document.getElementById("gameToolsRatingMessage");
            if (message) {
                message.textContent =
                    "আপনার রেটিং: " + this.rating + "/5";
            }
        },

        bindComponentEvents(container) {
            const root = container ||
                document.getElementById("gameToolsContainer") ||
                document;

            if (this.boundContainer === root) return;
            this.boundContainer = root;

            root.querySelectorAll("[data-game-tools-open]")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        this.toggleModal(
                            button.dataset.gameToolsOpen
                        );
                    });
                });

            root.querySelectorAll("[data-game-tools-close]")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        const modal = document.getElementById(
                            button.dataset.gameToolsClose
                        );
                        if (modal) {
                            modal.classList.add("hidden");
                            modal.classList.remove("flex");
                        }
                    });
                });

            [
                "gameToolsSettingsModal",
                "gameToolsStatsModal",
                "gameToolsRatingModal"
            ].forEach(id => {
                const modal = root.querySelector("#" + id);
                if (!modal) return;

                modal.addEventListener("click", event => {
                    if (event.target === modal) {
                        modal.classList.add("hidden");
                        modal.classList.remove("flex");
                    }
                });
            });

            const soundButton =
                root.querySelector("#gameToolsSoundToggle");

            if (soundButton) {
                soundButton.addEventListener("click", () => {
                    this.soundEnabled = !this.soundEnabled;

                    const status =
                        root.querySelector("#gameToolsSoundStatus");
                    if (status) {
                        status.textContent =
                            this.soundEnabled ? "ON" : "OFF";
                    }

                    document.dispatchEvent(new CustomEvent(
                        "game-tools-sound-change",
                        { detail: { enabled: this.soundEnabled } }
                    ));
                });
            }

            const turboButton =
                root.querySelector("#gameToolsTurboToggle");

            if (turboButton) {
                turboButton.addEventListener("click", () => {
                    this.turboEnabled = !this.turboEnabled;
                    this.updateTurboDisplay();

                    document.dispatchEvent(new CustomEvent(
                        "game-tools-turbo-change",
                        { detail: { enabled: this.turboEnabled } }
                    ));
                });
            }

            root.querySelectorAll("[data-game-tools-rating]")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        this.setRating(
                            button.dataset.gameToolsRating
                        );
                    });
                });

            const shareButton =
                root.querySelector("#gameToolsShare");

            if (shareButton) {
                shareButton.addEventListener("click", async () => {
                    try {
                        if (navigator.share) {
                            await navigator.share({
                                title: document.title,
                                url: window.location.href
                            });
                        } else if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(
                                window.location.href
                            );
                            alert("গেমের লিংক কপি করা হয়েছে!");
                        } else {
                            window.prompt(
                                "গেমের লিংক কপি করুন:",
                                window.location.href
                            );
                        }
                    } catch (error) {
                        if (error.name !== "AbortError") {
                            console.error("Share error:", error);
                        }
                    }
                });
            }
        },

        playSound(audio, enabled = true) {
            if (!this.soundEnabled || !enabled || !audio) return;

            try {
                audio.currentTime = 0;
                const result = audio.play();
                if (result?.catch) {
                    result.catch(error => {
                        console.error("Sound error:", error);
                    });
                }
            } catch (error) {
                console.error("Sound error:", error);
            }
        },

        destroy() {
            if (this.client && this.balanceChannel) {
                this.client.removeChannel(this.balanceChannel);
            }
            this.balanceChannel = null;
            this.boundContainer = null;
        }
    };

    window.GameTools = GameTools;
})();
