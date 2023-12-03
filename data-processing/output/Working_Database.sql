--
-- PostgreSQL database cluster dump
--

-- Started on 2023-12-03 17:18:43

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:Y6qwULQp1zUdWCydsrmNow==$jnEOwFse+9cTmVpYyuKXmlUzsUWeU1jP5C8y/E+iD4o=:ZdgdArpQYP/PKkaBORX392VH+vep/1y006SVqpY1nHo=';

--
-- User Configurations
--








--
-- Databases
--

--
-- Database "template1" dump
--

\connect template1

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.1
-- Dumped by pg_dump version 16.1

-- Started on 2023-12-03 17:18:43

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Completed on 2023-12-03 17:18:43

--
-- PostgreSQL database dump complete
--

--
-- Database "postgres" dump
--

\connect postgres

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.1
-- Dumped by pg_dump version 16.1

-- Started on 2023-12-03 17:18:44

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 7 (class 2615 OID 16397)
-- Name: Grafipedia; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA "Grafipedia";


ALTER SCHEMA "Grafipedia" OWNER TO postgres;

--
-- TOC entry 2 (class 3079 OID 16384)
-- Name: adminpack; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS adminpack WITH SCHEMA pg_catalog;


--
-- TOC entry 4849 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION adminpack; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION adminpack IS 'administrative functions for PostgreSQL';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 683247)
-- Name: pagelinks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagelinks (
    page_id integer NOT NULL,
    page_title character varying(255),
    page_children text[]
);


ALTER TABLE public.pagelinks OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 683255)
-- Name: pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pages (
    page_id numeric NOT NULL,
    page_title character varying(255) NOT NULL,
    children_count numeric DEFAULT 0
);


ALTER TABLE public.pages OWNER TO postgres;

--
-- TOC entry 4695 (class 2606 OID 683254)
-- Name: pagelinks Pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagelinks
    ADD CONSTRAINT "Pages_pkey" PRIMARY KEY (page_id);


--
-- TOC entry 4698 (class 2606 OID 683269)
-- Name: pages Pages_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT "Pages_pkey1" PRIMARY KEY (page_id);


--
-- TOC entry 4696 (class 1259 OID 1181323)
-- Name: idx_pagelinks_page_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagelinks_page_id ON public.pagelinks USING btree (page_id);


--
-- TOC entry 4699 (class 1259 OID 1181324)
-- Name: idx_pages_page_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pages_page_id ON public.pages USING btree (page_id);


--
-- TOC entry 4700 (class 2606 OID 683270)
-- Name: pagelinks page_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagelinks
    ADD CONSTRAINT page_id FOREIGN KEY (page_id) REFERENCES public.pages(page_id) NOT VALID;


-- Completed on 2023-12-03 17:18:44

--
-- PostgreSQL database dump complete
--

-- Completed on 2023-12-03 17:18:44

--
-- PostgreSQL database cluster dump complete
--

