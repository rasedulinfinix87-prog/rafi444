(function () {
    const state = {
        soundOn: true,
        turboOn: false,
        totalProfit: 0,
        totalWagered: 0,
        totalWins: 0,
        totalLosses: 0,
        profitHistory: [0]
    };

    const winSound = new Audio(
        'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
    );

    const loseSound = new Audio(
        'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3'
    );

    function byId(id) {
        return document.getElementById(id);
    }

    function showModal(id, show) {
        const modal = byId(id);
        if (!modal) return;

        modal.classList.toggle('hidden', !show);
        modal.classList.toggle('flex', show);
    }

    function updateSoundUI() {
        const button = byId('soundSettingBtn');
        const text = byId('soundStatusText');

        if (text) text.textContent = state.soundOn ? 'ON' : 'OFF';

        if (button) {
            button.className = state.soundOn
                ? 'flex items-center justify-between py-2.5 px-3 rounded-lg text-sm text-[#F5CF66]'
                : 'flex items-center justify-between py-2.5 px-3 rounded-lg text-sm text-gray-400';
        }
    }

    function updateTurboUI() {
        const icon = byId('turboIcon');
        const text = byId('turboText');

        if (icon) {
            icon.className = state.turboOn
                ? 'fa-solid fa-bolt text-[#F5CF66]'
                : 'fa-solid fa-bolt text-gray-400';
        }

        if (text) {
            text.textContent = state.turboOn ? 'ON' : 'OFF';
            text.className = state.turboOn
                ? 'text-[10px] font-bold text-[#F5CF66]'
                : 'text-[10px] font-bold text-gray-400';
        }
    }

    function updateStatsUI() {
        if (byId('statsProfit')) {
            byId('statsProfit').textContent =
                '৳ ' + state.totalProfit.toFixed(2);
        }

        if (byId('statsWagered')) {
            byId('statsWagered').textContent =
                '৳ ' + state.totalWagered.toFixed(2);
        }

        if (byId('statsWin')) {
            byId('statsWin').textContent = state.totalWins;
        }

        if (byId('statsLose')) {
            byId('statsLose').textContent = state.totalLosses;
        }

        updateGraph();
    }

    function updateGraph() {
        const container = byId('statsGraphContainer');
        if (!container) return;

        container.innerHTML = '';

        if (state.profitHistory.length <= 1) {
            container.innerHTML =
                '<div class="w-full text-center text-xs text-gray-500 self-center">No bets yet</div>';
            return;
        }

        const maxValue = Math.max(
            ...state.profitHistory.map(value => Math.abs(value)),
            1
        );

        state.profitHistory.slice(1).forEach(value => {
            const bar = document.createElement('div');
            const positive = value >= 0;
            const height = Math.max(
                10,
                Math.min((Math.abs(value) / maxValue) * 100, 100)
            );

            bar.className =
                `w-3 shrink-0 rounded-sm ${positive ? 'bg-[#F5CF66]' : 'bg-[#eb4e3d]'}`;

            bar.style.height = height + '%';
            bar.title = 'Profit/Loss: ৳' + value.toFixed(2);

            container.appendChild(bar);
        });

        container.scrollLeft = container.scrollWidth;
    }

    window.GameTools = {
        toggleSettings() {
            const modal = byId('settingsModal');
            if (modal) showModal('settingsModal', modal.classList.contains('hidden'));
        },

        toggleStats() {
            const modal = byId('liveStatsModal');
            if (modal) showModal('liveStatsModal', modal.classList.contains('hidden'));
        },

        toggleSound() {
            state.soundOn = !state.soundOn;
            updateSoundUI();
        },

        toggleTurbo() {
            state.turboOn = !state.turboOn;
            updateTurboUI();
            return state.turboOn;
        },

        isTurboOn() {
            return state.turboOn;
        },

        isSoundOn() {
            return state.soundOn;
        },

        playSound(isWin) {
            if (!state.soundOn) return;

            const sound = isWin ? winSound : loseSound;
            sound.currentTime = 0;
            sound.play().catch(() => {});
        },

        async share() {
            const shareData = {
                title: document.title || 'Game',
                text: 'Play this game!',
                url: window.location.href
            };

            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(window.location.href);
                    alert('লিংক কপি করা হয়েছে!');
                } else {
                    prompt('গেমের লিংক কপি করুন:', window.location.href);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share error:', error);
                }
            }
        },

        recordRound({ betAmount, payoutAmount, isWin }) {
            const bet = Number(betAmount) || 0;
            const payout = Number(payoutAmount) || 0;

            state.totalWagered += bet;

            if (isWin) {
                state.totalWins++;
                state.totalProfit += payout - bet;
            } else {
                state.totalLosses++;
                state.totalProfit -= bet;
            }

            state.profitHistory.push(state.totalProfit);
            updateStatsUI();
            this.playSound(isWin);
        },

        resetStats() {
            state.totalProfit = 0;
            state.totalWagered = 0;
            state.totalWins = 0;
            state.totalLosses = 0;
            state.profitHistory = [0];
            updateStatsUI();
        }
    };

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            showModal('settingsModal', false);
            showModal('liveStatsModal', false);
        }
    });

    updateSoundUI();
    updateTurboUI();
})();
