const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class SanctionsReferenceModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'sanctions_references';
        this.primaryKey = 'code';
    }

    /**
     * Validate sanctions reference record
     * @param {Object} record - Sanctions reference record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific sanctions reference validation
        if (!record.code) {
            throw new Error('Sanctions reference code is required');
        }

        if (!record.name) {
            throw new Error('Sanctions reference name is required');
        }
    }

    /**
     * Sanitize sanctions reference record
     * @param {Object} record - Sanctions reference record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            code: parseInt(record.code, 10),
            name: record.name?.trim() || '',
            status: record.status?.trim() || null,
            description2_id: record.description2_id ? parseInt(record.description2_id, 10) : null,
            description2_level: record.description2_level || 2
        };
    }

    /**
     * Check if description exists before trying to reference it
     * @param {number} level - Description level
     * @param {number} id - Description ID
     * @returns {Promise<boolean>} Whether the description exists
     */
    async descriptionExists(level, id) {
        if (!level || !id) return false;
        
        try {
            const query = `
                SELECT 1 FROM description_types 
                WHERE level = $1 AND id = $2
            `;
            
            const result = await this.db.query(query, [level, id]);
            return result.rows.length > 0;
        } catch (error) {
            logger.processingError('Description existence check failed', error);
            return false;
        }
    }

    /**
     * Insert or update sanctions reference with foreign key validation
     * @param {Object} record - Sanctions reference record
     * @returns {Promise<Object|null>} Inserted or updated sanctions reference, or null if validation failed
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            // Check if the description reference exists
            if (sanitizedRecord.description2_id) {
                const exists = await this.descriptionExists(
                    sanitizedRecord.description2_level, 
                    sanitizedRecord.description2_id
                );
                
                if (!exists) {
                    logger.processInfo('Missing description reference', {
                        code: sanitizedRecord.code,
                        description2_level: sanitizedRecord.description2_level,
                        description2_id: sanitizedRecord.description2_id
                    });
                    
                    // Set to NULL to avoid foreign key constraint violation
                    sanitizedRecord.description2_level = null;
                    sanitizedRecord.description2_id = null;
                }
            }

            const query = `
                INSERT INTO ${this.tableName} 
                (code, name, status, description2_id, description2_level)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (code) DO UPDATE
                SET 
                    name = EXCLUDED.name,
                    status = EXCLUDED.status,
                    description2_id = EXCLUDED.description2_id,
                    description2_level = EXCLUDED.description2_level
                RETURNING *
            `;

            const values = [
                sanitizedRecord.code,
                sanitizedRecord.name,
                sanitizedRecord.status,
                sanitizedRecord.description2_id,
                sanitizedRecord.description2_level
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Sanctions reference upserted', {
                code: sanitizedRecord.code,
                name: sanitizedRecord.name
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Sanctions reference upsert failed', error);
            throw error;
        }
    }

    /**
     * Find sanctions references by name pattern
     * @param {string} namePattern - Name pattern to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found sanctions references
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
            logger.processingError('Sanctions reference search failed', error);
            throw error;
        }
    }

    /**
     * Find sanctions references by status
     * @param {string} status - Status to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found sanctions references
     */
    async findByStatus(status, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        try {
            const query = `
                SELECT * FROM ${this.tableName}
                WHERE status = $1
                ORDER BY name
                LIMIT $2 OFFSET $3
            `;
            
            const values = [status, limit, offset];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Sanctions reference search by status failed', error);
            throw error;
        }
    }
    
    /**
     * Batch upsert sanctions references with improved error handling
     * @param {Array} references - Array of sanctions reference records
     * @returns {Promise<number>} Number of upserted sanctions references
     */
    async batchUpsert(references) {
        if (!references || references.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let upsertedCount = 0;
            let errorCount = 0;
            const maxErrors = 10; // Only log up to 10 errors to avoid log flooding
            
            for (const reference of references) {
                try {
                    await this.upsert(reference);
                    upsertedCount++;
                } catch (error) {
                    errorCount++;
                    
                    // Only log first few errors to avoid overwhelming logs
                    if (errorCount <= maxErrors) {
                        logger.processingError(`Sanctions reference error ${errorCount}`, error);
                    } else if (errorCount === maxErrors + 1) {
                        logger.processingError(`Too many sanctions reference errors, suppressing further logs`, {
                            totalReferences: references.length,
                            errorsSoFar: errorCount
                        });
                    }
                }
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch sanctions references completed', {
                totalReferences: references.length,
                successCount: upsertedCount,
                errorCount: errorCount
            });

            return upsertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch sanctions reference upsert failed', error);
            throw error;
        }
    }
}

module.exports = SanctionsReferenceModel;