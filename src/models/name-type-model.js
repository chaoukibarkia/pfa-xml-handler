// src/models/name-type-model.js
const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class NameTypeModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'name_types';
        this.primaryKey = 'id';
    }

    /**
     * Validate name type record
     * @param {Object} record - Name type record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific name type validation
        if (record.name_type_id === undefined) {
            throw new Error('Name type ID is required');
        }

        if (!record.name) {
            throw new Error('Name type name is required');
        }

        if (!record.record_type) {
            throw new Error('Record type is required');
        }
    }

    /**
     * Sanitize name type record
     * @param {Object} record - Name type record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            name_type_id: parseInt(record.name_type_id, 10),
            name: record.name.trim(),
            record_type: record.record_type.trim()
        };
    }

    /**
     * Insert or update name type
     * @param {Object} record - Name type record
     * @returns {Promise<Object>} Inserted or updated name type
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (name_type_id, name, record_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (name_type_id, record_type) DO UPDATE
                SET name = EXCLUDED.name
                RETURNING *
            `;

            const values = [
                sanitizedRecord.name_type_id,
                sanitizedRecord.name,
                sanitizedRecord.record_type
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Name type upserted', {
                nameTypeId: sanitizedRecord.name_type_id,
                name: sanitizedRecord.name,
                recordType: sanitizedRecord.record_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Name type upsert failed', error);
            throw error;
        }
    }

    /**
     * Find name types by record type
     * @param {string} recordType - Record type to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found name types
     */
    async findByRecordType(recordType, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE record_type = $1
                ORDER BY name_type_id
                LIMIT $2 OFFSET $3
            `;
            
            const values = [recordType, limit, offset];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Name type search by record type failed', error);
            throw error;
        }
    }

    /**
     * Find name type by ID and record type
     * @param {number} nameTypeId - Name type ID
     * @param {string} recordType - Record type
     * @returns {Promise<Object|null>} Found name type or null
     */
    async findByIdAndRecordType(nameTypeId, recordType) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE name_type_id = $1 AND record_type = $2
            `;
            
            const values = [nameTypeId, recordType];
            
            const result = await this.db.query(query, values);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.processingError('Name type lookup failed', error);
            throw error;
        }
    }
    
    /**
     * Batch upsert name types
     * @param {Array} nameTypes - Array of name type records
     * @returns {Promise<number>} Number of upserted name types
     */
    async batchUpsert(nameTypes) {
        if (!nameTypes || nameTypes.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            for (const nameType of nameTypes) {
                await this.upsert(nameType);
                upsertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch name types upserted', {
                totalNameTypes: upsertedCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch name type upsert failed', error);
            throw error;
        }
    }
}

module.exports = NameTypeModel;