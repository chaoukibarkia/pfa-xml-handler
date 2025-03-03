// src/models/date-type-model.js
const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class DateTypeModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'date_types';
        this.primaryKey = 'id';
    }

    /**
     * Validate date type record
     * @param {Object} record - Date type record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific date type validation
        if (record.date_type_id === undefined) {
            throw new Error('Date type ID is required');
        }

        if (!record.name) {
            throw new Error('Date type name is required');
        }

        if (!record.record_type) {
            throw new Error('Record type is required');
        }
    }

    /**
     * Sanitize date type record
     * @param {Object} record - Date type record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            date_type_id: parseInt(record.date_type_id, 10),
            name: record.name.trim(),
            record_type: record.record_type.trim()
        };
    }

    /**
     * Insert or update date type
     * @param {Object} record - Date type record
     * @returns {Promise<Object>} Inserted or updated date type
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (date_type_id, name, record_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (date_type_id, record_type) DO UPDATE
                SET name = EXCLUDED.name
                RETURNING *
            `;

            const values = [
                sanitizedRecord.date_type_id,
                sanitizedRecord.name,
                sanitizedRecord.record_type
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Date type upserted', {
                dateTypeId: sanitizedRecord.date_type_id,
                name: sanitizedRecord.name,
                recordType: sanitizedRecord.record_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Date type upsert failed', error);
            throw error;
        }
    }

    /**
     * Find date types by record type
     * @param {string} recordType - Record type to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found date types
     */
    async findByRecordType(recordType, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE record_type = $1
                ORDER BY date_type_id
                LIMIT $2 OFFSET $3
            `;
            
            const values = [recordType, limit, offset];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Date type search by record type failed', error);
            throw error;
        }
    }

    /**
     * Find date type by ID and record type
     * @param {number} dateTypeId - Date type ID
     * @param {string} recordType - Record type
     * @returns {Promise<Object|null>} Found date type or null
     */
    async findByIdAndRecordType(dateTypeId, recordType) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE date_type_id = $1 AND record_type = $2
            `;
            
            const values = [dateTypeId, recordType];
            
            const result = await this.db.query(query, values);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.processingError('Date type lookup failed', error);
            throw error;
        }
    }
    
    /**
     * Batch upsert date types
     * @param {Array} dateTypes - Array of date type records
     * @returns {Promise<number>} Number of upserted date types
     */
    async batchUpsert(dateTypes) {
        if (!dateTypes || dateTypes.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            for (const dateType of dateTypes) {
                await this.upsert(dateType);
                upsertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch date types upserted', {
                totalDateTypes: upsertedCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch date type upsert failed', error);
            throw error;
        }
    }
}

module.exports = DateTypeModel;