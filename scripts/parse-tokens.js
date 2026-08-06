#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const inputPath = path.resolve(process.argv[2] || "design/ui-kit.lib.pen");
const outputPath = path.resolve(process.argv[3] || "design/variables.css");

function toCssName(name) {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .toLowerCase();
}

function toCssValue(variableName, variable) {
  if (!variable || !Object.hasOwn(variable, "value")) {
    throw new Error(`Variable "${variableName}" has no value`);
  }

  switch (variable.type) {
    case "number":
      return `${variable.value}px`;
    case "color":
    case "string":
      return String(variable.value);
    default:
      throw new Error(
        `Unsupported variable type "${variable.type}" for "${variableName}"`,
      );
  }
}

function parsePenFile(filePath) {
  let document;

  try {
    document = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read or parse ${filePath}: ${error.message}`);
  }

  if (!document.variables || typeof document.variables !== "object") {
    throw new Error(`No variables object found in ${filePath}`);
  }

  return document.variables;
}

function createCss(variables) {
  const declarations = Object.entries(variables)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([name, variable]) =>
        `  --${toCssName(name)}: ${toCssValue(name, variable)};`,
    );

  return [
    "/* Generated from design/ui-kit.lib.pen. Do not edit manually. */",
    ":root {",
    ...declarations,
    "}",
    "",
  ].join("\n");
}

try {
  const css = createCss(parsePenFile(inputPath));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, css, "utf8");
  console.log(`Created ${outputPath}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
