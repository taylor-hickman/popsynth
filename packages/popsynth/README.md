# Pop Synth CLI

Generate themed synthetic data from SQL DDL, CSV headers, JSON Schema, or dbt YAML.

```bash
npm i -g popsynth
popsynth generate --schema schema.sql --schema-kind sql --theme "Studio Ghibli CRM" --out ./data
```

Pop Synth parses SQL only; it never executes SQL input.

## Environment

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_PLANNER_MODEL=claude-sonnet-4-6
ANTHROPIC_ROW_MODEL=claude-haiku-4-5
```

CLI model flags override the environment for one run:

```bash
popsynth generate --schema schema.sql --schema-kind sql --theme "Breaking Bad" --planner-model claude-sonnet-4-6 --row-model claude-haiku-4-5
```

## Commands

```bash
popsynth parse --schema schema.sql --schema-kind sql
popsynth plan --schema schema.sql --schema-kind sql --theme "Wes Anderson hotel lobby"
popsynth generate --schema schema.sql --schema-kind sql --theme "Gotham logistics" --out ./popsynth-output
```

Use `--schema -` to read schema input from stdin. Use `--json` on `generate` for a machine-readable manifest.
