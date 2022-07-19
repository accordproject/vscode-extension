/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

import MemoryWriter from './memorywriter';
import MermaidVisitor from './mermaidvisitor';
import {
	LogicManager
} from '@accordproject/ergo-compiler';

const ModelFile = require('@accordproject/concerto-core').ModelFile;

var md = require('markdown-it')()
	.use(require('@accordproject/markdown-it-template'))
	.use(require('@accordproject/markdown-it-cicero'));

let outputChannel: vscode.OutputChannel

export function setOutputChannel(oc: vscode.OutputChannel) {
	outputChannel = oc;
}

async function getModelManager(ctoFile: vscode.Uri) {
	try {

		console.log(ctoFile.fsPath)

		const modelRoot = path.dirname(ctoFile.fsPath)

		console.log(modelRoot);
		
		const modelFileName = ctoFile.fsPath;

		console.log(modelFileName);

		const logicManager = new LogicManager('es6');
		const modelManager = logicManager.getModelManager();
		modelManager.clearModelFiles();
		modelManager.modelFiles;
		const loadedModelFiles = [];

		// load the edited file
		const contents = getDocument(modelFileName);
		console.log(contents)
		const rootModelFile = new ModelFile(modelManager, contents, modelFileName);
		outputChannel.appendLine(`Loaded model file: ${rootModelFile.getNamespace()}`);
		loadedModelFiles.push(rootModelFile);

		// is the cto file is in a directory called 'model'
		// i.e. templates.accordproject.org
		// then we also load all the files in the directory, otherwise we assume
		// that the model file is standalone and only has internet dependencies
		// i.e. models.accordproject.org
		if (path.basename(modelRoot) === 'model') {
			path.dirname(ctoFile.fsPath)

			// Find all cto under the directory that contains the cto file
			const modelFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(modelRoot, '*.cto'));
			console.log(modelFiles);

			// read the model files
			for (const file of modelFiles) {
				const contents = getDocument(file);
				if (contents) {
					const m = new ModelFile(modelManager, contents, file);
					const exists = loadedModelFiles.find( it => it.getNamespace() === m.getNamespace() );
					if(!exists) {
						outputChannel.appendLine(`Loaded model file: ${m.getNamespace()}`);
						loadedModelFiles.push(m);
					}
				}
			}
		}

		modelManager.addModelFiles(loadedModelFiles, null, true);

		// download external dependencies and validate
		try {
			await modelManager.updateExternalModels();
		} catch (err) {
			// assume we are offline
			modelManager.validateModelFiles();
		}

		return modelManager;
	} catch (error) {
		outputChannel.appendLine(`${error} : ${error.stack}`);
		vscode.window.showErrorMessage( `Failed to build models ${error}`);
	}

	return null;
}

export function getDocument(file) {
	for (let n = 0; n < vscode.workspace.textDocuments.length; n++) {
		const doc = vscode.workspace.textDocuments[n];
		if (doc.fileName === file) {
			const text = doc.getText();
			return text;
		}
	}
}

async function getMermaid(ctoFile: vscode.Uri) {

	try {
		const modelManager = await getModelManager(ctoFile);
		const namespaces = modelManager.getModelFiles().map( m => m.getNamespace()).sort();

		if (modelManager) {
			const visitor = new MermaidVisitor();
			let parameters = {} as any;
			parameters.fileWriter = new MemoryWriter();
			modelManager.accept(visitor, parameters);
			return {
				mermaid: parameters.fileWriter.getFiles()['/model.mmd'],
				namespaces,
				modelManager
			}
		}
	} catch (error) {
		vscode.window.showErrorMessage( `Failed to generate diagram ${error}`);
	}

	return false;
}

async function getHtml() {

	let html = 'To display preview please open a grammar.tem.md or a *.cto file.';

	if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
		if (vscode.window.activeTextEditor.document.languageId === 'ciceroMark') {
			html = md.render(vscode.window.activeTextEditor.document.getText());
		} else if (vscode.window.activeTextEditor.document.languageId === 'concerto') {

			const result = await getMermaid(vscode.window.activeTextEditor.document.uri);
			if (result) {
				outputChannel.appendLine(result.mermaid);

				let namespaces = '<ul>';
				result.namespaces.forEach(ns => {
					namespaces += `<li>${ns}</li>`
				});
				namespaces += `</ul>`
				html = `<h1>Class Diagram</h1>
<h2>Namespaces</h2>
${namespaces}
<table>
  <tr><th>Type</th><th>Count</th></tr>
  <tr><td>Asset</td><td>${result.modelManager.getAssetDeclarations(false).length}</td></tr>
  <tr><td>Participant</td><td>${result.modelManager.getParticipantDeclarations(false).length}</td></tr>
  <tr><td>Transaction</td><td>${result.modelManager.getTransactionDeclarations(false).length}</td></tr>
  <tr><td>Event</td><td>${result.modelManager.getEventDeclarations(false).length}</td></tr>
  <tr><td>Enumeration</td><td>${result.modelManager.getEnumDeclarations(false).length}</td></tr>
  <tr><td>Concept</td><td>${result.modelManager.getConceptDeclarations(false).length}</td></tr>
</table>
<div class="mermaid">
${result.mermaid}
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad:true, theme: 'dark'});</script>
				`;
			} else {
				outputChannel.appendLine('Failed to created Mermaid diagram.');
			}
		}
	}

	return html;
}

export async function getPreviewWebviewContent() {
	const html = await getHtml();

	const styles = `
	table, th, td {
		border: 1px solid;
		color: var(--vscode-editor-foreground)
	}
	.variable {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: var(--vscode-editor-background);
	}

	a {
		color: #0f52ba;
	}
	
	.formula {   
		border: #AF54C4 1px solid;
		border-radius: 2px;
		background-color: var(--vscode-editor-background);
		cursor: pointer;
	}
	
	.clause_block {
		position: relative;
		margin: 10px -10px;
		padding: 0px 10px;
		background-color: rgb(49, 48, 53);
		border: 1px solid black;
		border-radius: 3px;
	}
	
	.ulist_block {
		border: #A4BBE7 1px solid;
		padding: 0px 10px;
		margin: 10 0;
		border-radius: 2px;
		background-color: rgb(65, 63, 70);
	}
	
	.olist_block {
		border: #A4BBE7 1px solid;
		padding: 0px 10px;
		margin: 10px 0;
		border-radius: 2px;
		background-color: rgb(65, 63, 70);
	}
	
	.join_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: var(--vscode-editor-background);
	}
	
	.if_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: var(--vscode-editor-background);
	}
	
	.else_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: var(--vscode-editor-background);
	}
	
	.optional_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: var(--vscode-editor-background);
	}

	span {
		position: relative;
		display: inline;
	  }
	  span:after{
		display: block;
		visibility: hidden;
		position: absolute;
		bottom: 0;
		left: 20%;
		opacity: 1 !important;
		content: attr(class); /* might also use attr(title) */
		height: auto;
		min-width: 100px;
		padding: 1px 3px;
		z-index: 999;
		color: #FFFFFF;
		text-decoration: none;
		text-align: center;
		border: 1px solid rgb(65, 63, 70);
		background-color: rgb(65, 63, 70);
		-webkit-border-radius: 5px;
		-moz-border-radius: 5px;
		border-radius: 2px;
	  }
	  span:before {
		position: absolute;
		visibility: hidden;
		width: 0;
		height: 0;
		left: 50%;
		bottom: 0px;
		opacity: 0;
		content: "";
		border-style: solid;
		border-width: 6px 6px 0 6px;
		border-color: rgb(65, 63, 70) transparent transparent transparent;
	  }
	  span:hover:after{ visibility: visible; opacity: 1; bottom: 20px; }
	  span:hover:before{ visibility: visible; opacity: 1; bottom: 14px; }
	`
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Accord Project</title>
	  <style>${styles}</style>
  </head>
  <body>
${html}
  </body>
  </html>`;
}