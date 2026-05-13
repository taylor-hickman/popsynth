import { describe, expect, it } from "vitest";
import {
  PlanValidationError,
  validatePlanAgainstSchema,
} from "@/lib/plan-validator";
import type { GenerationPlan, SchemaIR } from "@/lib/types";

const schema: SchemaIR = {
  tables: [
    {
      name: "users",
      columns: [
        {
          name: "id",
          type: "integer",
          nullable: false,
          isPrimaryKey: true,
          isUnique: true,
          enumValues: null,
        },
        {
          name: "full_name",
          type: "text",
          nullable: false,
          isPrimaryKey: false,
          isUnique: false,
          enumValues: null,
        },
      ],
      foreignKeys: [],
    },
    {
      name: "posts",
      columns: [
        {
          name: "id",
          type: "integer",
          nullable: false,
          isPrimaryKey: true,
          isUnique: true,
          enumValues: null,
        },
        {
          name: "user_id",
          type: "integer",
          nullable: false,
          isPrimaryKey: false,
          isUnique: false,
          enumValues: null,
        },
        {
          name: "title",
          type: "text",
          nullable: false,
          isPrimaryKey: false,
          isUnique: false,
          enumValues: null,
        },
      ],
      foreignKeys: [{ column: "user_id", refTable: "users", refColumn: "id" }],
    },
  ],
};

describe("plan validator", () => {
  it("accepts a plan that maps every column and respects FK order", () => {
    expect(() =>
      validatePlanAgainstSchema(validPlan(), schema),
    ).not.toThrow();
  });

  it("catches missing mappings, invalid FK pools, duplicate pools, and bad FK order", () => {
    const plan = validPlan();
    plan.entityPools.characters[5] = "Saul Goodman";
    plan.tables[1].columnMappings = plan.tables[1].columnMappings.filter(
      (mapping) => mapping.column !== "title",
    );
    plan.tables[1].columnMappings.find(
      (mapping) => mapping.column === "user_id",
    )!.referencesPool = "missing_pool";
    plan.generationOrder = ["posts", "users"];

    expect(() => validatePlanAgainstSchema(plan, schema)).toThrow(
      PlanValidationError,
    );

    try {
      validatePlanAgainstSchema(plan, schema);
      throw new Error("expected validation to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanValidationError);
      const issues = (err as PlanValidationError).issues.join("\n");
      expect(issues).toContain('pool "characters" has duplicate entry');
      expect(issues).toContain('table "posts" is missing mapping for column "title"');
      expect(issues).toContain(
        'table "posts" FK column "user_id" references unknown pool "missing_pool"',
      );
      expect(issues).toContain(
        'generationOrder places "posts" before its FK parent "users"',
      );
    }
  });
});

function validPlan(): GenerationPlan {
  return {
    theme: "Breaking Bad",
    themeInterpretation: "Desert noir with chemistry, DEA pressure, and coded aliases.",
    entityPools: {
      characters: [
        "Walter White",
        "Jesse Pinkman",
        "Skyler White",
        "Hank Schrader",
        "Saul Goodman",
        "Gustavo Fring",
      ],
    },
    tables: [
      {
        name: "users",
        rowCount: 2,
        thematicRole: "Core character accounts.",
        constraints: [],
        columnMappings: [
          {
            column: "id",
            semanticType: "numeric_id",
            thematicHint: "Sequential account id.",
            examples: ["1", "2"],
            referencesPool: null,
          },
          {
            column: "full_name",
            semanticType: "person_full_name",
            thematicHint: "Name from characters pool.",
            examples: ["Walter White", "Jesse Pinkman"],
            referencesPool: "characters",
          },
        ],
      },
      {
        name: "posts",
        rowCount: 2,
        thematicRole: "Short in-universe posts.",
        constraints: [],
        columnMappings: [
          {
            column: "id",
            semanticType: "numeric_id",
            thematicHint: "Sequential post id.",
            examples: ["1", "2"],
            referencesPool: null,
          },
          {
            column: "user_id",
            semanticType: "foreign_key",
            thematicHint: "References users.id.",
            examples: ["1", "2"],
            referencesPool: "characters",
          },
          {
            column: "title",
            semanticType: "title",
            thematicHint: "Short themed post title.",
            examples: ["Tread Lightly", "Blue Sky Batch"],
            referencesPool: null,
          },
        ],
      },
    ],
    generationOrder: ["users", "posts"],
  };
}
