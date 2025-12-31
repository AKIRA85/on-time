// background.js

let userToken = null;

// Meeting link regex patterns
const MEETING_PATTERNS = [
    /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/,
    /https:\/\/.*\.zoom\.us\/j\/[0-9]+/,
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^"\s]+/,
    /https:\/\/.*\.webex\.com\/[^"\s]+/
];

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pollEvents') {
        fetchEvents();
    } else if (alarm.name.startsWith('meeting:')) {
        // Open the meeting link
        const url = alarm.name.substring('meeting:'.length);

        chrome.storage.local.get(['settings'], (result) => {
            const settings = result.settings || { openInNewWindow: false };

            if (settings.openInNewWindow) {
                chrome.windows.create({ url: url, focused: true });
            } else {
                chrome.tabs.create({ url: url, active: true }, (tab) => {
                    chrome.windows.update(tab.windowId, { focused: true });
                });
            }
        });
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("On Time extension installed.");
    // Poll every 15 minutes
    chrome.alarms.create('pollEvents', { periodInMinutes: 15 });
    // Check immediately if we have access
    getAuthToken(false).then(() => fetchEvents()).catch(() => { });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'LOGIN') {
        getAuthToken(true)
            .then(token => {
                fetchEvents(); // Fetch immediately after login
                sendResponse({ success: true, token });
            })
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // async response
    } else if (request.action === 'CHECK_AUTH') {
        getAuthToken(false)
            .then(token => sendResponse({ success: true, token }))
            .catch(() => sendResponse({ success: false }));
        return true;
    } else if (request.action === 'REFRESH_EVENTS') {
        fetchEvents().then(count => sendResponse({ success: true, count }));
        return true;
    }
});

function getAuthToken(interactive) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(chrome.runtime.lastError);
            } else {
                userToken = token;
                resolve(token);
            }
        });
    });
}

async function fetchEvents() {
    if (!userToken) return 0;

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${now.toISOString()}&` +
        `timeMax=${endOfDay.toISOString()}&` +
        `singleEvents=true&` +
        `orderBy=startTime`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                chrome.identity.removeCachedAuthToken({ token: userToken }, () => { });
                userToken = null;
            }
            throw new Error('Failed to fetch events');
        }

        const data = await response.json();
        const count = processEvents(data.items);
        return count;
    } catch (err) {
        console.error(err);
        return 0;
    }
}

function processEvents(events) {
    if (!events) return 0;

    const upcomingMeetings = [];

    events.forEach(event => {
        if (!event.start || !event.start.dateTime) return;

        // Extract link
        const meetingLink = extractMeetingLink(event);

        if (meetingLink) {
            const startTime = new Date(event.start.dateTime).getTime();
            const now = Date.now();

            // Find self attendee status
            let responseStatus = 'accepted'; // Default to accepted if no attendees list (e.g. self-created event sometimes)
            if (event.attendees) {
                const selfAttendee = event.attendees.find(a => a.self);
                if (selfAttendee) {
                    responseStatus = selfAttendee.responseStatus;
                }
            }

            // If starts in future
            if (startTime > now) {
                upcomingMeetings.push({
                    summary: event.summary,
                    startTime: startTime,
                    link: meetingLink,
                    status: responseStatus,
                    calendarLink: event.htmlLink
                });

                // Get settings to determine if we should schedule alarm
                chrome.storage.local.get(['settings'], (result) => {
                    const settings = result.settings || { includeTentative: false };

                    // Check status validity based on settings
                    let shouldOpen = false;
                    if (responseStatus === 'accepted') shouldOpen = true;
                    if (responseStatus === 'tentative' && settings.includeTentative) shouldOpen = true;

                    if (shouldOpen) {
                        const alarmTime = Math.max(now, startTime - 60000);
                        const alarmName = `meeting:${meetingLink}`;
                        chrome.alarms.create(alarmName, { when: alarmTime });
                    }
                });
            }
        }
    });

    // Cleanup alarms for deleted/declined meetings
    chrome.alarms.getAll((alarms) => {
        const validLinks = new Set(upcomingMeetings.map(m => m.link));
        alarms.forEach(alarm => {
            if (alarm.name.startsWith('meeting:')) {
                const link = alarm.name.substring('meeting:'.length);
                if (!validLinks.has(link)) {
                    console.log('Removing stale alarm for:', link);
                    chrome.alarms.clear(alarm.name);
                }
            }
        });
    });

    // Save to storage for popup to display
    chrome.storage.local.set({ upcomingMeetings });
    return upcomingMeetings.length;
}

function extractMeetingLink(event) {
    if (event.hangoutLink) return event.hangoutLink;

    const textToCheck = (event.description || '') + ' ' + (event.location || '');
    for (const pattern of MEETING_PATTERNS) {
        const match = textToCheck.match(pattern);
        if (match) return match[0];
    }
    return null;
}
