# Accord Project Extension for VSCode

Validate Smart Legal Contracts that conform to the [Accord Project Template Specification](https://docs.google.com/document/d/1UacA_r2KGcBA2D4voDgGE8jqid-Uh4Dt09AE-shBKR0/edit)

This VSCode extension parses '.ergo' files using the Ergo parser
and reports any validation errors. It will provide syntax highlighting for template grammar files (.tem) 

## For Template Authors

If you want to use this plugin:
1. Download and install VSCode from https://code.visualstudio.com/download
2. From the extensions view in VSCode, search for "Accord Project", click the `Install` button to install it

The extension is available from the Visual Studio Marketplace at https://marketplace.visualstudio.com/items?itemName=accordproject.accordproject-vscode-plugin

## For Contributors

### Manual Build and Install

Generate the installable VSIX file:

```
git clone https://github.com/accordproject/ergo-vscode-plugin.git
cd ergo-vscode-plugin/server
npm install
npm run compile:server
cd ../client
npm install
npm run package:vsix
```

1. Launch VSCode
2. View > Extensions
3. Press the ... and select "Install from VSIX"
4. Browse to the VSIX file
5. Install and restart VSCode
6. Open a .cto file

### Travis CI build
Developers no longer need a manual build, once you have created a pull request from your private Github repository. The build will be automatically performed by Travis.
A successful build will create an installable VSIX file on the build machine. 
The public release version number is defined in the Client package.json file. 

#### Publish Release
Below are steps for publishing a release.
1. Go to https://github.com/accordproject/ergo-vscode-plugin
2. Click Releases tab
3. Click Draft a new release on the right
4. Type a Tag version in the Tag version field. e.g. v0.5.7.1
5. Type a Release title in the Release title field e.g v0.5.7.1
6. Provide a short description of this release under the Write tab
7. Uncheck the box for This is a pre-release at the end of this page
8. Click Publish release button to publish the VSIX file to the VSCode Marketplace

#### Check the published release
1. Go to the VSCode Marketplace: https://marketplace.visualstudio.com/
2. Type Accord Project in the search field and hit return key or search button
3. This will bring you to https://marketplace.visualstudio.com/search?term=Accord%20Project&target=VSCode&category=All%20categories&sortBy=Relevance

#### Install a new release
1. Open Visual Studio Code in your desktop
2. Open the Extensions by View-->Extensions or Ctrl(cmd)+Shift+x 
3. Search for Accord Project
4. The new published Accord Project plugin is showing on the list
5. Click Install button to install it
6. Update button will be shown if you have already installed the same plugin before.

## Acknowledgements

Thanks to our friends at Hyperledger Composer for their existing plugin, 
https://github.com/hyperledger/composer-vscode-plugin/

## License <a name="license"></a>
Accord Project Project source code files are made available under the Apache License, Version 2.0 (Apache-2.0), located in the [LICENSE](LICENSE) file. Accord Project documentation files are made available under the Creative Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
