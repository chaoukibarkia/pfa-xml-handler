const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class RelationshipModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'relationships';
        this.primaryKey = 'code';
    }

    /**
     * Validate relationship record
     * @param {Object} record - Relationship record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific relationship validation
        if (!record.code) {
            throw new Error('Relationship code is required');
        }

        if (!record.name) {
            throw new Error('Relationship name is required');
        }
    }

    /**
     * Sanitize relationship record
     * @param {Object} record - Relationship record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            code: parseInt(record.code, 10),
            name: record.name.trim()
        };
    }

    /**
     * Upsert relationship
     * @param {Object} record - Relationship record
     * @returns {Promise<Object>} Upserted relationship
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

            logger.processInfo('Relationship upserted', {
                code: sanitizedRecord.code,
                name: sanitizedRecord.name
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Relationship upsert failed', error);
            throw error;
        }
    }

    /**
     * Find relationships by multiple criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Found relationships
     */
    async findRelationships(criteria = {}) {
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.name) {
            conditions.push(`name ILIKE $${values.length + 1}`);
            values.push(`%${criteria.name}%`);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY name
            LIMIT 100
        `;

        try {
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Relationship search failed', error);
            throw error;
        }
    }

    /**
     * Batch upsert relationships
     * @param {Array} relationships - Array of relationship records
     * @returns {Promise<number>} Number of upserted relationships
     */
    async batchUpsert(relationships) {
        if (!relationships || relationships.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            for (const relationship of relationships) {
                await this.upsert(relationship);
                upsertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch relationships upserted', {
                totalRelationships: upsertedCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch relationship upsert failed', error);
            throw error;
        }
    }

    /**
     * Get relationship details by code
     * @param {number} code - Relationship code
     * @returns {Promise<Object|null>} Relationship details
     */
    async getByCode(code) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE code = $1
            `;

            const result = await this.db.query(query, [code]);

            return result.rows[0] || null;
        } catch (error) {
            logger.processingError('Relationship retrieval failed', error);
            throw error;
        }
    }
}

module.exports = RelationshipModel;
