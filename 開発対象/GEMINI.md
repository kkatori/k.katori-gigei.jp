# Workspace Overview: GAS Tool Development Plan

This workspace contains planning and design documents for developing Google Apps Script (GAS) tools that integrate with rakumo and Google Workspace APIs. The project focuses on creating automation tools for small and medium-sized businesses (SMBs) to streamline administrative tasks.

## Directory Purpose
The primary purpose of this directory is to host the conceptual and sales-related documentation for a suite of GAS-based productivity tools.

## Key Files
- **`API利用ツールについて.pptx`**: A comprehensive presentation detailing nine specific tools, their overview, process flows, and architectural configurations using GAS and rakumo/Google Workspace APIs.
- **`販売ツール検討.xlsx`**: A spreadsheet analyzing the sales strategy, including target customer size (50-300 employees), estimated development periods, required API licenses, and pricing for each tool.

## Tool Categories
The planned tools are divided into two main categories:

### 1. Management Systems (管理系ツール)
Tools designed to simplify user and group management across Google Workspace and rakumo.
- **rakumo User Management Tool**: Automates CSV generation and upload for user profiles and licenses.
- **Google Workspace User Management Tool**: Manages users and groups in GWS and triggers rakumo synchronization.
- **Integrated GWS + rakumo Management**: A unified tool for managing both ecosystems simultaneously.
- **Kintai (Attendance) Settings Tool**: Batch updates for individual attendance settings via API.

### 2. Utility & Efficiency Tools (利便性向上ツール)
Tools aimed at improving workflow efficiency and data integrity.
- **rakumo Board Pre-posting Approval**: Integrates rakumo Workflow with Board to ensure only approved content is posted.
- **Approval Pending Status Reporter**: Visualizes workflow bottlenecks by reporting who is holding up requests.
- **Attachment Migration Tools**: Automatically moves files attached to rakumo Board or Workflow to specific Google Drive folders for better management.
- **Master Data Update Tool**: Automatically syncs lookup and master data in rakumo Workflow from Google Sheets.

## Technical Context
- **Primary Platform**: Google Apps Script (GAS)
- **APIs Used**: rakumo API (Workflow, Board, Kintai, Profile), Google Workspace Admin SDK.
- **Target Architecture**: Spreadsheet-bound or standalone GAS projects acting as the interface/engine for API interactions.

## Usage
These documents serve as the foundation for the development phase. Future interactions should refer to these files for specific tool requirements, process flows, and business constraints.
