// ChronoPulse - Time Calculator & Live Countdown Logic

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const liveClockEl = document.getElementById('live-clock');
    const liveDateEl = document.getElementById('live-date');
    const liveTimezoneEl = document.getElementById('live-timezone');

    const endDateInput = document.getElementById('end-date-input');
    const endTimeInput = document.getElementById('end-time-input');
    const eventTitleInput = document.getElementById('event-title-input');

    const activeEventTitleEl = document.getElementById('active-event-title');
    const targetSummaryTextEl = document.getElementById('target-summary-text');
    const statusBadgeEl = document.getElementById('countdown-status-badge');

    const resDaysEl = document.getElementById('res-days');
    const resHoursEl = document.getElementById('res-hours');
    const resMinutesEl = document.getElementById('res-minutes');
    const resSecondsEl = document.getElementById('res-seconds');

    const totalWeeksEl = document.getElementById('total-weeks');
    const totalHoursEl = document.getElementById('total-hours');
    const totalMinutesEl = document.getElementById('total-minutes');
    const totalSecondsEl = document.getElementById('total-seconds');

    const progressFillEl = document.getElementById('progress-fill');
    const progressPercentageEl = document.getElementById('progress-percentage');

    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    const saveCurrentBtn = document.getElementById('save-current-btn');
    const historyListEl = document.getElementById('history-list');

    // App State
    let soundEnabled = true;
    let alarmTriggered = false;
    let savedTimers = JSON.parse(localStorage.getItem('chronopulse_timers') || '[]');
    let initialTotalDiffMs = null;

    // Web Audio API Sound Generator (No external audio file required)
    function playBeepSound() {
        if (!soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            // Beep pattern: 3 rising tones
            [440, 554.37, 659.25, 880].forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.15);
                gain.gain.setValueAtTime(0.3, ctx.currentTime + index * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.15 + 0.3);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(ctx.currentTime + index * 0.15);
                osc.stop(ctx.currentTime + index * 0.15 + 0.3);
            });
        } catch (e) {
            console.log('Audio playback error', e);
        }
    }

    // Helper: Format Date & Time Strings
    function formatDateString(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    }

    function formatTimeString(date) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }

    function getTimezoneString() {
        const offset = -new Date().getTimezoneOffset();
        const hrs = Math.floor(Math.abs(offset) / 60).toString().padStart(2, '0');
        const mins = (Math.abs(offset) % 60).toString().padStart(2, '0');
        const sign = offset >= 0 ? '+' : '-';
        return `GMT${sign}${hrs}:${mins}`;
    }

    function padZero(num) {
        return num < 10 ? `0${num}` : `${num}`;
    }

    // Set Default Target: Today 07:45 PM (or Tomorrow 07:45 PM if already past)
    function initDefaultTarget() {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 45, 0); // 07:45 PM
        
        if (now > target) {
            // If present time is past 7:45 PM today, target tomorrow 7:45 PM
            target.setDate(target.getDate() + 1);
        }

        const dateStr = target.toISOString().split('T')[0];
        const timeStr = `${padZero(target.getHours())}:${padZero(target.getMinutes())}`;

        endDateInput.value = dateStr;
        endTimeInput.value = timeStr;
        eventTitleInput.value = "Target Time (07:45 PM)";
    }

    // Read Target Date Object from Inputs
    function getTargetDateTime() {
        const dateVal = endDateInput.value;
        const timeVal = endTimeInput.value;
        if (!dateVal || !timeVal) return null;

        const [year, month, day] = dateVal.split('-').map(Number);
        const [hours, minutes] = timeVal.split(':').map(Number);

        return new Date(year, month - 1, day, hours, minutes, 0);
    }

    // Update Live Clock (Start Time) and Target Calculation
    function tick() {
        const now = new Date();

        // 1. Update Live Present Time (Start Time)
        liveClockEl.textContent = formatTimeString(now);
        liveDateEl.textContent = formatDateString(now);
        liveTimezoneEl.textContent = getTimezoneString();

        // 2. Calculate Difference to Target End Time
        const targetDate = getTargetDateTime();
        if (!targetDate) return;

        // Update Target Text Summary
        const eventTitle = eventTitleInput.value.trim() || "Target Time";
        activeEventTitleEl.textContent = eventTitle;
        targetSummaryTextEl.textContent = `Target: ${formatDateString(targetDate)} at ${targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;

        const diffMs = targetDate.getTime() - now.getTime();

        if (initialTotalDiffMs === null || diffMs > initialTotalDiffMs) {
            initialTotalDiffMs = Math.max(diffMs, 1000);
        }

        if (diffMs <= 0) {
            // Countdown Reached 0 or Past
            resDaysEl.textContent = "00";
            resHoursEl.textContent = "00";
            resMinutesEl.textContent = "00";
            resSecondsEl.textContent = "00";

            totalWeeksEl.textContent = "0.0";
            totalHoursEl.textContent = "0";
            totalMinutesEl.textContent = "0";
            totalSecondsEl.textContent = "0";

            progressFillEl.style.width = "100%";
            progressPercentageEl.textContent = "100%";

            if (Math.abs(diffMs) < 2000) {
                // Just completed right now
                statusBadgeEl.className = "status-badge completed";
                statusBadgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Target Time Reached!`;
                if (!alarmTriggered) {
                    playBeepSound();
                    alarmTriggered = true;
                }
            } else {
                // Past Target
                const absMs = Math.abs(diffMs);
                const pastSec = Math.floor(absMs / 1000);
                const pastMin = Math.floor(pastSec / 60);
                const pastHr = Math.floor(pastMin / 60);
                const pastDay = Math.floor(pastHr / 24);

                statusBadgeEl.className = "status-badge past";
                statusBadgeEl.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Passed ${pastDay}d ${pastHr % 24}h ${pastMin % 60}m ago`;
            }
            return;
        }

        // Active Live Counting
        alarmTriggered = false;
        statusBadgeEl.className = "status-badge";
        statusBadgeEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Live Counting`;

        const totalSec = Math.floor(diffMs / 1000);
        const totalMin = Math.floor(totalSec / 60);
        const totalHr = Math.floor(totalMin / 60);
        const days = Math.floor(totalHr / 24);

        const hours = totalHr % 24;
        const minutes = totalMin % 60;
        const seconds = totalSec % 60;
        const weeks = (days / 7).toFixed(1);

        // Render Counter Cards
        resDaysEl.textContent = padZero(days);
        resHoursEl.textContent = padZero(hours);
        resMinutesEl.textContent = padZero(minutes);
        resSecondsEl.textContent = padZero(seconds);

        // Render Breakdown
        totalWeeksEl.textContent = weeks;
        totalHoursEl.textContent = totalHr.toLocaleString();
        totalMinutesEl.textContent = totalMin.toLocaleString();
        totalSecondsEl.textContent = totalSec.toLocaleString();

        // Calculate Elapsed Progress %
        const elapsedMs = initialTotalDiffMs - diffMs;
        const progressPct = Math.min(100, Math.max(0, (elapsedMs / initialTotalDiffMs) * 100));
        progressFillEl.style.width = `${progressPct.toFixed(1)}%`;
        progressPercentageEl.textContent = `${progressPct.toFixed(1)}%`;
    }

    // Preset Handlers
    function applyPreset(presetType) {
        const now = new Date();
        let target = new Date();

        if (presetType === 'today-745pm') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 45, 0); // 07:45 PM
            if (now > target) {
                target.setDate(target.getDate() + 1);
            }
            eventTitleInput.value = "Today 07:45 PM";
        } else if (presetType === 'end-today') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            eventTitleInput.value = "End of Today";
        } else if (presetType === 'plus-1h') {
            target = new Date(now.getTime() + 60 * 60 * 1000);
            eventTitleInput.value = "+1 Hour Target";
        } else if (presetType === 'plus-24h') {
            target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            eventTitleInput.value = "+24 Hours Target";
        } else if (presetType === 'end-month') {
            target = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            eventTitleInput.value = "End of Month";
        }

        endDateInput.value = target.toISOString().split('T')[0];
        endTimeInput.value = `${padZero(target.getHours())}:${padZero(target.getMinutes())}`;
        
        initialTotalDiffMs = null; // Reset initial calculation
        tick();
    }

    // Saved Timers Feature
    function renderSavedTimers() {
        if (savedTimers.length === 0) {
            historyListEl.innerHTML = `<p class="empty-msg">No saved target timers yet. Click "Save Current Timer" to bookmark a target!</p>`;
            return;
        }

        historyListEl.innerHTML = savedTimers.map((timer, index) => {
            const targetDate = new Date(timer.datetime);
            const dateDisplay = `${formatDateString(targetDate)} @ ${targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            return `
                <div class="saved-timer-card">
                    <div class="saved-info">
                        <span class="saved-title">${timer.title || 'Saved Target'}</span>
                        <span class="saved-target"><i class="fa-regular fa-clock"></i> ${dateDisplay}</span>
                    </div>
                    <div class="saved-actions">
                        <button class="action-icon-btn load-btn" data-index="${index}" title="Load Target">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <button class="action-icon-btn delete-btn" data-index="${index}" title="Delete Timer">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    saveCurrentBtn.addEventListener('click', () => {
        const target = getTargetDateTime();
        if (!target) return;

        const newTimer = {
            title: eventTitleInput.value.trim() || `Target ${savedTimers.length + 1}`,
            datetime: target.toISOString()
        };

        savedTimers.unshift(newTimer);
        if (savedTimers.length > 5) savedTimers.pop(); // keep top 5
        localStorage.setItem('chronopulse_timers', JSON.stringify(savedTimers));
        renderSavedTimers();
    });

    historyListEl.addEventListener('click', (e) => {
        const loadBtn = e.target.closest('.load-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (loadBtn) {
            const idx = loadBtn.getAttribute('data-index');
            const timer = savedTimers[idx];
            if (timer) {
                const target = new Date(timer.datetime);
                endDateInput.value = target.toISOString().split('T')[0];
                endTimeInput.value = `${padZero(target.getHours())}:${padZero(target.getMinutes())}`;
                eventTitleInput.value = timer.title;
                initialTotalDiffMs = null;
                tick();
            }
        } else if (deleteBtn) {
            const idx = deleteBtn.getAttribute('data-index');
            savedTimers.splice(idx, 1);
            localStorage.setItem('chronopulse_timers', JSON.stringify(savedTimers));
            renderSavedTimers();
        }
    });

    // Sound Toggle
    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggleBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
        soundToggleBtn.title = soundEnabled ? "Sound Alert Enabled" : "Sound Alert Disabled";
    });

    // Theme Toggle
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeToggleBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });

    // Event Listeners for Preset Chips
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyPreset(btn.dataset.preset);
        });
    });

    // Input Change Handlers
    [endDateInput, endTimeInput, eventTitleInput].forEach(input => {
        input.addEventListener('change', () => {
            initialTotalDiffMs = null;
            tick();
        });
    });

    // Initialization
    initDefaultTarget();
    renderSavedTimers();

    // Start Live Ticking Clock (1 second interval)
    tick();
    setInterval(tick, 1000);
});
