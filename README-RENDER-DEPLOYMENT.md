# Render Deployment Guide for Discord Fight Night Bot

Since Railway requires a paid plan, this guide will help you deploy your Discord Fight Night bot to **Render** for free 24/7 cloud hosting.

## Why Render?
- **Free Tier**: 750 hours/month (sufficient for 24/7 operation)
- **GitHub Integration**: Direct deployment from your repository
- **Auto-restart**: Automatic failure recovery
- **Persistent Storage**: For your SQLite database
- **Easy Setup**: Similar to Railway but completely free

## Step-by-Step Deployment

### 1. Sign Up for Render
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

### 2. Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `SanakhteR/discord-fight-night-bot`
3. Configure the service:
   - **Name**: `discord-fight-night-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Plan**: `Free`

### 3. Configure Environment Variables
In the Render dashboard, add these environment variables:

```
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
GUILD_ID=your_discord_guild_id_here
PREFIX=!
ADMIN_ROLE_NAME=Power
MODERATOR_ROLE_NAME=Moderator
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
DATABASE_PATH=./data/bot.db
NODE_ENV=production
```

**Important**: Copy the exact values from your local `.env` file.

### 4. Deploy
1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Install dependencies with `npm install`
   - Start your bot with `node index.js`

### 5. Deploy Slash Commands
Once your bot is running:
1. Run locally: `node deploy-commands.js`
2. Or add this as a one-time build command in Render

### 6. Keep Bot Alive (Important!)
Render free tier sleeps after 15 minutes of inactivity. To keep your bot running 24/7:

**Option A: UptimeRobot (Recommended)**
1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free)
2. Add your Render service URL as a monitor
3. Set check interval to 5 minutes
4. This will ping your service to keep it awake

**Option B: Self-Ping (Add to your bot)**
Add this to your `index.js` (already configured in your bot):
```javascript
// Keep alive ping (for free hosting)
if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
        console.log('Keep alive ping');
    }, 14 * 60 * 1000); // Every 14 minutes
}
```

## Alternative Free Hosting Options

### Fly.io
- **Free Tier**: 3 shared VMs with 256MB RAM
- **Setup**: `flyctl launch` after installing Fly CLI
- **Good for**: Discord bots with Docker

### Glitch
- **Free Tier**: Available with project boosting
- **Setup**: Import from GitHub
- **Good for**: Simple Node.js apps

### Cyclic
- **Free Tier**: Serverless deployment
- **Setup**: Connect GitHub repository
- **Good for**: Lightweight applications

## Render vs Railway Comparison

| Feature | Render (Free) | Railway (Paid) |
|---------|---------------|----------------|
| Cost | Free | $5+/month |
| Uptime | 750 hours/month | Unlimited |
| Sleep Policy | 15 min inactivity | None |
| Build Time | Fast | Very Fast |
| GitHub Integration | ✅ | ✅ |
| Custom Domains | ✅ | ✅ |
| Database | Persistent | Persistent |

## Troubleshooting

### Bot Not Connecting
- Check environment variables in Render dashboard
- Verify Discord token is valid
- Check Render logs for errors

### Commands Not Working
- Run `node deploy-commands.js` to register slash commands
- Verify `CLIENT_ID` and `GUILD_ID` are correct

### Bot Going Offline
- Set up UptimeRobot monitoring
- Check if you've exceeded 750 hours/month
- Verify auto-deploy is disabled to prevent unnecessary rebuilds

### Database Issues
- Render provides persistent storage for SQLite
- Database files are preserved between deployments
- Check file permissions if database creation fails

## Monitoring Your Bot

### Render Dashboard
- **Logs**: Real-time application logs
- **Metrics**: CPU and memory usage
- **Events**: Deployment history
- **Settings**: Environment variables and configuration

### Discord Bot Status
- Monitor bot online status in Discord
- Test slash commands regularly
- Check Google Sheets integration

## Cost Optimization

### Free Tier Limits
- **750 hours/month**: Sufficient for 24/7 with UptimeRobot
- **Bandwidth**: 100GB/month (more than enough for Discord bot)
- **Build minutes**: 500/month (plenty for occasional updates)

### Upgrade Considerations
- If you exceed free limits, Render's paid plans start at $7/month
- Paid plans remove sleep policy and provide more resources
- Consider upgrading if your bot grows significantly

## Next Steps

1. **Deploy to Render** using the steps above
2. **Set up UptimeRobot** to keep bot alive 24/7
3. **Test all functionality** in the cloud environment
4. **Monitor performance** through Render dashboard

Your Discord Fight Night bot will now run 24/7 in the cloud for free! 🚀

## Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Discord Bot Issues**: Check logs in Render dashboard
- **Google Sheets Problems**: Verify service account permissions
