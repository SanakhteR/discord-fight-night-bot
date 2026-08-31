const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Restore Script for Discord Fight Night Bot
 * Restores bot from a timestamped backup
 */

const BACKUP_DIR = path.join(__dirname, 'backups');
const EXCLUDE_DIRS = ['node_modules', '.git', 'backups'];

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('\n🔄 Discord Fight Night Bot - Restore Utility\n');
    
    // Check if backups directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        console.error('❌ No backups directory found!');
        console.log('   Run "node backup-bot.js" first to create a backup.\n');
        process.exit(1);
    }
    
    // List available backups
    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(name => name.startsWith('backup_'))
        .map(name => {
            const backupPath = path.join(BACKUP_DIR, name);
            const stats = fs.statSync(backupPath);
            const manifestPath = path.join(backupPath, 'BACKUP_MANIFEST.json');
            let manifest = null;
            
            if (fs.existsSync(manifestPath)) {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            }
            
            return {
                name,
                path: backupPath,
                created: stats.birthtime,
                manifest
            };
        })
        .sort((a, b) => b.created - a.created);
    
    if (backups.length === 0) {
        console.error('❌ No backups found!');
        console.log('   Run "node backup-bot.js" first to create a backup.\n');
        process.exit(1);
    }
    
    // Display available backups
    console.log('📋 Available Backups:\n');
    backups.forEach((backup, index) => {
        console.log(`   ${index + 1}. ${backup.name}`);
        console.log(`      Created: ${backup.created.toLocaleString()}`);
        if (backup.manifest) {
            console.log(`      Description: ${backup.manifest.description}`);
        }
        console.log('');
    });
    
    // Get backup selection from command line or user input
    let selectedBackup;
    const backupArg = process.argv[2];
    
    if (backupArg) {
        // Backup name provided as command line argument
        selectedBackup = backups.find(b => b.name === backupArg);
        if (!selectedBackup) {
            console.error(`❌ Backup "${backupArg}" not found!`);
            process.exit(1);
        }
        console.log(`Selected backup: ${selectedBackup.name}\n`);
    } else {
        // Ask user to select a backup
        const answer = await question('Enter backup number to restore (or "q" to quit): ');
        
        if (answer.toLowerCase() === 'q') {
            console.log('Restore cancelled.\n');
            rl.close();
            process.exit(0);
        }
        
        const backupIndex = parseInt(answer) - 1;
        if (isNaN(backupIndex) || backupIndex < 0 || backupIndex >= backups.length) {
            console.error('❌ Invalid backup number!\n');
            rl.close();
            process.exit(1);
        }
        
        selectedBackup = backups[backupIndex];
    }
    
    // Confirm restoration
    console.log('\n⚠️  WARNING: This will overwrite your current bot files!');
    console.log('   The following will NOT be affected:');
    console.log('   - .env file (your credentials)');
    console.log('   - google-service-account-base64.txt');
    console.log('   - node_modules directory');
    console.log('   - backups directory\n');
    
    const confirm = await question('Are you sure you want to restore? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
        console.log('Restore cancelled.\n');
        rl.close();
        process.exit(0);
    }
    
    // Perform restoration
    try {
        console.log('\n🔄 Restoring backup...\n');
        
        // Copy files from backup to current directory
        copyDirectory(selectedBackup.path, __dirname);
        
        console.log('✅ Backup restored successfully!\n');
        console.log('📝 Next Steps:');
        console.log('   1. Verify your .env file has correct credentials');
        console.log('   2. Run: npm install (to ensure dependencies are up to date)');
        console.log('   3. Run: node deploy-commands.js (to register commands)');
        console.log('   4. Run: node index.js (to start the bot)\n');
        
    } catch (error) {
        console.error('❌ Restore failed:', error.message);
        process.exit(1);
    }
    
    rl.close();
}

// Function to copy directory recursively
function copyDirectory(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        // Skip excluded directories and backup metadata files
        if (EXCLUDE_DIRS.includes(entry.name) || 
            entry.name === 'BACKUP_MANIFEST.json' || 
            entry.name === 'README.md') {
            continue;
        }
        
        if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            copyDirectory(srcPath, destPath);
            console.log(`   📁 Restored directory: ${entry.name}`);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`   📄 Restored file: ${path.relative(__dirname, destPath)}`);
        }
    }
}

// Run the main function
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    rl.close();
    process.exit(1);
});
