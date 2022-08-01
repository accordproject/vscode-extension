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
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

import MemoryWriter from './memorywriter';
import MermaidVisitor from './mermaidvisitor';
import FileWriter from './filewriter';
import {
	LogicManager
} from '@accordproject/ergo-compiler';

const Template = require('@accordproject/cicero-core').Template;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;
const Clause = require('@accordproject/cicero-core').Clause;
const Engine = require('@accordproject/cicero-engine').Engine;
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
		const modelRoot = path.dirname(ctoFile.fsPath)
		const modelFileName = ctoFile.fsPath;

		const logicManager = new LogicManager('es6');
		const modelManager = logicManager.getModelManager();
		modelManager.clearModelFiles();
		const loadedModelFiles = [];

		// load the edited file
		const contents = getDocument(modelFileName);
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
			const modelFiles = glob.sync(`${modelRoot}/**/*.cto`);

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

export async function exportArchive(file: vscode.Uri) {
	try {
		if(!checkTemplate(file)) {
			return false;
		}

		await vscode.workspace.saveAll();
		const template = await Template.fromDirectory(file.path);
		const archive = await template.toArchive('ergo');

		const outputPath = path.join(file.path, `${template.getIdentifier()}.cta`);
		fs.writeFileSync(outputPath, archive);
		vscode.window.showInformationMessage(`Created archive ${outputPath}`);
		return true;
	} catch (error) {
		vscode.window.showErrorMessage( `Failed to export archive ${error}`);
	}

	return false;
}

export async function downloadModels(file: vscode.Uri) {
	try {
		const outputPath = path.dirname(file.path);
		const modelManager = await getModelManager(file)

		if( modelManager ) {
			modelManager.writeModelsToFileSystem(outputPath);
			vscode.window.showInformationMessage(`Downloaded models to ${outputPath}`);	
		}
		return true;
	} catch (error) {
		vscode.window.showErrorMessage( `Failed to download models ${error}`);
	}

	return false;
}

function getDocument(file) {
	for (let n = 0; n < vscode.workspace.textDocuments.length; n++) {
		const doc = vscode.workspace.textDocuments[n];
		if (doc.fileName === file) {
			const text = doc.getText();
			return text;
		}
	}

	if(fs.existsSync(file)) {
		return fs.readFileSync(file, 'utf-8');
	}
	else {
		return null;
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

export async function exportClassDiagram(file: vscode.Uri) {
	try {
		const outputPath = path.dirname(file.path);
		const modelManager = await getModelManager(file);

		if(modelManager) {
			const PlantUMLVisitor = CodeGen.PlantUMLVisitor;

			const visitor = new PlantUMLVisitor();
			let parameters = {} as any;
			parameters.fileWriter = new FileWriter(outputPath);
			modelManager.accept(visitor, parameters);
	
			vscode.window.showInformationMessage(`Exported class diagram to ${outputPath}`);
			return true;	
		}
	} catch (error) {
		vscode.window.showErrorMessage( `Failed to generate diagram ${error}`);
	}

	return false;
}

function checkTemplate(file: vscode.Uri) {
	const packageJsonPath = path.join(file.fsPath, 'package.json');
	// vscode.window.showInformationMessage(`Loading template from ${packageJsonPath}`);

	const packageJsonContents = getDocument(packageJsonPath);

	if(!packageJsonContents) {
		vscode.window.showErrorMessage('Template package.json file was not found.');
		return false;
	}

	try {
		const packageJson = JSON.parse(packageJsonContents);
		if(!packageJson.accordproject) {
			vscode.window.showErrorMessage('package.json does not define a Cicero template.');
			return false;
		}
	}
	catch(error) {
		vscode.window.showErrorMessage('package.json contents is invalid.');
		return false;
	}

	return true;
}

export async function triggerClause(file: vscode.Uri) {
	try {
		if(!checkTemplate(file)) {
			return false;
		}

		outputChannel.show();
		
		await vscode.workspace.saveAll();
		const template = await Template.fromDirectory(file.path);
		const clause = new Clause(template);
		const samplePath = path.join(file.path, 'text', 'sample.md');

		if (!fs.existsSync(samplePath)) {
			vscode.window.showErrorMessage('Cannot trigger: /text/sample.md file was not found.');
			return false;
		}

		const requestPath = path.join(file.path, 'request.json');

		if (!fs.existsSync(requestPath)) {
			vscode.window.showErrorMessage('Cannot trigger:/request.json file was not found.');
			return false;
		}

		const sampleText = fs.readFileSync(samplePath, 'utf8');
		clause.parse(sampleText);
		const parseResult = clause.getData();

		outputChannel.appendLine('template');
		outputChannel.appendLine('========');
		outputChannel.appendLine(template.getIdentifier());
		outputChannel.appendLine('');

		outputChannel.appendLine('sample.md parse result');
		outputChannel.appendLine('======================');
		outputChannel.appendLine(JSON.stringify(parseResult, null, 2));
		outputChannel.appendLine('');

		const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

		outputChannel.appendLine('request.json');
		outputChannel.appendLine('============');
		outputChannel.appendLine(JSON.stringify(request, null, 2));
		outputChannel.appendLine('');

		const statePath = path.join(file.path, 'state.json');
		const engine = new Engine();
		let state = null;

		if (!fs.existsSync(statePath)) {
			const initResult = await engine.init(clause, null);
			state = initResult.state;
		} else {
			state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
		}

		outputChannel.appendLine('state.json');
		outputChannel.appendLine('==========');
		outputChannel.appendLine(JSON.stringify(state, null, 2));
		outputChannel.appendLine('');

		const result = await engine.trigger(clause, request, state, null);

		outputChannel.appendLine('response');
		outputChannel.appendLine('========');
		outputChannel.appendLine(JSON.stringify(result, null, 2));
		outputChannel.appendLine('');

		return true;
	} catch (error) {
		vscode.window.showErrorMessage( `Failed to trigger clause ${error}`);
	}

	return false;
}

function getProjectRoot(pathStr) {

    let currentPath = pathStr;

    while(currentPath !== '/' && currentPath.split(":").pop() !== '\\') {
        // connection.console.log( `- ${currentPath}`);

        try{
            if(fs.existsSync(currentPath + '/package.json'))
			    return currentPath;
        }
        catch(err) {
            // connection.console.log( `- exception ${err}`);
        }
        currentPath = path.normalize(path.join(currentPath, '..'));
    }
    return path.basename(path.dirname(pathStr));
}

export async function parseClause(file: vscode.Uri) {
	try {	
		const templateDirectory = getProjectRoot(file.fsPath);
		await vscode.workspace.saveAll();

		var panel = vscode.window.createWebviewPanel(
			'parseInput',
			'Parse Input',
			vscode.ViewColumn.Beside,
			{
			  // Enable scripts in the webview
			  enableScripts: true
			}
		);

		panel.webview.html = await getParseWebviewContent(path.relative(templateDirectory,file.path));

		panel.webview.onDidReceiveMessage(
			async (message) => {
			  const {samplePath,outputPath,utcOffset,currentTime} = message;
			  const template = await Template.fromDirectory(templateDirectory);
		      const clause = new Clause(template);
			  const sampleText = fs.readFileSync(path.resolve(templateDirectory,samplePath), 'utf8');

		      clause.parse(sampleText, currentTime, utcOffset, path.resolve(templateDirectory,samplePath));	  

			  outputChannel.show();

			  outputChannel.appendLine(`${samplePath} parse result`);
		      outputChannel.appendLine('======================');
		      outputChannel.appendLine(JSON.stringify(clause.getData(),null,2));
		      outputChannel.appendLine('');


			  fs.writeFileSync( path.resolve(templateDirectory,outputPath), JSON.stringify(clause.getData(),null,2));
			  outputChannel.appendLine(`Output written to ${outputPath}`);
			  outputChannel.appendLine('');
			},
			null
	    )
		
		return true;
	} catch (error) {
		vscode.window.showErrorMessage( `Failed to parse clause ${error}`);
	}

	return false;
}

export async function verifyTemplateSignature(file: vscode.Uri) {
	try {	
		if(!checkTemplate(file)) {
			return false;
		}
		await vscode.workspace.saveAll();

		const template = await Template.fromDirectory(file.path);

        await template.verifyTemplateSignature();
		
		vscode.window.showInformationMessage( `Template signatures verified successfully!` )

		return true;
	} catch (error) {
		vscode.window.showErrorMessage( `Verification ${error}`);
	}

	return false;
}

async function getPreviewHtml() {

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

	// outputChannel.appendLine( html );
	return html;
}

function getParseWebviewContent(samplePath){
    
    const defaultOutPath = samplePath+".json";
	const html = getParseWebviewHtml(samplePath,defaultOutPath);

	const styles = `<style>
	* {
	  box-sizing: border-box;
	}
	
	input, select, textarea {
	  width: 80%;
	  padding: 12px;
	  border-radius: 4px;
	  resize: vertical;
	}
	
	label {
	  padding: 12px 12px 12px 0;
	  display: inline-block;
	}
	
	button {
	  background-color: #04AA6D;
	  color: white;
	  padding: 12px 20px;
	  border: none;
	  border-radius: 4px;
	  cursor: pointer;
	  float: left;
	}
	
	button:hover {
	  background-color: #45a049;
	}
	
	.container {
	  border-radius: 5px;
	  padding: 20px;
	}
	
	.col-25 {
	  float: left;
	  width: 25%;
	  margin-top: 6px;
	}
	
	.col-75 {
	  float: left;
	  width: 75%;
	  margin-top: 6px;
	}
	
	/* Clear floats after the columns */
	.row:after {
	  content: "";
	  display: table;
	  clear: both;
	}

	.button{
		width: 30%;
	}

	.button-container{
		text-align: center;
	}
	
	@media screen and (max-width: 600px) {
	   input[type=submit] {
		width: 100%;
		margin-top: 0;
	  }
	}
	</style>`

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
	<script>
		let btn = document.getElementById("button");
		const vscode = acquireVsCodeApi();
        btn.addEventListener('click', event => {
			vscode.postMessage({
				command: 'parse',
				outputPath: document.getElementById("outputPath").value,
				samplePath: document.getElementById("samplePath").value,
				utcOffset: document.getElementById("utcOffset").value,
				currentTime: document.getElementById("currentTime").value,
			})
        });

    </script>
	</html>`;
}

function getParseWebviewHtml(defaultSamplePath,defaultOutPath){

	return `
	<div class="container">
	<div class="row">
	<h4>*Paths mentioned here are relative to the template directory</h4>
    </div>
	  <div class="row">
		<div class="col-25">
		  <label for="samplePath">Sample Path</label>
		</div>
		<div class="col-75">
		  <input type="text" id="samplePath" name="samplePath" placeholder="Choose Sample Path" value=${defaultSamplePath} >
		</div>
	  </div>
	  <br>
	  <div class="row">
		<div class="col-25">
		  <label for="outputPath">Ouput Path</label>
		</div>
		<div class="col-75">
		  <input type="text" id="outputPath" name="outputPath" placeholder="Choose Output Path" value=${defaultOutPath}>
		</div>
	  </div>
	  <br>
	  <div class="row">
		<div class="col-25">
		  <label for="utcOffset">UTC Offset</label>
		</div>
		<div class="col-75">
		  <input type="number" id="utcOffset" name="utcOffset" placeholder="UTC Offset" value="0">
		</div>
	  </div>
	  <br>
	  <div class="row">
		<div class="col-25">
		  <label for="currentTime">Current Time</label>
		</div>
		<div class="col-75">
		  <input type="text" id="currentTime" name="currentTime" placeholder="Current Time">
		</div>
	  </div>	  
	  <br>
	  <r>
	  <br>
	  <div class="row">
	  <button type="submit" id="button" class="button">Parse</button>
	  </div>
	</div>`

}

export async function getPreviewWebviewContent() {
	const html = await getPreviewHtml();

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