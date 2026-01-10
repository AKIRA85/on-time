document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');

    // Check auth status immediately
    chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (response) => {
        if (response && response.success) {
            toggleUI(true);
        }
    });

    const loginError = document.getElementById('login-error');

    loginBtn.addEventListener('click', () => {
        // Clear previous error
        loginError.classList.add('hidden');
        loginError.textContent = '';

        chrome.runtime.sendMessage({ action: 'LOGIN' }, (response) => {
            if (response && response.success) {
                toggleUI(true);
            } else {
                console.error("Login failed:", response?.error);
                // Show user-friendly error message
                let errorMsg = 'Sign in failed. Please try again.';
                if (response?.error) {
                    if (response.error.includes('canceled') || response.error.includes('cancelled')) {
                        errorMsg = 'Sign in was cancelled.';
                    } else if (response.error.includes('network')) {
                        errorMsg = 'Network error. Please check your connection.';
                    }
                }
                loginError.textContent = errorMsg;
                loginError.classList.remove('hidden');
            }
        });
    });

    function toggleUI(isSignedIn) {
        if (isSignedIn) {
            authSection.classList.add('hidden');
            appSection.classList.remove('hidden');
            // Load meetings when signed in
            loadMeetings();
        } else {
            authSection.classList.remove('hidden');
            appSection.classList.add('hidden');
        }
    }

    const refreshBtn = document.getElementById('refreshBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const backBtn = document.getElementById('backBtn');
    const settingsView = document.getElementById('settings-view');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            appSection.classList.add('hidden');
            settingsView.classList.remove('hidden');
            // Hide header buttons? Or just keep them? 
            // The requirement was "hide everything else", so maybe hide refresh btn too?
            // For now let's just swap the main views.
            refreshBtn.style.display = 'none';
            settingsBtn.style.display = 'none';
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            settingsView.classList.add('hidden');
            appSection.classList.remove('hidden');
            refreshBtn.style.display = 'inline-block';
            settingsBtn.style.display = 'inline-block';
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('Refreshing events...');
            refreshBtn.style.animation = 'spin 1s linear infinite';
            chrome.runtime.sendMessage({ action: 'REFRESH_EVENTS' }, (response) => {
                setTimeout(() => {
                    refreshBtn.style.animation = '';
                    loadMeetings();
                }, 500);
            });
        });
    }

    // Settings Logic
    const newWindowToggle = document.getElementById('newWindowToggle');
    const tentativeToggle = document.getElementById('tentativeToggle');

    // Load saved settings
    chrome.storage.local.get(['settings'], (result) => {
        const settings = result.settings || { openInNewWindow: false, includeTentative: false };
        if (newWindowToggle) newWindowToggle.checked = settings.openInNewWindow;
        if (tentativeToggle) tentativeToggle.checked = settings.includeTentative;
    });

    function saveSettings() {
        const settings = {
            openInNewWindow: newWindowToggle ? newWindowToggle.checked : false,
            includeTentative: tentativeToggle ? tentativeToggle.checked : false
        };
        chrome.storage.local.set({ settings: settings }, () => {
            console.log('Settings saved:', settings);
            chrome.runtime.sendMessage({ action: 'REFRESH_EVENTS' });
        });
    }

    if (newWindowToggle) newWindowToggle.addEventListener('change', saveSettings);
    if (tentativeToggle) tentativeToggle.addEventListener('change', saveSettings);

    function loadMeetings() {
        chrome.storage.local.get(['upcomingMeetings'], (result) => {
            renderMeetings(result.upcomingMeetings || []);
        });
    }

    function renderMeetings(meetings) {
        const nextCard = document.getElementById('next-meeting-card');
        const laterList = document.getElementById('later-meetings-list');
        const laterHeading = document.getElementById('later-heading');

        // Filter out past meetings (allow 5 min buffer)
        const now = Date.now();
        const upcoming = meetings.filter(m => m.startTime > now - 5 * 60000);

        if (upcoming.length === 0) {
            nextCard.innerHTML = '<p class="placeholder">No upcoming meetings found.</p>';
            if (laterList) laterList.innerHTML = '';
            if (laterHeading) laterHeading.classList.add('hidden');
            return;
        }

        // Next Meeting
        const next = upcoming[0];
        const timeStr = formatTime(next.startTime);
        const countdown = getCountdown(next.startTime);

        const combinedTemplate = document.getElementById('meeting-card-template');

        nextCard.innerHTML = '';
        const nextClone = combinedTemplate.content.cloneNode(true);
        nextClone.querySelector('.meeting-title').textContent = next.summary;
        nextClone.querySelector('.time-badge').textContent = timeStr;
        nextClone.querySelector('.countdown').textContent = countdown;
        renderStatus(nextClone, next.status);

        if (next.calendarLink) {
            nextClone.querySelector('.meeting-item').addEventListener('click', () => {
                chrome.tabs.create({ url: next.calendarLink });
            });
        }

        nextCard.appendChild(nextClone);

        // Later
        const later = upcoming.slice(1);
        if (later.length > 0 && laterList && laterHeading) {
            laterHeading.classList.remove('hidden');
            laterList.innerHTML = '';

            later.forEach(m => {
                const clone = combinedTemplate.content.cloneNode(true);
                clone.querySelector('.meeting-title').textContent = m.summary;
                clone.querySelector('.time-badge').textContent = formatTime(m.startTime);
                renderStatus(clone, m.status);

                // Start remove countdown from 'Later' items
                const cd = clone.querySelector('.countdown');
                if (cd) cd.remove();

                if (m.calendarLink) {
                    clone.querySelector('.meeting-item').addEventListener('click', () => {
                        chrome.tabs.create({ url: m.calendarLink });
                    });
                }

                laterList.appendChild(clone);
            });

        } else if (laterList && laterHeading) {
            laterHeading.classList.add('hidden');
            laterList.innerHTML = '';
        }
    }

    function renderStatus(element, status) {
        const badge = element.querySelector('.status-badge');
        if (!status) {
            status = 'accepted';
        }

        badge.textContent = status === 'needsAction' ? 'Invited' : status;
        badge.classList.add(`status-${status}`);
        badge.style.display = 'inline-block';
    }

    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function getCountdown(timestamp) {
        const diff = timestamp - Date.now();
        const mins = Math.ceil(diff / 60000);

        if (mins <= 0) return 'Now';
        if (mins < 60) return `In ${mins} min`;

        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `In ${hours}h ${remainingMins}m`;
    }
});
