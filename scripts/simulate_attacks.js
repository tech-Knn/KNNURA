const API_URL = 'http://localhost:3000/api/fraud-check';

// Helper to send request
async function check(name, payload) {
    console.log(`Sending ${name}...`);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        const resData = data.result || {};
        const color = resData.classification === 'GOOD' ? '\x1b[32m' : '\x1b[31m'; // Green/Red
        const reset = '\x1b[0m';
        console.log(`[${name}] Status: ${res.status} | Result: ${color}${resData.classification}${reset} | Reason: ${resData.reason}\n`);
    } catch (e) {
        console.error(`[${name}] Failed:`, e.code || e.message);
        console.log('Is the server running? Run "npm run dev" in another terminal.');
    }
}

// 1. GOOD User (Mobile)
const GOOD_USER = {
    fingerprint: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        language: 'en-US',
        timezone: 'Asia/Kolkata',
        device: {
            type: 'mobile',
            isFakeMobile: false,
            isAutomated: false,
            isHeadless: false,
            browser: 'Safari',
            browserVersion: '14.1.2',
            os: 'iOS',
            osVersion: '14.7.1'
        },
        screen: { width: 390, height: 844, availWidth: 390, availHeight: 844, colorDepth: 32, pixelRatio: 3 },
        hardware: { cores: 6, memory: 4, maxTouchPoints: 5, hasTouch: true },
        ids: { canvas: 'test-canvas-hash', webgl: 'test-webgl-hash' }
    },
    behavior: { mouseMovements: 0, touchEvents: 25, scrollEvents: 10, keyPresses: 0, activeTimeMs: 5000 }
};

// 2. BOT (Automation Detected)
const BOT_USER = JSON.parse(JSON.stringify(GOOD_USER));
BOT_USER.fingerprint.device.isAutomated = true; // navigator.webdriver = true
BOT_USER.fingerprint.device.type = 'bot';

// 3. HEADLESS (Headless Chrome)
const HEADLESS_USER = JSON.parse(JSON.stringify(GOOD_USER));
HEADLESS_USER.fingerprint.device.isHeadless = true;
HEADLESS_USER.fingerprint.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/90.0.4430.212 Safari/537.36';

// 4. FAKE MOBILE (DevTools)
const FAKE_MOBILE = JSON.parse(JSON.stringify(GOOD_USER));
FAKE_MOBILE.fingerprint.device.isFakeMobile = true;
// Simulate mismatch: Mobile UA but clearly Desktop hardware features (if we checked deeper, but boolean is enough here)

(async () => {
    console.log(`🚀 Starting Attack Simulation on ${API_URL}\n`);

    // Wait a bit to ensure server is ready if just started
    // await new Promise(r => setTimeout(r, 1000));

    await check('GOOD FLOW (Valid Mobile)', GOOD_USER);
    await check('BOT ATTACK (Selenium/WebDriver)', BOT_USER);
    await check('HEADLESS CHROME (Script)', HEADLESS_USER);
    await check('FAKE MOBILE SPOOF (DevTools)', FAKE_MOBILE);

    console.log('✅ Simulation Complete! Check your Dashboard Logs.');
})();
