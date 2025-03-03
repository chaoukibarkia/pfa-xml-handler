// src/models/association-model.js
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

        // Validate source_type and target_type
        const validTypes = ['PERSON', 'ENTITY'];
        if (!validTypes.includes(record.source_type.toUpperCase())) {
            throw new Error('Invalid source type. Must be PERSON or ENTITY');
        }

        if (!validTypes.includes(record.target_type.toUpperCase())) {
            throw new Error('Invalid target type. Must be PERSON or ENTITY');
        }
    }

    /**
     * Sanitize association record
     * @param {Object} record - Association record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            source_id: parseInt(record.source_id, 10),
            source_type: record.source_type.toUpperCase(),
            target_id: parseInt(record.target_id, 10),
            target_type: record.target_type.toUpperCase(),
            relationship_code: record.relationship_code ? parseInt(record.relationship_code, 10) : null,
            is_former: !!record.is_former,
            start_date: record.start_date || null,
            end_date: record.end_date || null
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
                relationship_code, is_former, start_date, end_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (source_id, source_type, target_id, target_type, relationship_code) 
                DO UPDATE SET
                    is_former = EXCLUDED.is_former,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date,
                    last_updated = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const values = [
                sanitizedRecord.source_id,
                sanitizedRecord.source_type,
                sanitizedRecord.target_id,
                sanitizedRecord.target_type,
                sanitizedRecord.relationship_code,
                sanitizedRecord.is_former,
                sanitizedRecord.start_date,
                sanitizedRecord.end_date
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
                (association_id, start_date, end_date, start_day, start_month, start_year,
                end_day, end_month, end_year, notes, source, confidence_level, verification_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `;

            // Calculate start and end dates if components are provided
            let startDate = null;
            let endDate = null;

            if (detailRecord.start_year && detailRecord.start_month) {
                try {
                    // Convert month names to numbers if necessary
                    let startMonthNum = detailRecord.start_month;
                    if (isNaN(detailRecord.start_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        startMonthNum = monthMap[detailRecord.start_month.toUpperCase()] || 1;
                    }
                    startDate = new Date(
                        detailRecord.start_year, 
                        startMonthNum - 1, 
                        detailRecord.start_day || 1
                    );
                } catch (e) {
                    logger.processingError('Start date conversion error', e);
                }
            }

            if (detailRecord.end_year && detailRecord.end_month) {
                try {
                    // Convert month names to numbers if necessary
                    let endMonthNum = detailRecord.end_month;
                    if (isNaN(detailRecord.end_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        endMonthNum = monthMap[detailRecord.end_month.toUpperCase()] || 1;
                    }
                    endDate = new Date(
                        detailRecord.end_year, 
                        endMonthNum - 1, 
                        detailRecord.end_day || 1
                    );
                } catch (e) {
                    logger.processingError('End date conversion error', e);
                }
            }

            const values = [
                detailRecord.association_id,
                startDate || detailRecord.start_date,
                endDate || detailRecord.end_date,
                detailRecord.start_day || null,
                detailRecord.start_month?.trim() || null,
                detailRecord.start_year || null,
                detailRecord.end_day || null,
                detailRecord.end_month?.trim() || null,
                detailRecord.end_year || null,
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
     * Create public figure association
     * @param {Object} record - Public figure association record
     * @returns {Promise<Object>} Created public figure association
     */
    async createPublicFigureAssociation(record) {
        try {
            // Validate record
            if (!record.public_figure_id) {
                throw new Error('Public Figure ID is required');
            }

            if (!record.associate_id) {
                throw new Error('Associate ID is required');
            }

            if (!record.associate_type) {
                throw new Error('Associate type is required');
            }

            // Validate associate_type
            const validTypes = ['PERSON', 'ENTITY'];
            if (!validTypes.includes(record.associate_type.toUpperCase())) {
                throw new Error('Invalid associate type. Must be PERSON or ENTITY');
            }

            const query = `
                INSERT INTO public_figure_associations 
                (public_figure_id, associate_id, associate_type, relationship_code, 
                is_former, start_date, end_date, start_day, start_month, start_year,
                end_day, end_month, end_year)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (public_figure_id, associate_id, associate_type, relationship_code) 
                DO UPDATE SET
                    is_former = EXCLUDED.is_former,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date
                RETURNING *
            `;

            // Calculate start and end dates if components are provided
            let startDate = null;
            let endDate = null;

            if (record.start_year && record.start_month) {
                try {
                    // Convert month names to numbers if necessary
                    let startMonthNum = record.start_month;
                    if (isNaN(record.start_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        startMonthNum = monthMap[record.start_month.toUpperCase()] || 1;
                    }
                    startDate = new Date(
                        record.start_year, 
                        startMonthNum - 1, 
                        record.start_day || 1
                    );
                } catch (e) {
                    logger.processingError('Start date conversion error', e);
                }
            }

            if (record.end_year && record.end_month) {
                try {
                    // Convert month names to numbers if necessary
                    let endMonthNum = record.end_month;
                    if (isNaN(record.end_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        endMonthNum = monthMap[record.end_month.toUpperCase()] || 1;
                    }
                    endDate = new Date(
                        record.end_year, 
                        endMonthNum - 1, 
                        record.end_day || 1
                    );
                } catch (e) {
                    logger.processingError('End date conversion error', e);
                }
            }

            const values = [
                record.public_figure_id,
                record.associate_id,
                record.associate_type.toUpperCase(),
                record.relationship_code || null,
                !!record.is_former,
                startDate || record.start_date,
                endDate || record.end_date,
                record.start_day || null,
                record.start_month?.trim() || null,
                record.start_year || null,
                record.end_day || null,
                record.end_month?.trim() || null,
                record.end_year || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Public figure association created', {
                publicFigureId: record.public_figure_id,
                associateId: record.associate_id,
                associateType: record.associate_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Public figure association creation failed', error);
            throw error;
        }
    }

    /**
     * Create special entity association
     * @param {Object} record - Special entity association record
     * @returns {Promise<Object>} Created special entity association
     */
    async createSpecialEntityAssociation(record) {
        try {
            // Validate record
            if (!record.special_entity_id) {
                throw new Error('Special Entity ID is required');
            }

            if (!record.associate_id) {
                throw new Error('Associate ID is required');
            }

            if (!record.associate_type) {
                throw new Error('Associate type is required');
            }

            // Validate associate_type
            const validTypes = ['PERSON', 'ENTITY'];
            if (!validTypes.includes(record.associate_type.toUpperCase())) {
                throw new Error('Invalid associate type. Must be PERSON or ENTITY');
            }

            const query = `
                INSERT INTO special_entity_associations 
                (special_entity_id, associate_id, associate_type, relationship_code, 
                is_former, start_date, end_date, start_day, start_month, start_year,
                end_day, end_month, end_year)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (special_entity_id, associate_id, associate_type, relationship_code) 
                DO UPDATE SET
                    is_former = EXCLUDED.is_former,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date
                RETURNING *
            `;

            // Calculate start and end dates if components are provided
            let startDate = null;
            let endDate = null;

            if (record.start_year && record.start_month) {
                try {
                    // Convert month names to numbers if necessary
                    let startMonthNum = record.start_month;
                    if (isNaN(record.start_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        startMonthNum = monthMap[record.start_month.toUpperCase()] || 1;
                    }
                    startDate = new Date(
                        record.start_year, 
                        startMonthNum - 1, 
                        record.start_day || 1
                    );
                } catch (e) {
                    logger.processingError('Start date conversion error', e);
                }
            }

            if (record.end_year && record.end_month) {
                try {
                    // Convert month names to numbers if necessary
                    let endMonthNum = record.end_month;
                    if (isNaN(record.end_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        endMonthNum = monthMap[record.end_month.toUpperCase()] || 1;
                    }
                    endDate = new Date(
                        record.end_year, 
                        endMonthNum - 1, 
                        record.end_day || 1
                    );
                } catch (e) {
                    logger.processingError('End date conversion error', e);
                }
            }

            const values = [
                record.special_entity_id,
                record.associate_id,
                record.associate_type.toUpperCase(),
                record.relationship_code || null,
                !!record.is_former,
                startDate || record.start_date,
                endDate || record.end_date,
                record.start_day || null,
                record.start_month?.trim() || null,
                record.start_year || null,
                record.end_day || null,
                record.end_month?.trim() || null,
                record.end_year || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Special entity association created', {
                specialEntityId: record.special_entity_id,
                associateId: record.associate_id,
                associateType: record.associate_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Special entity association creation failed', error);
            throw error;
        }
    }

    /**
     * Find associations by multiple criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found associations
     */
    async findAssociations(criteria = {}, options = {}) {
        const { limit = 100, offset = 0 } = options;
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
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        try {
            const result = await this.db.query(query, [...values, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.processingError('Association search failed', error);
            throw error;
        }
    }

    /**
     * Find public figure associations
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found public figure associations
     */
    async findPublicFigureAssociations(criteria = {}, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.public_figure_id) {
            conditions.push(`public_figure_id = $${values.length + 1}`);
            values.push(criteria.public_figure_id);
        }

        if (criteria.associate_id) {
            conditions.push(`associate_id = $${values.length + 1}`);
            values.push(criteria.associate_id);
        }

        if (criteria.associate_type) {
            conditions.push(`associate_type = $${values.length + 1}`);
            values.push(criteria.associate_type.toUpperCase());
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
            SELECT * FROM public_figure_associations
            ${whereClause}
            ORDER BY id
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        try {
            const result = await this.db.query(query, [...values, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.processingError('Public figure association search failed', error);
            throw error;
        }
    }

    /**
     * Find special entity associations
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found special entity associations
     */
    async findSpecialEntityAssociations(criteria = {}, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.special_entity_id) {
            conditions.push(`special_entity_id = $${values.length + 1}`);
            values.push(criteria.special_entity_id);
        }

        if (criteria.associate_id) {
            conditions.push(`associate_id = $${values.length + 1}`);
            values.push(criteria.associate_id);
        }

        if (criteria.associate_type) {
            conditions.push(`associate_type = $${values.length + 1}`);
            values.push(criteria.associate_type.toUpperCase());
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
            SELECT * FROM special_entity_associations
            ${whereClause}
            ORDER BY id
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        try {
            const result = await this.db.query(query, [...values, limit, offset]);
            return result.rows;
        } catch (error) {
            logger.processingError('Special entity association search failed', error);
            throw error;
        }
    }

    /**
     * Get network of associations for an entity or person
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Network of associations
     */
    async getAssociationNetwork(options = {}) {
        const { 
            id, 
            type = 'PERSON',
            depth = 2, 
            limit = 1000,
            includeDetails = false
        } = options;

        if (!id || !type) {
            throw new Error('ID and Type are required');
        }

        try {
            const query = `
                WITH RECURSIVE association_network AS (
                    -- Base case
                    SELECT 
                        id,
                        source_id,
                        source_type,
                        target_id,
                        target_type,
                        relationship_code,
                        is_former,
                        1 as depth
                    FROM ${this.tableName}
                    WHERE (source_id = $1 AND source_type = $2)
                        OR (target_id = $1 AND target_type = $2)
                    
                    UNION
                    
                    -- Recursive case
                    SELECT 
                        a.id,
                        a.source_id,
                        a.source_type,
                        a.target_id,
                        a.target_type,
                        a.relationship_code,
                        a.is_former,
                        an.depth + 1
                    FROM ${this.tableName} a
                    INNER JOIN association_network an ON 
                        (a.source_id = an.target_id AND a.source_type = an.target_type)
                        OR (a.target_id = an.source_id AND a.target_type = an.source_type)
                    WHERE an.depth < $3
                )
                SELECT 
                    an.id,
                    an.source_id,
                    an.source_type,
                    an.target_id,
                    an.target_type,
                    r.name as relationship_name,
                    an.relationship_code,
                    an.is_former,
                    an.depth
                FROM association_network an
                LEFT JOIN relationships r ON an.relationship_code = r.code
                ORDER BY an.depth, r.name
                LIMIT $4
            `;

            const values = [
                id, 
                type.toUpperCase(), 
                depth, 
                limit
            ];

            const result = await this.db.query(query, values);
            
            // If requested, include association details
            if (includeDetails && result.rows.length > 0) {
                const associationIds = result.rows.map(row => row.id);
                
                const detailsQuery = `
                    SELECT * FROM association_details
                    WHERE association_id = ANY($1)
                `;
                
                const detailsResult = await this.db.query(detailsQuery, [associationIds]);
                
                // Add details to each association
                const detailsMap = {};
                for (const detail of detailsResult.rows) {
                    detailsMap[detail.association_id] = detail;
                }
                
                for (const association of result.rows) {
                    association.details = detailsMap[association.id] || null;
                }
            }

            logger.processInfo('Association network retrieved', {
                id,
                type,
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
     * Batch insert associations
     * @param {Array} associations - Array of association records
     * @returns {Promise<number>} Number of inserted associations
     */
    async batchInsert(associations) {
        if (!associations || associations.length === 0) return 0;

        try {
            await this.db.query('BEGIN');

            let insertedCount = 0;
            for (const association of associations) {
                await this.create(association);
                insertedCount++;
            }

            await this.db.query('COMMIT');

            logger.processInfo('Batch associations inserted', {
                totalAssociations: insertedCount
            });

            return insertedCount;
        } catch (error) {
            await this.db.query('ROLLBACK');
            logger.processingError('Batch association insertion failed', error);
            throw error;
        }
    }

    /**
     * Helper method to create an appropriate specific association
     * @param {Object} record - Association record
     * @param {string} type - Either 'PublicFigure' or 'SpecialEntity'
     * @returns {Promise<Object>} Created association
     */
    async createSpecificAssociation(record, type) {
        if (type === 'PublicFigure') {
            return this.createPublicFigureAssociation({
                public_figure_id: record.source_id,
                associate_id: record.associate_id,
                associate_type: record.associate_type,
                relationship_code: record.relationship_code,
                is_former: record.is_former,
                start_date: record.start_date,
                end_date: record.end_date,
                start_day: record.start_day,
                start_month: record.start_month,
                start_year: record.start_year,
                end_day: record.end_day,
                end_month: record.end_month,
                end_year: record.end_year
            });
        } else if (type === 'SpecialEntity') {
            return this.createSpecialEntityAssociation({
                special_entity_id: record.source_id,
                associate_id: record.associate_id,
                associate_type: record.associate_type,
                relationship_code: record.relationship_code,
                is_former: record.is_former,
                start_date: record.start_date,
                end_date: record.end_date,
                start_day: record.start_day,
                start_month: record.start_month,
                start_year: record.start_year,
                end_day: record.end_day,
                end_month: record.end_month,
                end_year: record.end_year
            });
        } else {
            throw new Error('Invalid association type. Must be either PublicFigure or SpecialEntity');
        }
    }
}

module.exports = AssociationModel;