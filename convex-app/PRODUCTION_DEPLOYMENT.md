# Production Deployment Guide

Complete guide to deploying HealthyMama to production with Instagram + Mux integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Setup](#environment-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Convex Production](#convex-production)
5. [DigitalOcean Production](#digitalocean-production)
6. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Overview

### Production Architecture

```
User Browser
    ↓
Vercel (Next.js App)
    ↓
├─ Convex (Database)
├─ Clerk (Auth)
├─ OpenRouter (AI)
├─ Mux (Video Hosting)
└─ DigitalOcean (Instagram Scraper)
```

### What You're Deploying

| Component | Platform | Purpose |
|-----------|----------|---------|
| Next.js App | Vercel | Frontend + API routes |
| Database | Convex | Real-time database |
| Auth | Clerk | User authentication |
| Instagram Scraper | DigitalOcean | Extract Instagram videos |
| Video Hosting | Mux | Host & stream videos |

---

## Environment Setup

### 1. Vercel Environment Variables

Go to: https://vercel.com/your-project/settings/environment-variables

**Add ALL these variables:**

```env
# Convex
CONVEX_DEPLOYMENT=prod:your-production-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev

# AI Services
OPENAI_API_KEY=sk-proj-...
OPEN_ROUTER_API_KEY=sk-or-v1-...
GOOGLE_AI_API_KEY=AIza...

# Instagram Scraper (DigitalOcean)
DIGITALOCEAN_INSTAGRAM_URL=http://167.172.20.313:3001

# Mux Video Hosting
MUX_TOKEN_ID=f8e1dd1a-988f-4756-b6bf-d35395d9bc8a
MUX_TOKEN_SECRET=DMVziupkb3XS4AUUPRoAxS2bJQ0PhQuHkch1ieHfQp+hTwlUb1DEzpokkQZEyBEEEQUUvaCB8Pt

# ElevenLabs (Voice)
ELEVENLABS_API_KEY=sk_...
NEXT_PUBLIC_ELEVENLABS_API_KEY=sk_...
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_...

# Instacart
INSTACART_API_KEY=keys...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**⚠️ Important:**
- Use **production** keys (not test keys!)
- For Clerk: Switch to `pk_live_` and `sk_live_`
- For Stripe: Switch to `pk_live_` and `sk_live_`

---

### 2. Convex Production Deployment

```bash
# Create production deployment
npx convex deploy --prod

# Note the deployment URL
# Example: prod:happy-elephant-123
```

**Update Vercel env vars with the new:**
- `CONVEX_DEPLOYMENT=prod:happy-elephant-123`
- `NEXT_PUBLIC_CONVEX_URL=https://happy-elephant-123.convex.cloud`

---

### 3. Clerk Production Setup

1. Go to https://dashboard.clerk.com
2. Create a **Production** instance
3. Configure:
   - Domain: `your-app.vercel.app`
   - Callback URLs: `https://your-app.vercel.app/*`
4. Copy production keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_live_...)
   - `CLERK_SECRET_KEY` (sk_live_...)

---

## Vercel Deployment

### First-Time Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Link project (from your project directory)
cd C:\Healthymama-convex-vercel\convex-app
vercel link

# 4. Deploy to production
vercel --prod
```

### Subsequent Deployments

```bash
# From project directory
vercel --prod
```

Or just:
```bash
git push
```

Vercel auto-deploys when you push to `main` branch.

---

## DigitalOcean Production

### Make Service Production-Ready

**1. Update Environment**

SSH to server:
```bash
ssh root@167.172.20.313
cd /opt/instagram-service
nano .env
```

Add:
```env
PORT=3001
NODE_ENV=production
```

**2. Enable HTTPS (Optional but Recommended)**

Install Nginx + Let's Encrypt:

```bash
# Install Nginx
apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx as reverse proxy
cat > /etc/nginx/sites-available/instagram-service << 'EOF'
server {
    listen 80;
    server_name 167.172.20.313;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/instagram-service /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Now your service is available at: http://167.172.20.313
```

**3. Set Up SSL (if you have a domain)**

If you point a domain (e.g., `instagram-api.yourdomain.com`) to `167.172.20.313`:

```bash
certbot --nginx -d instagram-api.yourdomain.com
```

Then update Vercel env:
```env
DIGITALOCEAN_INSTAGRAM_URL=https://instagram-api.yourdomain.com
```

**4. Enable Auto-Updates**

Create update script:
```bash
cat > /opt/instagram-service/update.sh << 'EOF'
#!/bin/bash
cd /opt/instagram-service
git pull
npm install --production
pm2 restart instagram-service
EOF

chmod +x /opt/instagram-service/update.sh
```

**5. Set Up Monitoring**

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Enable monitoring dashboard (optional)
pm2 link [your-pm2-key] [your-pm2-secret]
```

---

## Post-Deployment Checklist

### ✅ Verify All Services

**1. Vercel App**
- [ ] Visit: https://your-app.vercel.app
- [ ] Sign in works (Clerk)
- [ ] Convex data loads

**2. Instagram Import**
- [ ] Click "+" button
- [ ] Paste Instagram URL
- [ ] Wait ~20 seconds
- [ ] Recipe imports with video

**3. Mux Video**
- [ ] Videos upload to Mux
- [ ] Videos play in recipe cards
- [ ] Check Mux dashboard for assets

**4. DigitalOcean Service**
- [ ] Test: `curl http://167.172.20.313:3001/health`
- [ ] Check: `ssh root@167.172.20.313 "pm2 status"`
- [ ] View logs: `ssh root@167.172.20.313 "pm2 logs instagram-service"`

---

## Monitoring & Maintenance

### Daily Checks

```bash
# Check service health
ssh root@167.172.20.313 "pm2 status"

# Check recent logs
ssh root@167.172.20.313 "pm2 logs instagram-service --lines 50"
```

### Weekly Maintenance

```bash
# Update system packages
ssh root@167.172.20.313 "apt-get update && apt-get upgrade -y"

# Check disk space
ssh root@167.172.20.313 "df -h"

# Review error logs
ssh root@167.172.20.313 "pm2 logs instagram-service --err --lines 100"
```

### Mux Monitoring

1. Go to https://dashboard.mux.com
2. Check **Data** → **Video Views**
3. Monitor encoding success rate
4. Track bandwidth usage

---

## Scaling Considerations

### When to Scale

| Metric | Action Needed |
|--------|---------------|
| > 100 imports/day | Add more RAM to DigitalOcean |
| > 500 imports/day | Add second DigitalOcean server |
| > 1000 imports/day | Consider managed Instagram API service |

### Scaling DigitalOcean

**Vertical Scaling (More Power):**
```
Current: $5/month (1 CPU, 1GB RAM)
Upgrade: $12/month (2 CPU, 2GB RAM)
```

**Horizontal Scaling (More Servers):**
1. Clone server setup to new IP
2. Add load balancer
3. Update Vercel env with load balancer URL

---

## Troubleshooting Production

### Instagram Import Fails

**Check service status:**
```bash
ssh root@167.172.20.313 "pm2 status instagram-service"
```

**Check logs:**
```bash
ssh root@167.172.20.313 "pm2 logs instagram-service --lines 100"
```

**Restart service:**
```bash
ssh root@167.172.20.313 "pm2 restart instagram-service"
```

### Mux Upload Fails

1. Check Mux dashboard for errors
2. Verify credentials in Vercel env vars
3. Check Vercel function logs

### Convex Errors

```bash
# Check Convex logs
npx convex logs --tail

# Redeploy Convex
npx convex deploy --prod
```

---

## Security Best Practices

### 1. Secure Environment Variables

- ✅ Never commit `.env.local` to git
- ✅ Use Vercel's environment variables (encrypted)
- ✅ Rotate API keys every 90 days

### 2. Server Security

```bash
# Enable automatic security updates
ssh root@167.172.20.313
apt-get install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 3. Rate Limiting

Add rate limiting to API routes:

```typescript
// app/api/instagram/import/route.ts
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  // ... rest of code
}
```

---

## Backup Strategy

### Convex Backups

Convex automatically backs up your data. You can also:

```bash
# Export data
npx convex export

# Import data
npx convex import
```

### Server Backups

```bash
# Backup service files
ssh root@167.172.20.313 "tar -czf /tmp/instagram-service-backup.tar.gz /opt/instagram-service"
scp root@167.172.20.313:/tmp/instagram-service-backup.tar.gz ./backups/
```

---

## Cost Breakdown (Production)

| Service | Cost/Month |
|---------|-----------|
| Vercel (Pro) | $20 |
| Convex (Starter) | $25 |
| DigitalOcean | $5 |
| Mux (100 recipes) | $2-5 |
| Clerk (Pro) | $25 |
| **Total** | **~$77-80/month** |

**Free Tier Option:**
- Vercel: Hobby (Free)
- Convex: Free tier (5GB)
- DigitalOcean: $5/month
- Mux: $20 free credit
- Clerk: Free (up to 10k users)

**Total Free: $5/month** (just DigitalOcean!)

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Convex Docs**: https://docs.convex.dev
- **Mux Docs**: https://docs.mux.com
- **Clerk Docs**: https://clerk.com/docs
- **DigitalOcean**: https://docs.digitalocean.com

---

**Ready to deploy?** Follow the steps above and you'll be live in production! 🚀
