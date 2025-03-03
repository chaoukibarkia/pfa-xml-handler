// src/services/xml-parser-service.js
const fs = require('fs');
const XmlStream = require('xml-stream');
const logger = require('../utils/logging');
const { Pool } = require('pg');
const { 
    CountryModel, 
    PersonModel, 
    EntityModel, 
    AssociationModel, 
    RelationshipModel, 
    DescriptionTypeModel,
    OccupationModel,
    SanctionsReferenceModel,
    DateTypeModel,
    NameTypeModel,
    RoleTypeModel,
    InformationSourceModel
} = require('../models/models-index');

class XMLParserService {
    /**
     * Constructor for XML Parser
     * @param {Object} dbConfig - Database configuration
     * @param {Object} options - Parser configuration options
     */
    constructor(dbConfig, options = {}) {
        // Initialize database connection
        this.pool = new Pool(dbConfig);
        this.dbClient = null;
        
        // Configuration options
        this.config = {
            batchSize: options.batchSize || 500,
            logInterval: options.logInterval || 10000,
            validateXml: options.validateXml !== false,
            maxFileSizeGB: options.maxFileSizeGB || 10
        };

        // Processing state
        this.state = {
            processedRecords: 0,
            startTime: Date.now(),
            currentSourceType: null,
            currentSourceID: null,
            counts: {
                countries: 0,
                occupations: 0,
                relationships: 0,
                sanctionsReferences: 0,
                descriptionTypes: 0,
                dateTypes: 0,
                nameTypes: 0,
                roleTypes: 0,
                persons: 0,
                personNames: 0,
                personDescriptions: 0,
                personRoles: 0,
                personDates: 0,
                personAddresses: 0,
                personSanctions: 0,
                personBirthPlaces: 0,
                personDocuments: 0,
                personImages: 0,
                personSources: 0,
                entities: 0,
                entityNames: 0,
                entityDescriptions: 0,
                entityAddresses: 0,
                entityDates: 0,
                entitySanctions: 0,
                entityVessels: 0,
                entitySources: 0,
                associations: 0,
                publicFigureAssociations: 0,
                specialEntityAssociations: 0
            }
        };
    }

    /**
     * Initialize database connection and models
     */
    async initialize() {
        try {
            this.dbClient = await this.pool.connect();
            
            // Initialize models with the client
            this.models = {
                country: new CountryModel(this.dbClient),
                person: new PersonModel(this.dbClient),
                entity: new EntityModel(this.dbClient),
                association: new AssociationModel(this.dbClient),
                relationship: new RelationshipModel(this.dbClient),
                descriptionType: new DescriptionTypeModel(this.dbClient),
                occupation: new OccupationModel(this.dbClient),
                sanctionsReference: new SanctionsReferenceModel(this.dbClient),
                dateType: new DateTypeModel(this.dbClient),
                nameType: new NameTypeModel(this.dbClient),
                roleType: new RoleTypeModel(this.dbClient),
                informationSource: new InformationSourceModel(this.dbClient)
            };
            
            logger.processInfo('Database connection established and models initialized');
            return true;
        } catch (error) {
            logger.processingError('Failed to initialize database connection', error);
            throw error;
        }
    }

    /**
     * Release the client back to the pool
     */
    async cleanup() {
        if (this.dbClient) {
            this.dbClient.release();
            logger.processInfo('Database connection released');
        }
    }

    /**
     * Parse large XML file
     * @param {string} filePath - Path to XML file
     * @returns {Promise<Object>} Processing statistics
     */
    async parseXMLFile(filePath) {
        return new Promise(async (resolve, reject) => {
            try {
                // Initialize connections
                await this.initialize();
                
                // Validate file exists
                if (!fs.existsSync(filePath)) {
                    await this.cleanup();
                    return reject(new Error(`XML file not found: ${filePath}`));
                }

                // Check file size
                const stats = fs.statSync(filePath);
                const fileSizeInGB = stats.size / (1024 * 1024 * 1024);
                
                if (fileSizeInGB > this.config.maxFileSizeGB) {
                    await this.cleanup();
                    return reject(new Error(`File too large. Max size is ${this.config.maxFileSizeGB}GB, file is ${fileSizeInGB.toFixed(2)}GB`));
                }

                logger.processInfo('Starting XML processing', {
                    filePath,
                    fileSize: `${fileSizeInGB.toFixed(2)} GB`
                });

                const stream = fs.createReadStream(filePath);
                const xml = new XmlStream(stream);

                // Reference Lists Processing
                this.setupReferenceListParsing(xml);

                // Records Processing
                this.setupRecordParsing(xml);

                // Associations Processing
                this.setupAssociationParsing(xml);

                // Stream completion handling
                xml.on('end', async () => {
                    try {
                        const processingTime = (Date.now() - this.state.startTime) / 1000;
                        
                        const stats = {
                            processingTime,
                            processedRecords: this.state.processedRecords,
                            counts: this.state.counts
                        };

                        logger.processInfo('XML parsing completed', stats);
                        
                        // Release the database client
                        await this.cleanup();
                        
                        resolve(stats);
                    } catch (error) {
                        logger.processingError('Completion processing failed', error);
                        await this.cleanup();
                        reject(error);
                    }
                });

                // Error handling
                xml.on('error', async (error) => {
                    logger.processingError('XML parsing error', error);
                    await this.cleanup();
                    reject(error);
                });
            } catch (error) {
                logger.processingError('Error in XML parsing setup', error);
                await this.cleanup();
                reject(error);
            }
        });
    }

    /**
     * Setup parsing for reference lists
     * @param {Object} xml - XML stream
     */
    setupReferenceListParsing(xml) {
        // Country List
        xml.on('endElement: CountryName', async (country) => {
            try {
                await this.models.country.upsert({
                    code: this.getAttribute(country.$, 'code'),
                    name: this.getAttribute(country.$, 'name'),
                    is_territory: this.getAttribute(country.$, 'IsTerritory') === 'true',
                    profile_url: this.getAttribute(country.$, 'ProfileURL')
                });
                
                this.state.counts.countries++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Country processing error', error);
            }
        });

        // Occupation List
        xml.on('endElement: Occupation', async (occupation) => {
            try {
                await this.models.occupation.upsert({
                    code: this.getAttribute(occupation.$, 'code'),
                    name: this.getAttribute(occupation.$, 'name')
                });
                
                this.state.counts.occupations++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Occupation processing error', error);
            }
        });

        // Relationship List
        xml.on('endElement: Relationship', async (relationship) => {
            try {
                await this.models.relationship.upsert({
                    code: this.getAttribute(relationship.$, 'code'),
                    name: this.getAttribute(relationship.$, 'name')
                });
                
                this.state.counts.relationships++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Relationship processing error', error);
            }
        });

        // Sanctions References List
        xml.on('endElement: ReferenceName', async (reference) => {
            try {
                await this.models.sanctionsReference.upsert({
                    code: this.getAttribute(reference.$, 'code'),
                    name: this.getAttribute(reference.$, 'name'),
                    status: this.getAttribute(reference.$, 'status'),
                    description2_id: this.getAttribute(reference.$, 'Description2Id')
                });
                
                this.state.counts.sanctionsReferences++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Sanctions reference processing error', error);
            }
        });

        // Description Types (Level 1)
        xml.on('endElement: Description1Name', async (description) => {
            try {
                await this.models.descriptionType.upsert({
                    level: 1,
                    id: this.getAttribute(description.$, 'Description1Id'),
                    description: description._,
                    parent_id: null,
                    parent_level: null,
                    record_type: this.getAttribute(description.$, 'RecordType')
                });
                
                this.state.counts.descriptionTypes++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Description1 processing error', error);
            }
        });

        // Description Types (Level 2)
        xml.on('endElement: Description2Name', async (description) => {
            try {
                await this.models.descriptionType.upsert({
                    level: 2,
                    id: this.getAttribute(description.$, 'Description2Id'),
                    description: description._,
                    parent_id: this.getAttribute(description.$, 'Description1Id'),
                    parent_level: 1,
                    record_type: null
                });
                
                this.state.counts.descriptionTypes++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Description2 processing error', error);
            }
        });

        // Description Types (Level 3)
        xml.on('endElement: Description3Name', async (description) => {
            try {
                await this.models.descriptionType.upsert({
                    level: 3,
                    id: this.getAttribute(description.$, 'Description3Id'),
                    description: description._,
                    parent_id: this.getAttribute(description.$, 'Description2Id'),
                    parent_level: 2,
                    record_type: null
                });
                
                this.state.counts.descriptionTypes++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Description3 processing error', error);
            }
        });
        
        // Date Type List
        xml.on('endElement: DateType', async (dateType) => {
            try {
                await this.models.dateType.upsert({
                    date_type_id: this.getAttribute(dateType.$, 'Id'),
                    name: this.getAttribute(dateType.$, 'name'),
                    record_type: this.getAttribute(dateType.$, 'RecordType')
                });
                
                this.state.counts.dateTypes++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Date type processing error', error);
            }
        });
        
        // Name Type List
        xml.on('endElement: NameType', async (nameType) => {
            try {
                await this.models.nameType.upsert({
                    name_type_id: this.getAttribute(nameType.$, 'NameTypeID'),
                    name: nameType._,
                    record_type: this.getAttribute(nameType.$, 'RecordType')
                });
                
                this.state.counts.nameTypes++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Name type processing error', error);
            }
        });
        
        // Role Type List
        xml.on('endElement: RoleType', async (roleType) => {
            try {
                await this.models.roleType.upsert({
                    role_type_id: this.getAttribute(roleType.$, 'Id'),
                    name: this.getAttribute(roleType.$, 'name')
                });
                
                this.state.counts.roleTypes++;
                this.incrementProcessedRecords();
            } catch (error) {
                logger.processingError('Role type processing error', error);
            }
        });
    }

    /**
     * Setup parsing for records (Persons and Entities)
     * @param {Object} xml - XML stream
     */
    setupRecordParsing(xml) {
        // Person Processing
        xml.on('endElement: Person', async (person) => {
            try {
                const personId = parseInt(this.getAttribute(person.$, 'id'), 10);
                
                // Begin transaction for person processing
                await this.dbClient.query('BEGIN');
                
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
                
                this.state.counts.persons++;

                // Process person names
                if (person.NameDetails?.[0]?.Name) {
                    for (const name of person.NameDetails[0].Name) {
                        const nameType = this.getAttribute(name.$, 'NameType');
                        
                        if (name.NameValue && name.NameValue.length > 0) {
                            for (const nameValue of name.NameValue) {
                                await this.models.person.insertName({
                                    person_id: personId,
                                    name_type: nameType,
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
                                
                                this.state.counts.personNames++;
                            }
                        }
                    }
                }
                
                // Process descriptions
                if (person.Descriptions?.[0]?.Description) {
                    for (const description of person.Descriptions[0].Description) {
                        await this.models.person.insertDescription({
                            person_id: personId,
                            description1_level: 1,
                            description1_id: parseInt(this.getAttribute(description.$, 'Description1'), 10) || null,
                            description2_level: 2,
                            description2_id: parseInt(this.getAttribute(description.$, 'Description2'), 10) || null,
                            description3_level: 3,
                            description3_id: parseInt(this.getAttribute(description.$, 'Description3'), 10) || null
                        });
                        
                        this.state.counts.personDescriptions++;
                    }
                }
                
                // Process roles
                if (person.RoleDetail?.[0]?.Roles) {
                    for (const role of person.RoleDetail[0].Roles) {
                        const roleType = this.getAttribute(role.$, 'RoleType');
                        
                        if (role.OccTitle && role.OccTitle.length > 0) {
                            for (const occTitle of role.OccTitle) {
                                await this.models.person.insertRole({
                                    person_id: personId,
                                    role_type: roleType,
                                    occupation_code: parseInt(this.getAttribute(occTitle.$, 'OccCat'), 10) || null,
                                    title: occTitle._ || null,
                                    start_day: parseInt(this.getAttribute(occTitle.$, 'SinceDay'), 10) || null,
                                    start_month: this.getAttribute(occTitle.$, 'SinceMonth'),
                                    start_year: parseInt(this.getAttribute(occTitle.$, 'SinceYear'), 10) || null,
                                    end_day: parseInt(this.getAttribute(occTitle.$, 'ToDay'), 10) || null,
                                    end_month: this.getAttribute(occTitle.$, 'ToMonth'),
                                    end_year: parseInt(this.getAttribute(occTitle.$, 'ToYear'), 10) || null
                                });
                                
                                this.state.counts.personRoles++;
                            }
                        }
                    }
                }
                
                // Process dates
                if (person.DateDetails?.[0]?.Date) {
                    for (const date of person.DateDetails[0].Date) {
                        const dateType = this.getAttribute(date.$, 'DateType');
                        
                        if (date.DateValue && date.DateValue.length > 0) {
                            for (const dateValue of date.DateValue) {
                                await this.models.person.insertDate({
                                    person_id: personId,
                                    date_type: dateType,
                                    day: parseInt(this.getAttribute(dateValue.$, 'Day'), 10) || null,
                                    month: this.getAttribute(dateValue.$, 'Month'),
                                    year: parseInt(this.getAttribute(dateValue.$, 'Year'), 10) || null,
                                    notes: this.getAttribute(dateValue.$, 'Dnotes')
                                });
                                
                                this.state.counts.personDates++;
                            }
                        }
                    }
                }
                
                // Process birth places
                if (person.BirthPlace?.[0]?.Place) {
                    for (const place of person.BirthPlace[0].Place) {
                        await this.models.person.insertBirthPlace({
                            person_id: personId,
                            place_name: this.getAttribute(place.$, 'name')
                        });
                        
                        this.state.counts.personBirthPlaces++;
                    }
                }
                
                // Process sanctions references
                if (person.SanctionsReferences?.[0]?.Reference) {
                    for (const reference of person.SanctionsReferences[0].Reference) {
                        await this.models.person.insertSanction({
                            person_id: personId,
                            reference_code: parseInt(reference._, 10),
                            start_day: parseInt(this.getAttribute(reference.$, 'SinceDay'), 10) || null,
                            start_month: this.getAttribute(reference.$, 'SinceMonth'),
                            start_year: parseInt(this.getAttribute(reference.$, 'SinceYear'), 10) || null,
                            end_day: parseInt(this.getAttribute(reference.$, 'ToDay'), 10) || null,
                            end_month: this.getAttribute(reference.$, 'ToMonth'),
                            end_year: parseInt(this.getAttribute(reference.$, 'ToYear'), 10) || null
                        });
                        
                        this.state.counts.personSanctions++;
                    }
                }
                
                // Process addresses
                if (person.Address) {
                    for (const address of person.Address) {
                        await this.models.person.insertAddress({
                            person_id: personId,
                            address_line: address.AddressLine?.[0] || null,
                            city: address.AddressCity?.[0] || null,
                            country_code: address.AddressCountry?.[0] || null,
                            url: address.URL?.[0] || null
                        });
                        
                        this.state.counts.personAddresses++;
                    }
                }
                
                // Process country details
                if (person.CountryDetails?.[0]?.Country) {
                    for (const country of person.CountryDetails[0].Country) {
                        const countryType = this.getAttribute(country.$, 'CountryType');
                        
                        if (country.CountryValue && country.CountryValue.length > 0) {
                            for (const countryValue of country.CountryValue) {
                                // We don't have a direct table for person-country associations
                                // This would typically be handled in a custom way depending on use case
                                // For now, we could log it for manual handling
                                logger.processInfo('Person country detail', {
                                    personId,
                                    countryType,
                                    countryCode: this.getAttribute(countryValue.$, 'Code')
                                });
                            }
                        }
                    }
                }
                
                // Process ID numbers/documents
                if (person.IDNumberTypes?.[0]?.ID) {
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
                                
                                this.state.counts.personDocuments++;
                            }
                        }
                    }
                }
                
                // Process images
                if (person.Images?.[0]?.Image) {
                    for (const image of person.Images[0].Image) {
                        await this.models.person.insertImage({
                            person_id: personId,
                            url: this.getAttribute(image.$, 'URL'),
                            is_primary: false
                        });
                        
                        this.state.counts.personImages++;
                    }
                }
                
                // Process sources
                if (person.SourceDescription?.[0]?.Source) {
                    for (const source of person.SourceDescription[0].Source) {
                        const sourceName = this.getAttribute(source.$, 'name');
                        
                        // First, ensure the source exists
                        const sourceRecord = await this.models.informationSource.upsert({
                            name: sourceName
                        });
                        
                        // Then link it to the person
                        await this.models.informationSource.addPersonSource(personId, sourceRecord.id);
                        this.state.counts.personSources++;
                    }
                }
                
                // Commit transaction
                await this.dbClient.query('COMMIT');
                this.incrementProcessedRecords();
            } catch (error) {
                // Rollback transaction on error
                await this.dbClient.query('ROLLBACK');
                logger.processingError(`Person processing error for ID: ${this.getAttribute(person.$, 'id')}`, error);
            }
        });

        // Entity Processing
        xml.on('endElement: Entity', async (entity) => {
            try {
                const entityId = parseInt(this.getAttribute(entity.$, 'id'), 10);
                
                // Begin transaction for entity processing
                await this.dbClient.query('BEGIN');
                
                // Upsert entity record
                const entityRecord = await this.models.entity.upsert({
                    id: entityId,
                    action: this.getAttribute(entity.$, 'action'),
                    date: this.getAttribute(entity.$, 'date'),
                    active_status: entity.ActiveStatus?.[0] || 'ACTIVE',
                    entity_type: 'ORGANIZATION', // Default type
                    profile_notes: entity.ProfileNotes?.[0] || null
                });
                
                this.state.counts.entities++;

                // Process entity names
                if (entity.NameDetails?.[0]?.Name) {
                    for (const name of entity.NameDetails[0].Name) {
                        const nameType = this.getAttribute(name.$, 'NameType');
                        
                        if (name.NameValue && name.NameValue.length > 0) {
                            for (const nameValue of name.NameValue) {
                                await this.models.entity.insertName({
                                    entity_id: entityId,
                                    name_type: nameType,
                                    entity_name: nameValue.EntityName?.[0] || null,
                                    suffix: nameValue.Suffix?.[0] || null,
                                    original_script_name: nameValue.OriginalScriptName?.[0] || null,
                                    is_primary: nameType === 'Primary'
                                });
                                
                                this.state.counts.entityNames++;
                            }
                        }
                    }
                }
                
                // Process descriptions
                if (entity.Descriptions?.[0]?.Description) {
                    for (const description of entity.Descriptions[0].Description) {
                        await this.models.entity.insertDescription({
                            entity_id: entityId,
                            description1_level: 1,
                            description1_id: parseInt(this.getAttribute(description.$, 'Description1'), 10) || null,
                            description2_level: 2,
                            description2_id: parseInt(this.getAttribute(description.$, 'Description2'), 10) || null,
                            description3_level: 3,
                            description3_id: parseInt(this.getAttribute(description.$, 'Description3'), 10) || null
                        });
                        
                        this.state.counts.entityDescriptions++;
                    }
                }
                
                // Process dates
                if (entity.DateDetails?.[0]?.Date) {
                    for (const date of entity.DateDetails[0].Date) {
                        const dateType = this.getAttribute(date.$, 'DateType');
                        
                        if (date.DateValue && date.DateValue.length > 0) {
                            for (const dateValue of date.DateValue) {
                                await this.models.entity.insertDate({
                                    entity_id: entityId,
                                    date_type: dateType,
                                    day: parseInt(this.getAttribute(dateValue.$, 'Day'), 10) || null,
                                    month: this.getAttribute(dateValue.$, 'Month'),
                                    year: parseInt(this.getAttribute(dateValue.$, 'Year'), 10) || null,
                                    notes: this.getAttribute(dateValue.$, 'Dnotes')
                                });
                                
                                this.state.counts.entityDates++;
                            }
                        }
                    }
                }
                
                // Process sanctions references
                if (entity.SanctionsReferences?.[0]?.Reference) {
                    for (const reference of entity.SanctionsReferences[0].Reference) {
                        await this.models.entity.insertSanction({
                            entity_id: entityId,
                            reference_code: parseInt(reference._, 10),
                            start_day: parseInt(this.getAttribute(reference.$, 'SinceDay'), 10) || null,
                            start_month: this.getAttribute(reference.$, 'SinceMonth'),
                            start_year: parseInt(this.getAttribute(reference.$, 'SinceYear'), 10) || null,
                            end_day: parseInt(this.getAttribute(reference.$, 'ToDay'), 10) || null,
                            end_month: this.getAttribute(reference.$, 'ToMonth'),
                            end_year: parseInt(this.getAttribute(reference.$, 'ToYear'), 10) || null
                        });
                        
                        this.state.counts.entitySanctions++;
                    }
                }
                
                // Process company addresses
                if (entity.CompanyDetails) {
                    for (const companyDetail of entity.CompanyDetails) {
                        await this.models.entity.insertAddress({
                            entity_id: entityId,
                            address_line: companyDetail.AddressLine?.[0] || null,
                            city: companyDetail.AddressCity?.[0] || null,
                            country_code: companyDetail.AddressCountry?.[0] || null,
                            url: companyDetail.URL?.[0] || null
                        });
                        
                        this.state.counts.entityAddresses++;
                    }
                }
                
                // Process country details
                if (entity.CountryDetails?.[0]?.Country) {
                    for (const country of entity.CountryDetails[0].Country) {
                        const countryType = this.getAttribute(country.$, 'CountryType');
                        
                        if (country.CountryValue && country.CountryValue.length > 0) {
                            for (const countryValue of country.CountryValue) {
                                // We don't have a direct table for entity-country associations
                                // This would typically be handled in a custom way depending on use case
                                // For now, we could log it for manual handling
                                logger.processInfo('Entity country detail', {
                                    entityId,
                                    countryType,
                                    countryCode: this.getAttribute(countryValue.$, 'Code')
                                });
                            }
                        }
                    }
                }
                
                // Process vessel details
                if (entity.VesselDetails) {
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
                        
                        this.state.counts.entityVessels++;
                    }
                }
                
                // Process ID numbers
                if (entity.IDNumberTypes?.[0]?.ID) {
                    for (const id of entity.IDNumberTypes[0].ID) {
                        const idType = this.getAttribute(id.$, 'IDType');
                        
                        if (id.IDValue && id.IDValue.length > 0) {
                            for (const idValue of id.IDValue) {
                                // Note: There's no entity_documents table in the schema
                                // We'll log this for now to track that we received this data
                                logger.processInfo('Entity ID number received', {
                                    entityId,
                                    idType,
                                    idValue: idValue._,
                                    notes: this.getAttribute(idValue.$, 'IDnotes')
                                });
                            }
                        }
                    }
                }
                
                // Process sources
                if (entity.SourceDescription?.[0]?.Source) {
                    for (const source of entity.SourceDescription[0].Source) {
                        const sourceName = this.getAttribute(source.$, 'name');
                        
                        // First, ensure the source exists
                        const sourceRecord = await this.models.informationSource.upsert({
                            name: sourceName
                        });
                        
                        // Then link it to the entity
                        await this.models.informationSource.addEntitySource(entityId, sourceRecord.id);
                        this.state.counts.entitySources++;
                    }
                }
                
                // Commit transaction
                await this.dbClient.query('COMMIT');
                this.incrementProcessedRecords();
            } catch (error) {
                // Rollback transaction on error
                await this.dbClient.query('ROLLBACK');
                logger.processingError(`Entity processing error for ID: ${this.getAttribute(entity.$, 'id')}`, error);
            }
        });
    }

    /**
     * Setup parsing for associations
     * @param {Object} xml - XML stream
     */
    setupAssociationParsing(xml) {
        // Public Figure Associations
        xml.on('endElement: PublicFigure', async (publicFigure) => {
            try {
                // Begin transaction for public figure associations
                await this.dbClient.query('BEGIN');
                
                const publicFigureId = parseInt(this.getAttribute(publicFigure.$, 'id'), 10);
                this.state.currentSourceType = 'PublicFigure';
                this.state.currentSourceID = publicFigureId;
                
                // Process associates
                if (publicFigure.Associate) {
                    for (const associate of publicFigure.Associate) {
                        try {
                            const associateId = parseInt(this.getAttribute(associate.$, 'id'), 10);
                            const relationshipCode = parseInt(this.getAttribute(associate.$, 'code'), 10) || null;
                            const isFormer = this.getAttribute(associate.$, 'ex') === 'true';
                            
                            // Determine if this is a person or entity
                            // We'll need to check in the database
                            const personResult = await this.dbClient.query(`
                                SELECT 1 FROM persons WHERE id = $1
                            `, [associateId]);
                            
                            const associateType = personResult.rows.length > 0 ? 'PERSON' : 'ENTITY';
                            
                            // Create an association in the generic associations table
                            const associationResult = await this.models.association.create({
                                source_id: publicFigureId,
                                source_type: 'PERSON',
                                target_id: associateId,
                                target_type: associateType,
                                relationship_code: relationshipCode,
                                is_former: isFormer
                            });
                            
                            this.state.counts.associations++;
                            
                            // Also create a specific public figure association
                            await this.models.association.createPublicFigureAssociation({
                                public_figure_id: publicFigureId,
                                associate_id: associateId,
                                associate_type: associateType,
                                relationship_code: relationshipCode,
                                is_former: isFormer
                            });
                            
                            this.state.counts.publicFigureAssociations++;
                        } catch (error) {
                            logger.processingError(`Associate processing error for Public Figure ID: ${publicFigureId}, Associate ID: ${this.getAttribute(associate.$, 'id')}`, error);
                        }
                    }
                }
                
                // Commit transaction
                await this.dbClient.query('COMMIT');
                this.incrementProcessedRecords();
            } catch (error) {
                // Rollback transaction on error
                await this.dbClient.query('ROLLBACK');
                logger.processingError(`Public Figure Association processing error for ID: ${this.getAttribute(publicFigure.$, 'id')}`, error);
            }
        });

        // Special Entity Associations
        xml.on('endElement: SpecialEntity', async (specialEntity) => {
            try {
                // Begin transaction for special entity associations
                await this.dbClient.query('BEGIN');
                
                const specialEntityId = parseInt(this.getAttribute(specialEntity.$, 'id'), 10);
                this.state.currentSourceType = 'SpecialEntity';
                this.state.currentSourceID = specialEntityId;
                
                // Process associates
                if (specialEntity.Associate) {
                    for (const associate of specialEntity.Associate) {
                        try {
                            const associateId = parseInt(this.getAttribute(associate.$, 'id'), 10);
                            const relationshipCode = parseInt(this.getAttribute(associate.$, 'code'), 10) || null;
                            const isFormer = this.getAttribute(associate.$, 'ex') === 'true';
                            
                            // Determine if this is a person or entity
                            // We'll need to check in the database
                            const personResult = await this.dbClient.query(`
                                SELECT 1 FROM persons WHERE id = $1
                            `, [associateId]);
                            
                            const associateType = personResult.rows.length > 0 ? 'PERSON' : 'ENTITY';
                            
                            // Create an association in the generic associations table
                            const associationResult = await this.models.association.create({
                                source_id: specialEntityId,
                                source_type: 'ENTITY',
                                target_id: associateId,
                                target_type: associateType,
                                relationship_code: relationshipCode,
                                is_former: isFormer
                            });
                            
                            this.state.counts.associations++;
                            
                            // Also create a specific special entity association
                            await this.models.association.createSpecialEntityAssociation({
                                special_entity_id: specialEntityId,
                                associate_id: associateId,
                                associate_type: associateType,
                                relationship_code: relationshipCode,
                                is_former: isFormer
                            });
                            
                            this.state.counts.specialEntityAssociations++;
                        } catch (error) {
                            logger.processingError(`Associate processing error for Special Entity ID: ${specialEntityId}, Associate ID: ${this.getAttribute(associate.$, 'id')}`, error);
                        }
                    }
                }
                
                // Commit transaction
                await this.dbClient.query('COMMIT');
                this.incrementProcessedRecords();
            } catch (error) {
                // Rollback transaction on error
                await this.dbClient.query('ROLLBACK');
                logger.processingError(`Special Entity Association processing error for ID: ${this.getAttribute(specialEntity.$, 'id')}`, error);
            }
        });
    }

    /**
     * Get attribute safely
     * @param {Object} attributes - XML attributes
     * @param {string} attrName - Attribute name
     * @returns {string} Attribute value or empty string
     */
    getAttribute(attributes, attrName) {
        if (!attributes || !attributes[attrName]) {
            return '';
        }
        return Array.isArray(attributes[attrName]) ? attributes[attrName][0] : attributes[attrName];
    }

    /**
     * Increment processed records and log periodically
     */
    incrementProcessedRecords() {
        this.state.processedRecords++;

        // Log progress periodically
        if (this.state.processedRecords % this.config.logInterval === 0) {
            const elapsedTime = (Date.now() - this.state.startTime) / 1000;
            const recordsPerSecond = this.state.processedRecords / elapsedTime;
            
            logger.processInfo('Processing progress', {
                recordsProcessed: this.state.processedRecords,
                elapsedTime: `${elapsedTime.toFixed(2)}s`,
                speed: `${recordsPerSecond.toFixed(2)} records/second`,
                counts: this.state.counts
            });
        }
    }
}

module.exports = XMLParserService;