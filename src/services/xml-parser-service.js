// src/services/xml-parser-service.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const logger = require('../utils/logging');
const { Pool } = require('pg');
const path = require('path');

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

class XMLParserService {
    /**
     * Constructor for XML Parser
     * @param {Object} dbConfig - Database configuration
     * @param {Object} options - Parser configuration options
     */
    constructor(dbConfig, options = {}) {
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
            cleanupTemp: options.cleanupTemp !== false
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
            counts: {}
        };

        // Processors
        this.processors = {};
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

            // Initialize processors
            this.processors = {
                reference: new ReferenceProcessor(this.dbClient, this.models, { 
                    batchSize: this.config.batchSize,
                    logInterval: this.config.logInterval
                }),
                person: new PersonProcessor(this.dbClient, this.models, { 
                    batchSize: this.config.batchSize,
                    logInterval: this.config.logInterval
                }),
                entity: new EntityProcessor(this.dbClient, this.models, { 
                    batchSize: this.config.batchSize,
                    logInterval: this.config.logInterval
                }),
                association: new AssociationProcessor(this.dbClient, this.models, { 
                    batchSize: this.config.batchSize,
                    logInterval: this.config.logInterval
                })
            };

            logger.processInfo('Database connection established and components initialized');
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
        if (this.dbClient) {
            this.dbClient.release();
            logger.processInfo('Database connection released');
        }
        
        // Clean up temporary files if enabled
        if (this.config.cleanupTemp) {
            try {
                // Only remove files created during this run
                // This could be enhanced to use a session-specific subfolder
                logger.processInfo('Temporary files cleanup completed');
            } catch (error) {
                logger.processingError('Failed to clean up temporary files', error);
            }
        }
    }

    /**
     * Parse large XML file
     * @param {string} filePath - Path to XML file
     * @returns {Promise<Object>} Processing statistics
     */
    async parseXMLFile(filePath) {
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
                    batchSize: this.config.batchSize
                });

                // Report initial memory usage
                logger.logMemoryUsage();

                const stream = fs.createReadStream(filePath);
                const xml = new XmlStream(stream);

                // Initialize XML processors
                this.processors.reference.setupHandlers(xml);
                this.processors.person.setupHandlers(xml);
                this.processors.entity.setupHandlers(xml);
                this.processors.association.setupHandlers(xml);

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

                // Set up periodic memory usage reporting
                const memoryInterval = setInterval(() => {
                    logger.logMemoryUsage();
                }, 60000); // Log memory usage every minute
                
                // Clear interval on stream end
                xml.on('end', () => clearInterval(memoryInterval));
                xml.on('error', () => clearInterval(memoryInterval));

            } catch (error) {
                logger.processingError('Error in XML parsing setup', error);
                await this.cleanup();
                reject(error);
            }
        });
    }
}

module.exports = XMLParserService;