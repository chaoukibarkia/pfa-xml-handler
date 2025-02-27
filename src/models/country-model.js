const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class CountryModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'countries';
        this.primaryKey = 'code';
    }

    /**
     * Validate country record
     * @param {Object} record - Country record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific country validation
        if (!record.code) {
            throw new Error('Country code is required');
        }

        if (!record.name) {
            throw new Error('Country name is required');
        }
    }

    /**
     * Sanitize country record
     * @param {Object} record - Country record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            code: record.code?.trim(),
            name: record.name?.trim(),
            is_territory: !!record.is_territory,
            profile_url: record.profile_url?.trim() || null
        };
    }

    /**
     * Insert or update country
     * @param {Object} record - Country record
     * @returns {Promise<Object>} Inserted or updated country
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} (code, name, is_territory, profile_url)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (code) DO UPDATE
                SET 
                    name = EXCLUDED.name,
                    is_territory = EXCLUDED.is_territory,
                    profile_url = EXCLUDED.profile_url
                RETURNING *
            `;

            const values = [
                sanitizedRecord.code, 
                sanitizedRecord.name, 
                sanitizedRecord.is_territory, 
                sanitizedRecord.profile_url
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Country upserted', {
                code: sanitizedRecord.code,
                name: sanitizedRecord.name
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Country upsert failed', error);
            throw error;
        }
    }

    /**
     * Find countries by multiple criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Found countries
     */
    async findCountries(criteria = {}) {
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.name) {
            conditions.push(`name ILIKE $${values.length + 1}`);
            values.push(`%${criteria.name}%`);
        }

        if (criteria.is_territory !== undefined) {
            conditions.push(`is_territory = $${values.length + 1}`);
            values.push(criteria.is_territory);
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
            logger.processingError('Country search failed', error);
            throw error;
        }
    }
}

module.exports = CountryModel;
