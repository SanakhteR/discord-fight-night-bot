@echo off
REM Automated Backup Scheduler for Discord Fight Night Bot
REM This script can be added to Windows Task Scheduler for automatic backups

title Discord Bot - Scheduled Backup
color 0B

echo ========================================
echo  Discord Fight Night Bot
echo  Scheduled Backup
echo ========================================
echo.
echo Starting automated backup...
echo Time: %date% %time%
echo.

REM Change to bot directory
cd /d "%~dp0"

REM Run backup
node backup-bot.js

echo.
echo ========================================
echo Backup completed at %time%
echo ========================================
echo.

REM Optional: Keep only last 10 backups to save space
REM Uncomment the following lines if you want automatic cleanup
REM echo Cleaning up old backups...
REM node cleanup-old-backups.js

REM Log the backup
echo [%date% %time%] Backup completed >> backup-log.txt

REM Wait 5 seconds before closing (remove this line if running from Task Scheduler)
timeout /t 5
