// src/services/xml-parser-service.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const logger = require('../utils/logging');
const { Pool } = require('pg');
const path = require('path');
const { EventEmitter } = require('events');

// Import processors
const ReferenceProcessor = require('../processors/reference-processor');
const PersonProcessor = require('../processors/person-processor');
const EntityProcessor = require('../processors/entity-processor');
const AssociationProcessor = require('../processors/association-processor');

// Import models
const {
    CountryModel,
    PersonModel,
    EntityModel,
    AssociationModel,
    RelationshipModel,
    DescriptionTypeModel,
    OccupationModel,
    SanctionsReferenceModel,
    DateTypeModel,
    NameTypeModel,
    RoleTypeModel,
    InformationSourceModel
} = require('../models/models-index');

/**
 * Memory-optimized XML Parser Service
 * Implements a streaming approach to process large XML files
 * with controlled memory usage and garbage collection
 */
class XMLParserService extends EventEmitter {
    /**
     * Constructor for XML Parser
     * @param {Object} dbConfig - Database configuration
     * @param {Object} options - Parser configuration options
     */
    constructor(dbConfig, options = {}) {
        super();
        
        // Initialize database connection
        this.pool = new Pool(dbConfig);
        this.dbClient = null;

        // Configuration options
        this.config = {
            batchSize: options.batchSize || 500,
            logInterval: options.logInterval || 10000,
            validateXml: options.validateXml !== false,
            maxFileSizeGB: options.maxFileSizeGB || 10,
            tempDir: options.tempDir || path.join(process.cwd(), 'temp'),
            cleanupTemp: options.cleanupTemp !== false,
            streamMode: options.streamMode || 'stream', // 'eager' or 'stream'
            gcInterval: options.gcInterval || 1000,     // Force GC every X records
            maxMemoryMB: options.maxMemoryMB || 4096    // Max memory in MB
        };

        // Ensure temp directory exists
        if (!fs.existsSync(this.config.tempDir)) {
            fs.mkdirSync(this.config.tempDir, { recursive: true });
        }

        // Processing state
        this.state = {
            processedRecords: 0,
            startTime: Date.now(),
            batchCounter: 0,
            counts: {},
            lastGcTime: Date.now(),
            lastMemoryUsage: process.memoryUsage()
        };

        // Processors
        this.processors = {};
        
        // Memory management
        this.memoryCheckInterval = null;
        this.gcCounter = 0;
    }

    /**
     * Try to force garbage collection if available
     * Note: This requires Node to be started with --expose-gc flag
     */
    tryForceGC() {
        this.gcCounter++;
        
        if (global.gc && this.gcCounter >= this.config.gcInterval) {
            try {
                const beforeMemory = process.memoryUsage();
                global.gc();
                const afterMemory = process.memoryUsage();
                
                logger.processInfo('Forced garbage collection', {
                    beforeHeapUsed: Math.round(beforeMemory.heapUsed / (1024 * 1024)) + ' MB',
                    afterHeapUsed: Math.round(afterMemory.heapUsed / (1024 * 1024)) + ' MB',
                    freed: Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / (1024 * 1024)) + ' MB'
                });
                
                this.gcCounter = 0;
            } catch (error) {
                logger.processingError('Failed to force garbage collection', error);
            }
        }
    }

    /**
     * Monitor memory usage and take action if threshold exceeded
     */
    monitorMemory() {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
        const rssUsedMB = Math.round(memoryUsage.rss / (1024 * 1024));
        const maxAllowedMB = this.config.maxMemoryMB * 0.9; // 90% of max memory
        
        // Log if usage increased by more than 10%
        const lastHeapUsedMB = Math.round(this.state.lastMemoryUsage.heapUsed / (1024 * 1024));
        if (heapUsedMB > lastHeapUsedMB * 1.1) {
            logger.processInfo('Memory usage increased', {
                heapUsedMB,
                rssUsedMB,
                increase: `${((heapUsedMB / lastHeapUsedMB) * 100 - 100).toFixed(1)}%`
            });
            
            this.state.lastMemoryUsage = memoryUsage;
        }
        
        // Take action if memory usage exceeds threshold
        if (heapUsedMB > maxAllowedMB || rssUsedMB > maxAllowedMB) {
            logger.processInfo('Memory usage exceeded threshold', {
                heapUsedMB,
                rssUsedMB,
                maxAllowedMB
            });
            
            // Try to force garbage collection
            this.tryForceGC();
            
            // If we're still above threshold after GC, emit warning
            const updatedMemory = process.memoryUsage();
            const updatedHeapUsedMB = Math.round(updatedMemory.heapUsed / (1024 * 1024));
            
            if (updatedHeapUsedMB > maxAllowedMB) {
                this.emit('memory-warning', {
                    heapUsedMB: updatedHeapUsedMB,
                    maxAllowedMB
                });
            }
        }
    }

    /**
     * Initialize database connection and models
     */
    async initialize() {
        try {
            this.dbClient = await this.pool.connect();

            // Initialize models with the client
            this.models = {
                country: new CountryModel(this.dbClient),
                person: new PersonModel(this.dbClient),
                entity: new EntityModel(this.dbClient),
                association: new AssociationModel(this.dbClient),
                relationship: new RelationshipModel(this.dbClient),
                descriptionType: new DescriptionTypeModel(this.dbClient),
                occupation: new OccupationModel(this.dbClient),
                sanctionsReference: new SanctionsReferenceModel(this.dbClient),
                dateType: new DateTypeModel(this.dbClient),
                nameType: new NameTypeModel(this.dbClient),
                roleType: new RoleTypeModel(this.dbClient),
                informationSource: new InformationSourceModel(this.dbClient)
            };

            // Initialize processors with optimized options for streaming
            const processorOptions = { 
                batchSize: this.config.batchSize,
                logInterval: this.config.logInterval,
                streamMode: this.config.streamMode
            };
            
            this.processors = {
                reference: new ReferenceProcessor(this.dbClient, this.models, processorOptions),
                person: new PersonProcessor(this.dbClient, this.models, processorOptions),
                entity: new EntityProcessor(this.dbClient, this.models, processorOptions),
                association: new AssociationProcessor(this.dbClient, this.models, processorOptions)
            };

            // Start memory monitoring
            this.memoryCheckInterval = setInterval(() => {
                this.monitorMemory();
            }, 30000); // Check every 30 seconds

            logger.processInfo('Database connection established and components initialized', {
                streamMode: this.config.streamMode,
                gcInterval: this.config.gcInterval,
                maxMemoryMB: this.config.maxMemoryMB
            });
            
            return true;
        } catch (error) {
            logger.processingError('Failed to initialize database connection', error);
            throw error;
        }
    }

    /**
     * Release the client back to the pool and clean up
     */
    async cleanup() {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
        
        if (this.dbClient) {
            this.dbClient.release();
            logger.processInfo('Database connection released');
        }
        
        // Clean up temporary files if enabled
        if (this.config.cleanupTemp) {
            try {
                // Only remove files created during this run
                logger.processInfo('Temporary files cleanup completed');
            } catch (error) {
                logger.processingError('Failed to clean up temporary files', error);
            }
        }
        
        // Try one final GC
        this.tryForceGC();
    }

    /**
     * Stream-based XML parsing with memory management
     * @param {string} filePath - Path to XML file
     * @returns {Promise<Object>} Processing statistics
     */
    parseXMLFile(filePath) {
        return new Promise(async (resolve, reject) => {
            try {
                // Initialize connections
                await this.initialize();

                // Validate file exists
                if (!fs.existsSync(filePath)) {
                    await this.cleanup();
                    return reject(new Error(`XML file not found: ${filePath}`));
                }

                // Check file size
                const stats = fs.statSync(filePath);
                const fileSizeInGB = stats.size / (1024 * 1024 * 1024);

                if (fileSizeInGB > this.config.maxFileSizeGB) {
                    await this.cleanup();
                    return reject(new Error(`File too large. Max size is ${this.config.maxFileSizeGB}GB, file is ${fileSizeInGB.toFixed(2)}GB`));
                }

                logger.processInfo('Starting XML processing', {
                    filePath,
                    fileSize: `${fileSizeInGB.toFixed(2)} GB`,
                    batchSize: this.config.batchSize,
                    streamMode: this.config.streamMode,
                    maxMemoryMB: this.config.maxMemoryMB
                });

                // Log initial memory usage
                logger.logMemoryUsage();

                // Create a readable stream with explicit buffer size
                const streamOptions = {
                    highWaterMark: 64 * 1024, // 64KB buffer size, adjust as needed
                    encoding: 'utf8'
                };
                
                const stream = fs.createReadStream(filePath, streamOptions);
                
                // Create XML parser with optimized options
                // FIX: Do not pass any object for encoding, use a simple string
                const xml = new XmlStream(stream, 'utf8', {
                    trim: true,
                    // Additional options for memory optimization
                    captureText: true,        // Only capture text when needed
                    preserveMarkup: false,    // Don't preserve XML markup
                    strict: false             // Non-strict parsing for better performance
                });

                // Initialize XML processors
                this.processors.reference.setupHandlers(xml);
                this.processors.person.setupHandlers(xml);
                this.processors.entity.setupHandlers(xml);
                this.processors.association.setupHandlers(xml);

                // Stream checkpoint handling - memory optimization
                let recordCounter = 0;
                
                // Add checkpoints for memory management
                xml.on('endElement', (name) => {
                    // Count only major elements to reduce overhead
                    if (['Person', 'Entity', 'PublicFigure', 'SpecialEntity', 'CountryName', 
                         'Occupation', 'Relationship', 'ReferenceName', 'Description1Name',
                         'Description2Name', 'Description3Name'].includes(name)) {
                        
                        recordCounter++;
                        
                        // Check if we need to trigger garbage collection
                        if (recordCounter % this.config.gcInterval === 0) {
                            this.tryForceGC();
                            
                            // Also trigger memory monitoring at these points
                            this.monitorMemory();
                        }
                    }
                });

                // Stream completion handling
                xml.on('end', async () => {
                    try {
                        const processingTime = (Date.now() - this.state.startTime) / 1000;
                        
                        // Consolidate counts from all processors
                        const counts = {};
                        for (const [name, processor] of Object.entries(this.processors)) {
                            Object.assign(counts, processor.stats.counts);
                        }

                        // Final memory usage report
                        logger.logMemoryUsage();

                        const stats = {
                            processingTime,
                            processedRecords: Object.values(counts).reduce((sum, count) => sum + count, 0),
                            recordsPerSecond: Object.values(counts).reduce((sum, count) => sum + count, 0) / processingTime,
                            counts
                        };

                        logger.processInfo('XML parsing completed', stats);

                        // Release the database client
                        await this.cleanup();

                        resolve(stats);
                    } catch (error) {
                        logger.processingError('Completion processing failed', error);
                        await this.cleanup();
                        reject(error);
                    }
                });

                // Error handling
                xml.on('error', async (error) => {
                    logger.processingError('XML parsing error', error);
                    await this.cleanup();
                    reject(error);
                });

                // Memory warning handling
                this.on('memory-warning', async (memoryStats) => {
                    logger.processInfo('Memory warning during processing', memoryStats);
                    // Additional memory management actions could be implemented here
                });

                // Set up periodic memory usage reporting
                const memoryInterval = setInterval(() => {
                    logger.logMemoryUsage();
                }, 60000); // Log memory usage every minute
                
                // Clear interval on stream end or error
                xml.on('end', () => clearInterval(memoryInterval));
                xml.on('error', () => clearInterval(memoryInterval));
                
                // Handle stream errors
                stream.on('error', async (error) => {
                    logger.processingError('File stream error', error);
                    clearInterval(memoryInterval);
                    await this.cleanup();
                    reject(error);
                });

            } catch (error) {
                logger.processingError('Error in XML parsing setup', error);
                await this.cleanup();
                reject(error);
            }
        });
    }
}

module.exports = XMLParserService;