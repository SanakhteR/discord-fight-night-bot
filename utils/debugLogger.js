/**
 * Centralized debug logging utility for the Discord Fight Night bot
 * Ensures all debug messages are consistently sent to the list-status-and-debug channel
 */

class DebugLogger {
    constructor() {
        this.channelName = 'list-status-and-debug';
    }

    /**
     * Send a debug message to the debug channel
     * @param {Guild} guild - Discord guild object
     * @param {string} message - Debug message to send
     * @param {string} prefix - Optional prefix for the message (default: 🔧)
     */
    async log(guild, message, prefix = '🔧') {
        if (!guild) {
            console.error('DebugLogger: Guild not provided');
            return;
        }

        try {
            const debugChannel = guild.channels.cache.find(ch => ch.name === this.channelName);
            
            if (!debugChannel) {
                console.error(`DebugLogger: Channel "${this.channelName}" not found in guild "${guild.name}"`);
                return;
            }

            const formattedMessage = `${prefix} ${message}`;
            await debugChannel.send(formattedMessage);
            
        } catch (error) {
            console.error('DebugLogger: Error sending debug message:', error);
            console.error('DebugLogger: Original message was:', message);
        }
    }

    /**
     * Log an error message
     * @param {Guild} guild - Discord guild object
     * @param {string} message - Error message to send
     */
    async error(guild, message) {
        await this.log(guild, `❌ ${message}`);
    }

    /**
     * Log a success message
     * @param {Guild} guild - Discord guild object
     * @param {string} message - Success message to send
     */
    async success(guild, message) {
        await this.log(guild, `✅ ${message}`);
    }

    /**
     * Log an info message
     * @param {Guild} guild - Discord guild object
     * @param {string} message - Info message to send
     */
    async info(guild, message) {
        await this.log(guild, `ℹ️ ${message}`);
    }

    /**
     * Log a warning message
     * @param {Guild} guild - Discord guild object
     * @param {string} message - Warning message to send
     */
    async warn(guild, message) {
        await this.log(guild, `⚠️ ${message}`);
    }

    /**
     * Create a debug logger function for a specific guild
     * @param {Guild} guild - Discord guild object
     * @returns {Function} Debug logging function
     */
    createLogger(guild) {
        return {
            log: (message, prefix) => this.log(guild, message, prefix),
            error: (message) => this.error(guild, message),
            success: (message) => this.success(guild, message),
            info: (message) => this.info(guild, message),
            warn: (message) => this.warn(guild, message)
        };
    }
}

module.exports = { DebugLogger };
