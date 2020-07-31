# Accord Project Cicero VSCode Extension Contribution Guide

## ❗ Accord Project Contribution Guide ❗
We'd love for you to contribute to our source code and to make Accord Project Cicero VSCode Extension technology even better than it is today! Please refer to the [Accord Project Contribution guidelines][apcontribute] we'd like you to follow.

[apcontribute]: https://github.com/accordproject/techdocs/blob/master/CONTRIBUTING.md

## Contributors

Please update CHANGELOG.md when you make changes.

### Code Structure

```
.
├── client // Language Client
│   ├── src
│   │   ├── test // End to End tests for Language Client / Server
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```

### Running

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`

### Manual Build and Install

Generate the installable VSIX file:

```
git clone https://github.com/accordproject/cicero-vscode-extension.git
npm install
npm run package:vsix
```

1. Launch VSCode
2. View > Extensions
3. Press the ... and select "Install from VSIX"
4. Browse to the VSIX file
5. Install and restart VSCode
6. Open a .cto or .ergo file

### Travis CI build

Developers no longer need a manual build, once you have created a pull request from your private Github repository. The build will be automatically performed by Travis.
A successful build will create an installable VSIX file on the build machine.
The public release version number is defined in the package.json file. The 3 package.json files should all have the same version number (root/client and server).

#### Publish Release

Below are steps for publishing a release.

1. Go to https://github.com/accordproject/cicero-vscode-extension
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