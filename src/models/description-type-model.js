const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class DescriptionTypeModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'description_types';
        this.primaryKey = 'id';
    }

    /**
     * Validate description type record
     * @param {Object} record - Description type record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific description type validation
        if (record.level === undefined) {
            throw new Error('Description level is required');
        }

        if (!record.id) {
            throw new Error('Description ID is required');
        }
    }

    /**
     * Sanitize description type record
     * @param {Object} record - Description type record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            level: parseInt(record.level, 10),
            id: parseInt(record.id, 10),
            description: record.description?.trim() || null,
            parent_id: record.parent_id ? parseInt(record.parent_id, 10) : null,
            record_type: record.record_type?.trim() || null
        };
    }

    /**
     * Upsert description type
     * @param {Object} record - Description type record
     * @returns {Promise<Object>} Upserted description type
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (level, id, description, parent_id, record_type)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (level, id) DO UPDATE
                SET 
                    description = EXCLUDED.description,
                    parent_id = EXCLUDED.parent_id,
                    record_type = EXCLUDED.record_type
                RETURNING *
            `;

            const values = [
                sanitizedRecord.level,
                sanitizedRecord.id,
                sanitizedRecord.description,
                sanitizedRecord.parent_id,
                sanitizedRecord.record_type
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Description type upserted', {
                level: sanitizedRecord.level,
                id: sanitizedRecord.id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Description type upsert failed', error);
            throw error;
        }
    }

    /**
     * Find description types by multiple criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Found description types
     */
    async findDescriptionTypes(criteria = {}) {
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.level !== undefined) {
            conditions.push(`level = $${values.length + 1}`);
            values.push(criteria.level);
        }

        if (criteria.record_type) {
            conditions.push(`record_type = $${values.length + 1}`);
            values.push(criteria.record_type);
        }

        if (criteria.description) {
            conditions.push(`description ILIKE $${values.length + 1}`);
            values.push(`%${criteria.description}%`);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY level, id
            LIMIT 100
        `;

        try {
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Description type search failed', error);
            throw error;
        }
    }

    /**
     * Batch upsert description types
     * @param {Array} descriptionTypes - Array of description type records
     * @returns {Promise<number>} Number of upserted description types
     */
    async batchUpsert(descriptionTypes) {
        if (!descriptionTypes || descriptionTypes.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            for (const descType of descriptionTypes) {
                await this.upsert(descType);
                upsertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch description types upserted', {
                totalDescriptionTypes: upsertedCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch description type upsert failed', error);
            throw error;
        }
    }

    /**
     * Get description type details
     * @param {number} level - Description level
     * @param {number} id - Description ID
     * @returns {Promise<Object|null>} Description type details
     */
    async getDescriptionType(level, id) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE level = $1 AND id = $2
            `;

            const result = await this.db.query(query, [level, id]);

            return result.rows[0] || null;
        } catch (error) {
            logger.processingError('Description type retrieval failed', error);
            throw error;
        }
    }

    /**
     * Get hierarchical description types
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Hierarchical description types
     */
    async getHierarchicalDescriptionTypes(options = {}) {
        const { 
            level = null, 
            parent_id = null, 
            record_type = null 
        } = options;

        const conditions = [];
        const values = [];

        if (level !== null) {
            conditions.push(`level = $${values.length + 1}`);
            values.push(level);
        }

        if (parent_id !== null) {
            conditions.push(`parent_id = $${values.length + 1}`);
            values.push(parent_id);
        }

        if (record_type) {
            conditions.push(`record_type = $${values.length + 1}`);
            values.push(record_type);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        const query = `
            WITH RECURSIVE description_hierarchy AS (
                -- Base case: fetch top-level or specified descriptions
                SELECT 
                    level, 
                    id, 
                    description, 
                    parent_id, 
                    record_type,
                    ARRAY[id]::integer[] AS path
                FROM ${this.tableName}
                ${whereClause}
                
                UNION
                
                -- Recursive case: fetch child descriptions
                SELECT 
                    dt.level, 
                    dt.id, 
                    dt.description, 
                    dt.parent_id, 
                    dt.record_type,
                    dh.path || dt.id
                FROM ${this.tableName} dt
                JOIN description_hierarchy dh ON dt.parent_id = dh.id
            )
            SELECT DISTINCT 
                level, 
                id, 
                description, 
                parent_id, 
                record_type,
                path
            FROM description_hierarchy
            ORDER BY path
            LIMIT 1000
        `;

        try {
            const result = await this.db.query(query, values);

            logger.processInfo('Hierarchical description types retrieved', {
                resultCount: result.rows.length,
                queryOptions: options
            });

            return result.rows;
        } catch (error) {
            logger.processingError('Hierarchical description types retrieval failed', error);
            throw error;
        }
    }
}

module.exports = DescriptionTypeModel;