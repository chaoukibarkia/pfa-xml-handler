// src/processors/entity-processor.js
const BaseProcessor = require('./base-processor');
const logger = require('../utils/logging');

/**
 * Processor for Entity XML elements
 */
class EntityProcessor extends BaseProcessor {
    constructor(dbClient, models, options = {}) {
        super(dbClient, models, options);
        
        // Additional entity-specific stats
        this.stats.counts = {
            entities: 0,
            names: 0,
            descriptions: 0,
            dates: 0,
            addresses: 0,
            sanctions: 0,
            vessels: 0,
            images: 0,
            sources: 0
        };
    }
    
    /**
     * Setup XML handlers for entity processing
     * @param {Object} xml - XML stream
     */
    setupHandlers(xml) {
        // Main entity element handler
        xml.on('endElement: Entity', async (entity) => {
            try {
                await this.processRecord(entity);
                this.updateStats(true);
            } catch (error) {
                logger.processingError(`Entity processing error for ID: ${this.getAttribute(entity.$, 'id')}`, error);
                this.updateStats(false);
            }
        });
        
        // Return the processor for chaining
        return this;
    }
    
    /**
     * Process an entity record
     * @param {Object} entity - Entity XML element
     */
    async processRecord(entity) {
        const entityId = this.safeParseInt(this.getAttribute(entity.$, 'id'));
        
        // Begin transaction for entity processing
        await this.db.query('BEGIN');
        
        try {
            // Upsert entity record
            const entityRecord = await this.models.entity.upsert({
                id: entityId,
                action: this.getAttribute(entity.$, 'action'),
                date: this.getAttribute(entity.$, 'date'),
                active_status: entity.ActiveStatus?.[0] || 'ACTIVE',
                entity_type: entity.EntityType?.[0] || 'ORGANIZATION',
                profile_notes: entity.ProfileNotes?.[0] || null
            });
            
            this.stats.counts.entities++;
            
            // Process names
            await this.processNames(entityId, entity);
            
            // Process descriptions
            await this.processDescriptions(entityId, entity);
            
            // Process dates
            await this.processDates(entityId, entity);
            
            // Process sanctions
            await this.processSanctions(entityId, entity);
            
            // Process addresses
            await this.processAddresses(entityId, entity);
            
            // Process vessel details
            await this.processVesselDetails(entityId, entity);
            
            // Process images
            await this.processImages(entityId, entity);
            
            // Process sources
            await this.processSources(entityId, entity);
            
            // Commit transaction
            await this.db.query('COMMIT');
            
            return entityRecord;
        } catch (error) {
            // Rollback transaction on error
            await this.db.query('ROLLBACK');
            throw error;
        }
    }
    
    /**
     * Process entity names
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processNames(entityId, entity) {
        if (!entity.NameDetails?.[0]?.Name) return;
        
        for (const name of entity.NameDetails[0].Name) {
            const nameType = this.getAttribute(name.$, 'NameType');
            
            if (name.NameValue && name.NameValue.length > 0) {
                for (const nameValue of name.NameValue) {
                    await this.models.entity.insertName({
                        entity_id: entityId,
                        name_type: nameType,
                        name_type_id: this.safeParseInt(this.getAttribute(name.$, 'NameTypeID')),
                        entity_name: nameValue.EntityName?.[0] || null,
                        suffix: nameValue.Suffix?.[0] || null,
                        original_script_name: nameValue.OriginalScriptName?.[0] || null,
                        is_primary: nameType === 'Primary'
                    });
                    
                    this.stats.counts.names++;
                }
            }
        }
    }
    
    /**
     * Process entity descriptions
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processDescriptions(entityId, entity) {
        if (!entity.Descriptions?.[0]?.Description) return;
        
        for (const description of entity.Descriptions[0].Description) {
            await this.models.entity.insertDescription({
                entity_id: entityId,
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
     * Process entity dates
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processDates(entityId, entity) {
        if (!entity.DateDetails?.[0]?.Date) return;
        
        for (const date of entity.DateDetails[0].Date) {
            const dateType = this.getAttribute(date.$, 'DateType');
            
            if (date.DateValue && date.DateValue.length > 0) {
                for (const dateValue of date.DateValue) {
                    await this.models.entity.insertDate({
                        entity_id: entityId,
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
     * Process entity sanctions
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processSanctions(entityId, entity) {
        if (!entity.SanctionsReferences?.[0]?.Reference) return;
        
        for (const reference of entity.SanctionsReferences[0].Reference) {
            await this.models.entity.insertSanction({
                entity_id: entityId,
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
     * Process entity addresses
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processAddresses(entityId, entity) {
        // Process addresses from CompanyDetails
        if (entity.CompanyDetails) {
            for (const companyDetail of entity.CompanyDetails) {
                await this.models.entity.insertAddress({
                    entity_id: entityId,
                    address_line: companyDetail.AddressLine?.[0] || null,
                    city: companyDetail.AddressCity?.[0] || null,
                    country_code: companyDetail.AddressCountry?.[0] || null,
                    url: companyDetail.URL?.[0] || null
                });
                
                this.stats.counts.addresses++;
            }
        }
        
        // Also check for Address elements directly on entity
        if (entity.Address) {
            for (const address of entity.Address) {
                await this.models.entity.insertAddress({
                    entity_id: entityId,
                    address_line: address.AddressLine?.[0] || null,
                    city: address.AddressCity?.[0] || null,
                    country_code: address.AddressCountry?.[0] || null,
                    url: address.URL?.[0] || null
                });
                
                this.stats.counts.addresses++;
            }
        }
    }
    
    /**
     * Process entity vessel details
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processVesselDetails(entityId, entity) {
        if (!entity.VesselDetails) return;
        
        for (const vesselDetail of entity.VesselDetails) {
            await this.models.entity.insertVesselDetails({
                entity_id: entityId,
                call_sign: vesselDetail.VesselCallSign?.[0] || null,
                vessel_type: vesselDetail.VesselType?.[0] || null,
                tonnage: vesselDetail.VesselTonnage?.[0] || null,
                grt: vesselDetail.VesselGRT?.[0] || null,
                owner: vesselDetail.VesselOwner?.[0] || null,
                flag: vesselDetail.VesselFlag?.[0] || null
            });
            
            this.stats.counts.vessels++;
        }
    }
    
    /**
     * Process entity images
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processImages(entityId, entity) {
        if (!entity.Images?.[0]?.Image) return;
        
        for (const image of entity.Images[0].Image) {
            await this.models.entity.insertImage({
                entity_id: entityId,
                url: this.getAttribute(image.$, 'URL'),
                is_primary: this.getAttribute(image.$, 'IsPrimary') === 'true'
            });
            
            this.stats.counts.images++;
        }
    }
    
    /**
     * Process entity sources
     * @param {number} entityId - Entity ID
     * @param {Object} entity - Entity XML element
     */
    async processSources(entityId, entity) {
        if (!entity.SourceDescription?.[0]?.Source) return;
        
        for (const source of entity.SourceDescription[0].Source) {
            const sourceName = this.getAttribute(source.$, 'name');
            
            // First, ensure the source exists
            const sourceRecord = await this.models.informationSource.upsert({
                name: sourceName,
                description: this.getAttribute(source.$, 'description'),
                url: this.getAttribute(source.$, 'url')
            });
            
            // Then link it to the entity
            await this.models.informationSource.addEntitySource(entityId, sourceRecord.id);
            this.stats.counts.sources++;
        }
    }
}

module.exports = EntityProcessor;