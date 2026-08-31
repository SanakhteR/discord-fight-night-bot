const fs = require('fs');
const path = require('path');

/**
 * List Backups Script for Discord Fight Night Bot
 * Displays all available backups with details
 */

const BACKUP_DIR = path.join(__dirname, 'backups');

console.log('\n📋 Discord Fight Night Bot - Backup List\n');

// Check if backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    console.log('❌ No backups directory found!');
    console.log('   Run "node backup-bot.js" to create your first backup.\n');
    process.exit(0);
}

// Get all backups
const backups = fs.readdirSync(BACKUP_DIR)
    .filter(name => name.startsWith('backup_'))
    .map(name => {
        const backupPath = path.join(BACKUP_DIR, name);
        const stats = fs.statSync(backupPath);
        const manifestPath = path.join(backupPath, 'BACKUP_MANIFEST.json');
        
        let manifest = null;
        if (fs.existsSync(manifestPath)) {
            try {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            } catch (error) {
                // Ignore manifest read errors
            }
        }
        
        return {
            name,
            path: backupPath,
            created: stats.birthtime,
            size: getDirectorySize(backupPath),
            manifest
        };
    })
    .sort((a, b) => b.created - a.created);

if (backups.length === 0) {
    console.log('📦 No backups found yet.');
    console.log('   Run "node backup-bot.js" to create your first backup.\n');
    process.exit(0);
}

// Display backups
console.log(`Found ${backups.length} backup(s):\n`);

backups.forEach((backup, index) => {
    const sizeInMB = (backup.size / (1024 * 1024)).toFixed(2);
    const age = getTimeAgo(backup.created);
    
    console.log(`${index + 1}. ${backup.name}`);
    console.log(`   📅 Created: ${backup.created.toLocaleString()} (${age})`);
    console.log(`   💾 Size: ${sizeInMB} MB`);
    
    if (backup.manifest) {
        console.log(`   📝 Description: ${backup.manifest.description}`);
        if (backup.manifest.note) {
            console.log(`   ℹ️  Note: ${backup.manifest.note}`);
        }
    }
    
    console.log(`   📂 Location: ${backup.path}`);
    console.log('');
});

// Display total size
const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
const totalSizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
console.log(`📊 Total backup size: ${totalSizeInMB} MB\n`);

// Display commands
console.log('💡 Commands:');
console.log('   Create new backup:  node backup-bot.js');
console.log('   Restore backup:     node restore-bot.js');
console.log('   Restore specific:   node restore-bot.js <backup_name>');
console.log('   Delete backup:      node delete-backup.js\n');

// Function to calculate directory size
function getDirectorySize(dir) {
    let size = 0;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                size += getDirectorySize(fullPath);
            } else {
                size += fs.statSync(fullPath).size;
            }
        }
    } catch (error) {
        // Ignore errors
    }
    return size;
}

// Function to get human-readable time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'just now';
}
