# Deployment Guide

## Vercel Deployment (Recommended)

### 1. Prerequisites

- Node.js 18+
- Vercel CLI: `npm i -g vercel`
- Git repository

### 2. Deploy

```bash
cd fraud-detector

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod
```

### 3. Environment Variables

Set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `IPHUB_API_KEY` | No | IPHub API key for paid IP lookups |
| `DATABASE_URL` | No | PostgreSQL connection string |

### 4. Custom Domain

1. Go to Vercel Dashboard → Domains
2. Add your domain
3. Update DNS records

## Database Setup (PostgreSQL)

### Option A: Vercel Postgres

```bash
# Enable in Vercel Dashboard → Storage → Create Database → Postgres
# Connection string is auto-added to env vars
```

### Option B: External (Supabase, Neon, etc.)

1. Create PostgreSQL database
2. Run schema: `psql -f database/schema.sql`
3. Add `DATABASE_URL` to Vercel

### Option C: Skip Database

The system works without a database using in-memory caching only.
You'll lose:
- Historical fraud check records
- Fingerprint reputation tracking
- Admin dashboard data

## Build Client Script

To create minified script for `<script>` tag:

```bash
# Install dependencies
npm install

# Build minified version
npm run build:client
```

This creates `public/fraud-detector.min.js`

## Performance Optimization

### 1. Edge Runtime (Optional)

Enable for lower latency:

```typescript
// In src/app/api/fraud-check/route.ts
export const runtime = 'edge';
```

Note: Edge runtime has limitations (no Node.js modules).

### 2. Caching Strategy

- IP lookups cached 1 hour (in-memory)
- For high traffic: add Redis
- Vercel KV: `vercel storage create kv`

### 3. Rate Limiting

Add to `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/api/fraud-check",
      "headers": [
        { "key": "X-RateLimit-Limit", "value": "100" }
      ]
    }
  ]
}
```

## Monitoring

### 1. Vercel Analytics

Enable in Dashboard → Analytics

### 2. Custom Logging

```typescript
// In route.ts, add structured logging
console.log(JSON.stringify({
  event: 'fraud_check',
  ip: clientIp,
  classification: result.classification,
  score: result.score,
  processingTime: result.processingTime
}));
```

### 3. Alerts

Set up alerts for:
- Bad rate > 10% in 5 minutes
- Processing time > 800ms average
- Error rate > 1%

## Cost Estimation

| Component | Free Tier | Paid Tier |
|-----------|-----------|-----------|
| Vercel | 100GB bandwidth/mo | $20/mo |
| ipapi.co | 30K lookups/mo | $15/mo (100K) |
| IPHub | - | $30/mo (100K) |
| Vercel Postgres | 256MB | $20/mo |
| **Total** | **$0-10/mo** | **$50-100/mo** |

For 1-2M requests/month with aggressive caching, free tier should work.

## Scaling Notes

- **1M requests/mo**: Free tier works with caching
- **10M requests/mo**: Add Redis, upgrade IP API tier
- **100M requests/mo**: Consider dedicated infrastructure

## Troubleshooting

### API returns 500

Check Vercel logs: `vercel logs --follow`

### IP always shows as localhost

Make sure `x-forwarded-for` header is present (Vercel adds this automatically).

### Slow response times

1. Check IP API latency
2. Enable edge runtime
3. Add more aggressive caching

### High BAD rate

1. Check if VPN users are legitimate
2. Review datacenter detection patterns
3. Add manual whitelist for known good IPs
