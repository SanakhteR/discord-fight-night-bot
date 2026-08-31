@echo off
title Discord Fight Night Bot - Backup Menu
color 0A

:menu
cls
echo ========================================
echo  Discord Fight Night Bot - Backup Menu
echo ========================================
echo.
echo  1. Create New Backup
echo  2. List All Backups
echo  3. Restore from Backup
echo  4. Delete Old Backups
echo  5. View Backup Documentation
echo  6. Exit
echo.
echo ========================================
echo.

set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto create
if "%choice%"=="2" goto list
if "%choice%"=="3" goto restore
if "%choice%"=="4" goto delete
if "%choice%"=="5" goto docs
if "%choice%"=="6" goto exit

echo Invalid choice! Please try again.
timeout /t 2 >nul
goto menu

:create
cls
echo Creating backup...
echo.
node backup-bot.js
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:list
cls
echo Listing backups...
echo.
node list-backups.js
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:restore
cls
echo Restoring backup...
echo.
node restore-bot.js
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:delete
cls
echo Deleting backup...
echo.
node delete-backup.js
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:docs
cls
echo Opening backup documentation...
start BACKUP-SYSTEM-README.md
timeout /t 1 >nul
goto menu

:exit
cls
echo Goodbye!
timeout /t 1 >nul
exit
