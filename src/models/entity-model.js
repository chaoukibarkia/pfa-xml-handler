// src/models/entity-model.js
const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class EntityModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'entities';
        this.primaryKey = 'id';
    }

    /**
     * Validate entity record
     * @param {Object} record - Entity record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific entity validation
        if (!record.id) {
            throw new Error('Entity ID is required');
        }
    }

    /**
     * Sanitize entity record
     * @param {Object} record - Entity record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            id: record.id,
            action: record.action?.trim() || null,
            date: record.date ? new Date(record.date) : null,
            active_status: record.active_status?.trim() || 'ACTIVE',
            entity_type: record.entity_type?.trim() || 'ORGANIZATION',
            profile_notes: record.profile_notes?.trim() || null
        };
    }

    /**
     * Insert or update entity
     * @param {Object} record - Entity record
     * @returns {Promise<Object>} Inserted or updated entity
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (id, action, date, active_status, entity_type, profile_notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE
                SET 
                    action = EXCLUDED.action,
                    date = EXCLUDED.date,
                    active_status = EXCLUDED.active_status,
                    entity_type = EXCLUDED.entity_type,
                    profile_notes = EXCLUDED.profile_notes,
                    last_updated = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const values = [
                sanitizedRecord.id,
                sanitizedRecord.action,
                sanitizedRecord.date,
                sanitizedRecord.active_status,
                sanitizedRecord.entity_type,
                sanitizedRecord.profile_notes
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity upserted', {
                id: sanitizedRecord.id,
                action: sanitizedRecord.action
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity upsert failed', error);
            throw error;
        }
    }

    /**
     * Insert entity name
     * @param {Object} nameRecord - Entity name record
     * @returns {Promise<Object>} Inserted name record
     */
    async insertName(nameRecord) {
        try {
            // Validate name record
            if (!nameRecord.entity_id) {
                throw new Error('Entity ID is required for name');
            }

            const query = `
                INSERT INTO entity_names 
                (entity_id, name_type, name_type_id, entity_name, suffix, 
                original_script_name, is_primary)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                nameRecord.entity_id,
                nameRecord.name_type?.trim() || null,
                nameRecord.name_type_id || null,
                nameRecord.entity_name?.trim() || null,
                nameRecord.suffix?.trim() || null,
                nameRecord.original_script_name?.trim() || null,
                nameRecord.is_primary === undefined ? true : !!nameRecord.is_primary
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity name inserted', {
                entityId: nameRecord.entity_id,
                nameType: nameRecord.name_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity name insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert entity description
     * @param {Object} descriptionRecord - Entity description record
     * @returns {Promise<Object>} Inserted description record
     */
    async insertDescription(descriptionRecord) {
        try {
            // Validate description record
            if (!descriptionRecord.entity_id) {
                throw new Error('Entity ID is required for description');
            }

            const query = `
                INSERT INTO entity_descriptions 
                (entity_id, description1_level, description1_id, 
                description2_level, description2_id, 
                description3_level, description3_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                descriptionRecord.entity_id,
                descriptionRecord.description1_level || 1,
                descriptionRecord.description1_id || null,
                descriptionRecord.description2_level || 2,
                descriptionRecord.description2_id || null,
                descriptionRecord.description3_level || 3,
                descriptionRecord.description3_id || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity description inserted', {
                entityId: descriptionRecord.entity_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity description insertion failed', error);
            throw error;
        }
    }
    
    /**
     * Insert entity date
     * @param {Object} dateRecord - Entity date record
     * @returns {Promise<Object>} Inserted date record
     */
    async insertDate(dateRecord) {
        try {
            // Validate date record
            if (!dateRecord.entity_id) {
                throw new Error('Entity ID is required for date');
            }

            const query = `
                INSERT INTO entity_dates 
                (entity_id, date_type, date_type_id, date, day, month, year, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;

            // Calculate full date if day, month, and year are provided
            let fullDate = null;
            if (dateRecord.year && dateRecord.month && dateRecord.day) {
                try {
                    // Convert month names to numbers if necessary
                    let monthNum = dateRecord.month;
                    if (isNaN(dateRecord.month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        monthNum = monthMap[dateRecord.month.toUpperCase()] || 1;
                    }
                    fullDate = new Date(dateRecord.year, monthNum - 1, dateRecord.day);
                } catch (e) {
                    logger.processingError('Date conversion error', e);
                }
            }

            const values = [
                dateRecord.entity_id,
                dateRecord.date_type?.trim() || null,
                dateRecord.date_type_id || null,
                fullDate,
                dateRecord.day || null,
                dateRecord.month?.trim() || null,
                dateRecord.year || null,
                dateRecord.notes?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity date inserted', {
                entityId: dateRecord.entity_id,
                dateType: dateRecord.date_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity date insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert entity address
     * @param {Object} addressRecord - Entity address record
     * @returns {Promise<Object>} Inserted address record
     */
    async insertAddress(addressRecord) {
        try {
            // Validate address record
            if (!addressRecord.entity_id) {
                throw new Error('Entity ID is required for address');
            }

            const query = `
                INSERT INTO entity_addresses 
                (entity_id, address_line, city, country_code, url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;

            const values = [
                addressRecord.entity_id,
                addressRecord.address_line?.trim() || null,
                addressRecord.city?.trim() || null,
                addressRecord.country_code?.trim() || null,
                addressRecord.url?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity address inserted', {
                entityId: addressRecord.entity_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity address insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert entity vessel details
     * @param {Object} vesselRecord - Entity vessel record
     * @returns {Promise<Object>} Inserted vessel record
     */
    async insertVesselDetails(vesselRecord) {
        try {
            // Validate vessel record
            if (!vesselRecord.entity_id) {
                throw new Error('Entity ID is required for vessel details');
            }

            const query = `
                INSERT INTO entity_vessels 
                (entity_id, call_sign, vessel_type, tonnage, grt, owner, flag)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                vesselRecord.entity_id,
                vesselRecord.call_sign?.trim() || null,
                vesselRecord.vessel_type?.trim() || null,
                vesselRecord.tonnage?.trim() || null,
                vesselRecord.grt?.trim() || null,
                vesselRecord.owner?.trim() || null,
                vesselRecord.flag?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity vessel details inserted', {
                entityId: vesselRecord.entity_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity vessel details insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert entity image
     * @param {Object} imageRecord - Entity image record
     * @returns {Promise<Object>} Inserted image record
     */
    async insertImage(imageRecord) {
        try {
            // Validate image record
            if (!imageRecord.entity_id) {
                throw new Error('Entity ID is required for image');
            }

            if (!imageRecord.url) {
                throw new Error('Image URL is required');
            }

            const query = `
                INSERT INTO entity_images 
                (entity_id, url, is_primary)
                VALUES ($1, $2, $3)
                RETURNING *
            `;

            const values = [
                imageRecord.entity_id,
                imageRecord.url.trim(),
                imageRecord.is_primary === undefined ? false : !!imageRecord.is_primary
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity image inserted', {
                entityId: imageRecord.entity_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity image insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert entity sanction reference
     * @param {Object} sanctionRecord - Entity sanction record
     * @returns {Promise<Object>} Inserted sanction record
     */
    async insertSanction(sanctionRecord) {
        try {
            // Validate sanction record
            if (!sanctionRecord.entity_id) {
                throw new Error('Entity ID is required for sanction');
            }

            if (!sanctionRecord.reference_code) {
                throw new Error('Reference code is required for sanction');
            }

            const query = `
                INSERT INTO entity_sanctions 
                (entity_id, reference_code, start_date, end_date, 
                start_day, start_month, start_year, 
                end_day, end_month, end_year)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            // Calculate start and end dates if components are provided
            let startDate = null;
            let endDate = null;

            if (sanctionRecord.start_year && sanctionRecord.start_month) {
                try {
                    // Convert month names to numbers if necessary
                    let startMonthNum = sanctionRecord.start_month;
                    if (isNaN(sanctionRecord.start_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        startMonthNum = monthMap[sanctionRecord.start_month.toUpperCase()] || 1;
                    }
                    startDate = new Date(
                        sanctionRecord.start_year, 
                        startMonthNum - 1, 
                        sanctionRecord.start_day || 1
                    );
                } catch (e) {
                    logger.processingError('Start date conversion error', e);
                }
            }

            if (sanctionRecord.end_year && sanctionRecord.end_month) {
                try {
                    // Convert month names to numbers if necessary
                    let endMonthNum = sanctionRecord.end_month;
                    if (isNaN(sanctionRecord.end_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        endMonthNum = monthMap[sanctionRecord.end_month.toUpperCase()] || 1;
                    }
                    endDate = new Date(
                        sanctionRecord.end_year, 
                        endMonthNum - 1, 
                        sanctionRecord.end_day || 1
                    );
                } catch (e) {
                    logger.processingError('End date conversion error', e);
                }
            }

            const values = [
                sanctionRecord.entity_id,
                sanctionRecord.reference_code,
                startDate || sanctionRecord.start_date,
                endDate || sanctionRecord.end_date,
                sanctionRecord.start_day || null,
                sanctionRecord.start_month?.trim() || null,
                sanctionRecord.start_year || null,
                sanctionRecord.end_day || null,
                sanctionRecord.end_month?.trim() || null,
                sanctionRecord.end_year || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity sanction inserted', {
                entityId: sanctionRecord.entity_id,
                referenceCode: sanctionRecord.reference_code
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity sanction insertion failed', error);
            throw error;
        }
    }

    /**
     * Find entities by multiple criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found entities
     */
    async findEntities(criteria = {}, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.id) {
            conditions.push(`id = ${values.length + 1}`);
            values.push(criteria.id);
        }

        if (criteria.active_status) {
            conditions.push(`active_status = ${values.length + 1}`);
            values.push(criteria.active_status);
        }

        if (criteria.entity_type) {
            conditions.push(`entity_type = ${values.length + 1}`);
            values.push(criteria.entity_type);
        }

        if (criteria.action) {
            conditions.push(`action = ${values.length + 1}`);
            values.push(criteria.action);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY id
            LIMIT ${values.length + 1}
            OFFSET ${values.length + 2}
        `;

        try {
            const result = await this.db.query(query, [...values, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.processingError('Entity search failed', error);
            throw error;
        }
    }

    /**
     * Get complete entity profile with related data
     * @param {number} entityId - Entity ID
     * @returns {Promise<Object>} Entity profile
     */
    async getFullProfile(entityId) {
        try {
            // Get basic entity data
            const entityQuery = `
                SELECT * FROM ${this.tableName}
                WHERE id = $1
            `;
            
            const entityResult = await this.db.query(entityQuery, [entityId]);
            
            if (entityResult.rows.length === 0) {
                return null;
            }
            
            const entity = entityResult.rows[0];
            
            // Get names
            const namesQuery = `
                SELECT * FROM entity_names
                WHERE entity_id = $1
                ORDER BY is_primary DESC
            `;
            
            const namesResult = await this.db.query(namesQuery, [entityId]);
            entity.names = namesResult.rows;
            
            // Get descriptions
            const descriptionsQuery = `
                SELECT 
                    ed.*,
                    d1.description as description1_text,
                    d2.description as description2_text,
                    d3.description as description3_text
                FROM entity_descriptions ed
                LEFT JOIN description_types d1 ON ed.description1_level = d1.level AND ed.description1_id = d1.id
                LEFT JOIN description_types d2 ON ed.description2_level = d2.level AND ed.description2_id = d2.id
                LEFT JOIN description_types d3 ON ed.description3_level = d3.level AND ed.description3_id = d3.id
                WHERE ed.entity_id = $1
            `;
            
            const descriptionsResult = await this.db.query(descriptionsQuery, [entityId]);
            entity.descriptions = descriptionsResult.rows;
            
            // Get dates
            const datesQuery = `
                SELECT * FROM entity_dates
                WHERE entity_id = $1
            `;
            
            const datesResult = await this.db.query(datesQuery, [entityId]);
            entity.dates = datesResult.rows;
            
            // Get sanctions
            const sanctionsQuery = `
                SELECT es.*, sr.name as sanction_name
                FROM entity_sanctions es
                LEFT JOIN sanctions_references sr ON es.reference_code = sr.code
                WHERE es.entity_id = $1
            `;
            
            const sanctionsResult = await this.db.query(sanctionsQuery, [entityId]);
            entity.sanctions = sanctionsResult.rows;
            
            // Get addresses
            const addressesQuery = `
                SELECT ea.*, c.name as country_name
                FROM entity_addresses ea
                LEFT JOIN countries c ON ea.country_code = c.code
                WHERE ea.entity_id = $1
            `;
            
            const addressesResult = await this.db.query(addressesQuery, [entityId]);
            entity.addresses = addressesResult.rows;
            
            // Get vessel details
            const vesselsQuery = `
                SELECT * FROM entity_vessels
                WHERE entity_id = $1
            `;
            
            const vesselsResult = await this.db.query(vesselsQuery, [entityId]);
            entity.vessels = vesselsResult.rows;
            
            // Get images
            const imagesQuery = `
                SELECT * FROM entity_images
                WHERE entity_id = $1
                ORDER BY is_primary DESC
            `;
            
            const imagesResult = await this.db.query(imagesQuery, [entityId]);
            entity.images = imagesResult.rows;
            
            // Get sources
            const sourcesQuery = `
                SELECT es.*, is.name as source_name
                FROM entity_sources es
                JOIN information_sources is ON es.source_id = is.id
                WHERE es.entity_id = $1
            `;
            
            const sourcesResult = await this.db.query(sourcesQuery, [entityId]);
            entity.sources = sourcesResult.rows;
            
            return entity;
        } catch (error) {
            logger.processingError(`Entity profile retrieval failed for ID ${entityId}`, error);
            throw error;
        }
    }

    /**
     * Search entities by name
     * @param {string} nameQuery - Name to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching entities
     */
    async searchByName(nameQuery, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        try {
            const query = `
                SELECT e.*, en.entity_name
                FROM ${this.tableName} e
                JOIN entity_names en ON e.id = en.entity_id
                WHERE en.entity_name ILIKE $1
                ORDER BY e.id
                LIMIT $2
                OFFSET $3
            `;
            
            const values = [`%${nameQuery}%`, limit, offset];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Entity name search failed', error);
            throw error;
        }
    }
}

module.exports = EntityModel;