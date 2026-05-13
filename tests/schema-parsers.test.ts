import { describe, expect, it } from "vitest";
import { parseDbtYaml } from "@/lib/schema-parsers/dbt";
import { parseJsonSchema } from "@/lib/schema-parsers/json-schema";
import { parseSqlDdl, SqlParseError } from "@/lib/schema-parsers/sql";

describe("SQL schema parser", () => {
  it("accepts CREATE TABLE DDL with keys, uniqueness, foreign keys, and enum checks", () => {
    const schema = parseSqlDdl(`
      CREATE TABLE users (
        id integer PRIMARY KEY,
        email varchar(254) UNIQUE NOT NULL,
        status text NOT NULL,
        CONSTRAINT users_status_check CHECK (status IN ('active', 'paused'))
      );

      CREATE TABLE posts (
        id integer PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        title text NOT NULL
      );
    `);

    expect(schema.tables).toHaveLength(2);

    const users = schema.tables.find((table) => table.name === "users");
    expect(users).toBeDefined();
    expect(users?.columns.find((column) => column.name === "id")).toMatchObject({
      isPrimaryKey: true,
      isUnique: true,
      nullable: false,
    });
    expect(
      users?.columns.find((column) => column.name === "email"),
    ).toMatchObject({
      type: "varchar(254)",
      isUnique: true,
      nullable: false,
    });
    expect(users?.columns.find((column) => column.name === "status")).toMatchObject({
      enumValues: ["active", "paused"],
    });

    const posts = schema.tables.find((table) => table.name === "posts");
    expect(posts?.foreignKeys).toEqual([
      { column: "user_id", refTable: "users", refColumn: "id" },
    ]);
  });

  it("rejects non-CREATE TABLE SQL", () => {
    expect(() => parseSqlDdl("DROP TABLE users;")).toThrow(SqlParseError);
  });

  it("rejects unsupported identifiers", () => {
    expect(() => parseSqlDdl('CREATE TABLE "bad-name" (id integer);')).toThrow(
      SqlParseError,
    );
  });
});

describe("JSON Schema parser", () => {
  it("maps object properties, required fields, formats, enums, and defs", () => {
    const schema = parseJsonSchema(
      JSON.stringify({
        title: "User",
        type: "object",
        required: ["id", "email"],
        properties: {
          id: { type: "integer" },
          email: { type: "string", format: "email" },
          created_at: { type: ["string", "null"], format: "date-time" },
          role: { enum: ["admin", "member"] },
        },
        $defs: {
          Team: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string", format: "uuid" },
              homepage_url: { type: "string", format: "uri" },
            },
          },
        },
      }),
    );

    expect(schema.tables.map((table) => table.name)).toEqual(["user", "team"]);
    const user = schema.tables[0];
    expect(user.columns.find((column) => column.name === "id")).toMatchObject({
      type: "integer",
      nullable: false,
    });
    expect(user.columns.find((column) => column.name === "email")).toMatchObject({
      type: "varchar(254)",
      nullable: false,
    });
    expect(user.columns.find((column) => column.name === "created_at")).toMatchObject({
      type: "timestamp",
      nullable: true,
    });
    expect(user.columns.find((column) => column.name === "role")).toMatchObject({
      enumValues: ["admin", "member"],
    });

    const team = schema.tables[1];
    expect(team.columns.find((column) => column.name === "id")).toMatchObject({
      type: "uuid",
      nullable: false,
    });
    expect(
      team.columns.find((column) => column.name === "homepage_url"),
    ).toMatchObject({
      type: "text",
    });
  });
});

describe("dbt YAML parser", () => {
  it("maps sources, models, primary keys, unique tests, and relationship tests", () => {
    const schema = parseDbtYaml(`
version: 2
sources:
  - name: app
    tables:
      - name: users
        columns:
          - name: id
            data_type: integer
            constraints:
              - type: primary_key
          - name: email
            data_type: varchar(254)
            tests:
              - unique
              - not_null
models:
  - name: orders
    columns:
      - name: id
        data_type: integer
        tests:
          - unique
          - not_null
      - name: user_id
        data_type: integer
        tests:
          - relationships:
              to: ref('users')
              field: id
    `);

    expect(schema.tables.map((table) => table.name)).toEqual([
      "users",
      "orders",
    ]);
    expect(schema.tables[0].columns.find((column) => column.name === "id")).toMatchObject({
      isPrimaryKey: true,
      isUnique: true,
      nullable: false,
    });
    expect(
      schema.tables[0].columns.find((column) => column.name === "email"),
    ).toMatchObject({
      isUnique: true,
      nullable: false,
    });
    expect(schema.tables[1].foreignKeys).toEqual([
      { column: "user_id", refTable: "users", refColumn: "id" },
    ]);
  });
});
