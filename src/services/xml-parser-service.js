const fs = require('fs');
const XmlStream = require('xml-stream');
const logger = require('../utils/logging');
const { 
    CountryModel, 
    PersonModel, 
    EntityModel, 
    AssociationModel, 
    RelationshipModel, 
    DescriptionTypeModel 
} = require('../models');

class XMLParserService {
    /**
     * Constructor for XML Parser
     * @param {Object} dbClient - Database client connection
     * @param {Object} options - Parser configuration options
     */
    constructor(dbClient, options = {}) {
        // Initialize models
        this.models = {
            country: new CountryModel(dbClient),
            person: new PersonModel(dbClient),
            entity: new EntityModel(dbClient),
            association: new AssociationModel(dbClient),
            relationship: new RelationshipModel(dbClient),
            descriptionType: new DescriptionTypeModel(dbClient)
        };

        // Configuration options
        this.config = {
            batchSize: options.batchSize || 500,
            logInterval: options.logInterval || 10000
        };

        // Processing state
        this.state = {
            processedRecords: 0,
            startTime: Date.now(),
            currentSourceType: null,
            currentSourceID: 0
        };
    }

    /**
     * Parse large XML file
     * @param {string} filePath - Path to XML file
     * @returns {Promise<Object>} Processing statistics
     */
    async parseXMLFile(filePath) {
        return new Promise((resolve, reject) => {
            // Validate file exists
            if (!fs.existsSync(filePath)) {
                return reject(new Error(`XML file not found: ${filePath}`));
            }

            const stream = fs.createReadStream(filePath);
            const xml = new XmlStream(stream);

            // Reference Lists Processing
            this.setupReferenceListParsing(xml);

            // Records Processing
            this.setupRecordParsing(xml);

            // Associations Processing
            this.setupAssociationParsing(xml);

            // Stream completion handling
            xml.on('end', async () => {
                try {
                    // Flush any remaining batches
                    await this.flushAllBatches();

                    const processingTime = (Date.now() - this.state.startTime) / 1000;
                    
                    const stats = {
                        processingTime,
                        processedRecords: this.state.processedRecords
                    };

                    logger.processInfo('XML parsing completed', stats);
                    resolve(stats);
                } catch (error) {
                    logger.processingError('Final batch processing failed', error);
                    reject(error);
                }
            });

            // Error handling
            xml.on('error', (error) => {
                logger.processingError('XML parsing error', error);
                reject(error);
            });
        });
    }

    /**
     * Setup parsing for reference lists
     * @param {Object} xml - XML stream
     */
    setupReferenceListParsing(xml) {
        // Country Names
        xml.on('updateElement: CountryName', async (country) => {
            try {
                await this.models.country.upsert({
                    code: this.getAttribute(country.$, 'code'),
                    name: this.getAttribute(country.$, 'name'),
                    is_territory: this.getAttribute(country.$, 'IsTerritory') === 'true',
                    profile_url: this.getAttribute(country.$, 'ProfileURL')
                });
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Country processing error', error);
            }
        });

        // Relationships
        xml.on('updateElement: Relationship', async (relationship) => {
            try {
                await this.models.relationship.upsert({
                    code: this.getAttribute(relationship.$, 'code'),
                    name: this.getAttribute(relationship.$, 'name')
                });
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Relationship processing error', error);
            }
        });

        // Description Types (Multi-level)
        xml.on('updateElement: Description1Name', async (description) => {
            try {
                await this.models.descriptionType.upsert({
                    level: 1,
                    id: this.getAttribute(description.$, 'Description1Id'),
                    description: description._,
                    record_type: this.getAttribute(description.$, 'RecordType')
                });
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Description1 processing error', error);
            }
        });

        // Similar parsing for Description2Name and Description3Name
    }

    /**
     * Setup parsing for records (Persons and Entities)
     * @param {Object} xml - XML stream
     */
    setupRecordParsing(xml) {
        // Person Processing
        xml.on('updateElement: Person', async (person) => {
            try {
                // Upsert person record
                const personRecord = await this.models.person.upsert({
                    id: this.getAttribute(person.$, 'id'),
                    action: this.getAttribute(person.$, 'action'),
                    date: this.getAttribute(person.$, 'date'),
                    gender: person.Gender?.[0],
                    active_status: person.ActiveStatus?.[0],
                    deceased: person.Deceased?.[0] === 'true'
                });

                // Process person names
                if (person.NameDetails?.[0]?.Name) {
                    for (const name of person.NameDetails[0].Name) {
                        await this.models.person.insertName({
                            person_id: personRecord.id,
                            name_type: this.getAttribute(name.$, 'NameType'),
                            first_name: name.NameValue?.[0]?.FirstName?.[0],
                            surname: name.NameValue?.[0]?.Surname?.[0]
                        });
                    }
                }

                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Person processing error', error);
            }
        });

        // Entity Processing
        xml.on('updateElement: Entity', async (entity) => {
            try {
                // Upsert entity record
                const entityRecord = await this.models.entity.upsert({
                    id: this.getAttribute(entity.$, 'id'),
                    action: this.getAttribute(entity.$, 'action'),
                    date: this.getAttribute(entity.$, 'date'),
                    active_status: entity.ActiveStatus?.[0]
                });

                // Process entity names
                if (entity.NameDetails?.[0]?.Name) {
                    for (const name of entity.NameDetails[0].Name) {
                        await this.models.entity.insertName({
                            entity_id: entityRecord.id,
                            name_type: this.getAttribute(name.$, 'NameType'),
                            entity_name: name.NameValue?.[0]?.EntityName?.[0]
                        });
                    }
                }

                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Entity processing error', error);
            }
        });
    }

    /**
     * Setup parsing for associations
     * @param {Object} xml - XML stream
     */
    setupAssociationParsing(xml) {
        // Public Figure Associations
        xml.on('updateElement: PublicFigure', async (publicFigure) => {
            this.state.currentSourceType = 'PublicFigure';
            this.state.currentSourceID = this.getAttribute(publicFigure.$, 'id');

            // Process associates
            if (publicFigure.Associate) {
                for (const associate of publicFigure.Associate) {
                    try {
                        await this.models.association.createSpecificAssociation({
                            source_id: this.state.currentSourceID,
                            associate_id: this.getAttribute(associate.$, 'id'),
                            relationship_code: this.getAttribute(associate.$, 'code'),
                            is_former: this.getAttribute(associate.$, 'ex') === 'true'
                        }, 'PublicFigure');

                        this.incrementProcessedRecords();
                    } catch (error) {
                        logger.processingError('Public Figure Association processing error', error);
                    }
                }
            }
        });

        // Similar processing for Special Entity Associations
    }

    /**
     * Flush all batches to database
     */
    async flushAllBatches() {
        // Implement batch flushing for all models if needed
    }

    /**
     * Get attribute safely
     * @param {Object} attributes - XML attributes
     * @param {string} attrName - Attribute name
     * @returns {string} Attribute value
     */
    getAttribute(attributes, attrName) {
        return attributes?.[attrName]?.[0] || '';
    }

    /**
     * Increment processed records and log periodically
     */
    incrementProcessedRecords() {
        this.state.processedRecords++;

        // Log progress periodically
        if (this.state.processedRecords % this.config.logInterval === 0) {
            const elapsedTime = (Date.now() - this.state.startTime) / 1000;
            logger.processInfo('Processing progress', {
                recordsProcessed: this.state.processedRecords,
                elapsedTime: `${elapsedTime.toFixed(2)}s`
            });
        }
    }
}

module.exports = XMLParserService;
