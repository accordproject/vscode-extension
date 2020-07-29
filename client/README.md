# Accord Project Extension for VSCode 

## Features

Validates that Cicero templates conform to the [Accord Project Template Specification](https://docs.accordproject.org):

This VSCode extension:

- parses and type-checks '.ergo' files using the Ergo compiler and reports any errors.
- parses and validates '.cto' files using the Concerto parser and reports any errors.
- parses and validates '.md' and '.tem.md' files using the Cicero templates parser and reports any errors.

This extension is currently in beta so please raise any problems you find as an 
[issue](https://github.com/accordproject/cicero-vscode-extension/issues).

## Known Issues

The extension does not currently allow you to download the external model dependencies required to work offline. If you wish to work offline please using the `cicero` command line `archive` command to package your template into a CTA file and then unzip the file and copy the CTO model files that start with an `@` sign into your model folder.

## License <a name="license"></a>
Accord Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](LICENSE) file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.

## Release Notes

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
