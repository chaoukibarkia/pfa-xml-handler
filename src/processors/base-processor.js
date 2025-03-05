// src/processors/base-processor.js
const logger = require('../utils/logging');

/**
 * Base processor class for XML parsing
 * All specialized processors should extend this class
 */
class BaseProcessor {
    /**
     * Constructor
     * @param {Object} dbClient - Database client
     * @param {Object} models - Model objects
     * @param {Object} options - Processor options
     */
    constructor(dbClient, models, options = {}) {
        this.db = dbClient;
        this.models = models;

        this.config = {
            batchSize: 500,
            logInterval: 5000,
            ...options
        };

        this.stats = {
            processedCount: 0,
            successCount: 0,
            errorCount: 0,
            startTime: Date.now()
        };

        this.lastLogTime = Date.now();
    }

    /**
     * Setup XML stream handlers
     * @param {Object} xml - XML stream
     */
    setupHandlers(xml) {
        throw new Error('setupHandlers must be implemented by subclass');
    }

    /**
     * Process a record
     * @param {Object} record - Record to process
     */
    async processRecord(record) {
        throw new Error('processRecord must be implemented by subclass');
    }

    /**
     * Get processor statistics
     * @returns {Object} Processing statistics
     */
    getStats() {
        const duration = (Date.now() - this.stats.startTime) / 1000;
        return {
            ...this.stats,
            duration,
            recordsPerSecond: this.stats.processedCount / duration
        };
    }

    /**
     * Update processing statistics
     * @param {boolean} success - Whether processing was successful
     */
    updateStats(success = true) {
        this.stats.processedCount++;

        if (success) {
            this.stats.successCount++;
        } else {
            this.stats.errorCount++;
        }

        // Log progress at intervals
        const now = Date.now();
        if (now - this.lastLogTime > this.config.logInterval) {
            const stats = this.getStats();
            logger.processInfo(`Processed ${this.constructor.name}: ${stats.processedCount} records (${stats.recordsPerSecond.toFixed(2)}/sec)`, {
                processor: this.constructor.name,
                ...stats
            });
            this.lastLogTime = now;
        }
    }

    /**
     * Get attribute from XML node safely
     * @param {Object} attributes - XML node attributes
     * @param {string} name - Attribute name
     * @returns {string} Attribute value or empty string
     */
    getAttribute(attributes, name) {
        if (!attributes || !attributes[name]) {
            return '';
        }
        return Array.isArray(attributes[name]) ? attributes[name][0] : attributes[name];
    }

    /**
     * Convert a month string to a month number
     * @param {string} month - Month string (e.g., 'JAN', '1', etc.)
     * @returns {number|null} Month number (1-12) or null if invalid
     */
    convertMonth(month) {
        if (!month) return null;

        // If already a number, return it
        if (!isNaN(month)) {
            const num = parseInt(month, 10);
            return (num >= 1 && num <= 12) ? num : null;
        }

        // Map of month abbreviations to numbers
        const monthMap = {
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
        };

        return monthMap[month.toUpperCase()] || null;
    }

    /**
     * Create a date object from parts
     * @param {Object} parts - Object with year, month, day properties
     * @returns {Date|null} Date object or null if invalid
     */
    createDate(parts) {
        try {
            const { year, month, day = 1 } = parts;

            if (!year || !month) return null;

            const monthNum = this.convertMonth(month);
            if (!monthNum) return null;

            return new Date(parseInt(year, 10), monthNum - 1, parseInt(day || 1, 10));
        } catch (e) {
            logger.processingError('Date creation error', e);
            return null;
        }
    }

    /**
     * Safely parse an integer
     * @param {any} value - Value to parse
     * @param {number} defaultValue - Default value if parsing fails
     * @returns {number} Parsed integer or default value
     */
    safeParseInt(value, defaultValue = null) {
        if (value === undefined || value === null || value === '') {
            return defaultValue;
        }

        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    /**
 * Extract text content from an XML node
 * @param {Object} node - XML node
 * @returns {string} Text content
 */
    extractTextContent(node) {
        if (!node) return '';
        
        // If node is a simple string, return it
        if (typeof node === 'string') return node.trim();
        
        // If node is an array, join the array elements
        if (Array.isArray(node)) {
            return node.map(item => this.extractTextContent(item)).join(' ').trim();
        }
        
        // If node has text content in a direct property
        if (node._) return node._.trim();
        if (node.text) return node.text.trim();
        if (node.$text) return node.$text.trim();
        if (node.value) return String(node.value).trim();
        
        // For XML-Stream specific structures
        if (node.$ && node.$text) return node.$text.trim();
        
        // For object inspection
        if (typeof node === 'object') {
            // Try to find a property that might contain the text
            for (const key of Object.keys(node)) {
                // Skip $ attribute or empty values
                if (key === '$' || !node[key]) continue;
                
                // If we find a string property, it might be the text
                if (typeof node[key] === 'string') {
                    return node[key].trim();
                }
            }
        }
        
        // As a last resort, try toString() but check for "[object Object]"
        const str = String(node);
        return str !== '[object Object]' ? str.trim() : '';
    }
}

module.exports = BaseProcessor;