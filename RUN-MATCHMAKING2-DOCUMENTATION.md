# `/run-matchmaking2` Command Documentation

## Overview
The `/run-matchmaking2` command implements a **role-first assignment algorithm** that differs from the original `/run-matchmaking` command in its approach to creating balanced matches.

## Algorithm Differences

### Original `/run-matchmaking` Algorithm
1. **Shuffle and Match**: Creates complete 10-player matches by shuffling all players
2. **Assign Roles**: Assigns roles to players within each match based on preferences
3. **Optimize**: Focuses on minimizing autofills and role mismatches
4. **Team Balance**: Balances total team MMR as secondary priority

### New `/run-matchmaking2` Algorithm  
1. **Role Assignment First**: Assigns ALL players to roles before creating matches
2. **Balanced Distribution**: Ensures exactly 2*N players per role (2 per match)
3. **Match Creation**: Creates matches from pre-assigned role pools
4. **Dual Optimization**: Balances both lane MMR AND total team MMR simultaneously

## Algorithm Steps

### Step 1: Pool Separation (Same as original)
- Sorts players by Rioter status and join time
- Creates matchmaking pool (multiple of 10)
- Remaining players go to flex queue

### Step 2: Role Assignment (NEW APPROACH)
For N matches, assigns exactly 2*N players to each role:

**Phase 1: Primary Roles**
- Assigns players to their primary role first
- Distributes by MMR for balanced role pools
- Fill role players count as primary for all roles

**Phase 2: Secondary Roles**
- Fills remaining slots with secondary role preferences
- Maintains MMR balance within role pools

**Phase 3: Autofill**
- Fills any remaining slots with autofill players
- Applies 15% MMR penalty for autofilled players (vs 20% in original)

### Step 3: Match Creation and Optimization (NEW SCORING)
**Match Creation** (500 scenarios):
- Creates matches by randomly pairing players from each role pool
- Ensures no player is used twice
- Evaluates each scenario with comprehensive scoring

**Scoring Priorities**:
1. **Average Lane MMR Difference** (weight: 10x) - Most important
2. **Maximum Lane MMR Difference** (weight: 5x) - Avoid extreme imbalances
3. **Team MMR Difference** (weight: 2x) - Overall balance
4. **Autofill Imbalance** (weight: 100x) - Fairness between teams

**Optimization** (15 passes):
- Swaps players between teams within same roles
- Improves both lane balance and team MMR
- Continues until no improvements found

### Step 4: Output (Same as original)
- Displays matches with team compositions
- Shows MMR differences and role assignments
- Includes new metrics: Average Lane MMR Diff and Max Lane MMR Diff

## Key Advantages

### 1. Better Lane Balance
- By assigning roles first, creates more competitive individual matchups
- Players face opponents of similar skill in their lanes
- Reduces situations where one lane is heavily favored

### 2. More Predictable Role Distribution
- Guarantees exactly 2 players per role per match
- Easier to ensure all roles are fairly represented
- Better utilization of player preferences

### 3. Dual Optimization Focus
- Balances individual lane matchups AND team composition
- Provides competitive games at both micro (lane) and macro (team) levels
- More granular control over match quality

### 4. Transparent Metrics
- Shows both lane-level and team-level balance
- Average and maximum lane differences help identify match quality
- Easier to compare match fairness

## When to Use Each Algorithm

### Use `/run-matchmaking2` when:
- You want more competitive individual lane matchups
- Lane balance is as important as team balance
- You have players with diverse role preferences
- You want more predictable role assignments

### Use `/run-matchmaking` when:
- You prioritize minimizing autofills above all else
- Team MMR balance is the primary concern
- You have more Fill role players
- You want faster execution (fewer iterations)

## Example Output Comparison

### `/run-matchmaking` focus:
```
Team 1 Total MMR: 2250
Team 2 Total MMR: 2240
MMR Difference: 10
```

### `/run-matchmaking2` focus:
```
Team 1 Total MMR: 2250
Team 2 Total MMR: 2240
MMR Difference: 10
Avg Lane MMR Diff: 25.4
Max Lane MMR Diff: 45
```

## Technical Details

- **Scenarios Tested**: 500 (vs 250 in original)
- **Optimization Passes**: Up to 15 (vs 10 in original)
- **Autofill Penalty**: 15% MMR reduction (vs 20% in original)
- **Primary Scoring Factor**: Lane balance (vs autofill minimization in original)

## Performance

- **Execution Time**: Slightly longer due to more scenarios and lane calculations
- **Match Quality**: Higher granularity in balancing at both lane and team levels
- **Scalability**: Handles large player pools efficiently with role-first approach

## Permissions

Same as original `/run-matchmaking`:
- Requires Moderator, Admin, or Power role
- Can only be used in appropriate channels
- Preserves Active Players List after completion

## Deployment Status

✅ **Successfully deployed to Discord** (19 commands total)  
✅ **Successfully deployed to fly.io** (Version 29)  
✅ **Bot Status**: Running in Dallas (DFW) region
