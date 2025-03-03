// src/models/occupation-model.js
const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class OccupationModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'occupations';
        this.primaryKey = 'code';
    }

    /**
     * Validate occupation record
     * @param {Object} record - Occupation record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific occupation validation
        if (!record.code) {
            throw new Error('Occupation code is required');
        }

        if (!record.name) {
            throw new Error('Occupation name is required');
        }
    }

    /**
     * Sanitize occupation record
     * @param {Object} record - Occupation record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            code: parseInt(record.code, 10),
            name: record.name.trim()
        };
    }

    /**
     * Insert or update occupation
     * @param {Object} record - Occupation record
     * @returns {Promise<Object>} Inserted or updated occupation
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} (code, name)
                VALUES ($1, $2)
                ON CONFLICT (code) DO UPDATE
                SET name = EXCLUDED.name
                RETURNING *
            `;

            const values = [
                sanitizedRecord.code, 
                sanitizedRecord.name
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Occupation upserted', {
                code: sanitizedRecord.code,
                name: sanitizedRecord.name
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Occupation upsert failed', error);
            throw error;
        }
    }

    /**
     * Find occupations by name pattern
     * @param {string} namePattern - Name pattern to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found occupations
     */
    async findByName(namePattern, options = {}) {
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
            logger.processingError('Occupation search failed', error);
            throw error;
        }
    }

    /**
     * Batch upsert occupations
     * @param {Array} occupations - Array of occupation records
     * @returns {Promise<number>} Number of upserted occupations
     */
    async batchUpsert(occupations) {
        if (!occupations || occupations.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            for (const occupation of occupations) {
                await this.upsert(occupation);
                upsertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch occupations upserted', {
                totalOccupations: upsertedCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch occupation upsert failed', error);
            throw error;
        }
    }
}

module.exports = OccupationModel;