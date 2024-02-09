-- Create table relations
DROP TABLE IF EXISTS relations CASCADE;
CREATE TABLE relations (
    page_id         integer primary key,
    page_title      varchar(255),
    reference_count integer,
    children_count  integer,
    refs            integer[],
    children        integer[]
);

-- Fill relations table
DELETE FROM relations;
INSERT INTO relations
SELECT
    sub2.page_id, sub2.page_title, sub2.reference_count, array_length(sub2.children, 1), sub2.refs, sub2.children
FROM
    (SELECT
         sub1.page_id, sub1.page_title, sub1.reference_count, array_remove(array_remove(array_remove(array_remove(array_remove(CAST(pl.page_children AS integer[]), 14919), 422994), 23538754), 234930), 37575710) AS children, sub1.refs -- 14919: ISBN, 48361: Geographic_coordinate_system, 422994: Digital_object_identifier, 23538754: Wayback_machine, 35412202: Wikidata, 234930: ISSN, 37575710: H:S
     FROM
         (SELECT
              p.page_id, p.page_title, COUNT(p.page_id) AS reference_count, array_agg(allReferences.parent_id) AS refs
          FROM
              (SELECT
                  CAST(unnest(pl.page_children) AS integer) AS children_id, pl.page_id AS parent_id
               FROM
                  pagelinks pl
               WHERE
                  array_length(pl.page_children, 1) >= 20) allReferences
          JOIN
              pages p ON allReferences.children_id = p.page_id
          GROUP BY
              p.page_id) sub1
     JOIN
         pagelinks pl ON pl.page_id = sub1.page_id) sub2
;

DROP TABLE IF EXISTS query_result_2 CASCADE;
CREATE TABLE query_result_2 (
    from_title      varchar(255),
    from_id         integer,
    to_title        text[],
    to_id           integer[],
    reference_count integer[]
);

DROP FUNCTION bfsQueryWithRelations;

CREATE OR REPLACE FUNCTION bfsQueryWithRelations(articleNames text, maxDepth integer) RETURNS SETOF query_result_2 AS $$
    WITH RECURSIVE RecursivePageCTE AS (
        SELECT
            re.page_id AS from_id,
            unnest(re.children) AS to_id,
            1 AS depth
        FROM
            public.relations re
        WHERE
            re.page_title IN (SELECT unnest(string_to_array(articleNames, ',')))
        UNION ALL
        SELECT
            re.page_id AS from_id,
            unnest(re.children) AS to_id,
            r.depth + 1
        FROM
            public.relations re
        JOIN
            RecursivePageCTE r ON r.to_id = re.page_id
        WHERE
            r.depth < maxDepth
    )

    SELECT inside.from_title AS from_title, inside.from_id AS from_id, array_agg(inside.to_title) AS children_title, array_agg(inside.to_id) AS children_id, array_agg(inside.reference_count)
    FROM (SELECT re.page_title AS from_title, idpairs.from_id AS from_id, re2.page_title AS to_title, idpairs.to_id AS to_id, re2.reference_count
        FROM
            (select from_id, to_id from RecursivePageCTE) idpairs
        JOIN
            public.relations re ON re.page_id = idpairs.from_id
        JOIN
            public.relations re2 ON re2.page_id = idpairs.to_id) inside
    GROUP BY inside.from_title, inside.from_id

$$ LANGUAGE sql;

DROP FUNCTION querywithshared(articlenames text);
CREATE OR REPLACE FUNCTION queryWithShared(articleNames text) RETURNS SETOF QueryResult AS $$
    SELECT
        from_table.from_title, from_table.from_id, array_agg(sub.to_title) AS to_title, array_agg(sub.to_id) AS to_id, array_agg(sub.reference_count) AS reference_count
    FROM
        (SELECT rel.page_title AS to_title, s.to_id AS to_id, rel.reference_count AS reference_count
        FROM
            (SELECT rel.page_title AS from_title, rel.page_id AS from_id, unnest(rel.children) AS to_id
            FROM
                unnest(string_to_array(articleNames, ',')) from_title
            JOIN
                relations rel ON rel.page_title = from_title) s
        JOIN
            public.relations rel ON s.to_id = rel.page_id
        GROUP BY
            s.to_id, rel.page_title, rel.reference_count
        HAVING
            COUNT(s.to_id) >= array_length(string_to_array(articleNames, ','), 1)) sub
    CROSS JOIN
        (SELECT rel.page_title AS from_title, rel.page_id AS from_id FROM unnest(string_to_array(articleNames, ',')) from_title JOIN relations rel ON rel.page_title = from_title) from_table
    GROUP BY
        from_table.from_title, from_table.from_id


$$ LANGUAGE sql;

select * from bfsQueryWithRelations('Audi,Germany,Spain,Budapest,BMW', 2);

select * from querywithshared('Argentina,Lionel_Messi,Germany');

select * from relations where page_title IN ('ISBN','ISSN');

DROP TABLE IF EXISTS title_matching_result CASCADE;
CREATE TABLE title_matching_result (
    page_id         integer primary key,
    page_title      varchar(255)
);



DROP FUNCTION IF EXISTS titleMatching(userInput text);
CREATE OR REPLACE FUNCTION titleMatching(userInput text) RETURNS SETOF title_matching_result AS $$
    SELECT page_id, page_title FROM pages where lower(pages.page_title) like replace(lower(userInput), ' ', '_') || '%' order by length(page_title) limit 10;
$$ LANGUAGE sql;





CREATE INDEX idx_title ON relations (page_title);

SELECT * FROM titleMatching('polan');

SELECT * FROM titleMatching('gypt');
