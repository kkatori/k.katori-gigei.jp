import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.gs"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Google Apps Script globals
        SpreadsheetApp: "readonly",
        DriveApp: "readonly",
        GmailApp: "readonly",
        CalendarApp: "readonly",
        FormApp: "readonly",
        DocumentApp: "readonly",
        SlidesApp: "readonly",
        UrlFetchApp: "readonly",
        PropertiesService: "readonly",
        ScriptApp: "readonly",
        HtmlService: "readonly",
        ContentService: "readonly",
        Session: "readonly",
        Logger: "readonly",
        console: "readonly",
        Utilities: "readonly",
        CacheService: "readonly",
        LockService: "readonly",
        MailApp: "readonly",
        AdminDirectory: "readonly",
        AdminGroupsSettings: "readonly",
        GroupsApp: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
    },
  },
  {
    ignores: ["node_modules/", "eslint.config.js"],
  },
];
