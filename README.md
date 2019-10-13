<h1 align="center">
  Accord Project Extension for VSCode
</h1>

<p align="center">
  <a href="https://travis-ci.org/accordproject/cicero-vscode-extension"><img src="https://travis-ci.org/accordproject/cicero-vscode-extension.svg?branch=master" alt="Build Status"></a>
  <a href="https://github.com/accordproject/cicero-vscode-extension/blob/master/LICENSE"><img src="https://img.shields.io/github/license/accordproject/cicero-vscode-extension" alt="GitHub license"></a>
  <a href="https://accord-project-slack-signup.herokuapp.com/"><img src="https://img.shields.io/badge/Slack-Join%20Slack-blue" alt="slack"></a>
  <br>
</p>

Validates that Cicero templates conform to the [Accord Project Template Specification](https://docs.accordproject.org):

- Validates the model for the template ('.cto' files), downloading referenced external models as required
- Validates the logic of the template ('.ergo' files) 
- Validates that the template archive can be built
- Validates that the 'sample.txt' file for the template can be parsed using the template grammar ('.tem' file)
- Syntax highlighting for all files

## For Template Authors

If you want to use this plugin:
1. Download and install VSCode from https://code.visualstudio.com/download
2. Remove any existing versions of the Ergo extension and the Hyperledger Composer extension
3. From the extensions view in VSCode, search for "Accord Project", click the `Install` button to install it

The extension is available from the Visual Studio Marketplace at https://marketplace.visualstudio.com/items?itemName=accordproject.cicero-vscode-extension

## For Contributors

### Manual Build and Install

Generate the installable VSIX file:

```
git clone https://github.com/accordproject/cicero-vscode-extension.git
cd cicero-vscode-extension/server
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
6. Open a .cto or .ergo file

### Travis CI build
Developers no longer need a manual build, once you have created a pull request from your private Github repository. The build will be automatically performed by Travis.
A successful build will create an installable VSIX file on the build machine. 
The public release version number is defined in the Client package.json file. 

#### Publish Release
Below are the steps for publishing a release.
1. Go to https://github.com/accordproject/cicero-vscode-extension
2. Click the Releases tab
3. Click Draft a new release on the right
4. Type a Tag version in the Tag version field. e.g. v0.5.7.1
5. Type a Release title in the Release title field e.g v0.5.7.1
6. Provide a short description of this release under the Write tab
7. Uncheck the box for This is a pre-release at the end of this page
8. Click the Publish release button to publish the VSIX file to the VSCode Marketplace

#### Check the published release
1. Go to the VSCode Marketplace: https://marketplace.visualstudio.com/
2. Type Accord Project in the search field and hit return key or search button
3. This will bring you to https://marketplace.visualstudio.com/search?term=Accord%20Project&target=VSCode&category=All%20categories&sortBy=Relevance

#### Install a new release
1. Open Visual Studio Code in your desktop
2. Open the Extensions by View-->Extensions or Ctrl(cmd)+Shift+x 
3. Search for Accord Project
4. The new published Accord Project plugin is showing on the list
5. Click the Install button to install it
6. The Update button will be shown if you have already installed the same plugin before.

## Acknowledgments

Thanks to our friends at Hyperledger Composer for inspiring us with their existing plugin, 
https://github.com/hyperledger/composer-vscode-plugin/

---
<p align="center">
  <a href="https://www.accordproject.org/">
    <img src="assets/APLogo.png" alt="Accord Project Logo" width="400" />
  </a>
</p>

Accord Project is an open source, non-profit, initiative working to transform contract management and contract automation by digitizing contracts. Accord Project operates under the umbrella of the [Linux Foundation][linuxfound]. The technical charter for the Accord Project can be found [here][charter].

## Learn More About Accord Project

### Overview
* [Accord Project][apmain]
* [Accord Project News][apnews]
* [Accord Project Blog][apblog]
* [Accord Project Slack][apslack]
* [Accord Project Technical Documentation][apdoc]
* [Accord Project GitHub][apgit]


### Documentation
* [Getting Started with Accord Project][docwelcome]
* [Concepts and High-level Architecture][dochighlevel]
* [How to use the Cicero Templating System][doccicero]
* [How to Author Accord Project Templates][docstudio]
* [Ergo Language Guide][docergo]

## Contributing

The Accord Project technology is being developed as open source. All the software packages are being actively maintained on GitHub and we encourage organizations and individuals to contribute requirements, documentation, issues, new templates, and code.

Find out what’s coming on our [blog][apblog].

Join the Accord Project Technology Working Group [Slack channel][apslack] to get involved!

For code contributions, read our [CONTRIBUTING guide][contributing] and information for [DEVELOPERS][developers].

## License <a name="license"></a>

Accord Project source code files are made available under the [Apache License, Version 2.0][apache].
Accord Project documentation files are made available under the [Creative Commons Attribution 4.0 International License][creativecommons] (CC-BY-4.0).

Copyright 2018-2019 Clause, Inc. All trademarks are the property of their respective owners. See [LF Projects Trademark Policy](https://lfprojects.org/policies/trademark-policy/).

[apmain]: https://accordproject.org/ 
[apworkgroup]: https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=MjZvYzIzZHVrYnI1aDVzbjZnMHJqYmtwaGlfMjAxNzExMTVUMjEwMDAwWiBkYW5AY2xhdXNlLmlv&tmsrc=dan%40clause.io
[apblog]: https://medium.com/@accordhq
[apnews]: https://www.accordproject.org/news/
[apgit]:  https://github.com/accordproject/
[apdoc]: https://docs.accordproject.org/
[apslack]: https://accord-project-slack-signup.herokuapp.com

[docspec]: https://docs.accordproject.org/docs/spec-overview.html
[docwelcome]: https://docs.accordproject.org/docs/accordproject.html
[dochighlevel]: https://docs.accordproject.org/docs/spec-concepts.html
[docergo]: https://docs.accordproject.org/docs/logic-ergo.html
[docstart]: https://docs.accordproject.org/docs/accordproject.html
[doccicero]: https://docs.accordproject.org/docs/basic-use.html
[docstudio]: https://docs.accordproject.org/docs/advanced-latedelivery.html

[contributing]: https://github.com/accordproject/cicero-vscode-extension/blob/master/CONTRIBUTING.md
[developers]: https://github.com/accordproject/cicero-vscode-extension/blob/master/DEVELOPERS.md

[linuxfound]: https://www.linuxfoundation.org
[charter]: https://github.com/accordproject/cicero-vscode-extension/blob/master/CHARTER.md
[npmpkg]: https://www.npmjs.com/package/@accordproject/ergo-cli
[coq]: https://coq.inria.fr
[OCaml]: https://ocaml.org
[Qcert]: https://querycert.github.io
[REPL]: https://ergorepl.netlify.com
[studio]: https://studio.accordproject.org
[nodejs]: https://nodejs.org/

[apache]: https://github.com/accordproject/cicero-vscode-extension/blob/master/LICENSE
[creativecommons]: http://creativecommons.org/licenses/by/4.0/
