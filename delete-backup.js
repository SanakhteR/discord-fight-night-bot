const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Delete Backup Script for Discord Fight Night Bot
 * Safely deletes old backups
 */

const BACKUP_DIR = path.join(__dirname, 'backups');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('\n🗑️  Discord Fight Night Bot - Delete Backup\n');
    
    // Check if backups directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        console.log('❌ No backups directory found!\n');
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
                created: stats.birthtime,
                size: getDirectorySize(backupPath)
            };
        })
        .sort((a, b) => b.created - a.created);
    
    if (backups.length === 0) {
        console.log('📦 No backups found.\n');
        process.exit(0);
    }
    
    // Display backups
    console.log('📋 Available Backups:\n');
    backups.forEach((backup, index) => {
        const sizeInMB = (backup.size / (1024 * 1024)).toFixed(2);
        console.log(`   ${index + 1}. ${backup.name}`);
        console.log(`      Created: ${backup.created.toLocaleString()}`);
        console.log(`      Size: ${sizeInMB} MB`);
        console.log('');
    });
    
    // Get backup selection
    const backupArg = process.argv[2];
    let selectedBackup;
    
    if (backupArg) {
        // Backup name provided as command line argument
        selectedBackup = backups.find(b => b.name === backupArg);
        if (!selectedBackup) {
            console.error(`❌ Backup "${backupArg}" not found!\n`);
            rl.close();
            process.exit(1);
        }
    } else {
        // Ask user to select a backup
        const answer = await question('Enter backup number to delete (or "all" to delete all, "q" to quit): ');
        
        if (answer.toLowerCase() === 'q') {
            console.log('Deletion cancelled.\n');
            rl.close();
            process.exit(0);
        }
        
        if (answer.toLowerCase() === 'all') {
            // Confirm deletion of all backups
            console.log('\n⚠️  WARNING: This will delete ALL backups!\n');
            const confirm = await question('Type "DELETE ALL" to confirm: ');
            
            if (confirm !== 'DELETE ALL') {
                console.log('Deletion cancelled.\n');
                rl.close();
                process.exit(0);
            }
            
            // Delete all backups
            let deletedCount = 0;
            for (const backup of backups) {
                try {
                    deleteDirectory(backup.path);
                    console.log(`✅ Deleted: ${backup.name}`);
                    deletedCount++;
                } catch (error) {
                    console.error(`❌ Failed to delete ${backup.name}:`, error.message);
                }
            }
            
            console.log(`\n✅ Deleted ${deletedCount} backup(s)\n`);
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
    
    // Confirm deletion
    console.log(`\n⚠️  You are about to delete: ${selectedBackup.name}`);
    console.log(`   Created: ${selectedBackup.created.toLocaleString()}\n`);
    
    const confirm = await question('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
        console.log('Deletion cancelled.\n');
        rl.close();
        process.exit(0);
    }
    
    // Delete the backup
    try {
        deleteDirectory(selectedBackup.path);
        console.log(`\n✅ Backup deleted successfully: ${selectedBackup.name}\n`);
    } catch (error) {
        console.error('❌ Failed to delete backup:', error.message);
        process.exit(1);
    }
    
    rl.close();
}

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

// Run the main function
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    rl.close();
    process.exit(1);
});
