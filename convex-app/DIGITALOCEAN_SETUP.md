# DigitalOcean Server Setup Guide

Complete guide to set up the Instagram scraper service on your DigitalOcean server.

## Server Information

- **IP Address:** 167.172.20.313
- **OS:** Ubuntu
- **Service Port:** 3001

---

## Step 1: Connect to Your Server

Open Terminal (Mac/Linux) or PowerShell (Windows):

```bash
ssh root@167.172.20.313
```

Enter your password when prompted.

---

## Step 2: Install Dependencies

Run this single command to install everything:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
apt-get install -y nodejs git && \
npm install -g pm2
```

This installs:
- Node.js v20 (required for the scraper)
- npm (package manager)
- git (to clone repositories)
- PM2 (process manager to keep service running)

**Wait 2-3 minutes for installation to complete.**

---

## Step 3: Create Service Directory

```bash
mkdir -p /opt/instagram-service && cd /opt/instagram-service
```

---

## Step 4: Clone Instagram Scraper

```bash
git clone https://github.com/ahmedrangel/instagram-media-scraper.git scraper
```

---

## Step 5: Create Environment File

Create the `.env` file (optional - uses default port):

```bash
cat > /opt/instagram-service/.env << 'EOF'
PORT=3001
EOF
```

**That's it! No Instagram credentials or headers needed.**

The service uses Puppeteer to visit public Instagram pages like a normal browser.

---

## Step 6: Upload Service Files

The service files will be created in your local project. Upload them to the server:

**From your local computer (NOT on the server):**

```bash
# Navigate to your project directory
cd C:\Healthymama-convex-vercel\convex-app

# Upload the service files
scp -r instagram-service/* root@167.172.20.313:/opt/instagram-service/
```

Enter your password when prompted.

---

## Step 7: Install Service Dependencies

**Back on the server:**

```bash
cd /opt/instagram-service
npm install
```

This installs Express.js and other dependencies.

---

## Step 8: Start the Service with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Copy and run the command that PM2 outputs (it will look like):
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

---

## Step 9: Configure Firewall

Allow traffic on port 3001:

```bash
ufw allow 3001/tcp
ufw reload
```

---

## Step 10: Test the Service

```bash
curl http://localhost:3001/health
```

You should see: `{"status":"ok"}`

---

## Useful PM2 Commands

```bash
# Check service status
pm2 status

# View logs
pm2 logs instagram-service

# Restart service
pm2 restart instagram-service

# Stop service
pm2 stop instagram-service

# Monitor in real-time
pm2 monit
```

---

## Updating the Service

If you need to update the service code:

1. Upload new files from your local machine
2. Restart the service:
   ```bash
   pm2 restart instagram-service
   ```

---

## Troubleshooting

### Service won't start
```bash
pm2 logs instagram-service --lines 50
```

### Can't connect from app
```bash
# Check if service is listening
netstat -tulpn | grep 3001

# Check firewall
ufw status
```

### Instagram blocking requests
- The service uses Puppeteer which looks like a real browser
- If blocked, try adding delays between requests (uncommon)

---

## Security Notes

- **Never commit `.env` to git** (contains your Instagram session)
- Change your DigitalOcean root password regularly
- Consider setting up a non-root user for better security
- Use SSH keys instead of password authentication

---

## Next Steps

After the server is set up:
1. Update your Next.js app to point to this server
2. Test the integration with a sample Instagram URL
3. Remove the old Railway service

---

**Service URL for your app:**
```
http://167.172.20.313:3001/extract-instagram
```
