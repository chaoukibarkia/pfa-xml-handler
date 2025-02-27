const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class EntityModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'entities';
        this.primaryKey = 'id';
    }

    /**
     * Validate entity record
     * @param {Object} record - Entity record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific entity validation
        if (!record.id) {
            throw new Error('Entity ID is required');
        }
    }

    /**
     * Sanitize entity record
     * @param {Object} record - Entity record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            id: record.id,
            action: record.action?.trim() || null,
            date: record.date ? new Date(record.date) : null,
            active_status: record.active_status?.trim() || 'ACTIVE',
            entity_type: record.entity_type?.trim() || 'ORGANIZATION',
            profile_notes: record.profile_notes?.trim() || null
        };
    }

    /**
     * Insert or update entity
     * @param {Object} record - Entity record
     * @returns {Promise<Object>} Inserted or updated entity
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (id, action, date, active_status, entity_type, profile_notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE
                SET 
                    action = EXCLUDED.action,
                    date = EXCLUDED.date,
                    active_status = EXCLUDED.active_status,
                    entity_type = EXCLUDED.entity_type,
                    profile_notes = EXCLUDED.profile_notes,
                    last_updated = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const values = [
                sanitizedRecord.id,
                sanitizedRecord.action,
                sanitizedRecord.date,
                sanitizedRecord.active_status,
                sanitizedRecord.entity_type,
                sanitizedRecord.profile_notes
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity upserted', {
                id: sanitizedRecord.id,
                action: sanitizedRecord.action
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity upsert failed', error);
            throw error;
        }
    }

    /**
     * Insert entity name
     * @param {Object} nameRecord - Entity name record
     * @returns {Promise<Object>} Inserted name record
     */
    async insertName(nameRecord) {
        try {
            // Validate name record
            if (!nameRecord.entity_id) {
                throw new Error('Entity ID is required for name');
            }

            const query = `
                INSERT INTO entity_names 
                (entity_id, name_type, entity_name, suffix, 
                original_script_name, is_primary)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const values = [
                nameRecord.entity_id,
                nameRecord.name_type?.trim() || null,
                nameRecord.entity_name?.trim() || null,
                nameRecord.suffix?.trim() || null,
                nameRecord.original_script_name?.trim() || null,
                nameRecord.is_primary === undefined ? true : !!nameRecord.is_primary
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity name inserted', {
                entityId: nameRecord.entity_id,
                nameType: nameRecord.name_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity name insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert entity description
     * @param {Object} descriptionRecord - Entity description record
     * @returns {Promise<Object>} Inserted description record
     */
    async insertDescription(descriptionRecord) {
        try {
            // Validate description record
            if (!descriptionRecord.entity_id) {
                throw new Error('Entity ID is required for description');
            }

            const query = `
                INSERT INTO entity_descriptions 
                (entity_id, description1_id, description2_id, description3_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

            const values = [
                descriptionRecord.entity_id,
                descriptionRecord.description1_id || null,
                descriptionRecord.description2_id || null,
                descriptionRecord.description3_id || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity description inserted', {
                entityId: descriptionRecord.entity_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity description insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert vessel details
     * @param {Object} vesselRecord - Vessel details record
     * @returns {Promise<Object>} Inserted vessel record
     */
    async insertVesselDetails(vesselRecord) {
        try {
            // Validate vessel record
            if (!vesselRecord.entity_id) {
                throw new Error('Entity ID is required for vessel details');
            }

            const query = `
                INSERT INTO entity_vessels 
                (entity_id, call_sign, vessel_type, tonnage, grt, owner, flag)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                vesselRecord.entity_id,
                vesselRecord.call_sign?.trim() || null,
                vesselRecord.vessel_type?.trim() || null,
                vesselRecord.tonnage?.trim() || null,
                vesselRecord.grt?.trim() || null,
                vesselRecord.owner?.trim() || null,
                vesselRecord.flag?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Entity vessel details inserted', {
                entityId: vesselRecord.entity_id,
                vesselType: vesselRecord.vessel_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Entity vessel details insertion failed', error);
            throw error;
        }
    }

    /**
     * Find entities by multiple criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Found entities
     */
    async findEntities(criteria = {}) {
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.active_status) {
            conditions.push(`active_status = $${values.length + 1}`);
            values.push(criteria.active_status);
        }

        if (criteria.entity_type) {
            conditions.push(`entity_type = $${values.length + 1}`);
            values.push(criteria.entity_type);
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
            logger.processingError('Entity search failed', error);
            throw error;
        }
    }
}

module.exports = EntityModel;
