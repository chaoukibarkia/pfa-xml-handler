// src/config/index.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logging');

/**
 * Configuration manager for the PFA XML Handler
 */
class ConfigManager {
    /**
     * Constructor
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.options = options;
        this.config = null;
        this.configPath = options.configPath || path.join(process.cwd(), 'config.json');
    }

    /**
     * Load configuration from file and merge with defaults
     * @returns {Object} Merged configuration
     */
    load() {
        try {
            // Default configuration
            const defaultConfig = {
                database: {
                    connectionString: "postgresql://pfa_user:tt@S++2069@localhost:5432/pfa_db",
                    maxConnections: 10,
                    idleTimeout: 30000,
                    connectionTimeout: 2000
                },
                processing: {
                    batchSize: 500,
                    logLevel: "info",
                    logDirectory: "./logs",
                    memoryMonitoring: true,
                    memoryMonitorInterval: 60000
                },
                xml: {
                    validExtensions: [".xml"],
                    maxFileSizeGB: 10,
                    validateStructure: true
                },
                storage: {
                    tempDirectory: path.join(process.cwd(), 'temp'),
                    cleanupTemp: true
                }
            };

            // Load configuration from file if exists
            let fileConfig = {};
            if (fs.existsSync(this.configPath)) {
                const configContent = fs.readFileSync(this.configPath, 'utf8');
                fileConfig = JSON.parse(configContent);
                logger.processInfo('Loaded configuration from file', { path: this.configPath });
            } else {
                logger.processInfo('No configuration file found, using default configuration');
            }

            // Merge configurations (deep merge)
            this.config = this.mergeConfigs(defaultConfig, fileConfig);

            // Override with command line options
            if (this.options.database) {
                this.config.database = { ...this.config.database, ...this.options.database };
            }
            
            if (this.options.processing) {
                this.config.processing = { ...this.config.processing, ...this.options.processing };
            }
            
            if (this.options.xml) {
                this.config.xml = { ...this.config.xml, ...this.options.xml };
            }

            return this.config;
        } catch (error) {
            logger.processingError('Failed to load configuration', error);
            throw error;
        }
    }

    /**
     * Deep merge two configuration objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    mergeConfigs(target, source) {
        const output = { ...target };
        
        if (!source) {
            return output;
        }

        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                // If the key is an object in both target and source, merge them
                if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                    output[key] = this.mergeConfigs(target[key], source[key]);
                } else {
                    // Otherwise just use the source value
                    output[key] = source[key];
                }
            } else {
                // For primitives and arrays, use the source value
                output[key] = source[key];
            }
        });

        return output;
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfig() {
        if (!this.config) {
            return this.load();
        }
        return this.config;
    }

    /**
     * Get a specific section of the configuration
     * @param {string} section - Configuration section
     * @returns {Object} Configuration section
     */
    getSection(section) {
        const config = this.getConfig();
        return config[section] || {};
    }

    /**
     * Get database configuration
     * @returns {Object} Database configuration
     */
    getDatabaseConfig() {
        return this.getSection('database');
    }

    /**
     * Get processing configuration
     * @returns {Object} Processing configuration
     */
    getProcessingConfig() {
        return this.getSection('processing');
    }

    /**
     * Get XML configuration
     * @returns {Object} XML configuration
     */
    getXmlConfig() {
        return this.getSection('xml');
    }

    /**
     * Get storage configuration
     * @returns {Object} Storage configuration
     */
    getStorageConfig() {
        return this.getSection('storage');
    }
}

module.exports = ConfigManager;