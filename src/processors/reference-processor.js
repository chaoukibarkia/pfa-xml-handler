// src/processors/reference-processor.js
const BaseProcessor = require('./base-processor');
const logger = require('../utils/logging');

/**
 * Processor for Reference data XML elements
 */
class ReferenceProcessor extends BaseProcessor {
    constructor(dbClient, models, options = {}) {
        super(dbClient, models, options);

        // Reference-specific stats
        this.stats.counts = {
            countries: 0,
            occupations: 0,
            relationships: 0,
            sanctionsReferences: 0,
            descriptionTypes: 0,
            dateTypes: 0,
            nameTypes: 0,
            roleTypes: 0
        };
    }

    /**
     * Setup XML handlers for reference data processing
     * @param {Object} xml - XML stream
     */
    setupHandlers(xml) {
        // Country references
        xml.on('endElement: CountryName', async (country) => {
            try {
                await this.processCountry(country);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Country processing error', error);
                this.updateStats(false);
            }
        });

        // Occupation references
        xml.on('endElement: Occupation', async (occupation) => {
            try {
                await this.processOccupation(occupation);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Occupation processing error', error);
                this.updateStats(false);
            }
        });

        // Relationship references
        xml.on('endElement: Relationship', async (relationship) => {
            try {
                await this.processRelationship(relationship);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Relationship processing error', error);
                this.updateStats(false);
            }
        });

        // Sanctions references
        xml.on('endElement: ReferenceName', async (reference) => {
            try {
                await this.processSanctionsReference(reference);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Sanctions reference processing error', error);
                this.updateStats(false);
            }
        });

        // Description types (Level 1)
        xml.on('endElement: Description1Name', async (description) => {
            try {
                await this.processDescription1(description);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Description1 processing error', error);
                this.updateStats(false);
            }
        });

        // Description types (Level 2)
        xml.on('endElement: Description2Name', async (description) => {
            try {
                await this.processDescription2(description);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Description2 processing error', error);
                this.updateStats(false);
            }
        });

        // Description types (Level 3)
        xml.on('endElement: Description3Name', async (description) => {
            try {
                await this.processDescription3(description);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Description3 processing error', error);
                this.updateStats(false);
            }
        });

        // Date type references
        xml.on('endElement: DateType', async (dateType) => {
            try {
                await this.processDateType(dateType);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Date type processing error', error);
                this.updateStats(false);
            }
        });

        // Name type references
        xml.on('endElement: NameType', async (nameType) => {
            try {
                await this.processNameType(nameType);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Name type processing error', error);
                this.updateStats(false);
            }
        });

        // Role type references
        xml.on('endElement: RoleType', async (roleType) => {
            try {
                await this.processRoleType(roleType);
                this.updateStats(true);
            } catch (error) {
                logger.processingError('Role type processing error', error);
                this.updateStats(false);
            }
        });

        // Return the processor for chaining
        return this;
    }

    /**
     * Process Country reference
     * @param {Object} country - CountryName XML element
     */
    async processCountry(country) {
        await this.models.country.upsert({
            code: this.getAttribute(country.$, 'code'),
            name: this.getAttribute(country.$, 'name'),
            is_territory: this.getAttribute(country.$, 'IsTerritory') === 'true',
            profile_url: this.getAttribute(country.$, 'ProfileURL')
        });

        this.stats.counts.countries++;
    }

    /**
     * Process Occupation reference
     * @param {Object} occupation - Occupation XML element
     */
    async processOccupation(occupation) {
        await this.models.occupation.upsert({
            code: this.getAttribute(occupation.$, 'code'),
            name: this.getAttribute(occupation.$, 'name')
        });

        this.stats.counts.occupations++;
    }

    /**
     * Process Relationship reference
     * @param {Object} relationship - Relationship XML element
     */
    async processRelationship(relationship) {
        await this.models.relationship.upsert({
            code: this.getAttribute(relationship.$, 'code'),
            name: this.getAttribute(relationship.$, 'name')
        });

        this.stats.counts.relationships++;
    }

    /**
     * Process Sanctions Reference
     * @param {Object} reference - ReferenceName XML element
     */
    async processSanctionsReference(reference) {
        await this.models.sanctionsReference.upsert({
            code: this.getAttribute(reference.$, 'code'),
            name: this.getAttribute(reference.$, 'name'),
            status: this.getAttribute(reference.$, 'status'),
            description2_id: this.safeParseInt(this.getAttribute(reference.$, 'Description2Id'))
        });

        this.stats.counts.sanctionsReferences++;
    }

    // src/processors/reference-processor.js
    // Updated processDescription methods to correctly extract description text

    /**
     * Process Description Level 1
     * @param {Object} description - Description1Name XML element
     */
    async processDescription1(description) {
        try {
            // Improved text extraction logic
            let descriptionText = '';

            if (typeof description === 'string') {
                descriptionText = description;
            } else if (description._) {
                descriptionText = description._;
            } else if (description.text) {
                descriptionText = description.text;
            } else if (description.$text) {
                descriptionText = description.$text;
            } else {
                // Debug output to investigate structure
                logger.processInfo('Description structure:', {
                    type: typeof description,
                    keys: description ? Object.keys(description) : [],
                    structure: JSON.stringify(description)
                });

                // Try a more comprehensive approach
                descriptionText = this.extractTextContent(description);

                // Last resort: skip this record
                if (!descriptionText || descriptionText === '[object Object]') {
                    logger.processingError('Failed to extract description text', {
                        id: this.getAttribute(description.$, 'Description1Id')
                    });
                    return; // Skip this record rather than saving "[object Object]"
                }
            }

            await this.models.descriptionType.upsert({
                level: 1,
                id: this.safeParseInt(this.getAttribute(description.$, 'Description1Id')),
                description: descriptionText.trim(),
                parent_id: null,
                record_type: this.getAttribute(description.$, 'RecordType')
            });

            this.stats.counts.descriptionTypes++;
        } catch (error) {
            logger.processingError('Description1 processing error', error);
            throw error;
        }
    }

    /**
  * Process Description Level 2
  * @param {Object} description - Description2Name XML element
  */
    async processDescription2(description) {
        try {
            // Improved text extraction logic
            let descriptionText = '';

            if (typeof description === 'string') {
                descriptionText = description;
            } else if (description._) {
                descriptionText = description._;
            } else if (description.text) {
                descriptionText = description.text;
            } else if (description.$text) {
                descriptionText = description.$text;
            } else {
                // Debug output to investigate structure
                logger.processInfo('Description2 structure:', {
                    type: typeof description,
                    keys: description ? Object.keys(description) : [],
                    structure: JSON.stringify(description)
                });

                // Try a more comprehensive approach
                descriptionText = this.extractTextContent(description);

                // Last resort: skip this record
                if (!descriptionText || descriptionText === '[object Object]') {
                    logger.processingError('Failed to extract description2 text', {
                        id: this.getAttribute(description.$, 'Description2Id')
                    });
                    return; // Skip this record rather than saving "[object Object]"
                }
            }

            await this.models.descriptionType.upsert({
                level: 2,
                id: this.safeParseInt(this.getAttribute(description.$, 'Description2Id')),
                description: descriptionText.trim(),
                parent_id: this.safeParseInt(this.getAttribute(description.$, 'Description1Id')),
                parent_level: 1,
                record_type: null
            });

            this.stats.counts.descriptionTypes++;
        } catch (error) {
            logger.processingError('Description2 processing error', error);
            throw error;
        }
    }

    /**
     * Process Description Level 3
     * @param {Object} description - Description3Name XML element
     */
    async processDescription3(description) {
        try {
            // Improved text extraction logic
            let descriptionText = '';

            if (typeof description === 'string') {
                descriptionText = description;
            } else if (description._) {
                descriptionText = description._;
            } else if (description.text) {
                descriptionText = description.text;
            } else if (description.$text) {
                descriptionText = description.$text;
            } else {
                // Debug output to investigate structure
                logger.processInfo('Description3 structure:', {
                    type: typeof description,
                    keys: description ? Object.keys(description) : [],
                    structure: JSON.stringify(description)
                });

                // Try a more comprehensive approach
                descriptionText = this.extractTextContent(description);

                // Last resort: skip this record
                if (!descriptionText || descriptionText === '[object Object]') {
                    logger.processingError('Failed to extract description3 text', {
                        id: this.getAttribute(description.$, 'Description3Id')
                    });
                    return; // Skip this record rather than saving "[object Object]"
                }
            }

            await this.models.descriptionType.upsert({
                level: 3,
                id: this.safeParseInt(this.getAttribute(description.$, 'Description3Id')),
                description: descriptionText.trim(),
                parent_id: this.safeParseInt(this.getAttribute(description.$, 'Description2Id')),
                parent_level: 2,
                record_type: null
            });

            this.stats.counts.descriptionTypes++;
        } catch (error) {
            logger.processingError('Description3 processing error', error);
            throw error;
        }
    }
    /**
     * Process Date Type
     * @param {Object} dateType - DateType XML element
     */
    async processDateType(dateType) {
        await this.models.dateType.upsert({
            date_type_id: this.safeParseInt(this.getAttribute(dateType.$, 'Id')),
            name: this.getAttribute(dateType.$, 'name'),
            record_type: this.getAttribute(dateType.$, 'RecordType')
        });

        this.stats.counts.dateTypes++;
    }

    /**
     * Process Name Type
     * @param {Object} nameType - NameType XML element
     */
    async processNameType(nameType) {
        // Debug logging
        logger.processInfo('Processing NameType', {
            nameTypeId: this.getAttribute(nameType.$, 'NameTypeID'),
            recordType: this.getAttribute(nameType.$, 'RecordType'),
            nameTypeStructure: JSON.stringify(nameType)
        });

        const name = this.extractTextContent(nameType);

        // Log the extracted name
        logger.processInfo('Extracted name', { name });

        if (!name) {
            logger.processingError('Failed to extract name for NameType', {
                nameTypeId: this.getAttribute(nameType.$, 'NameTypeID')
            });
            return; // Skip this record rather than causing an error
        }

        await this.models.nameType.upsert({
            name_type_id: this.safeParseInt(this.getAttribute(nameType.$, 'NameTypeID')),
            name: name,
            record_type: this.getAttribute(nameType.$, 'RecordType')
        });

        this.stats.counts.nameTypes++;
    }

    /**
     * Process Role Type
     * @param {Object} roleType - RoleType XML element
     */
    async processRoleType(roleType) {
        await this.models.roleType.upsert({
            role_type_id: this.safeParseInt(this.getAttribute(roleType.$, 'Id')),
            name: this.getAttribute(roleType.$, 'name')
        });

        this.stats.counts.roleTypes++;
    }
}

module.exports = ReferenceProcessor;