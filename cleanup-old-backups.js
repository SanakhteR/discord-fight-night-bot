const fs = require('fs');
const path = require('path');

/**
 * Cleanup Old Backups Script
 * Automatically removes old backups, keeping only the most recent ones
 */

const BACKUP_DIR = path.join(__dirname, 'backups');
const KEEP_RECENT = 10; // Number of recent backups to keep

console.log('\n🧹 Cleaning up old backups...\n');

// Check if backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    console.log('📦 No backups directory found. Nothing to clean.\n');
    process.exit(0);
}

// Get all backups
const backups = fs.readdirSync(BACKUP_DIR)
    .filter(name => name.startsWith('backup_'))
    .map(name => {
        const backupPath = path.join(BACKUP_DIR, name);
        const stats = fs.statSync(backupPath);
        return {
            name,
            path: backupPath,
            created: stats.birthtime
        };
    })
    .sort((a, b) => b.created - a.created); // Sort by newest first

if (backups.length === 0) {
    console.log('📦 No backups found. Nothing to clean.\n');
    process.exit(0);
}

console.log(`Found ${backups.length} backup(s)`);
console.log(`Keeping ${KEEP_RECENT} most recent backup(s)\n`);

// Determine which backups to delete
const backupsToKeep = backups.slice(0, KEEP_RECENT);
const backupsToDelete = backups.slice(KEEP_RECENT);

if (backupsToDelete.length === 0) {
    console.log('✅ No old backups to delete. All backups are within the retention limit.\n');
    process.exit(0);
}

console.log(`🗑️  Deleting ${backupsToDelete.length} old backup(s):\n`);

// Delete old backups
let deletedCount = 0;
let deletedSize = 0;

for (const backup of backupsToDelete) {
    try {
        const size = getDirectorySize(backup.path);
        deleteDirectory(backup.path);
        deletedSize += size;
        deletedCount++;
        console.log(`   ✅ Deleted: ${backup.name} (${(size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (error) {
        console.error(`   ❌ Failed to delete ${backup.name}:`, error.message);
    }
}

const totalDeletedMB = (deletedSize / (1024 * 1024)).toFixed(2);
console.log(`\n✅ Cleanup complete!`);
console.log(`   Deleted: ${deletedCount} backup(s)`);
console.log(`   Freed: ${totalDeletedMB} MB`);
console.log(`   Remaining: ${backupsToKeep.length} backup(s)\n`);

// Function to delete directory recursively
function deleteDirectory(dir) {
    if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                deleteDirectory(fullPath);
            } else {
                fs.unlinkSync(fullPath);
            }
        }
        
        fs.rmdirSync(dir);
    }
}

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
