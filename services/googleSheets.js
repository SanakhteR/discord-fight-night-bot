const { google } = require('googleapis');

class GoogleSheetsService {
    constructor() {
        this.sheets = google.sheets('v4');
        this.spreadsheetId = '1dvxKdA41Z2pnKvl1-madOFlTtE6YPXlQKiNKyl5Izqo';
        this.auth = null;
        this.authClient = null;
    }

    async initAuth() {
        try {
            if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.log('Using service account authentication');
                const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                this.auth = new google.auth.GoogleAuth({
                    credentials: serviceAccount,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });
                this.authClient = await this.auth.getClient();
                console.log('Service account auth initialized successfully');
            } else {
                throw new Error('No Google authentication method found');
            }
        } catch (error) {
            console.error('Error initializing Google Sheets auth:', error);
            throw error;
        }
    }

    async getAllPlayers() {
        try {
            if (!this.authClient) {
                await this.initAuth();
            }
            
            const response = await this.sheets.spreadsheets.values.get({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: 'A:G',
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('No data found in spreadsheet');
                return [];
            }

            const players = [];
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[0]) {
                    // Map Elo to MMR values according to new specification
                    let mmr = 300; // Default Silver
                    const eloText = row[3] || 'Silver';
                    switch (eloText.toLowerCase()) {
                        case 'iron': mmr = 150; break;
                        case 'bronze': mmr = 250; break;
                        case 'silver': mmr = 300; break;
                        case 'gold': mmr = 350; break;
                        case 'platinum': mmr = 450; break;
                        case 'emerald': mmr = 600; break;
                        case 'diamond': mmr = 750; break;
                        default: mmr = parseInt(row[4]) || 300; break;
                    }

                    players.push({
                        username: row[0] || '',
                        discordUsername: row[0] || '',
                        realName: row[1] || 'N/A',
                        riotId: row[2] || 'Unknown Riot ID',
                        estimatedElo: eloText,
                        mmr: mmr,
                        primaryRole: row[5] || 'Mid',
                        secondaryRole: row[6] || 'Support'
                    });
                }
            }

            return players;
        } catch (error) {
            console.error('Error fetching all players:', error);
            return [];
        }
    }

    async findPlayerByUsername(username) {
        try {
            const players = await this.getAllPlayers();
            return players.find(player => 
                player.username && player.username.toLowerCase() === username.toLowerCase()
            );
        } catch (error) {
            console.error('Error finding player by username:', error);
            return null;
        }
    }

    async findPlayerByRiotId(riotId) {
        try {
            if (!this.authClient) {
                await this.initAuth();
            }
            
            const response = await this.sheets.spreadsheets.values.get({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: 'A:G',
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return null;
            }

            // Skip header row and search for Riot ID in column C (index 2)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[2] && row[2].toLowerCase() === riotId.toLowerCase()) {
                    return {
                        rowIndex: i + 1, // 1-based for Google Sheets
                        username: row[0] || '',
                        realName: row[1] || '',
                        riotId: row[2] || '',
                        estimatedElo: row[3] || '',
                        eloValue: parseInt(row[4]) || 300,
                        primaryRole: row[5] || '',
                        secondaryRole: row[6] || ''
                    };
                }
            }
            return null;
        } catch (error) {
            console.error('Error finding player by Riot ID:', error);
            return null;
        }
    }

    async updatePlayerUsername(rowIndex, newUsername) {
        try {
            if (!this.authClient) {
                await this.initAuth();
            }

            await this.sheets.spreadsheets.values.update({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: `A${rowIndex}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[newUsername]]
                }
            });

            console.log(`Updated username for row ${rowIndex} to ${newUsername}`);
            return true;
        } catch (error) {
            console.error('Error updating player username:', error);
            return false;
        }
    }

    async updatePlayerDiscordUsername(riotId, newUsername) {
        try {
            if (!this.authClient) {
                await this.initAuth();
            }

            const response = await this.sheets.spreadsheets.values.get({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: 'A:G',
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return false;
            }

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[2] && row[2].toLowerCase() === riotId.toLowerCase()) {
                    await this.sheets.spreadsheets.values.update({
                        auth: this.authClient,
                        spreadsheetId: this.spreadsheetId,
                        range: `A${i + 1}`,
                        valueInputOption: 'RAW',
                        resource: {
                            values: [[newUsername]]
                        }
                    });
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error updating player Discord username:', error);
            return false;
        }
    }

    async addNewPlayer(playerData) {
        try {
            if (!this.authClient) {
                await this.initAuth();
            }

            // Get current data to find the next empty row
            const response = await this.sheets.spreadsheets.values.get({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: 'A:G',
            });

            const rows = response.data.values || [];
            const nextRow = rows.length + 1;

            // Prepare the new row data
            const newRowData = [
                playerData.username,      // Column A - Discord Username
                playerData.realName,      // Column B - Real Name
                playerData.riotId,        // Column C - Riot ID
                playerData.estimatedElo,  // Column D - Elo
                playerData.mmr,           // Column E - MMR
                playerData.primaryRole,   // Column F - Primary Role
                playerData.secondaryRole  // Column G - Secondary Role
            ];

            await this.sheets.spreadsheets.values.update({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: `A${nextRow}:G${nextRow}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [newRowData]
                }
            });

            console.log(`Added new player ${playerData.username} to row ${nextRow}`);
            return true;
        } catch (error) {
            console.error('Error adding new player:', error);
            return false;
        }
    }

    async getRandomPlayers(count) {
        try {
            const allPlayers = await this.getAllPlayers();
            
            if (allPlayers.length === 0) {
                return [];
            }
            
            // Shuffle array and take first 'count' players
            const shuffled = allPlayers.sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(count, shuffled.length));
        } catch (error) {
            console.error('Error getting random players:', error);
            return [];
        }
    }
}

module.exports = { GoogleSheetsService };
