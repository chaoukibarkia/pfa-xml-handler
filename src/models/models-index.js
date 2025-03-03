// src/models/models-index.js
const BaseModel = require('./base-model');
const CountryModel = require('./country-model');
const PersonModel = require('./person-model');
const EntityModel = require('./entity-model');
const AssociationModel = require('./association-model');
const RelationshipModel = require('./relationship-model');
const DescriptionTypeModel = require('./description-type-model');
const OccupationModel = require('./occupation-model');
const SanctionsReferenceModel = require('./sanctions-reference-model');
const DateTypeModel = require('./date-type-model');
const NameTypeModel = require('./name-type-model');
const RoleTypeModel = require('./role-type-model');
const InformationSourceModel = require('./information-source-model');

module.exports = {
    BaseModel,
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
};