const logger = require('../utils/logging');

class BaseModel {
    constructor(dbClient) {
        this.db = dbClient;
        this.tableName = 'base_table';
        this.primaryKey = 'id';
    }

    /**
     * Batch insert records
     * @param {Array} records - Array of records to insert
     * @param {Array} columns - Columns to insert
     * @returns {Promise<number>} Number of inserted records
     */
    async batchInsert(records, columns) {
        if (!records || records.length === 0) return 0;

        try {
            // Start transaction
            await this.db.query('BEGIN');

            // Construct dynamic INSERT statement
            const placeholders = records.map((_, rowIndex) => 
                `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(',')})`
            ).join(',');

            const flattenedValues = records.flatMap(row => 
                columns.map(col => row[col] || null)
            );

            const query = `
                INSERT INTO ${this.tableName} (${columns.join(',')}) 
                VALUES ${placeholders}
                ON CONFLICT DO NOTHING
            `;

            const result = await this.db.query(query, flattenedValues);

            // Commit transaction
            await this.db.query('COMMIT');

            logger.processInfo(`Batch inserted ${result.rowCount} records into ${this.tableName}`, {
                tableName: this.tableName,
                recordCount: result.rowCount
            });

            return result.rowCount;
        } catch (error) {
            // Rollback transaction on error
            await this.db.query('ROLLBACK');

            logger.processingError(`Batch insert failed for ${this.tableName}`, error);
            throw error;
        }
    }

    /**
     * Find records by specific criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found records
     */
    async find(criteria = {}, options = {}) {
        const { limit = 100, offset = 0, orderBy = this.primaryKey } = options;
        
        const whereClause = Object.keys(criteria)
            .map((key, index) => `${key} = $${index + 1}`)
            .join(' AND ');

        const values = Object.values(criteria);

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause ? `WHERE ${whereClause}` : ''}
            ORDER BY ${orderBy}
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        try {
            const result = await this.db.query(query, [...values, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.processingError(`Find query failed for ${this.tableName}`, error);
            throw error;
        }
    }

    /**
     * Validate record before insertion
     * @param {Object} record - Record to validate
     * @throws {Error} If validation fails
     */
    validate(record) {
        // Basic validation - to be overridden by subclasses
        if (!record) {
            throw new Error('Record cannot be null or undefined');
        }
    }

    /**
     * Sanitize record before insertion
     * @param {Object} record - Record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        // Basic sanitization - to be overridden by subclasses
        return { ...record };
    }
}

module.exports = BaseModel;