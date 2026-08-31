# Fix Google Sheets Connection on Fly.io

## Problem
The Discord bot deployed to Fly.io is not connecting to Google Sheets correctly.

## Most Likely Causes & Solutions

### 1. Environment Variables Not Set in Fly.io

**Check current secrets:**
```bash
flyctl secrets list --app discord-fight-night-bot-andre
```

**Set all required environment variables:**
```bash
# Discord Configuration
flyctl secrets set DISCORD_TOKEN="<YOUR_DISCORD_BOT_TOKEN>" --app discord-fight-night-bot-andre
flyctl secrets set CLIENT_ID="1415866855142461573" --app discord-fight-night-bot-andre
flyctl secrets set GUILD_ID="338005047851876353" --app discord-fight-night-bot-andre

# Bot Configuration
flyctl secrets set PREFIX="!" --app discord-fight-night-bot-andre
flyctl secrets set ADMIN_ROLE_NAME="Power" --app discord-fight-night-bot-andre
flyctl secrets set MODERATOR_ROLE_NAME="Moderator" --app discord-fight-night-bot-andre
flyctl secrets set DATABASE_PATH="/app/data/bot.db" --app discord-fight-night-bot-andre

# Google Sheets - CRITICAL: Set as single line JSON
flyctl secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"fight-night-bot","private_key_id":"22497b34927afb5992c11a607bdc5c88bd29378c","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDL/oDURNaFTElv\nIFsaX0oPM30Foi/Y16+LKMCli6NL4H2Zj590bvH+/EySSU2UTdTfze+KDGVLEbCK\n3IvrTxUjgffCmgkOr+hjwyR+J4A0y8ZMsT9cH/ES8+lBRmIaomLqyfZJdEucCtee\nZbxWsSb1NnpBfZ/GoijM7wCHDdPlwZsnT4iEY290+vrG9zj2g5phr844hrPR6+gL\nvmmvo7vIpKhkwHMUUP0RDDTOtMbKU5nSpA29M79arbBBOmKdoLIMn2hYWdW+VN0I\nvmHOwWOq3bDXE1CXKE1OcacHaxCRO7HcaQy7xXgzylthr0MwJnDSWKEHy0k8SxcC\n9CRoQHKlAgMBAAECggEAQHAuhd8Q3J6Se9X+sT/0hwS+s27eKmNHgm/nGuQXOzq4\nsi9aMU9yhhdwoK0jInvLiL7msfbkcGgwGk08raIXjVXay9AYmFkc0ZatCmSz7PmJ\ntGQxHYrBfjkqL4JqLvuov334nI9t6ubJ4bFFYyUmp0MEL3fdZsOGm+XLht3pV6PW\nSYmDfmJ9hDp1AMIh/vTP55WHSMtcbNYtcA/OTW5LcEl0NqTjhst7WE6qO6GWmphY\nayGU0XaqOKEFZnlpI9NaMDYB5aiWQ7ttkymJ0D1ey/GAVYkAfo2gz7GshOAt4fD7\nsViMkw8/k0JNEbaYr17cEdkkJLuT3xVabOtsQzsNaQKBgQDsEnI01LwzFyXY5d6l\n50h5bLVElTlpzz7Rfr5dphBRwTDki4kTvaEYqeBntYJRjUeQ4SXAowN4yG4Oc40C\nn1MyYLWQWMJRS/LmZ4XzK515Yx6jig0zPD4BrJhQ6jAp4wXQJhgHicPQekNrWWnJ\noWP9s2opl5eGrSKi7YAbFUqniwKBgQDdNtlCFApQJKcXTcEDoCy5X/OAx6ZbvaRU\nYKpMBz5gB7zqdCw9rrIKyh+TsSb0aF2WluZ/UeQnnZwhB9Yv+TOtraRrgO8LZ6cf\nVMj6ZmioNIBNvUpM2I1DCK2h6SLT26gydTHCmN5hLttX9KNtKtkpFudFCUV8PPvE\n2tcsCiIUjwKBgQDo5gnmNTq27M9Z/O57noHRyX3L+6x4xw2igPguS/ctsPsbfs3t\nu9eDDZVmu5ul+Uvxky47rpduQc7SUw162NSrjt2RWv/aVKN+zANKtGzXpQJFNZ1w\nPq6t2CktKt35dQ/3Gp36Ud/tfbGl5sCHO8H6OVczUWscYxMYylboYUkVoQKBgQC+\nqPhl2GnvGzgcgLp7yoDhoQ55jxoV9gR9aPc+IfwjvmeX11sOKtRvMjg3DjeZ7Z3E\nHfk6ATXY4yHe4ic8H9fnuEJ/GZhuRv8mpOe30a4gU2fGGQDB7N8LyJ4Gb67B1I9K\nNfIWW7VHI6CPVV3JyGV04bWgrdYCt3jz+P39ihpHhwKBgQDbmOP8EdIYkybCFwBF\nknFwLoe/HS3yS5ASu7vN8MtTs8e3cByaBChhj7tMIwPfAJfUYah+sJo2LSYl1l4z\nftoSYYBQ9JKyQ4tIcQn/zZNNKiCizpzYa4qyNJ24gHOI9HrZj110pTAOi+4/w9lT\ndW1D2qHi/kgJjy/0XK5Opm4G9g==\n-----END PRIVATE KEY-----\n","client_email":"fight-night-bot-service@fight-night-bot.iam.gserviceaccount.com","client_id":"115278265485885723032","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/fight-night-bot-service%40fight-night-bot.iam.gserviceaccount.com","universe_domain":"googleapis.com"}' --app discord-fight-night-bot-andre
```

### 2. Alternative: Use Base64 Encoded Service Account

If JSON parsing fails, encode the service account key:

**Create base64 encoded version:**
```bash
# On Windows PowerShell:
$json = Get-Content .env | Select-String "GOOGLE_SERVICE_ACCOUNT_KEY=" | ForEach-Object { $_.ToString().Substring(27) }
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$base64 = [System.Convert]::ToBase64String($bytes)
Write-Output $base64
```

**Set as base64:**
```bash
flyctl secrets set GOOGLE_SERVICE_ACCOUNT_KEY_BASE64="<base64-encoded-json>" --app discord-fight-night-bot-andre
```

### 3. Update Google Sheets Service (if using base64)

If using base64 approach, update the service:

```javascript
// In googleSheets.js, modify initAuth method:
async initAuth() {
    try {
        let serviceAccount;
        
        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
            console.log('Using base64 encoded service account authentication');
            const base64Json = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
            const jsonString = Buffer.from(base64Json, 'base64').toString('utf-8');
            serviceAccount = JSON.parse(jsonString);
        } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            console.log('Using direct JSON service account authentication');
            serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        } else {
            throw new Error('No Google authentication method found');
        }
        
        this.auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        this.authClient = await this.auth.getClient();
        console.log('Service account auth initialized successfully');
    } catch (error) {
        console.error('Error initializing Google Sheets auth:', error);
        throw error;
    }
}
```

### 4. Deploy and Check Logs

After setting environment variables:

```bash
# Redeploy the app
flyctl deploy --app discord-fight-night-bot-andre

# Check logs for Google Sheets connection
flyctl logs --app discord-fight-night-bot-andre
```

### 5. Verify Google Sheets API Access

Ensure your service account has:
1. **Google Sheets API enabled** in Google Cloud Console
2. **Editor permissions** on the spreadsheet (1dvxKdA41Z2pnKvl1-madOFlTtE6YPXlQKiNKyl5Izqo)
3. **Correct spreadsheet ID** in the code

### 6. Test Connection Locally First

Before deploying, test locally:

```bash
# In your project directory
node -e "
const { GoogleSheetsService } = require('./services/googleSheets.js');
const service = new GoogleSheetsService();
service.getAllPlayers().then(players => {
    console.log('Connection successful, found', players.length, 'players');
}).catch(err => {
    console.error('Connection failed:', err.message);
});
"
```

## Quick Fix Commands

Run these commands in order:

```bash
# 1. Set all environment variables
flyctl secrets set DISCORD_TOKEN="<YOUR_DISCORD_BOT_TOKEN>" CLIENT_ID="1415866855142461573" GUILD_ID="338005047851876353" PREFIX="!" ADMIN_ROLE_NAME="Power" MODERATOR_ROLE_NAME="Moderator" DATABASE_PATH="/app/data/bot.db" --app discord-fight-night-bot-andre

# 2. Set Google service account (single command)
flyctl secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"fight-night-bot","private_key_id":"22497b34927afb5992c11a607bdc5c88bd29378c","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDL/oDURNaFTElv\nIFsaX0oPM30Foi/Y16+LKMCli6NL4H2Zj590bvH+/EySSU2UTdTfze+KDGVLEbCK\n3IvrTxUjgffCmgkOr+hjwyR+J4A0y8ZMsT9cH/ES8+lBRmIaomLqyfZJdEucCtee\nZbxWsSb1NnpBfZ/GoijM7wCHDdPlwZsnT4iEY290+vrG9zj2g5phr844hrPR6+gL\nvmmvo7vIpKhkwHMUUP0RDDTOtMbKU5nSpA29M79arbBBOmKdoLIMn2hYWdW+VN0I\nvmHOwWOq3bDXE1CXKE1OcacHaxCRO7HcaQy7xXgzylthr0MwJnDSWKEHy0k8SxcC\n9CRoQHKlAgMBAAECggEAQHAuhd8Q3J6Se9X+sT/0hwS+s27eKmNHgm/nGuQXOzq4\nsi9aMU9yhhdwoK0jInvLiL7msfbkcGgwGk08raIXjVXay9AYmFkc0ZatCmSz7PmJ\ntGQxHYrBfjkqL4JqLvuov334nI9t6ubJ4bFFYyUmp0MEL3fdZsOGm+XLht3pV6PW\nSYmDfmJ9hDp1AMIh/vTP55WHSMtcbNYtcA/OTW5LcEl0NqTjhst7WE6qO6GWmphY\nayGU0XaqOKEFZnlpI9NaMDYB5aiWQ7ttkymJ0D1ey/GAVYkAfo2gz7GshOAt4fD7\nsViMkw8/k0JNEbaYr17cEdkkJLuT3xVabOtsQzsNaQKBgQDsEnI01LwzFyXY5d6l\n50h5bLVElTlpzz7Rfr5dphBRwTDki4kTvaEYqeBntYJRjUeQ4SXAowN4yG4Oc40C\n1MyYLWQWMJRS/LmZ4XzK515Yx6jig0zPD4BrJhQ6jAp4wXQJhgHicPQekNrWWnJ\noWP9s2opl5eGrSKi7YAbFUqniwKBgQDdNtlCFApQJKcXTcEDoCy5X/OAx6ZbvaRU\nYKpMBz5gB7zqdCw9rrIKyh+TsSb0aF2WluZ/UeQnnZwhB9Yv+TOtraRrgO8LZ6cf\nVMj6ZmioNIBNvUpM2I1DCK2h6SLT26gydTHCmN5hLttX9KNtKtkpFudFCUV8PPvE\n2tcsCiIUjwKBgQDo5gnmNTq27M9Z/O57noHRyX3L+6x4xw2igPguS/ctsPsbfs3t\nu9eDDZVmu5ul+Uvxky47rpduQc7SUw162NSrjt2RWv/aVKN+zANKtGzXpQJFNZ1w\nPq6t2CktKt35dQ/3Gp36Ud/tfbGl5sCHO8H6OVczUWscYxMYylboYUkVoQKBgQC+\nqPhl2GnvGzgcgLp7yoDhoQ55jxoV9gR9aPc+IfwjvmeX11sOKtRvMjg3DjeZ7Z3E\nHfk6ATXY4yHe4ic8H9fnuEJ/GZhuRv8mpOe30a4gU2fGGQDB7N8LyJ4Gb67B1I9K\nNfIWW7VHI6CPVV3JyGV04bWgrdYCt3jz+P39ihpHhwKBgQDbmOP8EdIYkybCFwBF\nknFwLoe/HS3yS5ASu7vN8MtTs8e3cByaBChhj7tMIwPfAJfUYah+sJo2LSYl1l4z\nftoSYYBQ9JKyQ4tIcQn/zZNNKiCizpzYa4qyNJ24gHOI9HrZj110pTAOi+4/w9lT\ndW1D2qHi/kgJjy/0XK5Opm4G9g==\n-----END PRIVATE KEY-----\n","client_email":"fight-night-bot-service@fight-night-bot.iam.gserviceaccount.com","client_id":"115278265485885723032","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/fight-night-bot-service%40fight-night-bot.iam.gserviceaccount.com","universe_domain":"googleapis.com"}' --app discord-fight-night-bot-andre

# 3. Redeploy
flyctl deploy --app discord-fight-night-bot-andre

# 4. Check logs
flyctl logs --app discord-fight-night-bot-andre
```

The most common issue is that environment variables aren't set in Fly.io, even though they exist locally in your .env file.
