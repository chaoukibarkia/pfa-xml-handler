// src/services/xml-processor-factory.js
const ReferenceProcessor = require('../processors/reference-processor');
const PersonProcessor = require('../processors/person-processor');
const EntityProcessor = require('../processors/entity-processor');
const AssociationProcessor = require('../processors/association-processor');
const logger = require('../utils/logging');

/**
 * Factory for creating and managing XML processors
 */
class XmlProcessorFactory {
    /**
     * Constructor
     * @param {Object} dbClient - Database client
     * @param {Object} models - Database models
     * @param {Object} options - Processing options
     */
    constructor(dbClient, models, options = {}) {
        this.dbClient = dbClient;
        this.models = models;
        this.options = options;
        this.processors = {};
    }

    /**
     * Initialize all processors
     */
    initializeAll() {
        this.processors = {
            reference: new ReferenceProcessor(this.dbClient, this.models, this.options),
            person: new PersonProcessor(this.dbClient, this.models, this.options),
            entity: new EntityProcessor(this.dbClient, this.models, this.options),
            association: new AssociationProcessor(this.dbClient, this.models, this.options)
        };
        
        logger.processInfo('All processors initialized');
        return this.processors;
    }

    /**
     * Get a specific processor by name
     * @param {string} name - Processor name
     * @returns {Object} Processor instance
     */
    getProcessor(name) {
        if (!this.processors[name]) {
            switch (name) {
                case 'reference':
                    this.processors[name] = new ReferenceProcessor(this.dbClient, this.models, this.options);
                    break;
                case 'person':
                    this.processors[name] = new PersonProcessor(this.dbClient, this.models, this.options);
                    break;
                case 'entity':
                    this.processors[name] = new EntityProcessor(this.dbClient, this.models, this.options);
                    break;
                case 'association':
                    this.processors[name] = new AssociationProcessor(this.dbClient, this.models, this.options);
                    break;
                default:
                    throw new Error(`Unknown processor type: ${name}`);
            }
        }
        
        return this.processors[name];
    }

    /**
     * Setup all handlers on the XML stream
     * @param {Object} xml - XML stream
     */
    setupAllHandlers(xml) {
        // Ensure all processors are initialized
        if (Object.keys(this.processors).length === 0) {
            this.initializeAll();
        }
        
        // Setup handlers for each processor
        for (const [name, processor] of Object.entries(this.processors)) {
            processor.setupHandlers(xml);
        }
        
        logger.processInfo('All XML handlers setup complete');
        return this;
    }

    /**
     * Get combined statistics from all processors
     * @returns {Object} Combined statistics
     */
    getCombinedStats() {
        const combinedStats = {
            processedCount: 0,
            successCount: 0,
            errorCount: 0,
            counts: {}
        };
        
        for (const [name, processor] of Object.entries(this.processors)) {
            const stats = processor.getStats();
            
            combinedStats.processedCount += stats.processedCount;
            combinedStats.successCount += stats.successCount;
            combinedStats.errorCount += stats.errorCount;
            
            // Merge counts
            Object.assign(combinedStats.counts, stats.counts);
        }
        
        // Calculate derived stats
        const duration = (Date.now() - this.processors.reference.stats.startTime) / 1000;
        combinedStats.duration = duration;
        combinedStats.recordsPerSecond = combinedStats.processedCount / duration;
        
        return combinedStats;
    }
}

module.exports = XmlProcessorFactory;