# Instagram Account Rotation Setup Guide

This guide explains how to set up and manage multiple Instagram accounts for scaling to 100+ video extractions per hour.

## Architecture Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Next.js App   │─────▶│  Railway Python │─────▶│  Convex Database│
│  (Vercel)       │      │  Service        │      │  (Accounts)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │  Instagram  │
                         │  API        │
                         └─────────────┘
```

**How it works:**
1. Railway Python service calls Convex to get next available Instagram account
2. Service uses account credentials to fetch Instagram data
3. After successful use, service updates account usage stats in Convex
4. On errors, service marks account as unhealthy (rate_limited/banned/login_failed)
5. Convex automatically rotates to healthy accounts using round-robin strategy

## Step 1: Configure Convex Database

### 1.1 Deploy Convex Schema Changes

The `instagramAccounts` table has already been added to your Convex schema.

Deploy the schema changes:

```bash
cd convex-app
npx convex dev
```

This will push the schema changes to your Convex deployment.

### 1.2 Get Convex Deployment URL

1. Go to your Convex dashboard: https://dashboard.convex.dev
2. Select your project (`healthymama-convex-vercel` or similar)
3. Go to **Settings** → **URL & Deployment**
4. Copy your deployment URL (format: `https://your-deployment.convex.cloud`)

## Step 2: Configure Railway Environment Variables

### 2.1 Add CONVEX_URL to Railway

1. Go to your Railway dashboard: https://railway.app/dashboard
2. Select your `instagram-service` project
3. Go to **Variables** tab
4. Add new variable:
   - **Key:** `CONVEX_URL`
   - **Value:** Your Convex deployment URL (e.g., `https://caring-falcon-123.convex.cloud`)

### 2.2 Remove Old Variables (Optional)

The following variables are now deprecated (credentials are managed in Convex):
- `IG_USERNAME` - Can be removed
- `IG_PASSWORD` - Can be removed

**Note:** Don't remove them until you've added at least one account to Convex (see Step 3).

### 2.3 Redeploy Railway Service

After updating environment variables, Railway will automatically redeploy.

Alternatively, trigger manual redeploy:
```bash
railway up
```

## Step 3: Add Instagram Accounts to Convex

### Method 1: Using Convex Dashboard (Recommended)

1. Go to Convex dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to **Functions** tab
4. Find `instagramAccounts:addAccount` mutation
5. Run the mutation with your Instagram credentials:

```json
{
  "username": "healthymama_bot1",
  "password": "your_secure_password",
  "notes": "Primary account"
}
```

6. Repeat for each account you want to add

### Method 2: Using Convex CLI

```bash
npx convex run instagramAccounts:addAccount \
  --arg '{"username": "healthymama_bot1", "password": "your_password", "notes": "Primary account"}'
```

### Method 3: Using HTTP API (Advanced)

```bash
curl -X POST https://your-deployment.convex.cloud/api/mutation \
  -H "Content-Type: application/json" \
  -d '{
    "path": "instagramAccounts:addAccount",
    "args": {
      "username": "healthymama_bot1",
      "password": "your_password",
      "notes": "Primary account"
    },
    "format": "json"
  }'
```

## Step 4: Create Instagram Accounts (Best Practices)

### Account Creation Tips

1. **Use dedicated accounts** (not personal accounts)
   - Create new Instagram accounts specifically for API access
   - Use unique emails for each account

2. **Account naming**
   - Use descriptive names: `healthymama_bot1`, `healthymama_bot2`, etc.
   - Keep track of which account is which

3. **Password security**
   - Use strong, unique passwords for each account
   - Store passwords securely (Convex encrypts them at rest)

4. **Account warm-up**
   - Don't immediately start scraping with new accounts
   - Follow a few accounts, like a few posts (act human)
   - Wait 24-48 hours before high-volume scraping

5. **Profile setup**
   - Add profile picture (use a logo or generic image)
   - Add bio (something like "Recipe collector" or leave blank)
   - Make account public (private accounts can't view public posts)

### How Many Accounts Do You Need?

**Instagram Rate Limits:**
- ~200-500 requests per hour per account (unofficial)
- Each recipe extraction = ~2-3 requests (media info + comments)

**Scaling Guide:**
- **1 account:** ~50-100 videos/hour (safe)
- **5 accounts:** ~250-500 videos/hour
- **10 accounts:** ~500-1000 videos/hour
- **20+ accounts:** 1000+ videos/hour

**Recommendation:** Start with 3-5 accounts, add more if needed.

## Step 5: Optional - Configure Proxies

Proxies help distribute requests across different IP addresses, reducing rate limit risks.

### Adding Accounts with Proxies

When adding an account, include a `proxyUrl`:

```json
{
  "username": "healthymama_bot1",
  "password": "your_password",
  "proxyUrl": "http://proxy_user:proxy_pass@proxy.example.com:8080",
  "notes": "Primary account with residential proxy"
}
```

### Proxy Providers (Recommended)

- **Bright Data** (https://brightdata.com) - Residential proxies, expensive but reliable
- **Smartproxy** (https://smartproxy.com) - Good balance of price/quality
- **Oxylabs** (https://oxylabs.io) - Enterprise-grade, very expensive

**Cost Estimate:**
- Residential proxies: $5-15 per GB
- Datacenter proxies: $1-3 per GB (higher ban risk)

**Do you need proxies?**
- Not required for <100 videos/hour
- Recommended for 200+ videos/hour
- Essential for 500+ videos/hour

## Step 6: Test the System

### 6.1 Test Account Retrieval

Using Convex dashboard:
1. Go to **Functions** → `instagramAccounts:getNextAccount`
2. Run the query (no arguments needed)
3. Verify it returns an account

### 6.2 Test Instagram Import

1. Go to your HealthyMama app
2. Click the **+** button → **Import from Instagram**
3. Paste an Instagram reel URL
4. Click **Extract Recipe**
5. Check Railway logs to see which account was used

### 6.3 Monitor Account Health

Using Convex dashboard:
1. Go to **Functions** → `instagramAccounts:listAccounts`
2. Run the query
3. Check account statuses, usage counts, and last used timestamps

## Managing Accounts

### View All Accounts

```bash
npx convex run instagramAccounts:listAccounts
```

### Check Account Stats

```bash
npx convex run instagramAccounts:getAccountStats
```

Returns:
```json
{
  "totalAccounts": 5,
  "activeAccounts": 4,
  "totalUsage": 1234,
  "statusBreakdown": {
    "active": 4,
    "rate_limited": 1,
    "banned": 0,
    "login_failed": 0
  },
  "averageUsagePerAccount": 247
}
```

### Reactivate Rate-Limited Account

If an account is marked as `rate_limited`, you can reactivate it after the rate limit window (usually 1 hour):

```bash
npx convex run instagramAccounts:updateAccountStatus \
  --arg '{"accountId": "abc123", "status": "active", "isActive": true}'
```

### Delete Account

```bash
npx convex run instagramAccounts:deleteAccount \
  --arg '{"accountId": "abc123"}'
```

**Warning:** This permanently deletes the account. Consider setting `isActive: false` instead.

## Troubleshooting

### Error: "No Instagram accounts available"

**Cause:** No accounts in Convex database, or all accounts are inactive/unhealthy.

**Solution:**
1. Check accounts: `npx convex run instagramAccounts:listAccounts`
2. Add new account if needed (see Step 3)
3. Reactivate unhealthy accounts if they're recovered

### Error: "Instagram login failed"

**Cause:** Invalid username/password, or Instagram flagged the account.

**Solution:**
1. Verify credentials are correct
2. Try logging in manually on Instagram app/website
3. If account is locked, follow Instagram's recovery flow
4. Update account in Convex or delete and re-add with new credentials

### Error: "Instagram rate limit reached"

**Cause:** Account hit Instagram's rate limit (~200-500 requests/hour).

**Solution:**
1. Service automatically marks account as `rate_limited`
2. Rotation will use a different account
3. Wait 1 hour, then reactivate: `updateAccountStatus({accountId, status: "active"})`
4. Add more accounts to distribute load

### Error: "Instagram account requires verification"

**Cause:** Instagram requires email/SMS verification, or detected suspicious activity.

**Solution:**
1. Service marks account as `banned`
2. Login manually to Instagram and complete verification
3. Wait 24 hours before using account for scraping
4. Reactivate in Convex: `updateAccountStatus({accountId, status: "active"})`

### Accounts are rotating, but extraction is slow

**Cause:** Too many requests from same IP, or accounts are rate limited.

**Solution:**
1. Add proxies to distribute IP addresses (see Step 5)
2. Add more accounts to reduce load per account
3. Check account stats to see if any are rate limited

## Best Practices

### 1. Monitor Account Health

- Check account stats daily: `getAccountStats()`
- Look for patterns: if multiple accounts are banned, you may be scraping too aggressively
- Reactivate rate-limited accounts after waiting period

### 2. Gradual Scaling

- Start with 1-2 accounts
- Test for a few days
- Add more accounts gradually (don't jump from 1 to 20 overnight)
- Monitor ban/rate limit rates

### 3. Account Rotation

- Don't manually specify which account to use - let the system rotate
- The round-robin strategy ensures even distribution
- Accounts with `lastUsedAt = null` (never used) are prioritized

### 4. Security

- Never commit Instagram credentials to git
- Use environment variables or Convex database only
- Rotate passwords periodically
- Use 2FA on Instagram accounts (may require app-specific passwords)

### 5. Cost Management

- Each Instagram account is free
- Proxies cost money (~$5-15/GB for residential)
- Start without proxies, add them if you hit rate limits
- Monitor proxy usage to avoid unexpected costs

## Cost Estimation

### Instagram Accounts
- **Cost:** Free
- **Time to create:** 5-10 minutes per account
- **Recommended:** 5-10 accounts

### Proxies (Optional)
- **Residential proxies:** $5-15 per GB
- **Usage:** ~10-50 MB per 100 videos (depends on video size)
- **Monthly cost (500 videos/day):** $5-25

### Total Monthly Cost
- **Without proxies:** $0 (just time to create accounts)
- **With proxies:** $5-25 depending on volume

## Summary

You've successfully set up Instagram account rotation! Here's what you've accomplished:

✅ Added `instagramAccounts` table to Convex schema
✅ Created Convex functions for account management
✅ Updated Python service to use Convex for account rotation
✅ Configured Railway with Convex URL
✅ Ready to add Instagram accounts and scale to 100+ videos/hour

**Next Steps:**
1. Add 3-5 Instagram accounts to Convex (see Step 3)
2. Test the import feature with different Instagram URLs
3. Monitor account health and usage stats
4. Add more accounts or proxies as needed for scaling

**Need help?** Check the troubleshooting section or review the architecture diagram.
