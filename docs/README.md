# Fraud Detection System - Integration Guide

This guide shows how to replace Anura with your custom fraud detection system.

## Quick Start

### 1. Add Client Script

**Before (Anura):**
```html
<script src="https://script.anura.io/YOUR_KEY/anura.js"></script>
<script>
  function anuraCallback() {
    if (Anura.getAnura().isBad()) {
      // Block ads
    } else {
      startCSA();
    }
  }
</script>
```

**After (Custom):**
```html
<script src="/fraud-detector.min.js"></script>
<script>
  const detector = new FraudDetector({
    onComplete: function(result) {
      if (result.classification === 'GOOD') {
        startCSA(); // Show Google CSA ads
      } else if (result.classification === 'WARN') {
        startCSA(); // Show ads but flag for monitoring
        console.log('WARN:', result.reason);
      } else {
        console.log('Blocked:', result.reason);
        // Optionally show non-monetized content
      }
    },
    onError: function(error) {
      console.error('Detection error:', error);
      startCSA(); // Fail-safe: show ads on error
    }
  });
  
  detector.analyze();
</script>
```

### 2. API Endpoint

The client script automatically calls `/api/fraud-check`. Make sure this endpoint is deployed.

**Request:**
```json
{
  "fingerprint": {
    "device": { "type": "mobile", "isFakeMobile": false, ... },
    "userAgent": "...",
    "canvasHash": "...",
    ...
  },
  "behavior": {
    "mouseMovements": 45,
    "touchEvents": 12,
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "classification": "GOOD",
    "score": 95,
    "reason": "Mobile carrier: Reliance Jio",
    "timestamp": 1703847600000,
    "processingTime": 150
  },
  "requestId": "abc-123"
}
```

## Classification Behavior

| Classification | Action | When |
|---------------|--------|------|
| `GOOD` | Show ads | Mobile carrier IP, good behavior score |
| `WARN` | Show ads + log | Low behavior, unknown patterns |
| `BAD` | Block ads | VPN, datacenter, fake mobile, bots |

## Performance

- **Target**: < 800ms total
- **Typical**: 250-400ms
- **Breakdown**:
  - Fingerprinting: 30-50ms
  - Behavior collection: 3000ms (configurable)
  - API call: 100-200ms

## Options

```javascript
new FraudDetector({
  // Required
  onComplete: (result) => { ... },
  
  // Optional
  onError: (error) => { ... },
  onProgress: (stage) => { ... }, // 'init' | 'fingerprinting' | 'collecting_behavior' | 'sending_request' | 'complete'
  apiEndpoint: '/api/fraud-check', // Default
  timeout: 5000,                   // API timeout (ms)
  collectBehavior: true,           // Set false for instant check
  behaviorDuration: 3000,          // Behavior collection time (ms)
  debug: false                     // Console logging
});
```

## Instant Mode (No Behavior)

For fastest possible check (useful for returning users):

```javascript
const result = await detector.analyzeNow();
// Returns immediately with fingerprint-only classification
```

## Testing

### 1. Normal User
Open in regular browser → Should get `GOOD` or `WARN`

### 2. Mobile Emulation
Chrome DevTools → Toggle Device Toolbar → Should get `BAD` (fake mobile)

### 3. VPN
Connect to VPN → Should get `BAD` (VPN detected)

### 4. Automation
```javascript
// In console
navigator.webdriver = true;
// Refresh → Should get `BAD` (automation detected)
```

## Environment Variables

```env
# Optional: IPHub API key for paid tier
IPHUB_API_KEY=your_key_here

# Optional: Database URL
DATABASE_URL=postgresql://user:pass@host:5432/fraud_detection

# Optional: Debug mode
NODE_ENV=development
```

## Migration Checklist

- [ ] Deploy API endpoint (`/api/fraud-check`)
- [ ] Add client script to pages
- [ ] Test in development
- [ ] Run parallel with Anura for 1 week
- [ ] Compare results
- [ ] Remove Anura when confident
- [ ] Set up monitoring/alerts
