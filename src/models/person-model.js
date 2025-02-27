const BaseModel = require('./base-model');
const logger = require('../utils/logging');

class PersonModel extends BaseModel {
    constructor(dbClient) {
        super(dbClient);
        this.tableName = 'persons';
        this.primaryKey = 'id';
    }

    /**
     * Validate person record
     * @param {Object} record - Person record to validate
     */
    validate(record) {
        super.validate(record);

        // Specific person validation
        if (!record.id) {
            throw new Error('Person ID is required');
        }
    }

    /**
     * Sanitize person record
     * @param {Object} record - Person record to sanitize
     * @returns {Object} Sanitized record
     */
    sanitize(record) {
        return {
            id: record.id,
            action: record.action?.trim() || null,
            date: record.date ? new Date(record.date) : null,
            gender: record.gender?.trim() || 'U',
            active_status: record.active_status?.trim() || 'ACTIVE',
            deceased: !!record.deceased,
            profile_notes: record.profile_notes?.trim() || null
        };
    }

    /**
     * Insert or update person
     * @param {Object} record - Person record
     * @returns {Promise<Object>} Inserted or updated person
     */
    async upsert(record) {
        try {
            // Validate and sanitize
            this.validate(record);
            const sanitizedRecord = this.sanitize(record);

            const query = `
                INSERT INTO ${this.tableName} 
                (id, action, date, gender, active_status, deceased, profile_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE
                SET 
                    action = EXCLUDED.action,
                    date = EXCLUDED.date,
                    gender = EXCLUDED.gender,
                    active_status = EXCLUDED.active_status,
                    deceased = EXCLUDED.deceased,
                    profile_notes = EXCLUDED.profile_notes,
                    last_updated = CURRENT_TIMESTAMP
                RETURNING *
            `;

            const values = [
                sanitizedRecord.id,
                sanitizedRecord.action,
                sanitizedRecord.date,
                sanitizedRecord.gender,
                sanitizedRecord.active_status,
                sanitizedRecord.deceased,
                sanitizedRecord.profile_notes
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person upserted', {
                id: sanitizedRecord.id,
                action: sanitizedRecord.action
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person upsert failed', error);
            throw error;
        }
    }

    /**
     * Insert person name
     * @param {Object} nameRecord - Person name record
     * @returns {Promise<Object>} Inserted name record
     */
    async insertName(nameRecord) {
        try {
            // Validate name record
            if (!nameRecord.person_id) {
                throw new Error('Person ID is required for name');
            }

            const query = `
                INSERT INTO person_names 
                (person_id, name_type, title_honorific, maiden_name, 
                first_name, middle_name, surname, suffix, 
                single_string_name, original_script_name, is_primary)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                nameRecord.person_id,
                nameRecord.name_type?.trim() || null,
                nameRecord.title_honorific?.trim() || null,
                nameRecord.maiden_name?.trim() || null,
                nameRecord.first_name?.trim() || null,
                nameRecord.middle_name?.trim() || null,
                nameRecord.surname?.trim() || null,
                nameRecord.suffix?.trim() || null,
                nameRecord.single_string_name?.trim() || null,
                nameRecord.original_script_name?.trim() || null,
                nameRecord.is_primary === undefined ? true : !!nameRecord.is_primary
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person name inserted', {
                personId: nameRecord.person_id,
                nameType: nameRecord.name_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person name insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person description
     * @param {Object} descriptionRecord - Person description record
     * @returns {Promise<Object>} Inserted description record
     */
    async insertDescription(descriptionRecord) {
        try {
            // Validate description record
            if (!descriptionRecord.person_id) {
                throw new Error('Person ID is required for description');
            }

            const query = `
                INSERT INTO person_descriptions 
                (person_id, description1_id, description2_id, description3_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

            const values = [
                descriptionRecord.person_id,
                descriptionRecord.description1_id || null,
                descriptionRecord.description2_id || null,
                descriptionRecord.description3_id || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person description inserted', {
                personId: descriptionRecord.person_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person description insertion failed', error);
            throw error;
        }
    }

    /**
     * Find persons by multiple criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Found persons
     */
    async findPersons(criteria = {}) {
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.gender) {
            conditions.push(`gender = $${values.length + 1}`);
            values.push(criteria.gender);
        }

        if (criteria.active_status) {
            conditions.push(`active_status = $${values.length + 1}`);
            values.push(criteria.active_status);
        }

        if (criteria.deceased !== undefined) {
            conditions.push(`deceased = $${values.length + 1}`);
            values.push(criteria.deceased);
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
            logger.processingError('Person search failed', error);
            throw error;
        }
    }
}

module.exports = PersonModel;