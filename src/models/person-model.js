// src/models/person-model.js
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
                (person_id, name_type, name_type_id, title_honorific, maiden_name, 
                first_name, middle_name, surname, suffix, 
                single_string_name, original_script_name, is_primary)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `;

            const values = [
                nameRecord.person_id,
                nameRecord.name_type?.trim() || null,
                nameRecord.name_type_id || null,
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
                (person_id, description1_level, description1_id, 
                description2_level, description2_id, 
                description3_level, description3_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                descriptionRecord.person_id,
                descriptionRecord.description1_level || 1,
                descriptionRecord.description1_id || null,
                descriptionRecord.description2_level || 2,
                descriptionRecord.description2_id || null,
                descriptionRecord.description3_level || 3,
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
     * Insert person role
     * @param {Object} roleRecord - Person role record
     * @returns {Promise<Object>} Inserted role record
     */
    async insertRole(roleRecord) {
        try {
            // Validate role record
            if (!roleRecord.person_id) {
                throw new Error('Person ID is required for role');
            }

            const query = `
                INSERT INTO person_roles 
                (person_id, role_type, role_type_id, occupation_code, title, 
                start_date, end_date, start_day, start_month, start_year, 
                end_day, end_month, end_year)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `;

            const values = [
                roleRecord.person_id,
                roleRecord.role_type?.trim() || null,
                roleRecord.role_type_id || null,
                roleRecord.occupation_code || null,
                roleRecord.title?.trim() || null,
                roleRecord.start_date || null,
                roleRecord.end_date || null,
                roleRecord.start_day || null,
                roleRecord.start_month?.trim() || null,
                roleRecord.start_year || null,
                roleRecord.end_day || null,
                roleRecord.end_month?.trim() || null,
                roleRecord.end_year || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person role inserted', {
                personId: roleRecord.person_id,
                roleType: roleRecord.role_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person role insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person date
     * @param {Object} dateRecord - Person date record
     * @returns {Promise<Object>} Inserted date record
     */
    async insertDate(dateRecord) {
        try {
            // Validate date record
            if (!dateRecord.person_id) {
                throw new Error('Person ID is required for date');
            }

            const query = `
                INSERT INTO person_dates 
                (person_id, date_type, date_type_id, date, day, month, year, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `;

            // Calculate full date if day, month, and year are provided
            let fullDate = null;
            if (dateRecord.year && dateRecord.month && dateRecord.day) {
                try {
                    // Convert month names to numbers if necessary
                    let monthNum = dateRecord.month;
                    if (isNaN(dateRecord.month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        monthNum = monthMap[dateRecord.month.toUpperCase()] || 1;
                    }
                    fullDate = new Date(dateRecord.year, monthNum - 1, dateRecord.day);
                } catch (e) {
                    logger.processingError('Date conversion error', e);
                }
            }

            const values = [
                dateRecord.person_id,
                dateRecord.date_type?.trim() || null,
                dateRecord.date_type_id || null,
                fullDate,
                dateRecord.day || null,
                dateRecord.month?.trim() || null,
                dateRecord.year || null,
                dateRecord.notes?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person date inserted', {
                personId: dateRecord.person_id,
                dateType: dateRecord.date_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person date insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person address
     * @param {Object} addressRecord - Person address record
     * @returns {Promise<Object>} Inserted address record
     */
    async insertAddress(addressRecord) {
        try {
            // Validate address record
            if (!addressRecord.person_id) {
                throw new Error('Person ID is required for address');
            }

            const query = `
                INSERT INTO person_addresses 
                (person_id, address_line, city, country_code, url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;

            const values = [
                addressRecord.person_id,
                addressRecord.address_line?.trim() || null,
                addressRecord.city?.trim() || null,
                addressRecord.country_code?.trim() || null,
                addressRecord.url?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person address inserted', {
                personId: addressRecord.person_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person address insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person document (ID)
     * @param {Object} documentRecord - Person document record
     * @returns {Promise<Object>} Inserted document record
     */
    async insertDocument(documentRecord) {
        try {
            // Validate document record
            if (!documentRecord.person_id) {
                throw new Error('Person ID is required for document');
            }

            const query = `
                INSERT INTO person_documents 
                (person_id, document_type, document_number, notes)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

            const values = [
                documentRecord.person_id,
                documentRecord.document_type?.trim() || null,
                documentRecord.document_number?.trim() || null,
                documentRecord.notes?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person document inserted', {
                personId: documentRecord.person_id,
                documentType: documentRecord.document_type
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person document insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person image
     * @param {Object} imageRecord - Person image record
     * @returns {Promise<Object>} Inserted image record
     */
    async insertImage(imageRecord) {
        try {
            // Validate image record
            if (!imageRecord.person_id) {
                throw new Error('Person ID is required for image');
            }

            if (!imageRecord.url) {
                throw new Error('Image URL is required');
            }

            const query = `
                INSERT INTO person_images 
                (person_id, url, is_primary)
                VALUES ($1, $2, $3)
                RETURNING *
            `;

            const values = [
                imageRecord.person_id,
                imageRecord.url.trim(),
                imageRecord.is_primary === undefined ? false : !!imageRecord.is_primary
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person image inserted', {
                personId: imageRecord.person_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person image insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person birth place
     * @param {Object} birthPlaceRecord - Person birth place record
     * @returns {Promise<Object>} Inserted birth place record
     */
    async insertBirthPlace(birthPlaceRecord) {
        try {
            // Validate birth place record
            if (!birthPlaceRecord.person_id) {
                throw new Error('Person ID is required for birth place');
            }

            const query = `
                INSERT INTO person_birth_places 
                (person_id, place_name, country_code)
                VALUES ($1, $2, $3)
                RETURNING *
            `;

            const values = [
                birthPlaceRecord.person_id,
                birthPlaceRecord.place_name?.trim() || null,
                birthPlaceRecord.country_code?.trim() || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person birth place inserted', {
                personId: birthPlaceRecord.person_id
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person birth place insertion failed', error);
            throw error;
        }
    }

    /**
     * Insert person sanction reference
     * @param {Object} sanctionRecord - Person sanction record
     * @returns {Promise<Object>} Inserted sanction record
     */
    async insertSanction(sanctionRecord) {
        try {
            // Validate sanction record
            if (!sanctionRecord.person_id) {
                throw new Error('Person ID is required for sanction');
            }

            if (!sanctionRecord.reference_code) {
                throw new Error('Reference code is required for sanction');
            }

            const query = `
                INSERT INTO person_sanctions 
                (person_id, reference_code, start_date, end_date, 
                start_day, start_month, start_year, 
                end_day, end_month, end_year)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            // Calculate start and end dates if components are provided
            let startDate = null;
            let endDate = null;

            if (sanctionRecord.start_year && sanctionRecord.start_month) {
                try {
                    // Convert month names to numbers if necessary
                    let startMonthNum = sanctionRecord.start_month;
                    if (isNaN(sanctionRecord.start_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        startMonthNum = monthMap[sanctionRecord.start_month.toUpperCase()] || 1;
                    }
                    startDate = new Date(
                        sanctionRecord.start_year, 
                        startMonthNum - 1, 
                        sanctionRecord.start_day || 1
                    );
                } catch (e) {
                    logger.processingError('Start date conversion error', e);
                }
            }

            if (sanctionRecord.end_year && sanctionRecord.end_month) {
                try {
                    // Convert month names to numbers if necessary
                    let endMonthNum = sanctionRecord.end_month;
                    if (isNaN(sanctionRecord.end_month)) {
                        const monthMap = {
                            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
                            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
                        };
                        endMonthNum = monthMap[sanctionRecord.end_month.toUpperCase()] || 1;
                    }
                    endDate = new Date(
                        sanctionRecord.end_year, 
                        endMonthNum - 1, 
                        sanctionRecord.end_day || 1
                    );
                } catch (e) {
                    logger.processingError('End date conversion error', e);
                }
            }

            const values = [
                sanctionRecord.person_id,
                sanctionRecord.reference_code,
                startDate || sanctionRecord.start_date,
                endDate || sanctionRecord.end_date,
                sanctionRecord.start_day || null,
                sanctionRecord.start_month?.trim() || null,
                sanctionRecord.start_year || null,
                sanctionRecord.end_day || null,
                sanctionRecord.end_month?.trim() || null,
                sanctionRecord.end_year || null
            ];

            const result = await this.db.query(query, values);

            logger.processInfo('Person sanction inserted', {
                personId: sanctionRecord.person_id,
                referenceCode: sanctionRecord.reference_code
            });

            return result.rows[0];
        } catch (error) {
            logger.processingError('Person sanction insertion failed', error);
            throw error;
        }
    }

    /**
     * Find persons by multiple criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Found persons
     */
    async findPersons(criteria = {}, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const conditions = [];
        const values = [];

        // Build dynamic where clause
        if (criteria.id) {
            conditions.push(`id = $${values.length + 1}`);
            values.push(criteria.id);
        }

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

        if (criteria.action) {
            conditions.push(`action = $${values.length + 1}`);
            values.push(criteria.action);
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
            logger.processingError('Person search failed', error);
            throw error;
        }
    }

    /**
     * Get complete person profile with related data
     * @param {number} personId - Person ID
     * @returns {Promise<Object>} Person profile
     */
    async getFullProfile(personId) {
        try {
            // Get basic person data
            const personQuery = `
                SELECT * FROM ${this.tableName}
                WHERE id = $1
            `;
            
            const personResult = await this.db.query(personQuery, [personId]);
            
            if (personResult.rows.length === 0) {
                return null;
            }
            
            const person = personResult.rows[0];
            
            // Get names
            const namesQuery = `
                SELECT * FROM person_names
                WHERE person_id = $1
                ORDER BY is_primary DESC
            `;
            
            const namesResult = await this.db.query(namesQuery, [personId]);
            person.names = namesResult.rows;
            
            // Get descriptions
            const descriptionsQuery = `
                SELECT 
                    pd.*,
                    d1.description as description1_text,
                    d2.description as description2_text,
                    d3.description as description3_text
                FROM person_descriptions pd
                LEFT JOIN description_types d1 ON pd.description1_level = d1.level AND pd.description1_id = d1.id
                LEFT JOIN description_types d2 ON pd.description2_level = d2.level AND pd.description2_id = d2.id
                LEFT JOIN description_types d3 ON pd.description3_level = d3.level AND pd.description3_id = d3.id
                WHERE pd.person_id = $1
            `;
            
            const descriptionsResult = await this.db.query(descriptionsQuery, [personId]);
            person.descriptions = descriptionsResult.rows;
            
            // Get roles
            const rolesQuery = `
                SELECT pr.*, o.name as occupation_name
                FROM person_roles pr
                LEFT JOIN occupations o ON pr.occupation_code = o.code
                WHERE pr.person_id = $1
            `;
            
            const rolesResult = await this.db.query(rolesQuery, [personId]);
            person.roles = rolesResult.rows;
            
            // Get dates
            const datesQuery = `
                SELECT * FROM person_dates
                WHERE person_id = $1
            `;
            
            const datesResult = await this.db.query(datesQuery, [personId]);
            person.dates = datesResult.rows;
            
            // Get birth places
            const birthPlacesQuery = `
                SELECT pb.*, c.name as country_name
                FROM person_birth_places pb
                LEFT JOIN countries c ON pb.country_code = c.code
                WHERE pb.person_id = $1
            `;
            
            const birthPlacesResult = await this.db.query(birthPlacesQuery, [personId]);
            person.birthPlaces = birthPlacesResult.rows;
            
            // Get sanctions
            const sanctionsQuery = `
                SELECT ps.*, sr.name as sanction_name
                FROM person_sanctions ps
                LEFT JOIN sanctions_references sr ON ps.reference_code = sr.code
                WHERE ps.person_id = $1
            `;
            
            const sanctionsResult = await this.db.query(sanctionsQuery, [personId]);
            person.sanctions = sanctionsResult.rows;
            
            // Get addresses
            const addressesQuery = `
                SELECT pa.*, c.name as country_name
                FROM person_addresses pa
                LEFT JOIN countries c ON pa.country_code = c.code
                WHERE pa.person_id = $1
            `;
            
            const addressesResult = await this.db.query(addressesQuery, [personId]);
            person.addresses = addressesResult.rows;
            
            // Get documents
            const documentsQuery = `
                SELECT * FROM person_documents
                WHERE person_id = $1
            `;
            
            const documentsResult = await this.db.query(documentsQuery, [personId]);
            person.documents = documentsResult.rows;
            
            // Get images
            const imagesQuery = `
                SELECT * FROM person_images
                WHERE person_id = $1
                ORDER BY is_primary DESC
            `;
            
            const imagesResult = await this.db.query(imagesQuery, [personId]);
            person.images = imagesResult.rows;
            
            // Get sources
            const sourcesQuery = `
                SELECT ps.*, is.name as source_name
                FROM person_sources ps
                JOIN information_sources is ON ps.source_id = is.id
                WHERE ps.person_id = $1
            `;
            
            const sourcesResult = await this.db.query(sourcesQuery, [personId]);
            person.sources = sourcesResult.rows;
            
            return person;
        } catch (error) {
            logger.processingError(`Person profile retrieval failed for ID ${personId}`, error);
            throw error;
        }
    }

    /**
     * Search persons by name
     * @param {string} nameQuery - Name to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching persons
     */
    async searchByName(nameQuery, options = {}) {
        const { limit = 100, offset = 0 } = options;
        
        try {
            const query = `
                SELECT p.*, pn.first_name, pn.middle_name, pn.surname, pn.single_string_name
                FROM ${this.tableName} p
                JOIN person_names pn ON p.id = pn.person_id
                WHERE 
                    pn.first_name ILIKE $1 OR
                    pn.surname ILIKE $1 OR
                    pn.single_string_name ILIKE $1 OR
                    CONCAT(pn.first_name, ' ', pn.surname) ILIKE $1
                ORDER BY p.id
                LIMIT $2
                OFFSET $3
            `;
            
            const values = [`%${nameQuery}%`, limit, offset];
            
            const result = await this.db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.processingError('Person name search failed', error);
            throw error;
        }
    }
}

module.exports = PersonModel;