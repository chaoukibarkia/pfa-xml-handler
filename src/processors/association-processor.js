// src/processors/association-processor.js
const BaseProcessor = require('./base-processor');
const logger = require('../utils/logging');

/**
 * Processor for Association XML elements
 */
class AssociationProcessor extends BaseProcessor {
    constructor(dbClient, models, options = {}) {
        super(dbClient, models, options);
        
        // Additional association-specific stats
        this.stats.counts = {
            publicFigureAssociations: 0,
            specialEntityAssociations: 0,
            associations: 0
        };
    }
    
    /**
     * Setup XML handlers for association processing
     * @param {Object} xml - XML stream
     */
    setupHandlers(xml) {
        // Public Figure associations handler
        xml.on('endElement: PublicFigure', async (publicFigure) => {
            try {
                await this.processPublicFigure(publicFigure);
                this.updateStats(true);
            } catch (error) {
                logger.processingError(`Public Figure Association processing error for ID: ${this.getAttribute(publicFigure.$, 'id')}`, error);
                this.updateStats(false);
            }
        });
        
        // Special Entity associations handler
        xml.on('endElement: SpecialEntity', async (specialEntity) => {
            try {
                await this.processSpecialEntity(specialEntity);
                this.updateStats(true);
            } catch (error) {
                logger.processingError(`Special Entity Association processing error for ID: ${this.getAttribute(specialEntity.$, 'id')}`, error);
                this.updateStats(false);
            }
        });
        
        // Return the processor for chaining
        return this;
    }
    
    /**
     * Process a Public Figure record (association)
     * @param {Object} publicFigure - PublicFigure XML element
     */
    async processPublicFigure(publicFigure) {
        const publicFigureId = this.safeParseInt(this.getAttribute(publicFigure.$, 'id'));
        
        // Begin transaction for public figure associations
        await this.db.query('BEGIN');
        
        try {
            // Process associates
            if (publicFigure.Associate) {
                for (const associate of publicFigure.Associate) {
                    try {
                        const associateId = this.safeParseInt(this.getAttribute(associate.$, 'id'));
                        const relationshipCode = this.safeParseInt(this.getAttribute(associate.$, 'code'));
                        const isFormer = this.getAttribute(associate.$, 'ex') === 'true';
                        
                        // Determine if this is a person or entity
                        const personResult = await this.db.query(
                            'SELECT 1 FROM persons WHERE id = $1',
                            [associateId]
                        );
                        
                        const associateType = personResult.rows.length > 0 ? 'PERSON' : 'ENTITY';
                        
                        // Create a generic association
                        const associationResult = await this.models.association.create({
                            source_id: publicFigureId,
                            source_type: 'PERSON',
                            target_id: associateId,
                            target_type: associateType,
                            relationship_code: relationshipCode,
                            is_former: isFormer,
                            // Extract date information if available
                            start_day: this.safeParseInt(this.getAttribute(associate.$, 'SinceDay')),
                            start_month: this.getAttribute(associate.$, 'SinceMonth'),
                            start_year: this.safeParseInt(this.getAttribute(associate.$, 'SinceYear')),
                            end_day: this.safeParseInt(this.getAttribute(associate.$, 'ToDay')),
                            end_month: this.getAttribute(associate.$, 'ToMonth'),
                            end_year: this.safeParseInt(this.getAttribute(associate.$, 'ToYear'))
                        });
                        
                        this.stats.counts.associations++;
                        
                        // Also create a specific public figure association
                        await this.models.association.createPublicFigureAssociation({
                            public_figure_id: publicFigureId,
                            associate_id: associateId,
                            associate_type: associateType,
                            relationship_code: relationshipCode,
                            is_former: isFormer,
                            start_day: this.safeParseInt(this.getAttribute(associate.$, 'SinceDay')),
                            start_month: this.getAttribute(associate.$, 'SinceMonth'),
                            start_year: this.safeParseInt(this.getAttribute(associate.$, 'SinceYear')),
                            end_day: this.safeParseInt(this.getAttribute(associate.$, 'ToDay')),
                            end_month: this.getAttribute(associate.$, 'ToMonth'),
                            end_year: this.safeParseInt(this.getAttribute(associate.$, 'ToYear'))
                        });
                        
                        this.stats.counts.publicFigureAssociations++;
                    } catch (error) {
                        logger.processingError(`Associate processing error for Public Figure ID: ${publicFigureId}, Associate ID: ${this.getAttribute(associate.$, 'id')}`, error);
                        // Continue processing other associates even if one fails
                    }
                }
            }
            
            // Commit transaction
            await this.db.query('COMMIT');
        } catch (error) {
            // Rollback transaction on error
            await this.db.query('ROLLBACK');
            throw error;
        }
    }
    
    /**
     * Process a Special Entity record (association)
     * @param {Object} specialEntity - SpecialEntity XML element
     */
    async processSpecialEntity(specialEntity) {
        const specialEntityId = this.safeParseInt(this.getAttribute(specialEntity.$, 'id'));
        
        // Begin transaction for special entity associations
        await this.db.query('BEGIN');
        
        try {
            // Process associates
            if (specialEntity.Associate) {
                for (const associate of specialEntity.Associate) {
                    try {
                        const associateId = this.safeParseInt(this.getAttribute(associate.$, 'id'));
                        const relationshipCode = this.safeParseInt(this.getAttribute(associate.$, 'code'));
                        const isFormer = this.getAttribute(associate.$, 'ex') === 'true';
                        
                        // Determine if this is a person or entity
                        const personResult = await this.db.query(
                            'SELECT 1 FROM persons WHERE id = $1',
                            [associateId]
                        );
                        
                        const associateType = personResult.rows.length > 0 ? 'PERSON' : 'ENTITY';
                        
                        // Create a generic association
                        const associationResult = await this.models.association.create({
                            source_id: specialEntityId,
                            source_type: 'ENTITY',
                            target_id: associateId,
                            target_type: associateType,
                            relationship_code: relationshipCode,
                            is_former: isFormer,
                            // Extract date information if available
                            start_day: this.safeParseInt(this.getAttribute(associate.$, 'SinceDay')),
                            start_month: this.getAttribute(associate.$, 'SinceMonth'),
                            start_year: this.safeParseInt(this.getAttribute(associate.$, 'SinceYear')),
                            end_day: this.safeParseInt(this.getAttribute(associate.$, 'ToDay')),
                            end_month: this.getAttribute(associate.$, 'ToMonth'),
                            end_year: this.safeParseInt(this.getAttribute(associate.$, 'ToYear'))
                        });
                        
                        this.stats.counts.associations++;
                        
                        // Also create a specific special entity association
                        await this.models.association.createSpecialEntityAssociation({
                            special_entity_id: specialEntityId,
                            associate_id: associateId,
                            associate_type: associateType,
                            relationship_code: relationshipCode,
                            is_former: isFormer,
                            start_day: this.safeParseInt(this.getAttribute(associate.$, 'SinceDay')),
                            start_month: this.getAttribute(associate.$, 'SinceMonth'),
                            start_year: this.safeParseInt(this.getAttribute(associate.$, 'SinceYear')),
                            end_day: this.safeParseInt(this.getAttribute(associate.$, 'ToDay')),
                            end_month: this.getAttribute(associate.$, 'ToMonth'),
                            end_year: this.safeParseInt(this.getAttribute(associate.$, 'ToYear'))
                        });
                        
                        this.stats.counts.specialEntityAssociations++;
                    } catch (error) {
                        logger.processingError(`Associate processing error for Special Entity ID: ${specialEntityId}, Associate ID: ${this.getAttribute(associate.$, 'id')}`, error);
                        // Continue processing other associates even if one fails
                    }
                }
            }
            
            // Commit transaction
            await this.db.query('COMMIT');
        } catch (error) {
            // Rollback transaction on error
            await this.db.query('ROLLBACK');
            throw error;
        }
    }
}

module.exports = AssociationProcessor;