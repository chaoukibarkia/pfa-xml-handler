// src/models/role-type-model.js
const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class RoleTypeModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'role_types';
        this.primaryKey = 'id';
    }

    /**
     * Validate role type record
     * @param {Object} record - Role type record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific role type validation
        if (record.role_type_id === undefined) {
            throw new Error('Role type ID is required');
        }

        if (!record.name) {
            throw new Error('Role type name is required');
        }
    }

    /**
     * Sanitize role type record
     * @param {Object} record - Role type record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            role_type_id: parseInt(record.role_type_id, 10),
            name: record.name.trim()
        };
    }

    /**
     * Insert or update role type
     * @param {Object} record - Role type record
     * @returns {Promise<Object>} Inserted or updated role type
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (role_type_id, name)
                VALUES ($1, $2)
                ON CONFLICT (role_type_id) DO UPDATE
                SET name = EXCLUDED.name
                RETURNING *
            `;

            const values = [
                sanitizedRecord.role_type_id,
                sanitizedRecord.name
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Role type upserted', {
                roleTypeId: sanitizedRecord.role_type_id,
                name: sanitizedRecord.name
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Role type upsert failed', error);
            throw error;
        }
    }

    /**
     * Find role type by ID
     * @param {number} roleTypeId - Role type ID
     * @returns {Promise<Object|null>} Found role type or null
     */
    async findById(roleTypeId) {
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE role_type_id = $1
            `;
            
            const values = [roleTypeId];
            
            const result = await this.db.query(query, values);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.processingError('Role type lookup failed', error);
            throw error;
        }
    }

    /**
     * Find role types by name pattern
     * @param {string} namePattern - Name pattern to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found role types
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
            logger.processingError('Role type search by name failed', error);
            throw error;
        }
    }
    
    /**
     * Batch upsert role types
     * @param {Array} roleTypes - Array of role type records
     * @returns {Promise<number>} Number of upserted role types
     */
    async batchUpsert(roleTypes) {
        if (!roleTypes || roleTypes.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            for (const roleType of roleTypes) {
                await this.upsert(roleType);
                upsertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch role types upserted', {
                totalRoleTypes: upsertedCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch role type upsert failed', error);
            throw error;
        }
    }
}

module.exports = RoleTypeModel;