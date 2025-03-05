--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: validate_association_references(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_association_references() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.validate_association_references() OWNER TO postgres;

--
-- Name: validate_public_figure_association_references(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_public_figure_association_references() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.validate_public_figure_association_references() OWNER TO postgres;

--
-- Name: validate_special_entity_association_references(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_special_entity_association_references() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.validate_special_entity_association_references() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: association_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.association_details (
    id integer NOT NULL,
    association_id integer,
    start_date date,
    end_date date,
    start_day integer,
    start_month character varying(20),
    start_year integer,
    end_day integer,
    end_month character varying(20),
    end_year integer,
    notes text,
    source text,
    confidence_level integer,
    verification_status character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT association_details_confidence_level_check CHECK (((confidence_level >= 1) AND (confidence_level <= 5)))
);


ALTER TABLE public.association_details OWNER TO postgres;

--
-- Name: association_details_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.association_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.association_details_id_seq OWNER TO postgres;

--
-- Name: association_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.association_details_id_seq OWNED BY public.association_details.id;


--
-- Name: association_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.association_types (
    code integer NOT NULL,
    name character varying(255),
    description text,
    category character varying(50),
    bi_directional boolean DEFAULT false
);


ALTER TABLE public.association_types OWNER TO postgres;

--
-- Name: associations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.associations (
    id integer NOT NULL,
    source_id integer NOT NULL,
    source_type character varying(20) NOT NULL,
    target_id integer NOT NULL,
    target_type character varying(20) NOT NULL,
    relationship_code integer,
    is_former boolean DEFAULT false,
    start_date date,
    end_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_source CHECK (((source_type)::text = ANY ((ARRAY['PERSON'::character varying, 'ENTITY'::character varying])::text[]))),
    CONSTRAINT valid_target CHECK (((target_type)::text = ANY ((ARRAY['PERSON'::character varying, 'ENTITY'::character varying])::text[])))
);


ALTER TABLE public.associations OWNER TO postgres;

--
-- Name: associations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.associations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.associations_id_seq OWNER TO postgres;

--
-- Name: associations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.associations_id_seq OWNED BY public.associations.id;


--
-- Name: countries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.countries (
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    is_territory boolean DEFAULT false,
    profile_url text
);


ALTER TABLE public.countries OWNER TO postgres;

--
-- Name: date_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.date_types (
    id integer NOT NULL,
    date_type_id integer NOT NULL,
    name character varying(255) NOT NULL,
    record_type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.date_types OWNER TO postgres;

--
-- Name: date_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.date_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.date_types_id_seq OWNER TO postgres;

--
-- Name: date_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.date_types_id_seq OWNED BY public.date_types.id;


--
-- Name: description_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.description_types (
    level integer NOT NULL,
    id integer NOT NULL,
    description text,
    parent_id integer,
    parent_level integer,
    record_type character varying(50)
);


ALTER TABLE public.description_types OWNER TO postgres;

--
-- Name: entities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entities (
    id integer NOT NULL,
    action character varying(50),
    date date,
    active_status character varying(50),
    entity_type character varying(50),
    profile_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entities OWNER TO postgres;

--
-- Name: entity_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_addresses (
    id integer NOT NULL,
    entity_id integer,
    address_line text,
    city character varying(255),
    country_code character varying(20),
    url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_addresses OWNER TO postgres;

--
-- Name: entity_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_addresses_id_seq OWNER TO postgres;

--
-- Name: entity_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_addresses_id_seq OWNED BY public.entity_addresses.id;


--
-- Name: entity_dates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_dates (
    id integer NOT NULL,
    entity_id integer,
    date_type character varying(50),
    date_type_id integer,
    date date,
    day integer,
    month character varying(20),
    year integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_dates OWNER TO postgres;

--
-- Name: entity_dates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_dates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_dates_id_seq OWNER TO postgres;

--
-- Name: entity_dates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_dates_id_seq OWNED BY public.entity_dates.id;


--
-- Name: entity_descriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_descriptions (
    id integer NOT NULL,
    entity_id integer,
    description1_level integer,
    description1_id integer,
    description2_level integer,
    description2_id integer,
    description3_level integer,
    description3_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_descriptions OWNER TO postgres;

--
-- Name: entity_descriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_descriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_descriptions_id_seq OWNER TO postgres;

--
-- Name: entity_descriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_descriptions_id_seq OWNED BY public.entity_descriptions.id;


--
-- Name: entity_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_images (
    id integer NOT NULL,
    entity_id integer,
    url text NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_images OWNER TO postgres;

--
-- Name: entity_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_images_id_seq OWNER TO postgres;

--
-- Name: entity_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_images_id_seq OWNED BY public.entity_images.id;


--
-- Name: entity_names; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_names (
    id integer NOT NULL,
    entity_id integer,
    name_type character varying(50),
    name_type_id integer,
    entity_name character varying(255),
    suffix character varying(100),
    original_script_name text,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_names OWNER TO postgres;

--
-- Name: entity_names_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_names_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_names_id_seq OWNER TO postgres;

--
-- Name: entity_names_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_names_id_seq OWNED BY public.entity_names.id;


--
-- Name: entity_sanctions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_sanctions (
    id integer NOT NULL,
    entity_id integer,
    reference_code integer,
    start_date date,
    end_date date,
    start_day integer,
    start_month character varying(20),
    start_year integer,
    end_day integer,
    end_month character varying(20),
    end_year integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_sanctions OWNER TO postgres;

--
-- Name: entity_sanctions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_sanctions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_sanctions_id_seq OWNER TO postgres;

--
-- Name: entity_sanctions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_sanctions_id_seq OWNED BY public.entity_sanctions.id;


--
-- Name: entity_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_sources (
    id integer NOT NULL,
    entity_id integer,
    source_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_sources OWNER TO postgres;

--
-- Name: entity_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_sources_id_seq OWNER TO postgres;

--
-- Name: entity_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_sources_id_seq OWNED BY public.entity_sources.id;


--
-- Name: entity_vessels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_vessels (
    id integer NOT NULL,
    entity_id integer,
    call_sign character varying(50),
    vessel_type character varying(100),
    tonnage character varying(50),
    grt character varying(50),
    owner character varying(255),
    flag character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.entity_vessels OWNER TO postgres;

--
-- Name: entity_vessels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.entity_vessels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_vessels_id_seq OWNER TO postgres;

--
-- Name: entity_vessels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.entity_vessels_id_seq OWNED BY public.entity_vessels.id;


--
-- Name: information_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.information_sources (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.information_sources OWNER TO postgres;

--
-- Name: information_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.information_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.information_sources_id_seq OWNER TO postgres;

--
-- Name: information_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.information_sources_id_seq OWNED BY public.information_sources.id;


--
-- Name: name_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.name_types (
    id integer NOT NULL,
    name_type_id integer NOT NULL,
    name character varying(255) NOT NULL,
    record_type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.name_types OWNER TO postgres;

--
-- Name: name_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.name_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.name_types_id_seq OWNER TO postgres;

--
-- Name: name_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.name_types_id_seq OWNED BY public.name_types.id;


--
-- Name: occupations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.occupations (
    code integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.occupations OWNER TO postgres;

--
-- Name: person_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_addresses (
    id integer NOT NULL,
    person_id integer,
    address_line text,
    city character varying(255),
    country_code character varying(20),
    url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_addresses OWNER TO postgres;

--
-- Name: person_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_addresses_id_seq OWNER TO postgres;

--
-- Name: person_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_addresses_id_seq OWNED BY public.person_addresses.id;


--
-- Name: person_birth_places; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_birth_places (
    id integer NOT NULL,
    person_id integer,
    place_name character varying(255),
    country_code character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_birth_places OWNER TO postgres;

--
-- Name: person_birth_places_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_birth_places_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_birth_places_id_seq OWNER TO postgres;

--
-- Name: person_birth_places_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_birth_places_id_seq OWNED BY public.person_birth_places.id;


--
-- Name: person_dates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_dates (
    id integer NOT NULL,
    person_id integer,
    date_type character varying(50),
    date_type_id integer,
    date date,
    day integer,
    month character varying(20),
    year integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_dates OWNER TO postgres;

--
-- Name: person_dates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_dates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_dates_id_seq OWNER TO postgres;

--
-- Name: person_dates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_dates_id_seq OWNED BY public.person_dates.id;


--
-- Name: person_descriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_descriptions (
    id integer NOT NULL,
    person_id integer,
    description1_level integer,
    description1_id integer,
    description2_level integer,
    description2_id integer,
    description3_level integer,
    description3_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_descriptions OWNER TO postgres;

--
-- Name: person_descriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_descriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_descriptions_id_seq OWNER TO postgres;

--
-- Name: person_descriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_descriptions_id_seq OWNED BY public.person_descriptions.id;


--
-- Name: person_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_documents (
    id integer NOT NULL,
    person_id integer,
    document_type character varying(50),
    document_number character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_documents OWNER TO postgres;

--
-- Name: person_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_documents_id_seq OWNER TO postgres;

--
-- Name: person_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_documents_id_seq OWNED BY public.person_documents.id;


--
-- Name: person_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_images (
    id integer NOT NULL,
    person_id integer,
    url text NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_images OWNER TO postgres;

--
-- Name: person_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_images_id_seq OWNER TO postgres;

--
-- Name: person_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_images_id_seq OWNED BY public.person_images.id;


--
-- Name: person_names; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_names (
    id integer NOT NULL,
    person_id integer,
    name_type character varying(50),
    name_type_id integer,
    title_honorific character varying(100),
    maiden_name character varying(255),
    first_name character varying(255),
    middle_name character varying(255),
    surname character varying(255),
    suffix character varying(100),
    single_string_name text,
    original_script_name text,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_names OWNER TO postgres;

--
-- Name: person_names_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_names_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_names_id_seq OWNER TO postgres;

--
-- Name: person_names_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_names_id_seq OWNED BY public.person_names.id;


--
-- Name: person_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_roles (
    id integer NOT NULL,
    person_id integer,
    role_type character varying(50),
    role_type_id integer,
    occupation_code integer,
    title text,
    start_date date,
    end_date date,
    start_day integer,
    start_month character varying(20),
    start_year integer,
    end_day integer,
    end_month character varying(20),
    end_year integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_roles OWNER TO postgres;

--
-- Name: person_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_roles_id_seq OWNER TO postgres;

--
-- Name: person_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_roles_id_seq OWNED BY public.person_roles.id;


--
-- Name: person_sanctions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_sanctions (
    id integer NOT NULL,
    person_id integer,
    reference_code integer,
    start_date date,
    end_date date,
    start_day integer,
    start_month character varying(20),
    start_year integer,
    end_day integer,
    end_month character varying(20),
    end_year integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_sanctions OWNER TO postgres;

--
-- Name: person_sanctions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_sanctions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_sanctions_id_seq OWNER TO postgres;

--
-- Name: person_sanctions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_sanctions_id_seq OWNED BY public.person_sanctions.id;


--
-- Name: person_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.person_sources (
    id integer NOT NULL,
    person_id integer,
    source_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.person_sources OWNER TO postgres;

--
-- Name: person_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.person_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.person_sources_id_seq OWNER TO postgres;

--
-- Name: person_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.person_sources_id_seq OWNED BY public.person_sources.id;


--
-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    id integer NOT NULL,
    action character varying(50),
    date date,
    gender character varying(10),
    active_status character varying(50),
    deceased boolean,
    profile_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.persons OWNER TO postgres;

--
-- Name: public_figure_associations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.public_figure_associations (
    id integer NOT NULL,
    public_figure_id integer,
    associate_id integer NOT NULL,
    associate_type character varying(20) NOT NULL,
    relationship_code integer,
    is_former boolean DEFAULT false,
    start_date date,
    end_date date,
    start_day integer,
    start_month character varying(20),
    start_year integer,
    end_day integer,
    end_month character varying(20),
    end_year integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_associate_type CHECK (((associate_type)::text = ANY ((ARRAY['PERSON'::character varying, 'ENTITY'::character varying])::text[])))
);


ALTER TABLE public.public_figure_associations OWNER TO postgres;

--
-- Name: public_figure_associations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.public_figure_associations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.public_figure_associations_id_seq OWNER TO postgres;

--
-- Name: public_figure_associations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.public_figure_associations_id_seq OWNED BY public.public_figure_associations.id;


--
-- Name: relationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.relationships (
    code integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.relationships OWNER TO postgres;

--
-- Name: role_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_types (
    id integer NOT NULL,
    role_type_id integer NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.role_types OWNER TO postgres;

--
-- Name: role_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_types_id_seq OWNER TO postgres;

--
-- Name: role_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_types_id_seq OWNED BY public.role_types.id;


--
-- Name: sanctions_references; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sanctions_references (
    code integer NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50),
    description2_level integer,
    description2_id integer
);


ALTER TABLE public.sanctions_references OWNER TO postgres;

--
-- Name: special_entity_associations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.special_entity_associations (
    id integer NOT NULL,
    special_entity_id integer,
    associate_id integer NOT NULL,
    associate_type character varying(20) NOT NULL,
    relationship_code integer,
    is_former boolean DEFAULT false,
    start_date date,
    end_date date,
    start_day integer,
    start_month character varying(20),
    start_year integer,
    end_day integer,
    end_month character varying(20),
    end_year integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_associate_type CHECK (((associate_type)::text = ANY ((ARRAY['PERSON'::character varying, 'ENTITY'::character varying])::text[])))
);


ALTER TABLE public.special_entity_associations OWNER TO postgres;

--
-- Name: special_entity_associations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.special_entity_associations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.special_entity_associations_id_seq OWNER TO postgres;

--
-- Name: special_entity_associations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.special_entity_associations_id_seq OWNED BY public.special_entity_associations.id;


--
-- Name: association_details id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.association_details ALTER COLUMN id SET DEFAULT nextval('public.association_details_id_seq'::regclass);


--
-- Name: associations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associations ALTER COLUMN id SET DEFAULT nextval('public.associations_id_seq'::regclass);


--
-- Name: date_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.date_types ALTER COLUMN id SET DEFAULT nextval('public.date_types_id_seq'::regclass);


--
-- Name: entity_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_addresses ALTER COLUMN id SET DEFAULT nextval('public.entity_addresses_id_seq'::regclass);


--
-- Name: entity_dates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_dates ALTER COLUMN id SET DEFAULT nextval('public.entity_dates_id_seq'::regclass);


--
-- Name: entity_descriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_descriptions ALTER COLUMN id SET DEFAULT nextval('public.entity_descriptions_id_seq'::regclass);


--
-- Name: entity_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_images ALTER COLUMN id SET DEFAULT nextval('public.entity_images_id_seq'::regclass);


--
-- Name: entity_names id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_names ALTER COLUMN id SET DEFAULT nextval('public.entity_names_id_seq'::regclass);


--
-- Name: entity_sanctions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sanctions ALTER COLUMN id SET DEFAULT nextval('public.entity_sanctions_id_seq'::regclass);


--
-- Name: entity_sources id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sources ALTER COLUMN id SET DEFAULT nextval('public.entity_sources_id_seq'::regclass);


--
-- Name: entity_vessels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_vessels ALTER COLUMN id SET DEFAULT nextval('public.entity_vessels_id_seq'::regclass);


--
-- Name: information_sources id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.information_sources ALTER COLUMN id SET DEFAULT nextval('public.information_sources_id_seq'::regclass);


--
-- Name: name_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.name_types ALTER COLUMN id SET DEFAULT nextval('public.name_types_id_seq'::regclass);


--
-- Name: person_addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_addresses ALTER COLUMN id SET DEFAULT nextval('public.person_addresses_id_seq'::regclass);


--
-- Name: person_birth_places id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_birth_places ALTER COLUMN id SET DEFAULT nextval('public.person_birth_places_id_seq'::regclass);


--
-- Name: person_dates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_dates ALTER COLUMN id SET DEFAULT nextval('public.person_dates_id_seq'::regclass);


--
-- Name: person_descriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_descriptions ALTER COLUMN id SET DEFAULT nextval('public.person_descriptions_id_seq'::regclass);


--
-- Name: person_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_documents ALTER COLUMN id SET DEFAULT nextval('public.person_documents_id_seq'::regclass);


--
-- Name: person_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_images ALTER COLUMN id SET DEFAULT nextval('public.person_images_id_seq'::regclass);


--
-- Name: person_names id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_names ALTER COLUMN id SET DEFAULT nextval('public.person_names_id_seq'::regclass);


--
-- Name: person_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_roles ALTER COLUMN id SET DEFAULT nextval('public.person_roles_id_seq'::regclass);


--
-- Name: person_sanctions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sanctions ALTER COLUMN id SET DEFAULT nextval('public.person_sanctions_id_seq'::regclass);


--
-- Name: person_sources id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sources ALTER COLUMN id SET DEFAULT nextval('public.person_sources_id_seq'::regclass);


--
-- Name: public_figure_associations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_figure_associations ALTER COLUMN id SET DEFAULT nextval('public.public_figure_associations_id_seq'::regclass);


--
-- Name: role_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_types ALTER COLUMN id SET DEFAULT nextval('public.role_types_id_seq'::regclass);


--
-- Name: special_entity_associations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_entity_associations ALTER COLUMN id SET DEFAULT nextval('public.special_entity_associations_id_seq'::regclass);


--
-- Name: association_details association_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.association_details
    ADD CONSTRAINT association_details_pkey PRIMARY KEY (id);


--
-- Name: association_types association_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.association_types
    ADD CONSTRAINT association_types_pkey PRIMARY KEY (code);


--
-- Name: associations associations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associations
    ADD CONSTRAINT associations_pkey PRIMARY KEY (id);


--
-- Name: associations associations_source_id_source_type_target_id_target_type_re_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associations
    ADD CONSTRAINT associations_source_id_source_type_target_id_target_type_re_key UNIQUE (source_id, source_type, target_id, target_type, relationship_code);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (code);


--
-- Name: date_types date_types_date_type_id_record_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.date_types
    ADD CONSTRAINT date_types_date_type_id_record_type_key UNIQUE (date_type_id, record_type);


--
-- Name: date_types date_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.date_types
    ADD CONSTRAINT date_types_pkey PRIMARY KEY (id);


--
-- Name: description_types description_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.description_types
    ADD CONSTRAINT description_types_pkey PRIMARY KEY (level, id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (id);


--
-- Name: entity_addresses entity_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_addresses
    ADD CONSTRAINT entity_addresses_pkey PRIMARY KEY (id);


--
-- Name: entity_dates entity_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_dates
    ADD CONSTRAINT entity_dates_pkey PRIMARY KEY (id);


--
-- Name: entity_descriptions entity_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_descriptions
    ADD CONSTRAINT entity_descriptions_pkey PRIMARY KEY (id);


--
-- Name: entity_images entity_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_images
    ADD CONSTRAINT entity_images_pkey PRIMARY KEY (id);


--
-- Name: entity_names entity_names_entity_id_name_type_is_primary_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_names
    ADD CONSTRAINT entity_names_entity_id_name_type_is_primary_key UNIQUE (entity_id, name_type, is_primary);


--
-- Name: entity_names entity_names_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_names
    ADD CONSTRAINT entity_names_pkey PRIMARY KEY (id);


--
-- Name: entity_sanctions entity_sanctions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sanctions
    ADD CONSTRAINT entity_sanctions_pkey PRIMARY KEY (id);


--
-- Name: entity_sources entity_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sources
    ADD CONSTRAINT entity_sources_pkey PRIMARY KEY (id);


--
-- Name: entity_vessels entity_vessels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_vessels
    ADD CONSTRAINT entity_vessels_pkey PRIMARY KEY (id);


--
-- Name: information_sources information_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.information_sources
    ADD CONSTRAINT information_sources_pkey PRIMARY KEY (id);


--
-- Name: name_types name_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.name_types
    ADD CONSTRAINT name_types_pkey PRIMARY KEY (id);


--
-- Name: occupations occupations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.occupations
    ADD CONSTRAINT occupations_pkey PRIMARY KEY (code);


--
-- Name: person_addresses person_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_addresses
    ADD CONSTRAINT person_addresses_pkey PRIMARY KEY (id);


--
-- Name: person_birth_places person_birth_places_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_birth_places
    ADD CONSTRAINT person_birth_places_pkey PRIMARY KEY (id);


--
-- Name: person_dates person_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_dates
    ADD CONSTRAINT person_dates_pkey PRIMARY KEY (id);


--
-- Name: person_descriptions person_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_descriptions
    ADD CONSTRAINT person_descriptions_pkey PRIMARY KEY (id);


--
-- Name: person_documents person_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_documents
    ADD CONSTRAINT person_documents_pkey PRIMARY KEY (id);


--
-- Name: person_images person_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_images
    ADD CONSTRAINT person_images_pkey PRIMARY KEY (id);


--
-- Name: person_names person_names_person_id_name_type_is_primary_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_names
    ADD CONSTRAINT person_names_person_id_name_type_is_primary_key UNIQUE (person_id, name_type, is_primary);


--
-- Name: person_names person_names_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_names
    ADD CONSTRAINT person_names_pkey PRIMARY KEY (id);


--
-- Name: person_roles person_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_roles
    ADD CONSTRAINT person_roles_pkey PRIMARY KEY (id);


--
-- Name: person_sanctions person_sanctions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sanctions
    ADD CONSTRAINT person_sanctions_pkey PRIMARY KEY (id);


--
-- Name: person_sources person_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sources
    ADD CONSTRAINT person_sources_pkey PRIMARY KEY (id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: public_figure_associations public_figure_associations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_figure_associations
    ADD CONSTRAINT public_figure_associations_pkey PRIMARY KEY (id);


--
-- Name: public_figure_associations public_figure_associations_public_figure_id_associate_id_as_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_figure_associations
    ADD CONSTRAINT public_figure_associations_public_figure_id_associate_id_as_key UNIQUE (public_figure_id, associate_id, associate_type, relationship_code);


--
-- Name: relationships relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_pkey PRIMARY KEY (code);


--
-- Name: role_types role_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_types
    ADD CONSTRAINT role_types_pkey PRIMARY KEY (id);


--
-- Name: role_types role_types_role_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_types
    ADD CONSTRAINT role_types_role_type_id_key UNIQUE (role_type_id);


--
-- Name: sanctions_references sanctions_references_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sanctions_references
    ADD CONSTRAINT sanctions_references_pkey PRIMARY KEY (code);


--
-- Name: special_entity_associations special_entity_associations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_entity_associations
    ADD CONSTRAINT special_entity_associations_pkey PRIMARY KEY (id);


--
-- Name: special_entity_associations special_entity_associations_special_entity_id_associate_id__key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_entity_associations
    ADD CONSTRAINT special_entity_associations_special_entity_id_associate_id__key UNIQUE (special_entity_id, associate_id, associate_type, relationship_code);


--
-- Name: idx_associations_composite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_associations_composite ON public.associations USING btree (source_id, target_id, relationship_code);


--
-- Name: idx_associations_relationship; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_associations_relationship ON public.associations USING btree (relationship_code);


--
-- Name: idx_associations_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_associations_source ON public.associations USING btree (source_id, source_type);


--
-- Name: idx_associations_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_associations_target ON public.associations USING btree (target_id, target_type);


--
-- Name: idx_entities_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entities_action ON public.entities USING btree (action);


--
-- Name: idx_entities_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entities_date ON public.entities USING btree (date);


--
-- Name: idx_entities_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entities_type ON public.entities USING btree (entity_type);


--
-- Name: idx_entity_dates_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_dates_date ON public.entity_dates USING btree (date);


--
-- Name: idx_entity_dates_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_dates_entity ON public.entity_dates USING btree (entity_id);


--
-- Name: idx_entity_dates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_dates_type ON public.entity_dates USING btree (date_type);


--
-- Name: idx_entity_images_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_images_entity ON public.entity_images USING btree (entity_id);


--
-- Name: idx_entity_names_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_names_entity ON public.entity_names USING btree (entity_id);


--
-- Name: idx_entity_names_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_names_search ON public.entity_names USING btree (entity_name);


--
-- Name: idx_entity_names_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_names_type ON public.entity_names USING btree (name_type);


--
-- Name: idx_entity_sanctions_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_sanctions_entity ON public.entity_sanctions USING btree (entity_id);


--
-- Name: idx_entity_sanctions_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_sanctions_reference ON public.entity_sanctions USING btree (reference_code);


--
-- Name: idx_person_dates_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_dates_date ON public.person_dates USING btree (date);


--
-- Name: idx_person_dates_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_dates_person ON public.person_dates USING btree (person_id);


--
-- Name: idx_person_dates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_dates_type ON public.person_dates USING btree (date_type);


--
-- Name: idx_person_images_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_images_person ON public.person_images USING btree (person_id);


--
-- Name: idx_person_names_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_names_person ON public.person_names USING btree (person_id);


--
-- Name: idx_person_names_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_names_search ON public.person_names USING btree (first_name, surname);


--
-- Name: idx_person_names_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_names_type ON public.person_names USING btree (name_type);


--
-- Name: idx_person_roles_occupation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_roles_occupation ON public.person_roles USING btree (occupation_code);


--
-- Name: idx_person_roles_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_roles_person ON public.person_roles USING btree (person_id);


--
-- Name: idx_person_sanctions_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_sanctions_person ON public.person_sanctions USING btree (person_id);


--
-- Name: idx_person_sanctions_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_person_sanctions_reference ON public.person_sanctions USING btree (reference_code);


--
-- Name: idx_persons_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_action ON public.persons USING btree (action);


--
-- Name: idx_persons_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_date ON public.persons USING btree (date);


--
-- Name: idx_persons_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_status ON public.persons USING btree (active_status);


--
-- Name: idx_public_figure_assoc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_public_figure_assoc ON public.public_figure_associations USING btree (public_figure_id);


--
-- Name: idx_public_figure_associate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_public_figure_associate ON public.public_figure_associations USING btree (associate_id, associate_type);


--
-- Name: idx_special_entity_assoc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_special_entity_assoc ON public.special_entity_associations USING btree (special_entity_id);


--
-- Name: idx_special_entity_associate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_special_entity_associate ON public.special_entity_associations USING btree (associate_id, associate_type);


--
-- Name: associations check_association_references; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_association_references BEFORE INSERT OR UPDATE ON public.associations FOR EACH ROW EXECUTE FUNCTION public.validate_association_references();


--
-- Name: public_figure_associations check_public_figure_association_references; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_public_figure_association_references BEFORE INSERT OR UPDATE ON public.public_figure_associations FOR EACH ROW EXECUTE FUNCTION public.validate_public_figure_association_references();


--
-- Name: special_entity_associations check_special_entity_association_references; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_special_entity_association_references BEFORE INSERT OR UPDATE ON public.special_entity_associations FOR EACH ROW EXECUTE FUNCTION public.validate_special_entity_association_references();


--
-- Name: association_details association_details_association_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.association_details
    ADD CONSTRAINT association_details_association_id_fkey FOREIGN KEY (association_id) REFERENCES public.associations(id) ON DELETE CASCADE;


--
-- Name: associations associations_relationship_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associations
    ADD CONSTRAINT associations_relationship_code_fkey FOREIGN KEY (relationship_code) REFERENCES public.relationships(code);


--
-- Name: description_types description_types_parent_level_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.description_types
    ADD CONSTRAINT description_types_parent_level_parent_id_fkey FOREIGN KEY (parent_level, parent_id) REFERENCES public.description_types(level, id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: entity_addresses entity_addresses_country_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_addresses
    ADD CONSTRAINT entity_addresses_country_code_fkey FOREIGN KEY (country_code) REFERENCES public.countries(code);


--
-- Name: entity_addresses entity_addresses_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_addresses
    ADD CONSTRAINT entity_addresses_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_dates entity_dates_date_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_dates
    ADD CONSTRAINT entity_dates_date_type_id_fkey FOREIGN KEY (date_type_id) REFERENCES public.date_types(id);


--
-- Name: entity_dates entity_dates_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_dates
    ADD CONSTRAINT entity_dates_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_descriptions entity_descriptions_description1_level_description1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_descriptions
    ADD CONSTRAINT entity_descriptions_description1_level_description1_id_fkey FOREIGN KEY (description1_level, description1_id) REFERENCES public.description_types(level, id);


--
-- Name: entity_descriptions entity_descriptions_description2_level_description2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_descriptions
    ADD CONSTRAINT entity_descriptions_description2_level_description2_id_fkey FOREIGN KEY (description2_level, description2_id) REFERENCES public.description_types(level, id);


--
-- Name: entity_descriptions entity_descriptions_description3_level_description3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_descriptions
    ADD CONSTRAINT entity_descriptions_description3_level_description3_id_fkey FOREIGN KEY (description3_level, description3_id) REFERENCES public.description_types(level, id);


--
-- Name: entity_descriptions entity_descriptions_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_descriptions
    ADD CONSTRAINT entity_descriptions_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_images entity_images_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_images
    ADD CONSTRAINT entity_images_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_names entity_names_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_names
    ADD CONSTRAINT entity_names_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_names entity_names_name_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_names
    ADD CONSTRAINT entity_names_name_type_id_fkey FOREIGN KEY (name_type_id) REFERENCES public.name_types(id);


--
-- Name: entity_sanctions entity_sanctions_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sanctions
    ADD CONSTRAINT entity_sanctions_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_sanctions entity_sanctions_reference_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sanctions
    ADD CONSTRAINT entity_sanctions_reference_code_fkey FOREIGN KEY (reference_code) REFERENCES public.sanctions_references(code);


--
-- Name: entity_sources entity_sources_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sources
    ADD CONSTRAINT entity_sources_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: entity_sources entity_sources_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_sources
    ADD CONSTRAINT entity_sources_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.information_sources(id);


--
-- Name: entity_vessels entity_vessels_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_vessels
    ADD CONSTRAINT entity_vessels_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: person_addresses person_addresses_country_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_addresses
    ADD CONSTRAINT person_addresses_country_code_fkey FOREIGN KEY (country_code) REFERENCES public.countries(code);


--
-- Name: person_addresses person_addresses_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_addresses
    ADD CONSTRAINT person_addresses_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_birth_places person_birth_places_country_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_birth_places
    ADD CONSTRAINT person_birth_places_country_code_fkey FOREIGN KEY (country_code) REFERENCES public.countries(code);


--
-- Name: person_birth_places person_birth_places_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_birth_places
    ADD CONSTRAINT person_birth_places_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_dates person_dates_date_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_dates
    ADD CONSTRAINT person_dates_date_type_id_fkey FOREIGN KEY (date_type_id) REFERENCES public.date_types(id);


--
-- Name: person_dates person_dates_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_dates
    ADD CONSTRAINT person_dates_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_descriptions person_descriptions_description1_level_description1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_descriptions
    ADD CONSTRAINT person_descriptions_description1_level_description1_id_fkey FOREIGN KEY (description1_level, description1_id) REFERENCES public.description_types(level, id);


--
-- Name: person_descriptions person_descriptions_description2_level_description2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_descriptions
    ADD CONSTRAINT person_descriptions_description2_level_description2_id_fkey FOREIGN KEY (description2_level, description2_id) REFERENCES public.description_types(level, id);


--
-- Name: person_descriptions person_descriptions_description3_level_description3_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_descriptions
    ADD CONSTRAINT person_descriptions_description3_level_description3_id_fkey FOREIGN KEY (description3_level, description3_id) REFERENCES public.description_types(level, id);


--
-- Name: person_descriptions person_descriptions_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_descriptions
    ADD CONSTRAINT person_descriptions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_documents person_documents_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_documents
    ADD CONSTRAINT person_documents_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_images person_images_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_images
    ADD CONSTRAINT person_images_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_names person_names_name_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_names
    ADD CONSTRAINT person_names_name_type_id_fkey FOREIGN KEY (name_type_id) REFERENCES public.name_types(id);


--
-- Name: person_names person_names_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_names
    ADD CONSTRAINT person_names_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_roles person_roles_occupation_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_roles
    ADD CONSTRAINT person_roles_occupation_code_fkey FOREIGN KEY (occupation_code) REFERENCES public.occupations(code);


--
-- Name: person_roles person_roles_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_roles
    ADD CONSTRAINT person_roles_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_roles person_roles_role_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_roles
    ADD CONSTRAINT person_roles_role_type_id_fkey FOREIGN KEY (role_type_id) REFERENCES public.role_types(id);


--
-- Name: person_sanctions person_sanctions_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sanctions
    ADD CONSTRAINT person_sanctions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_sanctions person_sanctions_reference_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sanctions
    ADD CONSTRAINT person_sanctions_reference_code_fkey FOREIGN KEY (reference_code) REFERENCES public.sanctions_references(code);


--
-- Name: person_sources person_sources_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sources
    ADD CONSTRAINT person_sources_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: person_sources person_sources_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.person_sources
    ADD CONSTRAINT person_sources_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.information_sources(id);


--
-- Name: public_figure_associations public_figure_associations_public_figure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_figure_associations
    ADD CONSTRAINT public_figure_associations_public_figure_id_fkey FOREIGN KEY (public_figure_id) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- Name: public_figure_associations public_figure_associations_relationship_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_figure_associations
    ADD CONSTRAINT public_figure_associations_relationship_code_fkey FOREIGN KEY (relationship_code) REFERENCES public.relationships(code);


--
-- Name: sanctions_references sanctions_references_description2_level_description2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sanctions_references
    ADD CONSTRAINT sanctions_references_description2_level_description2_id_fkey FOREIGN KEY (description2_level, description2_id) REFERENCES public.description_types(level, id);


--
-- Name: special_entity_associations special_entity_associations_relationship_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_entity_associations
    ADD CONSTRAINT special_entity_associations_relationship_code_fkey FOREIGN KEY (relationship_code) REFERENCES public.relationships(code);


--
-- Name: special_entity_associations special_entity_associations_special_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.special_entity_associations
    ADD CONSTRAINT special_entity_associations_special_entity_id_fkey FOREIGN KEY (special_entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: TABLE association_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.association_details TO pfa_user;


--
-- Name: SEQUENCE association_details_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.association_details_id_seq TO pfa_user;


--
-- Name: TABLE association_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.association_types TO pfa_user;


--
-- Name: TABLE associations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.associations TO pfa_user;


--
-- Name: SEQUENCE associations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.associations_id_seq TO pfa_user;


--
-- Name: TABLE countries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.countries TO pfa_user;


--
-- Name: TABLE date_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.date_types TO pfa_user;


--
-- Name: SEQUENCE date_types_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.date_types_id_seq TO pfa_user;


--
-- Name: TABLE description_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.description_types TO pfa_user;


--
-- Name: TABLE entities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entities TO pfa_user;


--
-- Name: TABLE entity_addresses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_addresses TO pfa_user;


--
-- Name: SEQUENCE entity_addresses_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_addresses_id_seq TO pfa_user;


--
-- Name: TABLE entity_dates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_dates TO pfa_user;


--
-- Name: SEQUENCE entity_dates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_dates_id_seq TO pfa_user;


--
-- Name: TABLE entity_descriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_descriptions TO pfa_user;


--
-- Name: SEQUENCE entity_descriptions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_descriptions_id_seq TO pfa_user;


--
-- Name: TABLE entity_images; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_images TO pfa_user;


--
-- Name: SEQUENCE entity_images_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_images_id_seq TO pfa_user;


--
-- Name: TABLE entity_names; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_names TO pfa_user;


--
-- Name: SEQUENCE entity_names_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_names_id_seq TO pfa_user;


--
-- Name: TABLE entity_sanctions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_sanctions TO pfa_user;


--
-- Name: SEQUENCE entity_sanctions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_sanctions_id_seq TO pfa_user;


--
-- Name: TABLE entity_sources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_sources TO pfa_user;


--
-- Name: SEQUENCE entity_sources_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_sources_id_seq TO pfa_user;


--
-- Name: TABLE entity_vessels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.entity_vessels TO pfa_user;


--
-- Name: SEQUENCE entity_vessels_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.entity_vessels_id_seq TO pfa_user;


--
-- Name: TABLE information_sources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.information_sources TO pfa_user;


--
-- Name: SEQUENCE information_sources_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.information_sources_id_seq TO pfa_user;


--
-- Name: TABLE name_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.name_types TO pfa_user;


--
-- Name: SEQUENCE name_types_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.name_types_id_seq TO pfa_user;


--
-- Name: TABLE occupations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.occupations TO pfa_user;


--
-- Name: TABLE person_addresses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_addresses TO pfa_user;


--
-- Name: SEQUENCE person_addresses_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_addresses_id_seq TO pfa_user;


--
-- Name: TABLE person_birth_places; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_birth_places TO pfa_user;


--
-- Name: SEQUENCE person_birth_places_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_birth_places_id_seq TO pfa_user;


--
-- Name: TABLE person_dates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_dates TO pfa_user;


--
-- Name: SEQUENCE person_dates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_dates_id_seq TO pfa_user;


--
-- Name: TABLE person_descriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_descriptions TO pfa_user;


--
-- Name: SEQUENCE person_descriptions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_descriptions_id_seq TO pfa_user;


--
-- Name: TABLE person_documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_documents TO pfa_user;


--
-- Name: SEQUENCE person_documents_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_documents_id_seq TO pfa_user;


--
-- Name: TABLE person_images; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_images TO pfa_user;


--
-- Name: SEQUENCE person_images_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_images_id_seq TO pfa_user;


--
-- Name: TABLE person_names; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_names TO pfa_user;


--
-- Name: SEQUENCE person_names_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_names_id_seq TO pfa_user;


--
-- Name: TABLE person_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_roles TO pfa_user;


--
-- Name: SEQUENCE person_roles_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_roles_id_seq TO pfa_user;


--
-- Name: TABLE person_sanctions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_sanctions TO pfa_user;


--
-- Name: SEQUENCE person_sanctions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_sanctions_id_seq TO pfa_user;


--
-- Name: TABLE person_sources; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.person_sources TO pfa_user;


--
-- Name: SEQUENCE person_sources_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.person_sources_id_seq TO pfa_user;


--
-- Name: TABLE persons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.persons TO pfa_user;


--
-- Name: TABLE public_figure_associations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.public_figure_associations TO pfa_user;


--
-- Name: SEQUENCE public_figure_associations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.public_figure_associations_id_seq TO pfa_user;


--
-- Name: TABLE relationships; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.relationships TO pfa_user;


--
-- Name: TABLE role_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.role_types TO pfa_user;


--
-- Name: SEQUENCE role_types_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.role_types_id_seq TO pfa_user;


--
-- Name: TABLE sanctions_references; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sanctions_references TO pfa_user;


--
-- Name: TABLE special_entity_associations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.special_entity_associations TO pfa_user;


--
-- Name: SEQUENCE special_entity_associations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.special_entity_associations_id_seq TO pfa_user;


--
-- PostgreSQL database dump complete
--

