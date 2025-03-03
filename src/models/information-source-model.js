// src/models/information-source-model.js
const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class InformationSourceModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'information_sources';
        this.primaryKey = 'id';
    }

    /**
     * Validate information source record
     * @param {Object} record - Information source record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific information source validation
        if (!record.name) {
            throw new Error('Information source name is required');
        }
    }

    /**
     * Sanitize information source record
     * @param {Object} record - Information source record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            name: record.name.trim(),
            description: record.description?.trim() || null,
            url: record.url?.trim() || null
        };
    }

    /**
     * Insert or update information source
     * @param {Object} record - Information source record
     * @returns {Promise<Object>} Inserted or updated information source
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (name, description, url)
                VALUES ($1, $2, $3)
                ON CONFLICT (name) DO UPDATE
                SET 
                    description = COALESCE(EXCLUDED.description, ${this.tableName}.description),
                    url = COALESCE(EXCLUDED.url, ${this.tableName}.url)
                RETURNING *
            `;

            const values = [
                sanitizedRecord.name,
                sanitizedRecord.description,
                sanitizedRecord.url
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Information source upserted', {
                name: sanitizedRecord.name
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Information source upsert failed', error);
            throw error;
        }
    }

    /**
     * Find information source by name
     * @param {string} name - Information source name
     * @returns {Promise<Object|null>} Found information source or null
     */
    async findByName(name) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE name = $1
            `;
            
            const values = [name];
            
            const result = await this.db.query(query, values);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.processingError('Information source lookup failed', error);
            throw error;
        }
    }

    /**
     * Search information sources by name pattern
     * @param {string} namePattern - Name pattern to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found information sources
     */
    async searchByName(namePattern, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE name ILIKE $1
                ORDER BY name
                LIMIT $2 OFFSET $3
            `;
            
            const values = [`%${namePattern}%`, limit, offset];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Information source search by name failed', error);
            throw error;
        }
    }
    
    /**
     * Add source to a person
     * @param {number} personId - Person ID
     * @param {number} sourceId - Source ID
     * @returns {Promise<Object>} Added person source record
     */
    async addPersonSource(personId, sourceId) {
        try {
            const query = `
                INSERT INTO person_sources
                (person_id, source_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                RETURNING *
            `;
            
            const values = [personId, sourceId];
            
            const result = await this.db.query(query, values);
            
            logger.processInfo('Source added to person', {
                personId,
                sourceId
            });
            
            return result.rows[0];
        } catch (error) {
            logger.processingError('Adding source to person failed', error);
            throw error;
        }
    }
    
    /**
     * Add source to an entity
     * @param {number} entityId - Entity ID
     * @param {number} sourceId - Source ID
     * @returns {Promise<Object>} Added entity source record
     */
    async addEntitySource(entityId, sourceId) {
        try {
            const query = `
                INSERT INTO entity_sources
                (entity_id, source_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                RETURNING *
            `;
            
            const values = [entityId, sourceId];
            
            const result = await this.db.query(query, values);
            
            logger.processInfo('Source added to entity', {
                entityId,
                sourceId
            });
            
            return result.rows[0];
        } catch (error) {
            logger.processingError('Adding source to entity failed', error);
            throw error;
        }
    }
    
    /**
     * Get sources for a person
     * @param {number} personId - Person ID
     * @returns {Promise<Array>} Person's sources
     */
    async getPersonSources(personId) {
        try {
            const query = `
                SELECT s.* FROM ${this.tableName} s
                JOIN person_sources ps ON s.id = ps.source_id
                WHERE ps.person_id = $1
                ORDER BY s.name
            `;
            
            const values = [personId];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Getting person sources failed', error);
            throw error;
        }
    }
    
    /**
     * Get sources for an entity
     * @param {number} entityId - Entity ID
     * @returns {Promise<Array>} Entity's sources
     */
    async getEntitySources(entityId) {
        try {
            const query = `
                SELECT s.* FROM ${this.tableName} s
                JOIN entity_sources es ON s.id = es.source_id
                WHERE es.entity_id = $1
                ORDER BY s.name
            `;
            
            const values = [entityId];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Getting entity sources failed', error);
            throw error;
        }
    }
}

module.exports = InformationSourceModel;