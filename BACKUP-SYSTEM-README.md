# Discord Fight Night Bot - Backup & Restore System

## 📦 Overview

This backup system provides a complete solution for creating, managing, and restoring backups of your Discord Fight Night Bot. It ensures you can quickly recover from any issues or mistakes.

## 🚀 Quick Start

### Create a Backup
```bash
node backup-bot.js
```

### List All Backups
```bash
node list-backups.js
```

### Restore from Backup
```bash
# Interactive mode - choose from list
node restore-bot.js

# Direct restore - specify backup name
node restore-bot.js backup_2025-10-13_14-30-00
```

### Delete Old Backups
```bash
# Interactive mode - choose which to delete
node delete-backup.js

# Delete specific backup
node delete-backup.js backup_2025-10-13_14-30-00

# Delete all backups (requires confirmation)
node delete-backup.js
# Then type "all" when prompted
```

## 📋 What Gets Backed Up

### ✅ Included in Backups
- **All source code files:**
  - `index.js` (main bot file)
  - `commands/` directory (all bot commands)
  - `services/` directory (Google Sheets integration)
  - `utils/` directory (helper utilities)
  
- **Configuration files:**
  - `package.json`
  - `package-lock.json`
  - `Dockerfile`
  - `fly.toml`
  - `render.yaml`
  - All deployment configuration files
  
- **Documentation:**
  - All README files
  - All markdown documentation

- **Scripts:**
  - `deploy-commands.js`
  - `test-*.js` files
  - `generate-matches.js`
  - All utility scripts

### ❌ Excluded from Backups (for security & efficiency)
- `.env` file (contains sensitive Discord tokens and API keys)
- `google-service-account-base64.txt` (contains Google API credentials)
- `node_modules/` directory (can be reinstalled with `npm install`)
- `.git/` directory (version control history)
- `backups/` directory (prevents recursive backups)

## 🔧 Detailed Usage

### Creating Backups

**When to create backups:**
- Before making major code changes
- Before deploying to production
- After successfully implementing new features
- Before testing experimental changes
- On a regular schedule (daily/weekly)

**What happens during backup:**
1. Creates a timestamped backup folder in `backups/`
2. Copies all source code and configuration files
3. Generates a manifest file with backup metadata
4. Creates a README with backup details and restore instructions
5. Lists the 5 most recent backups

**Backup naming format:**
```
backup_YYYY-MM-DD_HH-MM-SS
Example: backup_2025-10-13_14-30-45
```

### Listing Backups

The `list-backups.js` script shows:
- Backup name and creation date
- How long ago it was created
- Size of the backup
- Total size of all backups
- Location of each backup

**Example output:**
```
📋 Discord Fight Night Bot - Backup List

Found 3 backup(s):

1. backup_2025-10-13_14-30-45
   📅 Created: 10/13/2025, 2:30:45 PM (2 hours ago)
   💾 Size: 0.85 MB
   📝 Description: Discord Fight Night Bot Backup
   📂 Location: C:\...\backups\backup_2025-10-13_14-30-45

📊 Total backup size: 2.55 MB
```

### Restoring Backups

**Interactive Mode:**
```bash
node restore-bot.js
```
- Shows list of available backups
- Prompts you to select which backup to restore
- Asks for confirmation before restoring

**Direct Mode:**
```bash
node restore-bot.js backup_2025-10-13_14-30-45
```
- Directly restores the specified backup
- Still asks for confirmation

**What happens during restore:**
1. Displays selected backup information
2. Warns about files that will be overwritten
3. Asks for confirmation
4. Copies all files from backup to project directory
5. Preserves your `.env` and credentials files
6. Shows next steps to complete restoration

**After restoring:**
1. Verify your `.env` file has correct credentials
2. Run `npm install` to ensure dependencies are up to date
3. Run `node deploy-commands.js` to register commands with Discord
4. Run `node index.js` to start the bot

### Deleting Backups

**Delete a single backup:**
```bash
node delete-backup.js
# Select backup number from list
```

**Delete a specific backup:**
```bash
node delete-backup.js backup_2025-10-13_14-30-45
```

**Delete all backups:**
```bash
node delete-backup.js
# Type "all" when prompted
# Type "DELETE ALL" to confirm
```

## 🔐 Security Considerations

### Sensitive Files NOT Backed Up

The backup system intentionally excludes sensitive files for security:

1. **`.env` file** - Contains:
   - Discord bot token
   - Client ID and Guild ID
   - Role names and configuration

2. **`google-service-account-base64.txt`** - Contains:
   - Google Sheets API credentials
   - Service account private key

### Storing Sensitive Files Separately

**Recommended approach:**
1. Keep a separate, secure backup of your `.env` file
2. Store credentials in a password manager
3. Use environment variables in production
4. Never commit sensitive files to version control

**Manual backup of sensitive files:**
```bash
# Create a secure backup folder outside the project
mkdir C:\SecureBackups

# Copy sensitive files
copy .env C:\SecureBackups\.env.backup
copy google-service-account-base64.txt C:\SecureBackups\google-creds.backup
```

## 📁 Backup Directory Structure

```
discord-fight-night-comish-bot/
├── backups/
│   ├── backup_2025-10-13_14-30-45/
│   │   ├── BACKUP_MANIFEST.json
│   │   ├── README.md
│   │   ├── index.js
│   │   ├── package.json
│   │   ├── commands/
│   │   ├── services/
│   │   └── utils/
│   ├── backup_2025-10-13_12-15-30/
│   └── backup_2025-10-12_18-45-20/
├── backup-bot.js
├── restore-bot.js
├── list-backups.js
└── delete-backup.js
```

## 🔄 Backup Workflow Examples

### Before Making Changes
```bash
# 1. Create a backup
node backup-bot.js

# 2. Make your changes
# ... edit code ...

# 3. Test changes
node index.js

# 4. If something breaks, restore
node restore-bot.js
```

### Regular Maintenance
```bash
# Weekly backup routine
node backup-bot.js

# Check backup size
node list-backups.js

# Delete old backups if needed
node delete-backup.js
```

### Emergency Recovery
```bash
# 1. List available backups
node list-backups.js

# 2. Restore the most recent working backup
node restore-bot.js

# 3. Follow post-restore steps
npm install
node deploy-commands.js
node index.js
```

## 🛠️ Troubleshooting

### "No backups directory found"
**Solution:** Run `node backup-bot.js` to create your first backup.

### "Backup failed: EACCES permission denied"
**Solution:** Run the command prompt as administrator or check file permissions.

### "Restore failed: Cannot find backup"
**Solution:** Run `node list-backups.js` to see available backups and use the exact name.

### Bot doesn't work after restore
**Checklist:**
1. ✅ Verify `.env` file exists and has correct credentials
2. ✅ Run `npm install` to reinstall dependencies
3. ✅ Run `node deploy-commands.js` to register commands
4. ✅ Check that `google-service-account-base64.txt` exists
5. ✅ Verify bot has correct permissions in Discord server

### Backup taking too long
**Cause:** Large `node_modules` directory (but it's excluded automatically)
**Solution:** The backup system already excludes `node_modules`. If it's still slow, check for other large files.

## 📊 Backup Best Practices

### 1. **Regular Backups**
- Create backups before major changes
- Schedule weekly backups
- Backup before deployments

### 2. **Backup Retention**
- Keep at least 3-5 recent backups
- Delete very old backups to save space
- Keep backups of stable versions longer

### 3. **Testing Restores**
- Periodically test restore process
- Verify backups are complete
- Document any issues

### 4. **Backup Storage**
- Keep backups on the same machine for quick access
- Consider copying important backups to external storage
- Use cloud storage for critical backups

### 5. **Documentation**
- Note what changed between backups
- Document why you're creating a backup
- Keep track of which backups are "known good"

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Create backup | `node backup-bot.js` |
| List backups | `node list-backups.js` |
| Restore backup | `node restore-bot.js` |
| Restore specific | `node restore-bot.js <backup_name>` |
| Delete backup | `node delete-backup.js` |
| Delete specific | `node delete-backup.js <backup_name>` |

## 📞 Support

If you encounter issues with the backup system:
1. Check this README for troubleshooting steps
2. Verify file permissions
3. Ensure you have enough disk space
4. Check that Node.js is properly installed

## 🔄 Version Control Integration

**Note:** This backup system is separate from Git version control.

**When to use backups vs Git:**
- **Backups:** Quick snapshots, easy rollback, includes all files
- **Git:** Long-term history, collaboration, detailed change tracking

**Recommended workflow:**
1. Use Git for version control and collaboration
2. Use backups for quick snapshots before risky changes
3. Commit to Git after successful changes
4. Keep backups for emergency recovery

---

**Created for Discord Fight Night Bot**  
Last Updated: October 2025
