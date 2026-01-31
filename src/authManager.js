import { MS_CLIENT_ID, MS_AUTH_URL, MS_SCOPES } from '../config.js';

export const AuthManager = {
    isLoggedIn: false,
    userInfo: null,

    async init() {
        const data = await chrome.storage.local.get(['userSession']);
        if (data.userSession) {
            this.handleLoginSuccess(data.userSession);
        } else {
            // Optional: Try silent Google Login
            chrome.identity.getAuthToken({ interactive: false }, (token) => {
                if (token && !chrome.runtime.lastError) {
                    this.fetchGoogleUserInfo(token);
                }
            });
        }
    },

    loginGoogle() {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                alert("Google Login failed: " + chrome.runtime.lastError.message);
                return;
            }
            this.fetchGoogleUserInfo(token);
        });
    },

    loginMicrosoft() {
        const redirectUri = chrome.identity.getRedirectURL();
        const nonce = Math.random().toString(36).substring(2, 15);
        const authUrl = `${MS_AUTH_URL}?client_id=${MS_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(MS_SCOPES)}&nonce=${nonce}`;

        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, (responseUrl) => {
            if (chrome.runtime.lastError) {
                console.log("User cancelled login.");
                return;
            }
            if (!responseUrl) return;
            try {
                const url = new URL(responseUrl);
                const urlParams = new URLSearchParams(url.hash.substring(1));
                const accessToken = urlParams.get("access_token");
                if (accessToken) {
                    this.fetchMicrosoftUserInfo(accessToken);
                }
            } catch (e) {}
        });
    },

    logout(cb) {
        chrome.storage.local.remove('userSession');
        this.isLoggedIn = false;
        this.userInfo = null;
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (token) chrome.identity.removeCachedAuthToken({ token: token }, () => {});
        });
        if (cb) cb();
    },

    fetchGoogleUserInfo(token) {
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(user => {
            const session = {
                provider: 'google',
                name: user.given_name || 'User',
                email: user.email,
                token: token
            };
            this.handleLoginSuccess(session);
        })
        .catch(err => console.error("User Info Error:", err));
    },

    fetchMicrosoftUserInfo(token) {
        fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(user => {
            const session = {
                provider: 'microsoft',
                name: user.givenName || 'User',
                email: user.mail || user.userPrincipalName,
                token: token
            };
            this.handleLoginSuccess(session);
        })
        .catch(err => console.error("MS Info Error:", err));
    },

    handleLoginSuccess(session) {
        this.isLoggedIn = true;
        this.userInfo = session;
        chrome.storage.local.set({ userSession: session });
        // Dispatch event or callback to update UI
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { isLoggedIn: true, user: session } }));
    },

    // Helper to get fresh MS Token
    getMicrosoftToken(interactive, callback) {
        const redirectUri = chrome.identity.getRedirectURL();
        const nonce = Math.random().toString(36).substring(2, 15);
        const authUrl = `${MS_AUTH_URL}?client_id=${MS_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(MS_SCOPES)}&nonce=${nonce}`;

        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: interactive
        }, (responseUrl) => {
            if (chrome.runtime.lastError || !responseUrl) {
                callback(null);
                return;
            }
            try {
                const url = new URL(responseUrl);
                const urlParams = new URLSearchParams(url.hash.substring(1));
                const accessToken = urlParams.get("access_token");
                callback(accessToken);
            } catch (e) {
                callback(null);
            }
        });
    }
};
