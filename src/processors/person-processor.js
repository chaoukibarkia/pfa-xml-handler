// src/processors/person-processor.js
const BaseProcessor = require('./base-processor');
const logger = require('../utils/logging');

/**
 * Processor for Person XML elements
 */
class PersonProcessor extends BaseProcessor {
    constructor(dbClient, models, options = {}) {
        super(dbClient, models, options);
        
        // Additional person-specific stats
        this.stats.counts = {
            persons: 0,
            names: 0,
            descriptions: 0,
            roles: 0,
            dates: 0,
            addresses: 0,
            documents: 0,
            images: 0,
            birthPlaces: 0,
            sanctions: 0,
            sources: 0
        };
    }
    
    /**
     * Setup XML handlers for person processing
     * @param {Object} xml - XML stream
     */
    setupHandlers(xml) {
        // Main person element handler
        xml.on('endElement: Person', async (person) => {
            try {
                await this.processRecord(person);
                this.updateStats(true);
            } catch (error) {
                logger.processingError(`Person processing error for ID: ${this.getAttribute(person.$, 'id')}`, error);
                this.updateStats(false);
            }
        });
        
        // Return the processor for chaining
        return this;
    }
    
    /**
     * Process a person record
     * @param {Object} person - Person XML element
     */
    async processRecord(person) {
        const personId = this.safeParseInt(this.getAttribute(person.$, 'id'));
        
        // Begin transaction for person processing
        await this.db.query('BEGIN');
        
        try {
            // Upsert person record
            const personRecord = await this.models.person.upsert({
                id: personId,
                action: this.getAttribute(person.$, 'action'),
                date: this.getAttribute(person.$, 'date'),
                gender: person.Gender?.[0] || 'U',
                active_status: person.ActiveStatus?.[0] || 'ACTIVE',
                deceased: person.Deceased?.[0] === 'true',
                profile_notes: person.ProfileNotes?.[0] || null
            });
            
            this.stats.counts.persons++;
            
            // Process names
            await this.processNames(personId, person);
            
            // Process descriptions
            await this.processDescriptions(personId, person);
            
            // Process roles
            await this.processRoles(personId, person);
            
            // Process dates
            await this.processDates(personId, person);
            
            // Process birth places
            await this.processBirthPlaces(personId, person);
            
            // Process sanctions
            await this.processSanctions(personId, person);
            
            // Process addresses
            await this.processAddresses(personId, person);
            
            // Process documents
            await this.processDocuments(personId, person);
            
            // Process images
            await this.processImages(personId, person);
            
            // Process sources
            await this.processSources(personId, person);
            
            // Commit transaction
            await this.db.query('COMMIT');
            
            return personRecord;
        } catch (error) {
            // Rollback transaction on error
            await this.db.query('ROLLBACK');
            throw error;
        }
    }
    
    /**
     * Process person names
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processNames(personId, person) {
        if (!person.NameDetails?.[0]?.Name) return;
        
        for (const name of person.NameDetails[0].Name) {
            const nameType = this.getAttribute(name.$, 'NameType');
            
            if (name.NameValue && name.NameValue.length > 0) {
                for (const nameValue of name.NameValue) {
                    await this.models.person.insertName({
                        person_id: personId,
                        name_type: nameType,
                        name_type_id: this.safeParseInt(this.getAttribute(name.$, 'NameTypeID')),
                        title_honorific: nameValue.TitleHonorific?.[0] || null,
                        maiden_name: nameValue.MaidenName?.[0] || null,
                        first_name: nameValue.FirstName?.[0] || null,
                        middle_name: nameValue.MiddleName?.[0] || null,
                        surname: nameValue.Surname?.[0] || null,
                        suffix: nameValue.Suffix?.[0] || null,
                        single_string_name: nameValue.SingleStringName?.[0] || null,
                        original_script_name: nameValue.OriginalScriptName?.[0] || null,
                        is_primary: nameType === 'Primary'
                    });
                    
                    this.stats.counts.names++;
                }
            }
        }
    }
    
    /**
     * Process person descriptions
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processDescriptions(personId, person) {
        if (!person.Descriptions?.[0]?.Description) return;
        
        for (const description of person.Descriptions[0].Description) {
            await this.models.person.insertDescription({
                person_id: personId,
                description1_level: 1,
                description1_id: this.safeParseInt(this.getAttribute(description.$, 'Description1')),
                description2_level: 2,
                description2_id: this.safeParseInt(this.getAttribute(description.$, 'Description2')),
                description3_level: 3,
                description3_id: this.safeParseInt(this.getAttribute(description.$, 'Description3'))
            });
            
            this.stats.counts.descriptions++;
        }
    }
    
    /**
     * Process person roles
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processRoles(personId, person) {
        if (!person.RoleDetail?.[0]?.Roles) return;
        
        for (const role of person.RoleDetail[0].Roles) {
            const roleType = this.getAttribute(role.$, 'RoleType');
            
            if (role.OccTitle && role.OccTitle.length > 0) {
                for (const occTitle of role.OccTitle) {
                    await this.models.person.insertRole({
                        person_id: personId,
                        role_type: roleType,
                        role_type_id: this.safeParseInt(this.getAttribute(role.$, 'RoleTypeID')),
                        occupation_code: this.safeParseInt(this.getAttribute(occTitle.$, 'OccCat')),
                        title: occTitle._ || null,
                        start_day: this.safeParseInt(this.getAttribute(occTitle.$, 'SinceDay')),
                        start_month: this.getAttribute(occTitle.$, 'SinceMonth'),
                        start_year: this.safeParseInt(this.getAttribute(occTitle.$, 'SinceYear')),
                        end_day: this.safeParseInt(this.getAttribute(occTitle.$, 'ToDay')),
                        end_month: this.getAttribute(occTitle.$, 'ToMonth'),
                        end_year: this.safeParseInt(this.getAttribute(occTitle.$, 'ToYear'))
                    });
                    
                    this.stats.counts.roles++;
                }
            }
        }
    }
    
    /**
     * Process person dates
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processDates(personId, person) {
        if (!person.DateDetails?.[0]?.Date) return;
        
        for (const date of person.DateDetails[0].Date) {
            const dateType = this.getAttribute(date.$, 'DateType');
            
            if (date.DateValue && date.DateValue.length > 0) {
                for (const dateValue of date.DateValue) {
                    await this.models.person.insertDate({
                        person_id: personId,
                        date_type: dateType,
                        date_type_id: this.safeParseInt(this.getAttribute(date.$, 'DateTypeID')),
                        day: this.safeParseInt(this.getAttribute(dateValue.$, 'Day')),
                        month: this.getAttribute(dateValue.$, 'Month'),
                        year: this.safeParseInt(this.getAttribute(dateValue.$, 'Year')),
                        notes: this.getAttribute(dateValue.$, 'Dnotes')
                    });
                    
                    this.stats.counts.dates++;
                }
            }
        }
    }
    
    /**
     * Process person birth places
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processBirthPlaces(personId, person) {
        if (!person.BirthPlace?.[0]?.Place) return;
        
        for (const place of person.BirthPlace[0].Place) {
            await this.models.person.insertBirthPlace({
                person_id: personId,
                place_name: this.getAttribute(place.$, 'name'),
                country_code: this.getAttribute(place.$, 'country')
            });
            
            this.stats.counts.birthPlaces++;
        }
    }
    
    /**
     * Process person sanctions
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processSanctions(personId, person) {
        if (!person.SanctionsReferences?.[0]?.Reference) return;
        
        for (const reference of person.SanctionsReferences[0].Reference) {
            await this.models.person.insertSanction({
                person_id: personId,
                reference_code: this.safeParseInt(reference._),
                start_day: this.safeParseInt(this.getAttribute(reference.$, 'SinceDay')),
                start_month: this.getAttribute(reference.$, 'SinceMonth'),
                start_year: this.safeParseInt(this.getAttribute(reference.$, 'SinceYear')),
                end_day: this.safeParseInt(this.getAttribute(reference.$, 'ToDay')),
                end_month: this.getAttribute(reference.$, 'ToMonth'),
                end_year: this.safeParseInt(this.getAttribute(reference.$, 'ToYear'))
            });
            
            this.stats.counts.sanctions++;
        }
    }
    
    /**
     * Process person addresses
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processAddresses(personId, person) {
        if (!person.Address) return;
        
        for (const address of person.Address) {
            await this.models.person.insertAddress({
                person_id: personId,
                address_line: address.AddressLine?.[0] || null,
                city: address.AddressCity?.[0] || null,
                country_code: address.AddressCountry?.[0] || null,
                url: address.URL?.[0] || null
            });
            
            this.stats.counts.addresses++;
        }
    }
    
    /**
     * Process person documents
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processDocuments(personId, person) {
        if (!person.IDNumberTypes?.[0]?.ID) return;
        
        for (const id of person.IDNumberTypes[0].ID) {
            const idType = this.getAttribute(id.$, 'IDType');
            
            if (id.IDValue && id.IDValue.length > 0) {
                for (const idValue of id.IDValue) {
                    await this.models.person.insertDocument({
                        person_id: personId,
                        document_type: idType,
                        document_number: idValue._ || null,
                        notes: this.getAttribute(idValue.$, 'IDnotes')
                    });
                    
                    this.stats.counts.documents++;
                }
            }
        }
    }
    
    /**
     * Process person images
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processImages(personId, person) {
        if (!person.Images?.[0]?.Image) return;
        
        for (const image of person.Images[0].Image) {
            await this.models.person.insertImage({
                person_id: personId,
                url: this.getAttribute(image.$, 'URL'),
                is_primary: this.getAttribute(image.$, 'IsPrimary') === 'true'
            });
            
            this.stats.counts.images++;
        }
    }
    
    /**
     * Process person sources
     * @param {number} personId - Person ID
     * @param {Object} person - Person XML element
     */
    async processSources(personId, person) {
        if (!person.SourceDescription?.[0]?.Source) return;
        
        for (const source of person.SourceDescription[0].Source) {
            const sourceName = this.getAttribute(source.$, 'name');
            
            // First, ensure the source exists
            const sourceRecord = await this.models.informationSource.upsert({
                name: sourceName,
                description: this.getAttribute(source.$, 'description'),
                url: this.getAttribute(source.$, 'url')
            });
            
            // Then link it to the person
            await this.models.informationSource.addPersonSource(personId, sourceRecord.id);
            this.stats.counts.sources++;
        }
    }
}

module.exports = PersonProcessor;