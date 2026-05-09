#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const SHARED_SRC = path.join(ROOT, "shared", "src");

const TOOLS = {
  "integrated-user-tool": {
    mode: "integrated",
    sharedFiles: [
      "auth.js",
      "config.js",
      "csv.js",
      "sheetUtils.js",
      "apiClient.js",
      "logger.js",
    ],
    toolFiles: [
      "main.js",
      "rakumoProfile.js",
      "rakumoSync.js",
      "gwsUsers.js",
      "gwsGroups.js",
      "csvGenerator.js",
      "workflows.js",
      "ui.js",
    ],
  },
  "rakumo-user-tool": {
    mode: "rakumo",
    sharedFiles: [
      "auth.js",
      "config.js",
      "csv.js",
      "sheetUtils.js",
      "apiClient.js",
      "logger.js",
    ],
    toolFiles: [
      "main.js",
      "rakumoProfile.js",
      "rakumoSync.js",
      "csvGenerator.js",
      "workflows.js",
      "ui.js",
    ],
  },
  "gws-user-tool": {
    mode: "gws",
    sharedFiles: [
      "auth.js",
      "config.js",
      "sheetUtils.js",
      "apiClient.js",
      "logger.js",
    ],
    toolFiles: [
      "main.js",
      "rakumoSync.js",
      "gwsUsers.js",
      "gwsGroups.js",
      "workflows.js",
      "ui.js",
    ],
  },
};

function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function patchToolMode(filePath, mode) {
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(
    /TOOL_MODE:\s*["']integrated["']/,
    `TOOL_MODE: "${mode}"`,
  );
  fs.writeFileSync(filePath, content, "utf-8");
}

function build(toolName) {
  const tool = TOOLS[toolName];
  if (!tool) {
    console.error(`Unknown tool: ${toolName}`);
    process.exit(1);
  }

  const toolDir = path.join(ROOT, toolName);
  const srcDir = path.join(toolDir, "src");
  const integratedSrc = path.join(ROOT, "integrated-user-tool", "src");

  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  console.log(`Building ${toolName} (mode: ${tool.mode})...`);

  // Copy shared modules
  for (const file of tool.sharedFiles) {
    const src = path.join(SHARED_SRC, file);
    const dest = path.join(srcDir, file);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
      console.log(`  shared/${file} -> src/${file}`);
    } else {
      console.warn(`  WARNING: ${src} not found`);
    }
  }

  // Copy tool modules from integrated-user-tool (source of truth)
  for (const file of tool.toolFiles) {
    const src = path.join(integratedSrc, file);
    const dest = path.join(srcDir, file);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
      console.log(`  integrated-user-tool/src/${file} -> src/${file}`);
    } else {
      console.warn(`  WARNING: ${src} not found`);
    }
  }

  // Copy appsscript.json into src/ (required by clasp rootDir: "src")
  const appsscriptSrc = path.join(toolDir, "appsscript.json");
  const appsscriptDest = path.join(srcDir, "appsscript.json");
  if (fs.existsSync(appsscriptSrc)) {
    copyFile(appsscriptSrc, appsscriptDest);
    console.log(`  appsscript.json -> src/appsscript.json`);
  }

  // Patch TOOL_MODE default for derived tools
  if (tool.mode !== "integrated") {
    const configDest = path.join(srcDir, "config.js");
    if (fs.existsSync(configDest)) {
      patchToolMode(configDest, tool.mode);
      console.log(`  Patched TOOL_MODE default to "${tool.mode}"`);
    }
  }

  console.log(`Done: ${toolName}\n`);
}

// Main
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "all") {
  for (const toolName of Object.keys(TOOLS)) {
    build(toolName);
  }
} else {
  for (const toolName of args) {
    build(toolName);
  }
}
