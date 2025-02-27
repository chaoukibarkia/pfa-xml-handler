-- Drop existing tables if they exist
DROP TABLE IF EXISTS person_images CASCADE;
DROP TABLE IF EXISTS entity_images CASCADE;
DROP TABLE IF EXISTS person_sources CASCADE;
DROP TABLE IF EXISTS entity_sources CASCADE;
DROP TABLE IF EXISTS information_sources CASCADE;
DROP TABLE IF EXISTS person_dates CASCADE;
DROP TABLE IF EXISTS entity_dates CASCADE;
DROP TABLE IF EXISTS date_types CASCADE;
DROP TABLE IF EXISTS association_roles CASCADE;
DROP TABLE IF EXISTS association_details CASCADE;
DROP TABLE IF EXISTS public_figure_associations CASCADE;
DROP TABLE IF EXISTS special_entity_associations CASCADE;
DROP TABLE IF EXISTS associations CASCADE;
DROP TABLE IF EXISTS person_documents CASCADE;
DROP TABLE IF EXISTS person_roles CASCADE;
DROP TABLE IF EXISTS entity_vessels CASCADE;
DROP TABLE IF EXISTS entity_addresses CASCADE;
DROP TABLE IF EXISTS person_addresses CASCADE;
DROP TABLE IF EXISTS entity_descriptions CASCADE;
DROP TABLE IF EXISTS person_descriptions CASCADE;
DROP TABLE IF EXISTS person_names CASCADE;
DROP TABLE IF EXISTS entity_names CASCADE;
DROP TABLE IF EXISTS description_types CASCADE;
DROP TABLE IF EXISTS sanctions_references CASCADE;
DROP TABLE IF EXISTS person_sanctions CASCADE;
DROP TABLE IF EXISTS entity_sanctions CASCADE;
DROP TABLE IF EXISTS person_birth_places CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
DROP TABLE IF EXISTS occupations CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP TABLE IF EXISTS persons CASCADE;
DROP TABLE IF EXISTS entities CASCADE;
DROP TABLE IF EXISTS association_types CASCADE;
DROP TABLE IF EXISTS name_types CASCADE;
DROP TABLE IF EXISTS role_types CASCADE;

-- Create Reference Tables
CREATE TABLE countries (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_territory BOOLEAN DEFAULT FALSE,
    profile_url TEXT
);

CREATE TABLE occupations (
    code INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE relationships (
    code INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create description_types table with hierarchical structure
CREATE TABLE description_types (
    level INTEGER,
    id INTEGER,
    description TEXT,
    parent_id INTEGER,
    parent_level INTEGER,
    record_type VARCHAR(50),
    PRIMARY KEY (level, id),
    FOREIGN KEY (parent_level, parent_id) 
        REFERENCES description_types(level, id)
        DEFERRABLE INITIALLY DEFERRED
);

-- Create sanctions_references table
CREATE TABLE sanctions_references (
    code INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    description2_level INTEGER,
    description2_id INTEGER,
    FOREIGN KEY (description2_level, description2_id) 
        REFERENCES description_types(level, id)
);

-- Create name_types table for XML NameTypeList
CREATE TABLE name_types (
    id SERIAL PRIMARY KEY,
    name_type_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    record_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create date_types table for XML DateTypeList
CREATE TABLE date_types (
    id SERIAL PRIMARY KEY,
    date_type_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    record_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_types table for XML RoleTypeList
CREATE TABLE role_types (
    id SERIAL PRIMARY KEY,
    role_type_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create information_sources table
CREATE TABLE information_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core Entity Tables
CREATE TABLE persons (
    id INTEGER PRIMARY KEY,
    action VARCHAR(50),
    date DATE,
    gender VARCHAR(10),
    active_status VARCHAR(50),
    deceased BOOLEAN,
    profile_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entities (
    id INTEGER PRIMARY KEY,
    action VARCHAR(50),
    date DATE,
    active_status VARCHAR(50),
    entity_type VARCHAR(50),
    profile_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Name Tables
CREATE TABLE person_names (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    name_type VARCHAR(50),
    name_type_id INTEGER REFERENCES name_types(id),
    title_honorific VARCHAR(100),
    maiden_name VARCHAR(255),
    first_name VARCHAR(255),
    middle_name VARCHAR(255),
    surname VARCHAR(255),
    suffix VARCHAR(100),
    single_string_name TEXT,
    original_script_name TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (person_id, name_type, is_primary)
);

CREATE TABLE entity_names (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    name_type VARCHAR(50),
    name_type_id INTEGER REFERENCES name_types(id),
    entity_name VARCHAR(255),
    suffix VARCHAR(100),
    original_script_name TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entity_id, name_type, is_primary)
);

-- Description Tables
CREATE TABLE person_descriptions (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    description1_level INTEGER,
    description1_id INTEGER,
    description2_level INTEGER,
    description2_id INTEGER,
    description3_level INTEGER,
    description3_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (description1_level, description1_id) 
        REFERENCES description_types(level, id),
    FOREIGN KEY (description2_level, description2_id) 
        REFERENCES description_types(level, id),
    FOREIGN KEY (description3_level, description3_id) 
        REFERENCES description_types(level, id)
);

CREATE TABLE entity_descriptions (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    description1_level INTEGER,
    description1_id INTEGER,
    description2_level INTEGER,
    description2_id INTEGER,
    description3_level INTEGER,
    description3_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (description1_level, description1_id) 
        REFERENCES description_types(level, id),
    FOREIGN KEY (description2_level, description2_id) 
        REFERENCES description_types(level, id),
    FOREIGN KEY (description3_level, description3_id) 
        REFERENCES description_types(level, id)
);

-- Address Tables
CREATE TABLE person_addresses (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    address_line TEXT,
    city VARCHAR(255),
    country_code VARCHAR(20) REFERENCES countries(code),
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_addresses (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    address_line TEXT,
    city VARCHAR(255),
    country_code VARCHAR(20) REFERENCES countries(code),
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Date Tables (for XML DateDetails)
CREATE TABLE person_dates (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    date_type VARCHAR(50),
    date_type_id INTEGER REFERENCES date_types(id),
    date DATE,
    day INTEGER,
    month VARCHAR(20),
    year INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_dates (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    date_type VARCHAR(50),
    date_type_id INTEGER REFERENCES date_types(id),
    date DATE,
    day INTEGER,
    month VARCHAR(20),
    year INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role and Document Tables
CREATE TABLE person_roles (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    role_type VARCHAR(50),
    role_type_id INTEGER REFERENCES role_types(id),
    occupation_code INTEGER REFERENCES occupations(code),
    title TEXT,
    start_date DATE,
    end_date DATE,
    start_day INTEGER,
    start_month VARCHAR(20),
    start_year INTEGER,
    end_day INTEGER,
    end_month VARCHAR(20),
    end_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE person_documents (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    document_type VARCHAR(50),
    document_number VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_vessels (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    call_sign VARCHAR(50),
    vessel_type VARCHAR(100),
    tonnage VARCHAR(50),
    grt VARCHAR(50),
    owner VARCHAR(255),
    flag VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Image Tables (for XML Images element)
CREATE TABLE person_images (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_images (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Source Tables (for XML SourceDescription)
CREATE TABLE person_sources (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    source_id INTEGER REFERENCES information_sources(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_sources (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    source_id INTEGER REFERENCES information_sources(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Birth Place Table
CREATE TABLE person_birth_places (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    place_name VARCHAR(255),
    country_code VARCHAR(20) REFERENCES countries(code),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Association Tables
CREATE TABLE association_types (
    code INTEGER PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    category VARCHAR(50),
    bi_directional BOOLEAN DEFAULT FALSE
);

-- Modified associations table without conditional foreign keys
CREATE TABLE associations (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    target_id INTEGER NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    relationship_code INTEGER REFERENCES relationships(code),
    is_former BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_source CHECK (source_type IN ('PERSON', 'ENTITY')),
    CONSTRAINT valid_target CHECK (target_type IN ('PERSON', 'ENTITY')),
    UNIQUE(source_id, source_type, target_id, target_type, relationship_code)
);

-- Create trigger function to validate polymorphic references
CREATE OR REPLACE FUNCTION validate_association_references()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if source exists in the appropriate table
    IF NEW.source_type = 'PERSON' THEN
        IF NOT EXISTS (SELECT 1 FROM persons WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Person with ID % does not exist', NEW.source_id;
        END IF;
    ELSIF NEW.source_type = 'ENTITY' THEN
        IF NOT EXISTS (SELECT 1 FROM entities WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Entity with ID % does not exist', NEW.source_id;
        END IF;
    END IF;
    
    -- Check if target exists in the appropriate table
    IF NEW.target_type = 'PERSON' THEN
        IF NOT EXISTS (SELECT 1 FROM persons WHERE id = NEW.target_id) THEN
            RAISE EXCEPTION 'Person with ID % does not exist', NEW.target_id;
        END IF;
    ELSIF NEW.target_type = 'ENTITY' THEN
        IF NOT EXISTS (SELECT 1 FROM entities WHERE id = NEW.target_id) THEN
            RAISE EXCEPTION 'Entity with ID % does not exist', NEW.target_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for the associations table
CREATE TRIGGER check_association_references
BEFORE INSERT OR UPDATE ON associations
FOR EACH ROW EXECUTE FUNCTION validate_association_references();

CREATE TABLE association_details (
    id SERIAL PRIMARY KEY,
    association_id INTEGER REFERENCES associations(id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    start_day INTEGER,
    start_month VARCHAR(20),
    start_year INTEGER,
    end_day INTEGER,
    end_month VARCHAR(20),
    end_year INTEGER,
    notes TEXT,
    source TEXT,
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
    verification_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modified public_figure_associations table without conditional foreign keys
CREATE TABLE public_figure_associations (
    id SERIAL PRIMARY KEY,
    public_figure_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    associate_id INTEGER NOT NULL,
    associate_type VARCHAR(20) NOT NULL,
    relationship_code INTEGER REFERENCES relationships(code),
    is_former BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    start_day INTEGER,
    start_month VARCHAR(20),
    start_year INTEGER,
    end_day INTEGER,
    end_month VARCHAR(20),
    end_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_associate_type CHECK (associate_type IN ('PERSON', 'ENTITY')),
    UNIQUE(public_figure_id, associate_id, associate_type, relationship_code)
);

-- Create trigger function to validate public figure association references
CREATE OR REPLACE FUNCTION validate_public_figure_association_references()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if associate exists in the appropriate table
    IF NEW.associate_type = 'PERSON' THEN
        IF NOT EXISTS (SELECT 1 FROM persons WHERE id = NEW.associate_id) THEN
            RAISE EXCEPTION 'Person with ID % does not exist', NEW.associate_id;
        END IF;
    ELSIF NEW.associate_type = 'ENTITY' THEN
        IF NOT EXISTS (SELECT 1 FROM entities WHERE id = NEW.associate_id) THEN
            RAISE EXCEPTION 'Entity with ID % does not exist', NEW.associate_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for the public_figure_associations table
CREATE TRIGGER check_public_figure_association_references
BEFORE INSERT OR UPDATE ON public_figure_associations
FOR EACH ROW EXECUTE FUNCTION validate_public_figure_association_references();

-- Modified special_entity_associations table without conditional foreign keys
CREATE TABLE special_entity_associations (
    id SERIAL PRIMARY KEY,
    special_entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    associate_id INTEGER NOT NULL,
    associate_type VARCHAR(20) NOT NULL,
    relationship_code INTEGER REFERENCES relationships(code),
    is_former BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE,
    start_day INTEGER,
    start_month VARCHAR(20),
    start_year INTEGER,
    end_day INTEGER,
    end_month VARCHAR(20),
    end_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_associate_type CHECK (associate_type IN ('PERSON', 'ENTITY')),
    UNIQUE(special_entity_id, associate_id, associate_type, relationship_code)
);

-- Create trigger function to validate special entity association references
CREATE OR REPLACE FUNCTION validate_special_entity_association_references()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if associate exists in the appropriate table
    IF NEW.associate_type = 'PERSON' THEN
        IF NOT EXISTS (SELECT 1 FROM persons WHERE id = NEW.associate_id) THEN
            RAISE EXCEPTION 'Person with ID % does not exist', NEW.associate_id;
        END IF;
    ELSIF NEW.associate_type = 'ENTITY' THEN
        IF NOT EXISTS (SELECT 1 FROM entities WHERE id = NEW.associate_id) THEN
            RAISE EXCEPTION 'Entity with ID % does not exist', NEW.associate_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for the special_entity_associations table
CREATE TRIGGER check_special_entity_association_references
BEFORE INSERT OR UPDATE ON special_entity_associations
FOR EACH ROW EXECUTE FUNCTION validate_special_entity_association_references();

-- Sanctions Reference Tables
CREATE TABLE person_sanctions (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
    reference_code INTEGER REFERENCES sanctions_references(code),
    start_date DATE,
    end_date DATE,
    start_day INTEGER,
    start_month VARCHAR(20),
    start_year INTEGER,
    end_day INTEGER,
    end_month VARCHAR(20),
    end_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entity_sanctions (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE,
    reference_code INTEGER REFERENCES sanctions_references(code),
    start_date DATE,
    end_date DATE,
    start_day INTEGER,
    start_month VARCHAR(20),
    start_year INTEGER,
    end_day INTEGER,
    end_month VARCHAR(20),
    end_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_persons_action ON persons(action);
CREATE INDEX idx_persons_date ON persons(date);
CREATE INDEX idx_persons_status ON persons(active_status);

CREATE INDEX idx_entities_action ON entities(action);
CREATE INDEX idx_entities_date ON entities(date);
CREATE INDEX idx_entities_type ON entities(entity_type);

CREATE INDEX idx_person_names_search ON person_names(first_name, surname);
CREATE INDEX idx_person_names_person ON person_names(person_id);
CREATE INDEX idx_person_names_type ON person_names(name_type);

CREATE INDEX idx_entity_names_search ON entity_names(entity_name);
CREATE INDEX idx_entity_names_entity ON entity_names(entity_id);
CREATE INDEX idx_entity_names_type ON entity_names(name_type);

CREATE INDEX idx_person_dates_person ON person_dates(person_id);
CREATE INDEX idx_person_dates_type ON person_dates(date_type);
CREATE INDEX idx_person_dates_date ON person_dates(date);

CREATE INDEX idx_entity_dates_entity ON entity_dates(entity_id);
CREATE INDEX idx_entity_dates_type ON entity_dates(date_type);
CREATE INDEX idx_entity_dates_date ON entity_dates(date);

CREATE INDEX idx_person_roles_person ON person_roles(person_id);
CREATE INDEX idx_person_roles_occupation ON person_roles(occupation_code);

CREATE INDEX idx_person_images_person ON person_images(person_id);
CREATE INDEX idx_entity_images_entity ON entity_images(entity_id);

CREATE INDEX idx_person_sanctions_person ON person_sanctions(person_id);
CREATE INDEX idx_person_sanctions_reference ON person_sanctions(reference_code);

CREATE INDEX idx_entity_sanctions_entity ON entity_sanctions(entity_id);
CREATE INDEX idx_entity_sanctions_reference ON entity_sanctions(reference_code);

CREATE INDEX idx_associations_source ON associations(source_id, source_type);
CREATE INDEX idx_associations_target ON associations(target_id, target_type);
CREATE INDEX idx_associations_relationship ON associations(relationship_code);
CREATE INDEX idx_associations_composite ON associations(source_id, target_id, relationship_code);

CREATE INDEX idx_public_figure_assoc ON public_figure_associations(public_figure_id);
CREATE INDEX idx_public_figure_associate ON public_figure_associations(associate_id, associate_type);

CREATE INDEX idx_special_entity_assoc ON special_entity_associations(special_entity_id);
CREATE INDEX idx_special_entity_associate ON special_entity_associations(associate_id, associate_type);