const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
    constructor() {
        this.sheets = google.sheets('v4');
        this.spreadsheetId = '1dvxKdA41Z2pnKvl1-madOFlTtE6YPXlQKiNKyl5Izqo';
        this.auth = null;
        this.authClient = null;
    }

    async initAuth() {
        try {
            let serviceAccount;
            
            // Debug environment variables
            console.log('Available Google env vars:', Object.keys(process.env).filter(key => key.includes('GOOGLE')));
            
            // Hardcoded service account as fallback for Fly.io deployment issues
            console.log('Using hardcoded service account for Fly.io deployment');
            serviceAccount = {
                "type": "service_account",
                "project_id": "fight-night-bot",
                "private_key_id": "22497b34927afb5992c11a607bdc5c88bd29378c",
                "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDL/oDURNaFTElv\nIFsaX0oPM30Foi/Y16+LKMCli6NL4H2Zj590bvH+/EySSU2UTdTfze+KDGVLEbCK\n3IvrTxUjgffCmgkOr+hjwyR+J4A0y8ZMsT9cH/ES8+lBRmIaomLqyfZJdEucCtee\nZbxWsSb1NnpBfZ/GoijM7wCHDdPlwZsnT4iEY290+vrG9zj2g5phr844hrPR6+gL\nvmmvo7vIpKhkwHMUUP0RDDTOtMbKU5nSpA29M79arbBBOmKdoLIMn2hYWdW+VN0I\nvmHOwWOq3bDXE1CXKE1OcacHaxCRO7HcaQy7xXgzylthr0MwJnDSWKEHy0k8SxcC\n9CRoQHKlAgMBAAECggEAQHAuhd8Q3J6Se9X+sT/0hwS+s27eKmNHgm/nGuQXOzq4\nsi9aMU9yhhdwoK0jInvLiL7msfbkcGgwGk08raIXjVXay9AYmFkc0ZatCmSz7PmJ\ntGQxHYrBfjkqL4JqLvuov334nI9t6ubJ4bFFYyUmp0MEL3fdZsOGm+XLht3pV6PW\nSYmDfmJ9hDp1AMIh/vTP55WHSMtcbNYtcA/OTW5LcEl0NqTjhst7WE6qO6GWmphY\nayGU0XaqOKEFZnlpI9NaMDYB5aiWQ7ttkymJ0D1ey/GAVYkAfo2gz7GshOAt4fD7\nsViMkw8/k0JNEbaYr17cEdkkJLuT3xVabOtsQzsNaQKBgQDsEnI01LwzFyXY5d6l\n50h5bLVElTlpzz7Rfr5dphBRwTDki4kTvaEYqeBntYJRjUeQ4SXAowN4yG4Oc40C\nn1MyYLWQWMJRS/LmZ4XzK515Yx6jig0zPD4BrJhQ6jAp4wXQJhgHicPQekNrWWnJ\noWP9s2opl5eGrSKi7YAbFUqniwKBgQDdNtlCFApQJKcXTcEDoCy5X/OAx6ZbvaRU\nYKpMBz5gB7zqdCw9rrIKyh+TsSb0aF2WluZ/UeQnnZwhB9Yv+TOtraRrgO8LZ6cf\nVMj6ZmioNIBNvUpM2I1DCK2h6SLT26gydTHCmN5hLttX9KNtKtkpFudFCUV8PPvE\n2tcsCiIUjwKBgQDo5gnmNTq27M9Z/O57noHRyX3L+6x4xw2igPguS/ctsPsbfs3t\nu9eDDZVmu5ul+Uvxky47rpduQc7SUw162NSrjt2RWv/aVKN+zANKtGzXpQJFNZ1w\nPq6t2CktKt35dQ/3Gp36Ud/tfbGl5sCHO8H6OVczUWscYxMYylboYUkVoQKBgQC+\nqPhl2GnvGzgcgLp7yoDhoQ55jxoV9gR9aPc+IfwjvmeX11sOKtRvMjg3DjeZ7Z3E\nHfk6ATXY4yHe4ic8H9fnuEJ/GZhuRv8mpOe30a4gU2fGGQDB7N8LyJ4Gb67B1I9K\nNfIWW7VHI6CPVV3JyGV04bWgrdYCt3jz+P39ihpHhwKBgQDbmOP8EdIYkybCFwBF\nknFwLoe/HS3yS5ASu7vN8MtTs8e3cByaBChhj7tMIwPfAJfUYah+sJo2LSYl1l4z\nftoSYYBQ9JKyQ4tIcQn/zZNNKiCizpzYa4qyNJ24gHOI9HrZj110pTAOi+4/w9lT\ndW1D2qHi/kgJjy/0XK5Opm4G9g==\n-----END PRIVATE KEY-----\n",
                "client_email": "fight-night-bot-service@fight-night-bot.iam.gserviceaccount.com",
                "client_id": "115278265485885723032",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/fight-night-bot-service%40fight-night-bot.iam.gserviceaccount.com",
                "universe_domain": "googleapis.com"
            };
            
            this.auth = new google.auth.GoogleAuth({
                credentials: serviceAccount,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            this.authClient = await this.auth.getClient();
            console.log('Service account auth initialized successfully');
            
            // Test the connection
            await this.testConnection();
            
        } catch (error) {
            console.error('Error initializing Google Sheets auth:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            const response = await this.sheets.spreadsheets.get({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
            });
            console.log(`Successfully connected to spreadsheet: ${response.data.properties.title}`);
            return true;
        } catch (error) {
            console.error('Failed to connect to Google Sheets:', error.message);
            throw new Error(`Google Sheets connection test failed: ${error.message}`);
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
                range: 'A:I',
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
                    // Column G (index 6) contains MMR value
                    let mmr = parseInt(row[6]) || 300; // Default Silver if not specified

                    // Column E (index 4) is Rioter status
                    const rioterText = (row[4] || '').toLowerCase();
                    const isRioter = rioterText === 'yes' || rioterText === 'y' || rioterText === 'true' || rioterText === '1';

                    players.push({
                        username: row[0] || '',           // Column A - Discord Username
                        discordUsername: row[0] || '',    // Column A - Discord Username
                        realName: row[2] || row[1] || 'N/A', // Column C - Full Name (fallback to B)
                        firstName: row[1] || 'N/A',       // Column B - First Name
                        riotId: row[3] || 'Unknown Riot ID', // Column D - Riot ID
                        isRioter: isRioter,               // Column E - Rioter
                        mmr: mmr,                         // Column G - MMR
                        primaryRole: row[7] || 'Mid',     // Column H - Primary Role
                        secondaryRole: row[8] || 'Support' // Column I - Secondary Role
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
                range: 'A:I',
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return null;
            }

            // Skip header row and search for Riot ID in column D (index 3)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[3] && row[3].toLowerCase() === riotId.toLowerCase()) {
                    const rioterText = (row[4] || '').toLowerCase();
                    const isRioter = rioterText === 'yes' || rioterText === 'y' || rioterText === 'true' || rioterText === '1';
                    
                    return {
                        rowIndex: i + 1, // 1-based for Google Sheets
                        username: row[0] || '',      // Column A - Discord Username
                        firstName: row[1] || '',     // Column B - First Name
                        realName: row[2] || row[1] || '', // Column C - Full Name (fallback to B)
                        riotId: row[3] || '',        // Column D - Riot ID
                        isRioter: isRioter,          // Column E - Rioter
                        mmr: parseInt(row[6]) || 300, // Column G - MMR
                        primaryRole: row[7] || '',   // Column H - Primary Role
                        secondaryRole: row[8] || ''  // Column I - Secondary Role
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
                range: 'A:I',
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return false;
            }

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[3] && row[3].toLowerCase() === riotId.toLowerCase()) {
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
                range: 'A:I',
            });

            const rows = response.data.values || [];
            const nextRow = rows.length + 1;

            // Extract first word from fullName for column B
            const fullName = playerData.fullName || playerData.realName || 'N/A';
            const firstName = fullName.split(' ')[0] || fullName;

            // Prepare the new row data
            const newRowData = [
                playerData.username,      // Column A - Discord Username
                firstName,                // Column B - First Name (first word)
                fullName,                 // Column C - Full Name
                playerData.riotId,        // Column D - Riot ID
                playerData.isRioter ? 'Yes' : 'No',  // Column E - Rioter
                '',                       // Column F - (unknown/empty)
                playerData.mmr,           // Column G - MMR
                playerData.primaryRole,   // Column H - Primary Role
                playerData.secondaryRole  // Column I - Secondary Role
            ];

            await this.sheets.spreadsheets.values.update({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: `A${nextRow}:I${nextRow}`,
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

    async getPlayersWithScores() {
        try {
            if (!this.authClient) {
                await this.initAuth();
            }
            
            // Get data from columns A through J to include scores
            const response = await this.sheets.spreadsheets.values.get({
                auth: this.authClient,
                spreadsheetId: this.spreadsheetId,
                range: 'A:J',
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
                    // Column J (index 9) contains the score
                    const score = parseInt(row[9]) || 0;
                    
                    // Column E (index 4) is Rioter status
                    const rioterText = (row[4] || '').toLowerCase();
                    const isRioter = rioterText === 'yes' || rioterText === 'y' || rioterText === 'true' || rioterText === '1';

                    players.push({
                        username: row[0] || '',           // Column A - Discord Username
                        discordUsername: row[0] || '',    // Column A - Discord Username
                        realName: row[2] || row[1] || 'N/A', // Column C - Full Name (fallback to B)
                        firstName: row[1] || 'N/A',       // Column B - First Name
                        riotId: row[3] || 'Unknown Riot ID', // Column D - Riot ID
                        isRioter: isRioter,               // Column E - Rioter
                        mmr: parseInt(row[6]) || 300,     // Column G - MMR
                        primaryRole: row[7] || 'Mid',     // Column H - Primary Role
                        secondaryRole: row[8] || 'Support', // Column I - Secondary Role
                        score: score                      // Column J - Score
                    });
                }
            }

            return players;
        } catch (error) {
            console.error('Error fetching players with scores:', error);
            return [];
        }
    }

    async getTopPlayersByScore(limit = 10) {
        try {
            const players = await this.getPlayersWithScores();
            
            // Filter out players with score of 0
            const playersWithScores = players.filter(p => p.score > 0);
            
            if (playersWithScores.length === 0) {
                return []; // Return empty array if all scores are 0
            }
            
            // Sort by score descending
            playersWithScores.sort((a, b) => b.score - a.score);
            
            // Handle ties - if the limit-th player has the same score as others, include them all
            if (playersWithScores.length <= limit) {
                return playersWithScores;
            }
            
            const cutoffScore = playersWithScores[limit - 1].score;
            const topPlayers = [];
            
            for (const player of playersWithScores) {
                if (player.score >= cutoffScore) {
                    topPlayers.push(player);
                }
            }
            
            return topPlayers;
        } catch (error) {
            console.error('Error getting top players by score:', error);
            return [];
        }
    }
}

module.exports = { GoogleSheetsService };
