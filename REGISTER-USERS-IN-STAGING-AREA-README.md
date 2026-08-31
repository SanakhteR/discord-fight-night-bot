# Register Users in Staging Area Command

## Overview
The `/register-users-in-staging-area` command automatically initiates the registration process for all users with the "Unverified" role who are currently in the Fight Night Staging Area voice channel.

## Command Details
- **Command:** `/register-users-in-staging-area`
- **Permissions:** Moderator, Admin, or Power role required
- **Location:** Can be used in any channel

## How It Works

### 1. **Check Voice Channel**
   - Finds all users in the "Fight Night Staging Area" voice channel
   - Excludes bots from the list
   - Identifies users with the "Unverified" role

### 2. **Filter by Role**
   - Only processes users who have the "Unverified" role
   - Users with "Verified" role or no role are skipped

### 3. **Registration Process**
   For each unverified user, the command:
   
   **a) Check Google Sheets:**
   - Searches for the user's Discord username in Google Sheets
   
   **b) If User Exists in Google Sheets:**
   - Auto-verifies the user
   - Assigns "Verified" role
   - Removes "Unverified" role
   - Logs success in debug channel
   
   **c) If User NOT in Google Sheets:**
   - Posts verification question in #welcome channel
   - Includes Yes/No buttons
   - Creates verification session
   - User can then complete interactive registration

### 4. **Summary Report**
   After processing all users, shows:
   - Total users processed
   - Number of registration prompts sent
   - Number of users auto-verified
   - Any errors encountered

## Use Cases

### Before Fight Night
When players join the staging area but haven't registered yet:
```
/register-users-in-staging-area
```

### After Bulk Invite
When new players are invited and join the voice channel:
```
/register-users-in-staging-area
```

### Regular Maintenance
Quick check to catch any unverified users:
```
/register-users-in-staging-area
```

## Example Output

```
🔄 Registration Process Started

Found 5 Unverified users in Fight Night Staging Area
Starting registration process for each user in #welcome channel...

✅ Registration Process Complete

Summary:
• Total Processed: 5 users
• Registration Started: 3 users (posted in #welcome)
• Already Registered: 2 users (auto-verified)
• Errors: 0 users

3 users have been prompted for registration in the #welcome channel.
2 users were found in Google Sheets and auto-verified.
```

## Integration with Existing System

This command works seamlessly with:
- **`/register-user`** - Manual single-user registration
- **`/verify-users-in-staging-area`** - Mass role assignment without interactive registration
- **Google Sheets Service** - Checks existing player database
- **Interactive Verification Flow** - Yes/No buttons in #welcome channel

## Key Differences from Similar Commands

| Command | Purpose | Action for Unverified Users |
|---------|---------|------------------------------|
| `/verify-users-in-staging-area` | Assigns roles based on Google Sheets | Assigns "Unverified" role, no prompts |
| `/register-users-in-staging-area` | **Starts registration process** | **Prompts in #welcome for registration** |
| `/register-user` | Single user registration | Prompts one specific user |

## Technical Details

- **Rate Limiting:** 500ms delay between users to avoid Discord API limits
- **Error Handling:** Continues processing even if individual users fail
- **Session Management:** Creates verification sessions for interactive flow
- **Auto-Detection:** Automatically finds users already in Google Sheets

## Requirements

- "Fight Night Staging Area" voice channel must exist
- "welcome" text channel must exist
- "Unverified" and "Verified" roles must exist
- Google Sheets integration must be active
- Bot must have permission to:
  - Read voice channel members
  - Manage roles
  - Send messages in #welcome

## Debug Logging

All actions are logged to the `#list-status-and-debug` channel with:
- Command initiation
- Users processed
- Verification status
- Errors and warnings
- Completion summary
