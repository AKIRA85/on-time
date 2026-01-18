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
    const loginErrorText = document.getElementById('login-error-text');
    const loginErrorDetailsSection = document.getElementById('login-error-details-section');
    const loginToggleDetailsBtn = document.getElementById('loginToggleDetailsBtn');
    const loginErrorDetails = document.getElementById('login-error-details');
    const loginErrorDetailsText = document.getElementById('login-error-details-text');
    const loginCopyErrorBtn = document.getElementById('loginCopyErrorBtn');

    // Helper to show login error with optional details
    function showLoginError(message, rawError = null) {
        loginErrorText.innerHTML = message;
        loginError.classList.remove('hidden');

        if (rawError) {
            loginErrorDetailsSection.classList.remove('hidden');
            loginErrorDetailsText.textContent = rawError;
            loginErrorDetails.classList.add('hidden');
            loginToggleDetailsBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Show details';
        } else {
            loginErrorDetailsSection.classList.add('hidden');
        }
    }

    // Helper to clear login error
    function clearLoginError() {
        loginError.classList.add('hidden');
        loginErrorText.textContent = '';
        loginErrorDetailsSection.classList.add('hidden');
    }

    // Toggle login error details
    if (loginToggleDetailsBtn) {
        loginToggleDetailsBtn.addEventListener('click', () => {
            const isHidden = loginErrorDetails.classList.contains('hidden');
            loginErrorDetails.classList.toggle('hidden');
            loginToggleDetailsBtn.innerHTML = isHidden ? '<i class="fa-solid fa-chevron-up"></i> Hide details' : '<i class="fa-solid fa-chevron-down"></i> Show details';
        });
    }

    // Copy login error details
    if (loginCopyErrorBtn) {
        loginCopyErrorBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(loginErrorDetailsText.textContent).then(() => {
                loginCopyErrorBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                loginCopyErrorBtn.classList.add('copied');
                setTimeout(() => {
                    loginCopyErrorBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                    loginCopyErrorBtn.classList.remove('copied');
                }, 2000);
            });
        });
    }

    loginBtn.addEventListener('click', () => {
        // Clear previous error
        clearLoginError();

        chrome.runtime.sendMessage({ action: 'LOGIN' }, (response) => {
            if (response && response.success) {
                toggleUI(true);
            } else {
                console.error("Login failed:", response?.error);
                const rawError = response?.error || 'Unknown error';
                // Show user-friendly error message
                let errorMsg = 'Sign in failed. Please try again.';
                let showDetails = true;
                if (response?.error) {
                    if (response.error.includes('canceled') || response.error.includes('cancelled')) {
                        errorMsg = 'Sign in was cancelled.';
                        showDetails = false; // No need for details on cancel
                    } else if (response.error.includes('network')) {
                        errorMsg = 'Network error. Please check your connection.';
                    } else if (response.error.includes('Service has been disabled for this account')) {
                        // Corporate account with restricted API access
                        errorMsg = 'Your organization has restricted this app. <a href="https://ontime-meeting.in/#troubleshooting" target="_blank" style="color: #4a9eff;">Learn how to fix this</a>';
                    }
                }
                showLoginError(errorMsg, showDetails ? rawError : null);
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

    const appError = document.getElementById('app-error');
    const appErrorText = document.getElementById('app-error-text');
    const reSignInBtn = document.getElementById('reSignInBtn');
    const toggleDetailsBtn = document.getElementById('toggleDetailsBtn');
    const errorDetails = document.getElementById('error-details');
    const errorDetailsText = document.getElementById('error-details-text');
    const copyErrorBtn = document.getElementById('copyErrorBtn');

    // Helper to show app error with optional raw error details
    function showAppError(message, isAuthError = false, rawError = null) {
        appErrorText.textContent = message;
        appError.classList.remove('hidden');
        if (isAuthError) {
            reSignInBtn.classList.remove('hidden');
        } else {
            reSignInBtn.classList.add('hidden');
        }

        // Set raw error details for debugging
        if (rawError) {
            errorDetailsText.textContent = rawError;
            errorDetails.classList.add('hidden');
            toggleDetailsBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Show details';
        }
    }

    // Helper to clear app error
    function clearAppError() {
        appError.classList.add('hidden');
        appErrorText.textContent = '';
        reSignInBtn.classList.add('hidden');
        errorDetails.classList.add('hidden');
        toggleDetailsBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Show details';
    }

    // Toggle error details visibility
    if (toggleDetailsBtn) {
        toggleDetailsBtn.addEventListener('click', () => {
            const isHidden = errorDetails.classList.contains('hidden');
            errorDetails.classList.toggle('hidden');
            toggleDetailsBtn.innerHTML = isHidden ? '<i class="fa-solid fa-chevron-up"></i> Hide details' : '<i class="fa-solid fa-chevron-down"></i> Show details';
        });
    }

    // Copy error details to clipboard
    if (copyErrorBtn) {
        copyErrorBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(errorDetailsText.textContent).then(() => {
                copyErrorBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                copyErrorBtn.classList.add('copied');
                setTimeout(() => {
                    copyErrorBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
                    copyErrorBtn.classList.remove('copied');
                }, 2000);
            });
        });
    }

    // Re-sign-in button handler
    if (reSignInBtn) {
        reSignInBtn.addEventListener('click', () => {
            clearAppError();
            // Use RELOGIN to clear cached token and get a fresh one
            chrome.runtime.sendMessage({ action: 'RELOGIN' }, (response) => {
                if (response && response.success) {
                    // Refresh events after re-authentication
                    chrome.runtime.sendMessage({ action: 'REFRESH_EVENTS' }, () => {
                        loadMeetings();
                    });
                } else {
                    showAppError(response?.error || 'Sign in failed. Please try again.', true);
                }
            });
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            console.log('Refreshing events...');
            refreshBtn.style.animation = 'spin 1s linear infinite';
            clearAppError();

            chrome.runtime.sendMessage({ action: 'REFRESH_EVENTS' }, (response) => {
                setTimeout(() => {
                    refreshBtn.style.animation = '';
                    if (response && response.success) {
                        loadMeetings();
                    } else {
                        console.error('Refresh failed:', response?.error);
                        const rawError = response?.error || 'Unknown error';
                        let errorMsg = 'Failed to refresh events. Please try again.';
                        if (rawError.includes('sign in') || rawError.includes('Session expired')) {
                            errorMsg = rawError;
                        }
                        const isAuthError = rawError.includes('sign in') || rawError.includes('Session expired');
                        showAppError(errorMsg, isAuthError, rawError);
                        loadMeetings(); // Still try to load cached meetings
                    }
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
