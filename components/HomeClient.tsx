"use client";

import { useState } from "react";
import { SchemaInput } from "@/components/SchemaInput";
import { ThemeInput } from "@/components/ThemeInput";
import { GenerateClient } from "@/components/GenerateClient";
import type { SchemaIR } from "popsynth/core";

export function HomeClient({
  initialDdl,
  initialTheme,
}: {
  initialDdl: string;
  initialTheme: string;
}) {
  const [schema, setSchema] = useState<SchemaIR | null>(null);
  const [theme, setTheme] = useState(initialTheme);
  const schemaKey = schema
    ? JSON.stringify(schema.tables.map((table) => [
        table.name,
        table.columns.map((column) => column.name),
      ]))
    : "no-schema";

  return (
    <>
      <SchemaInput initialDdl={initialDdl} onSchemaParsed={setSchema} />
      <ThemeInput value={theme} onChange={setTheme} />
      <GenerateClient key={schemaKey} schema={schema} theme={theme} />
    </>
  );
}
