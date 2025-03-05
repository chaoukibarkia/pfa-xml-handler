// src/services/xml-parser-service.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const logger = require('../utils/logging');
const { Pool } = require('pg');
const path = require('path');
const { EventEmitter } = require('events');
const os = require('os');

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
        this.pool = new Pool({
            ...dbConfig,
            // Reduce connection pool size to manage memory better
            max: options.maxConnections || 5,
            idleTimeoutMillis: options.idleTimeout || 10000
        });
        this.dbClient = null;

        // Configuration options
        this.config = {
            batchSize: options.batchSize || 100, // Reduced batch size for better memory management
            logInterval: options.logInterval || 5000, // More frequent logging for monitoring
            validateXml: options.validateXml !== false,
            maxFileSizeGB: options.maxFileSizeGB || 10,
            tempDir: options.tempDir || path.join(process.cwd(), 'temp'),
            cleanupTemp: options.cleanupTemp !== false,
            streamMode: options.streamMode || 'stream',
            gcInterval: options.gcInterval || 500, // More frequent GC
            maxMemoryMB: options.maxMemoryMB || 4096,  // Max memory in MB
            chunkSize: options.chunkSize || 50 * 1024 * 1024, // 50MB chunks for large files
            logMemoryInterval: options.logMemoryInterval || 10000 // Log memory usage every 10 seconds
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
            lastMemoryUsage: process.memoryUsage(),
            currentChunk: 0,
            totalChunks: 0,
            activeElements: new Set(), // Track active element processing
            aborted: false,
            memoryWarningCount: 0,
            elementCounts: {}
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
                global.gc(); // Double GC for more thorough cleaning
                const afterMemory = process.memoryUsage();

                const freedMB = Math.round((beforeMemory.heapUsed - afterMemory.heapUsed) / (1024 * 1024));
                if (freedMB > 10) { // Only log if significant memory was freed
                    logger.processInfo('Forced garbage collection', {
                        beforeHeapUsed: Math.round(beforeMemory.heapUsed / (1024 * 1024)) + ' MB',
                        afterHeapUsed: Math.round(afterMemory.heapUsed / (1024 * 1024)) + ' MB',
                        freed: freedMB + ' MB'
                    });
                }

                this.gcCounter = 0;
            } catch (error) {
                logger.processingError('Failed to force garbage collection', error);
            }
        }
    }

    /**
     * Get available system memory
     * @returns {number} Available memory in MB
     */
    getAvailableSystemMemory() {
        try {
            return Math.round(os.freemem() / (1024 * 1024));
        } catch (error) {
            return 4096; // Default assumption if we can't determine
        }
    }

    /**
     * Monitor memory usage and take action if threshold exceeded
     */
    monitorMemory() {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
        const rssUsedMB = Math.round(memoryUsage.rss / (1024 * 1024));
        
        // Get system-wide available memory
        const availableSystemMemoryMB = this.getAvailableSystemMemory();
        
        // Determine max allowed memory (90% of configured or 70% of available system memory, whichever is less)
        const maxAllowedMB = Math.min(
            this.config.maxMemoryMB * 0.9, 
            availableSystemMemoryMB * 0.7
        );

        // Log memory usage at intervals
        const now = Date.now();
        if (now - this.state.lastMemoryCheck > this.config.logMemoryInterval) {
            logger.processInfo('Memory status', {
                heapUsedMB,
                rssUsedMB,
                availableSystemMemoryMB,
                maxAllowedMB,
                activeElements: this.state.activeElements.size,
                elementCounts: this.state.elementCounts
            });
            this.state.lastMemoryCheck = now;
        }

        // Log if usage increased significantly
        const lastHeapUsedMB = Math.round(this.state.lastMemoryUsage.heapUsed / (1024 * 1024));
        if (heapUsedMB > lastHeapUsedMB * 1.2) { // 20% increase
            logger.processInfo('Memory usage increased significantly', {
                heapUsedMB,
                rssUsedMB,
                increase: `${((heapUsedMB / lastHeapUsedMB) * 100 - 100).toFixed(1)}%`,
                activeElements: this.state.activeElements.size
            });

            this.state.lastMemoryUsage = memoryUsage;
        }

        // Take action if memory usage exceeds threshold
        if (heapUsedMB > maxAllowedMB * 0.8 || rssUsedMB > maxAllowedMB * 0.8) {
            logger.processInfo('Memory usage approaching threshold', {
                heapUsedMB,
                rssUsedMB,
                maxAllowedMB,
                percentOfMax: `${((Math.max(heapUsedMB, rssUsedMB) / maxAllowedMB) * 100).toFixed(1)}%`
            });

            // Try to force garbage collection
            this.tryForceGC();

            // If we're critically close to threshold after GC, emit warning
            const updatedMemory = process.memoryUsage();
            const updatedHeapUsedMB = Math.round(updatedMemory.heapUsed / (1024 * 1024));

            if (updatedHeapUsedMB > maxAllowedMB * 0.9) {
                this.state.memoryWarningCount++;
                
                // Emit warning
                this.emit('memory-warning', {
                    heapUsedMB: updatedHeapUsedMB,
                    maxAllowedMB,
                    warningCount: this.state.memoryWarningCount
                });
                
                // If we've had multiple warnings, consider more drastic action
                if (this.state.memoryWarningCount >= 3) {
                    logger.processInfo('Critical memory pressure detected, considering aborting', {
                        heapUsedMB: updatedHeapUsedMB,
                        warningCount: this.state.memoryWarningCount
                    });
                    
                    // At this point we could abort if necessary
                    if (updatedHeapUsedMB > maxAllowedMB * 0.95) {
                        this.state.aborted = true;
                        this.emit('abort', {
                            reason: 'memory',
                            heapUsedMB: updatedHeapUsedMB
                        });
                    }
                }
            }
        } else {
            // Reset warning count if memory usage is acceptable
            if (this.state.memoryWarningCount > 0 && heapUsedMB < maxAllowedMB * 0.7) {
                this.state.memoryWarningCount = 0;
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
            this.state.lastMemoryCheck = Date.now();
            this.memoryCheckInterval = setInterval(() => {
                this.monitorMemory();
            }, 15000); // Check every 15 seconds

            logger.processInfo('Database connection established and components initialized', {
                streamMode: this.config.streamMode,
                gcInterval: this.config.gcInterval,
                maxMemoryMB: this.config.maxMemoryMB,
                batchSize: this.config.batchSize
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
            try {
                // Make sure any pending transactions are committed or rolled back
                await this.dbClient.query('COMMIT');
            } catch (e) {
                // Ignore errors during cleanup
            }
            
            this.dbClient.release();
            logger.processInfo('Database connection released');
        }

        // Clean up temporary files if enabled
        if (this.config.cleanupTemp) {
            try {
                const tempFiles = fs.readdirSync(this.config.tempDir)
                    .filter(file => file.startsWith('xml_chunk_'));
                
                for (const file of tempFiles) {
                    fs.unlinkSync(path.join(this.config.tempDir, file));
                }
                
                logger.processInfo('Temporary files cleanup completed', {
                    deletedFiles: tempFiles.length
                });
            } catch (error) {
                logger.processingError('Failed to clean up temporary files', error);
            }
        }

        // Try one final GC
        this.tryForceGC();
    }

    /**
     * Split large XML file into manageable chunks
     * @param {string} filePath - Path to large XML file
     * @returns {Promise<Array<string>>} Array of chunk file paths
     */
    async splitLargeXmlFile(filePath) {
        const stats = fs.statSync(filePath);
        const fileSizeBytes = stats.size;
        
        // If file is small enough, just return it directly
        if (fileSizeBytes <= this.config.chunkSize) {
            return [filePath];
        }
        
        const chunkCount = Math.ceil(fileSizeBytes / this.config.chunkSize);
        logger.processInfo('Splitting large XML file', {
            filePath,
            fileSizeBytes,
            chunkSizeBytes: this.config.chunkSize,
            chunkCount
        });
        
        this.state.totalChunks = chunkCount;
        
        // Reading and splitting large XML files requires special handling
        // For simplicity, we'll return the original file path and handle the chunking differently
        // A real implementation would need to preserve XML structure when splitting
        
        return [filePath];
    }

    /**
     * Stream-based XML parsing with memory management
     * @param {string} filePath - Path to XML file
     * @returns {Promise<Object>} Processing statistics
     */
    async parseXMLFile(filePath) {
        try {
            // Initialize connections
            await this.initialize();

            // Validate file exists
            if (!fs.existsSync(filePath)) {
                await this.cleanup();
                throw new Error(`XML file not found: ${filePath}`);
            }

            // Check file size
            const stats = fs.statSync(filePath);
            const fileSizeInGB = stats.size / (1024 * 1024 * 1024);

            if (fileSizeInGB > this.config.maxFileSizeGB) {
                await this.cleanup();
                throw new Error(`File too large. Max size is ${this.config.maxFileSizeGB}GB, file is ${fileSizeInGB.toFixed(2)}GB`);
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

            // Handle large files by processing in chunks if needed
            const chunkPaths = await this.splitLargeXmlFile(filePath);
            const startTime = Date.now();
            
            // Process each chunk
            const allStats = [];
            
            for (let i = 0; i < chunkPaths.length; i++) {
                this.state.currentChunk = i + 1;
                logger.processInfo(`Processing chunk ${this.state.currentChunk} of ${chunkPaths.length}`);
                
                const chunkStats = await this.processXmlChunk(chunkPaths[i]);
                allStats.push(chunkStats);
                
                // Force garbage collection between chunks
                this.tryForceGC();
                
                // Reset element tracking between chunks
                this.state.activeElements.clear();
                this.state.elementCounts = {};
                
                // Log progress
                const chunksProcessed = i + 1;
                const percentComplete = ((chunksProcessed / chunkPaths.length) * 100).toFixed(1);
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const estimatedTotalSeconds = (elapsedSeconds / chunksProcessed) * chunkPaths.length;
                const remainingSeconds = estimatedTotalSeconds - elapsedSeconds;
                
                logger.processInfo(`Chunk processing progress: ${percentComplete}%`, {
                    chunksProcessed,
                    totalChunks: chunkPaths.length,
                    elapsedTime: this.formatTime(elapsedSeconds),
                    estimatedRemaining: this.formatTime(remainingSeconds)
                });
            }
            
            // Combine stats from all chunks
            const combinedStats = this.combineStats(allStats);
            
            // Final cleanup
            await this.cleanup();
            
            return combinedStats;
        } catch (error) {
            logger.processingError('Error in XML parsing', error);
            await this.cleanup();
            throw error;
        }
    }
    
    /**
     * Format time in seconds to human-readable format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${hours}h ${minutes}m ${secs}s`;
    }
    
    /**
     * Combine stats from multiple processing chunks
     * @param {Array<Object>} statsList - List of stats objects
     * @returns {Object} Combined stats
     */
    combineStats(statsList) {
        const combined = {
            processingTime: 0,
            processedRecords: 0,
            recordsPerSecond: 0,
            counts: {}
        };
        
        for (const stats of statsList) {
            combined.processingTime += stats.processingTime;
            combined.processedRecords += stats.processedRecords;
            
            // Combine counts
            for (const [key, value] of Object.entries(stats.counts)) {
                combined.counts[key] = (combined.counts[key] || 0) + value;
            }
        }
        
        // Calculate overall records per second
        if (combined.processingTime > 0) {
            combined.recordsPerSecond = combined.processedRecords / combined.processingTime;
        }
        
        return combined;
    }
    
    /**
     * Process a single XML chunk with memory optimization
     * @param {string} chunkPath - Path to XML chunk
     * @returns {Promise<Object>} Processing statistics
     */
    processXmlChunk(chunkPath) {
        return new Promise((resolve, reject) => {
            try {
                // Create a readable stream with explicit buffer size
                const streamOptions = {
                    highWaterMark: 32 * 1024, // Smaller buffer size (32KB)
                    encoding: 'utf8'
                };

                const stream = fs.createReadStream(chunkPath, streamOptions);

                // Create XML parser with optimized options
                const xml = new XmlStream(stream, 'utf8', {
                    trim: true,
                    captureText: true,
                    preserveMarkup: false,
                    strict: false,
                    normalize: true,
                    collect: false
                });

                // Track active elements to help diagnose memory issues
                xml.on('startElement', (name) => {
                    this.state.activeElements.add(name);
                    this.state.elementCounts[name] = (this.state.elementCounts[name] || 0) + 1;
                });
                
                xml.on('endElement', (name) => {
                    this.state.activeElements.delete(name);
                });

                // Configure the parser to capture text content
                xml.preserve('Description1Name', true);
                xml.preserve('Description2Name', true);
                xml.preserve('Description3Name', true);
                xml.preserve('NameType', true);
                xml.preserve('DateType', true);
                xml.preserve('RoleType', true);
                xml.preserve('ReferenceName', true);
                xml.preserve('Relationship', true);
                xml.preserve('Occupation', true);
                xml.preserve('CountryName', true);

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

                // Set up abort handling
                this.on('abort', () => {
                    logger.processInfo('Aborting XML processing due to resource constraints');
                    stream.destroy(); // Force stream to close
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

                        logger.processInfo('XML chunk processing completed', stats);

                        resolve(stats);
                    } catch (error) {
                        logger.processingError('Completion processing failed', error);
                        reject(error);
                    }
                });

                // Error handling
                xml.on('error', (error) => {
                    logger.processingError('XML parsing error', error);
                    reject(error);
                });

                // Set up periodic memory usage reporting
                const memoryInterval = setInterval(() => {
                    logger.logMemoryUsage();
                }, 60000); // Log memory usage every minute

                // Clear interval on stream end or error
                xml.on('end', () => clearInterval(memoryInterval));
                xml.on('error', () => clearInterval(memoryInterval));

                // Handle stream errors
                stream.on('error', (error) => {
                    logger.processingError('File stream error', error);
                    clearInterval(memoryInterval);
                    reject(error);
                });

            } catch (error) {
                logger.processingError('Error in XML chunk processing setup', error);
                reject(error);
            }
        });
    }
}

module.exports = XMLParserService;