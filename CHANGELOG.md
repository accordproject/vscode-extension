## Change Log

### 0.22.0
- Update to Cicero 0.22.0
### 0.21.17
- Update to Cicero 0.21.8

### 0.21.16
- Update to Cicero 0.21.7

### 0.21.15
- Update to Cicero 0.21.6

### 0.21.14
- Update to Cicero 0.21.4
- Export Ergo source cicero template archive
- Force save open documents before exporting archive or triggering clause

### 0.21.13

- HTML preview for Concerto models improvements
   - Now uses unsaved editor contents
   - Works on CTO files that are outside of a template
   - Include namespace and declaration metadata in the generated HTML
   - Move context menu to CTO files
- Move context menu for download external models to CTO files
   - Works on CTO files that are outside of a template
- Move context menu for export class diagram to CTO files
   - Works on CTO files that are outside of a template
- Improve error checking for template commands

### 0.21.12

- Fix dependencies

### 0.21.11

- Fix dependencies

### 0.21.10

- HTML preview for Concerto models

### 0.21.9

- HTML preview for template markdown text

### 0.21.8

- Support triggering templates without a `state.json` file

### 0.21.7

- Added trigger command
- Registered markdown-it extensions with markdown preview (wip)

### 0.21.6

- Added a command to export the PlantUML class diagram
- Added a quick fix to add a variable to the template model if an undeclared variable is used in the grammar

### 0.21.5

- Updated the README

### 0.21.4

- Fixed packaging issue with export CTA and download models commands

### 0.21.2

- Upgrade to languageserver

### 0.21.0

- Upgrade to Cicero 0.21
- Enabled validation of grammar.tem.md and sample.mnd files
- Added a command to export Cicero Template Archive (CTA) file (context click on folder)
- Added a command to download external models (context click on folder)

### 0.20.16

- Improved documentation
- Added Ergo code snippets
- Improved Concerto code snippets

### 0.20.14

Fixed a bug that would cause unsaved changes to models to be overwritten with stale changes from disk.
