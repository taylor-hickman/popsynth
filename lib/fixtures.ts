import type { GenerationPlan, SchemaIR } from "popsynth/core";

/**
 * Phase 1 (vertical slice) fixtures. PLAN.md "Build order" step 1 says: hardcoded
 * schema, hardcoded theme, CSV-only, no streaming. Phase 2 replaces the schema
 * with a parser; phase 3 replaces the plan with the real mapping agent.
 */

export const DEMO_SCHEMA: SchemaIR = {
  tables: [
    {
      name: "users",
      columns: [
        { name: "id", type: "uuid", nullable: false, isPrimaryKey: true, isUnique: true, enumValues: null },
        { name: "email", type: "text", nullable: false, isPrimaryKey: false, isUnique: true, enumValues: null },
        { name: "full_name", type: "text", nullable: false, isPrimaryKey: false, isUnique: false, enumValues: null },
        { name: "created_at", type: "timestamp", nullable: false, isPrimaryKey: false, isUnique: false, enumValues: null },
      ],
      foreignKeys: [],
    },
    {
      name: "posts",
      columns: [
        { name: "id", type: "uuid", nullable: false, isPrimaryKey: true, isUnique: true, enumValues: null },
        { name: "user_id", type: "uuid", nullable: false, isPrimaryKey: false, isUnique: false, enumValues: null },
        { name: "title", type: "text", nullable: false, isPrimaryKey: false, isUnique: false, enumValues: null },
        { name: "body", type: "text", nullable: false, isPrimaryKey: false, isUnique: false, enumValues: null },
        { name: "published_at", type: "timestamp", nullable: true, isPrimaryKey: false, isUnique: false, enumValues: null },
      ],
      foreignKeys: [
        { column: "user_id", refTable: "users", refColumn: "id" },
      ],
    },
  ],
};

export const DEMO_SCHEMA_DDL = `CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE posts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMP
);
`;

export const DEMO_THEME = "Breaking Bad";

export const DEMO_PLAN: GenerationPlan = {
  theme: DEMO_THEME,
  themeInterpretation:
    "Late-2000s Albuquerque with dry, coded references to chemistry, RV labs, DEA heat, fast food fronts, and desert pressure.",
  entityPools: {
    characters: [
      "Walter White",
      "Jesse Pinkman",
      "Skyler White",
      "Hank Schrader",
      "Marie Schrader",
      "Saul Goodman",
      "Gustavo Fring",
      "Mike Ehrmantraut",
      "Tuco Salamanca",
      "Hector Salamanca",
    ],
  },
  tables: [
    {
      name: "users",
      rowCount: 6,
      thematicRole: "Core characters of the Breaking Bad universe and the email aliases they would use.",
      constraints: [
        "email local-part is derived from the character's name in lowercase, e.g., 'walter.white@...' or 'heisenberg@...'",
      ],
      columnMappings: [
        {
          column: "id",
          semanticType: "uuid",
          thematicHint: "A standard v4 UUID.",
          examples: ["a3f1c4b2-8e7d-4f1a-9c2b-1e5d3a7b9c10", "b4e2d5c3-9f8e-5a2b-ad3c-2f6e4b8cad21"],
          referencesPool: null,
        },
        {
          column: "email",
          semanticType: "email",
          thematicHint: "Email derived from character names with believable local or front-business domains.",
          examples: ["heisenberg@gmail.com", "captaincook@yo.net"],
          referencesPool: "characters",
        },
        {
          column: "full_name",
          semanticType: "person_full_name",
          thematicHint: "The character's full name exactly as it appears in the show.",
          examples: ["Walter White", "Jesse Pinkman"],
          referencesPool: "characters",
        },
        {
          column: "created_at",
          semanticType: "datetime",
          thematicHint: "ISO 8601 timestamps from 2008 to 2010, in the Mountain Time zone.",
          examples: ["2008-09-20T14:30:00-06:00", "2009-03-15T09:12:00-06:00"],
          referencesPool: null,
        },
      ],
    },
    {
      name: "posts",
      rowCount: 12,
      thematicRole: "Coded messages, recipe notes, and warnings the characters might leave on an internal forum.",
      constraints: [],
      columnMappings: [
        {
          column: "id",
          semanticType: "uuid",
          thematicHint: "A standard v4 UUID.",
          examples: ["c5d3e6f4-ae9f-6b3c-be4d-3a7f5c9dbe32", "d6e4f7a5-bfa0-7c4d-cf5e-4b8a6dadcf43"],
          referencesPool: null,
        },
        {
          column: "user_id",
          semanticType: "foreign_key",
          thematicHint: "The id of the character (from users) who wrote the post.",
          examples: [
            "a3f1c4b2-8e7d-4f1a-9c2b-1e5d3a7b9c10",
            "b4e2d5c3-9f8e-5a2b-ad3c-2f6e4b8cad21",
          ],
          referencesPool: "characters",
        },
        {
          column: "title",
          semanticType: "title",
          thematicHint: "Short, ominous post titles in the voice of the writer. Reference chemistry, the trade, or coded language.",
          examples: ["Tread lightly.", "97.2% purity tonight"],
          referencesPool: null,
        },
        {
          column: "body",
          semanticType: "long_text",
          thematicHint: "Concise internal posts with veiled chemistry, family, or desert-route references.",
          examples: [
            "Cook is on for Tuesday. Bring the methylamine. Tell Skyler I'll be late again.",
            "Yo, this batch is straight fire. Best we've had since Tuco days.",
          ],
          referencesPool: null,
        },
        {
          column: "published_at",
          semanticType: "datetime",
          thematicHint: "ISO 8601 timestamps in 2009-2010, Mountain Time. May be null for unpublished drafts.",
          examples: ["2009-08-11T22:45:00-06:00", "2010-01-04T03:12:00-07:00"],
          referencesPool: null,
        },
      ],
    },
  ],
  generationOrder: ["users", "posts"],
};
