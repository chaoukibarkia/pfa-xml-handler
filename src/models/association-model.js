const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class AssociationModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'associations';
        this.primaryKey = 'id';
    }

    /**
     * Validate association record
     * @param {Object} record - Association record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific association validation
        if (!record.source_id) {
            throw new Error('Source ID is required');
        }

        if (!record.target_id) {
            throw new Error('Target ID is required');
        }

        if (!record.source_type) {
            throw new Error('Source type is required');
        }

        if (!record.target_type) {
            throw new Error('Target type is required');
        }
    }

    /**
     * Sanitize association record
     * @param {Object} record - Association record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            source_id: record.source_id,
            source_type: record.source_type.toUpperCase(),
            target_id: record.target_id,
            target_type: record.target_type.toUpperCase(),
            relationship_code: record.relationship_code || null,
            is_former: !!record.is_former
        };
    }

    /**
     * Create association
     * @param {Object} record - Association record
     * @returns {Promise<Object>} Created association
     */
    async create(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (source_id, source_type, target_id, target_type, 
                relationship_code, is_former)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const values = [
                sanitizedRecord.source_id,
                sanitizedRecord.source_type,
                sanitizedRecord.target_id,
                sanitizedRecord.target_type,
                sanitizedRecord.relationship_code,
                sanitizedRecord.is_former
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Association created', {
                sourceId: sanitizedRecord.source_id,
                sourceType: sanitizedRecord.source_type,
                targetId: sanitizedRecord.target_id,
                targetType: sanitizedRecord.target_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Association creation failed', error);
            throw error;
        }
    }

    /**
     * Insert detailed association information
     * @param {Object} detailRecord - Association detail record
     * @returns {Promise<Object>} Inserted association detail
     */
    async insertDetails(detailRecord) {
        try {
            // Validate detail record
            if (!detailRecord.association_id) {
                throw new Error('Association ID is required for details');
            }

            const query = `
                INSERT INTO association_details 
                (association_id, start_date, end_date, 
                notes, source, confidence_level, verification_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                detailRecord.association_id,
                detailRecord.start_date || null,
                detailRecord.end_date || null,
                detailRecord.notes?.trim() || null,
                detailRecord.source?.trim() || null,
                detailRecord.confidence_level || null,
                detailRecord.verification_status?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Association details inserted', {
                associationId: detailRecord.association_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Association details insertion failed', error);
            throw error;
        }
    }

    /**
     * Find associations by multiple criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Found associations
     */
    async findAssociations(criteria = {}) {
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.source_id) {
            conditions.push(`source_id = $${values.length + 1}`);
            values.push(criteria.source_id);
        }

        if (criteria.source_type) {
            conditions.push(`source_type = $${values.length + 1}`);
            values.push(criteria.source_type.toUpperCase());
        }

        if (criteria.target_id) {
            conditions.push(`target_id = $${values.length + 1}`);
            values.push(criteria.target_id);
        }

        if (criteria.target_type) {
            conditions.push(`target_type = $${values.length + 1}`);
            values.push(criteria.target_type.toUpperCase());
        }

        if (criteria.relationship_code) {
            conditions.push(`relationship_code = $${values.length + 1}`);
            values.push(criteria.relationship_code);
        }

        if (criteria.is_former !== undefined) {
            conditions.push(`is_former = $${values.length + 1}`);
            values.push(criteria.is_former);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT * FROM ${this.tableName}
            ${whereClause}
            ORDER BY id
            LIMIT 100
        `;

        try {
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Association search failed', error);
            throw error;
        }
    }

    /**
     * Get network of associations for an entity
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Network of associations
     */
    async getAssociationNetwork(options = {}) {
        const { 
            entityId, 
            entityType, 
            depth = 2, 
            limit = 1000 
        } = options;

        if (!entityId || !entityType) {
            throw new Error('Entity ID and Type are required');
        }

        try {
            const query = `
                WITH RECURSIVE association_network AS (
                    -- Base case
                    SELECT 
                        source_id,
                        source_type,
                        target_id,
                        target_type,
                        relationship_code,
                        1 as depth
                    FROM associations
                    WHERE (source_id = $1 AND source_type = $2)
                        OR (target_id = $1 AND target_type = $2)
                    
                    UNION
                    
                    -- Recursive case
                    SELECT 
                        a.source_id,
                        a.source_type,
                        a.target_id,
                        a.target_type,
                        a.relationship_code,
                        an.depth + 1
                    FROM associations a
                    INNER JOIN association_network an ON 
                        (a.source_id = an.target_id AND a.source_type = an.target_type)
                        OR (a.target_id = an.source_id AND a.target_type = an.source_type)
                    WHERE an.depth < $3
                )
                SELECT 
                    an.source_id,
                    an.source_type,
                    an.target_id,
                    an.target_type,
                    r.name as relationship_name,
                    an.depth
                FROM association_network an
                LEFT JOIN relationships r ON an.relationship_code = r.code
                LIMIT $4
            `;

            const values = [
                entityId, 
                entityType.toUpperCase(), 
                depth, 
                limit
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Association network retrieved', {
                entityId,
                entityType,
                depth,
                networkSize: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.processingError('Association network retrieval failed', error);
            throw error;
        }
    }

    /**
     * Create public figure or special entity specific association
     * @param {Object} record - Specific association record
     * @param {string} associationType - Type of association (PublicFigure or SpecialEntity)
     * @returns {Promise<Object>} Created specific association
     */
    async createSpecificAssociation(record, associationType) {
        try {
            // Validate record
            if (!record.source_id) {
                throw new Error(`${associationType} ID is required`);
            }

            if (!record.associate_id) {
                throw new Error('Associate ID is required');
            }

            // Determine table name based on association type
            const tableName = associationType === 'PublicFigure' 
                ? 'public_figure_associations' 
                : 'special_entity_associations';

            const sourceColumnName = associationType === 'PublicFigure' 
                ? 'public_figure_id' 
                : 'special_entity_id';

            const query = `
                INSERT INTO ${tableName} 
                (${sourceColumnName}, associate_id, associate_type, 
                relationship_code, is_former, start_date, end_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                record.source_id,
                record.associate_id,
                record.associate_type?.toUpperCase() || 'PERSON',
                record.relationship_code || null,
                !!record.is_former,
                record.start_date || null,
                record.end_date || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo(`${associationType} association created`, {
                sourceId: record.source_id,
                associateId: record.associate_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError(`${associationType} association creation failed`, error);
            throw error;
        }
    }

    /**
     * Batch insert associations
     * @param {Array} associations - Array of association records
     * @returns {Promise<number>} Number of inserted associations
     */
    async batchCreateAssociations(associations) {
        if (!associations || associations.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let insertedCount = 0;
            for (const association of associations) {
                await this.create(association);
                insertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch associations created', {
                totalAssociations: insertedCount
            });

            return insertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch association creation failed', error);
            throw error;
        }
    }
}

module.exports = AssociationModel;