# 🚀 Backup System - Quick Reference Card

## Essential Commands

### Create Backup
```bash
node backup-bot.js
```
**Use before:** Making changes, deploying, testing new features

### List Backups
```bash
node list-backups.js
```
**Shows:** All backups with dates, sizes, and locations

### Restore Backup
```bash
node restore-bot.js
```
**Interactive:** Choose from list of backups

### Windows Menu (Easy Mode)
```bash
backup-menu.bat
```
**GUI Menu:** Point-and-click interface for all backup operations

---

## Emergency Recovery (3 Steps)

### If Bot Breaks:
```bash
# 1. Restore last working backup
node restore-bot.js

# 2. Reinstall dependencies
npm install

# 3. Restart bot
node deploy-commands.js
node index.js
```

---

## What's Backed Up?

### ✅ Included
- All source code (index.js, commands/, services/, utils/)
- Configuration files (package.json, Dockerfile, etc.)
- Documentation files

### ❌ Excluded (for security)
- .env (Discord tokens)
- google-service-account-base64.txt (API keys)
- node_modules (reinstall with npm install)

---

## Best Practices

1. **Backup before changes** - Always create backup before modifying code
2. **Keep 3-5 backups** - Delete old ones to save space
3. **Test restores** - Verify backups work periodically
4. **Secure credentials** - Keep separate backup of .env file

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot won't start after restore | Run `npm install` then `node deploy-commands.js` |
| "No backups found" | Run `node backup-bot.js` to create first backup |
| Backup failed | Check disk space and file permissions |
| Missing .env after restore | Backups don't include .env - restore manually |

---

## File Locations

- **Backups folder:** `backups/`
- **Backup scripts:** `backup-bot.js`, `restore-bot.js`, `list-backups.js`
- **Full docs:** `BACKUP-SYSTEM-README.md`

---

## Quick Tips

💡 **Before risky changes:** `node backup-bot.js`  
💡 **Check backup size:** `node list-backups.js`  
💡 **Emergency restore:** `node restore-bot.js` → select #1  
💡 **Clean old backups:** `node delete-backup.js`  

---

**Print this card and keep it handy!**
