import { z } from "zod";
import { DB_IDENTIFIER_RE, LIMITS } from "@/lib/limits";

export const DbIdentifier = z
  .string()
  .min(1)
  .max(LIMITS.maxIdentifierChars)
  .regex(
    DB_IDENTIFIER_RE,
    "Use simple SQL identifiers: letters, numbers, and underscores; start with a letter or underscore",
  );

export const SEMANTIC_TYPES = [
  "person_full_name",
  "person_first_name",
  "person_last_name",
  "username",
  "email",
  "phone",
  "url",
  "ip_address",
  "place_city",
  "place_country",
  "place_region",
  "place_street_address",
  "organization",
  "product_name",
  "date",
  "datetime",
  "duration_seconds",
  "money_amount",
  "integer",
  "float",
  "percentage",
  "boolean_flag",
  "enum_category",
  "status",
  "short_text",
  "long_text",
  "description",
  "title",
  "uuid",
  "numeric_id",
  "foreign_key",
  "image_url",
  "avatar_url",
  "unknown",
] as const;

export const SemanticType = z.enum(SEMANTIC_TYPES);
export type SemanticType = z.infer<typeof SemanticType>;

export const ColumnIR = z.object({
  name: DbIdentifier,
  type: z.string().min(1).max(80),
  nullable: z.boolean(),
  isPrimaryKey: z.boolean(),
  isUnique: z.boolean(),
  enumValues: z.array(z.string()).nullable(),
});
export type ColumnIR = z.infer<typeof ColumnIR>;

export const ForeignKeyIR = z.object({
  column: DbIdentifier,
  refTable: DbIdentifier,
  refColumn: DbIdentifier,
});
export type ForeignKeyIR = z.infer<typeof ForeignKeyIR>;

export const TableIR = z.object({
  name: DbIdentifier,
  columns: z.array(ColumnIR).min(1).max(LIMITS.maxColumnsPerTable),
  foreignKeys: z.array(ForeignKeyIR),
});
export type TableIR = z.infer<typeof TableIR>;

export const SchemaIR = z.object({
  tables: z.array(TableIR).min(1).max(LIMITS.maxTables),
});
export type SchemaIR = z.infer<typeof SchemaIR>;

export const ColumnMapping = z.object({
  column: DbIdentifier,
  semanticType: SemanticType,
  thematicHint: z.string().min(1).max(120),
  examples: z.array(z.string().min(1).max(120)).length(2),
  referencesPool: z.string().nullable(),
});
export type ColumnMapping = z.infer<typeof ColumnMapping>;

export const TablePlan = z.object({
  name: DbIdentifier,
  rowCount: z.number().int().min(1).max(200),
  thematicRole: z.string().min(1).max(120),
  columnMappings: z.array(ColumnMapping).min(1),
  constraints: z.array(z.string().min(1).max(240)).max(10),
});
export type TablePlan = z.infer<typeof TablePlan>;

const PoolArray = z.array(z.string().min(1).max(80)).min(4).max(20);

export const POOL_KINDS = [
  "characters",
  "locations",
  "organizations",
  "artifacts",
  "events",
  "motifs",
  "catchphrases",
] as const;

export type PoolKind = (typeof POOL_KINDS)[number];

export const EntityPools = z
  .object({
    characters: PoolArray,
    locations: PoolArray.optional(),
    organizations: PoolArray.optional(),
    artifacts: PoolArray.optional(),
    events: PoolArray.optional(),
    motifs: PoolArray.optional(),
    catchphrases: PoolArray.optional(),
  })
  .refine(
    (pools) =>
      Object.values(pools).some(
        (entries) => Array.isArray(entries) && entries.length >= 6,
      ),
    {
      message:
        "at least one entityPool must contain 6 or more canonical entries",
    },
  );

export const GenerationPlan = z.object({
  theme: z.string().min(1).max(LIMITS.maxThemeChars),
  themeInterpretation: z.string().min(1).max(180),
  entityPools: EntityPools,
  tables: z.array(TablePlan).min(1),
  generationOrder: z.array(DbIdentifier).min(1),
});
export type GenerationPlan = z.infer<typeof GenerationPlan>;

export type GeneratedRecords = Record<string, Record<string, unknown>[]>;

export type FormatterOutput = { filename: string; content: string };

export type Formatter = (
  records: GeneratedRecords,
  schema: SchemaIR,
  plan: GenerationPlan,
) => FormatterOutput[];
