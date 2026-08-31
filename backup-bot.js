const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Backup Script for Discord Fight Night Bot
 * Creates a timestamped backup of all critical bot files
 */

const BACKUP_DIR = path.join(__dirname, 'backups');
const EXCLUDE_DIRS = ['node_modules', '.git', 'backups'];
const EXCLUDE_FILES = ['.env', 'google-service-account-base64.txt'];

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log('✅ Created backups directory');
}

// Generate timestamp for backup folder
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
const dateStr = timestamp[0];
const timeStr = timestamp[1].split('Z')[0];
const backupName = `backup_${dateStr}_${timeStr}`;
const backupPath = path.join(BACKUP_DIR, backupName);

console.log(`\n🔄 Starting backup: ${backupName}\n`);

// Create backup folder
fs.mkdirSync(backupPath, { recursive: true });

// Function to copy directory recursively
function copyDirectory(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        // Skip excluded directories and files
        if (EXCLUDE_DIRS.includes(entry.name)) {
            continue;
        }
        
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirectory(srcPath, destPath);
        } else {
            // Skip excluded files
            if (EXCLUDE_FILES.includes(entry.name)) {
                continue;
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy all files
try {
    console.log('📁 Copying project files...');
    copyDirectory(__dirname, backupPath);
    
    // Create a backup manifest
    const manifest = {
        backupName: backupName,
        timestamp: new Date().toISOString(),
        description: 'Discord Fight Night Bot Backup',
        excludedDirs: EXCLUDE_DIRS,
        excludedFiles: EXCLUDE_FILES,
        note: 'Sensitive files (.env, google credentials) are excluded for security'
    };
    
    fs.writeFileSync(
        path.join(backupPath, 'BACKUP_MANIFEST.json'),
        JSON.stringify(manifest, null, 2)
    );
    
    // Create a README for the backup
    const readmeContent = `# Backup: ${backupName}

**Created:** ${new Date().toLocaleString()}

## What's Included
- All source code files (index.js, commands, services, utils)
- Configuration files (package.json, Dockerfile, etc.)
- Documentation files

## What's NOT Included (for security)
- .env file (contains sensitive tokens)
- google-service-account-base64.txt (contains API credentials)
- node_modules (can be reinstalled with npm install)
- .git directory (version control history)

## How to Restore
1. Copy all files from this backup to your project directory
2. Run: npm install
3. Manually restore your .env file with your credentials
4. Manually restore your google-service-account-base64.txt file
5. Run: node deploy-commands.js
6. Run: node index.js

Or use the restore script:
\`\`\`
node restore-bot.js ${backupName}
\`\`\`

## Backup Contents
${getDirectoryTree(backupPath, '', 0, 3)}
`;
    
    fs.writeFileSync(
        path.join(backupPath, 'README.md'),
        readmeContent
    );
    
    console.log('✅ Files copied successfully');
    console.log(`\n📦 Backup created at: ${backupPath}`);
    console.log(`\n⚠️  Remember: .env and credentials are NOT backed up for security`);
    console.log(`   You'll need to manually restore these files if needed\n`);
    
    // List recent backups
    listRecentBackups();
    
} catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
}

// Function to generate directory tree
function getDirectoryTree(dir, prefix = '', depth = 0, maxDepth = 3) {
    if (depth >= maxDepth) return '';
    
    let tree = '';
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const isLast = i === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            
            tree += `${prefix}${connector}${entry.name}\n`;
            
            if (entry.isDirectory()) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                tree += getDirectoryTree(
                    path.join(dir, entry.name),
                    newPrefix,
                    depth + 1,
                    maxDepth
                );
            }
        }
    } catch (error) {
        // Ignore errors
    }
    
    return tree;
}

// Function to list recent backups
function listRecentBackups() {
    try {
        const backups = fs.readdirSync(BACKUP_DIR)
            .filter(name => name.startsWith('backup_'))
            .map(name => {
                const stats = fs.statSync(path.join(BACKUP_DIR, name));
                return {
                    name,
                    created: stats.birthtime,
                    size: getDirectorySize(path.join(BACKUP_DIR, name))
                };
            })
            .sort((a, b) => b.created - a.created)
            .slice(0, 5);
        
        if (backups.length > 0) {
            console.log('📋 Recent Backups:');
            backups.forEach((backup, index) => {
                const sizeInMB = (backup.size / (1024 * 1024)).toFixed(2);
                console.log(`   ${index + 1}. ${backup.name} (${sizeInMB} MB) - ${backup.created.toLocaleString()}`);
            });
            console.log('');
        }
    } catch (error) {
        // Ignore errors
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
