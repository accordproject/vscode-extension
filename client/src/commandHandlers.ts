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
const plantumlEncoder = require('plantuml-encoder');
import MemoryWriter from './memorywriter';
import MermaidVisitor from './mermaidvisitor';
const Template = require('@accordproject/cicero-core').Template;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;
const FileWriter = require('@accordproject/concerto-tools').FileWriter;
const Clause = require('@accordproject/cicero-core').Clause;
const Engine = require('@accordproject/cicero-engine').Engine;

var md = require('markdown-it')()
	.use(require('@accordproject/markdown-it-template'))
	.use(require('@accordproject/markdown-it-cicero'));
	
let outputChannel: vscode.OutputChannel

export function setOutputChannel(oc : vscode.OutputChannel) {
	outputChannel = oc;
}

export async function exportArchive(file: vscode.Uri) {
	try {
		const template = await Template.fromDirectory(file.path, {skipUpdateExternalModels: true});
		const archive = await template.toArchive('cicero');
		const outputPath = path.join(file.path, `${template.getIdentifier()}.cta`);
		fs.writeFileSync(outputPath, archive);
		vscode.window.showInformationMessage(`Created archive ${outputPath}`);
		return true;
	}
	catch(error) {
		vscode.window.showErrorMessage(`Error ${error}`);
	}

	return false;
}

export async function downloadModels(file: vscode.Uri) {
	try {
		const template = await Template.fromDirectory(file.path);
		const outputPath = path.join(file.path, 'model');
		template.getModelManager().writeModelsToFileSystem(outputPath);
		vscode.window.showInformationMessage(`Downloaded models to ${outputPath}`);
		return true;
	}
	catch(error) {
		vscode.window.showErrorMessage(`Error ${error}`);
	}

	return false;
}

async function getMermaid(ctoFile: vscode.Uri) {
	try {
		const templateRootPath = path.resolve(ctoFile.fsPath, '..', '..');
		const modelFileName = ctoFile.fsPath;
		const template = await Template.fromDirectory(templateRootPath, {skipUpdateExternalModels: true});
		const modelManager = template.getModelManager();
		outputChannel.appendLine(`Active file: ${modelFileName}`);
		// const modelFile = modelManager.getModelFileByFileName(modelFileName);

		// modelManager.getModelFiles().forEach(modelFile => {
		// 	outputChannel.appendLine(`- ${modelFile.getName()}`);
		// });

		// if(!modelFile) {
		// 	vscode.window.showErrorMessage(`Error failed to find model file ${modelFileName} in the model manager.`);
		// 	return false;
		// }

		// outputChannel.appendLine(`Found: ${modelFile.getNamespace()}`);

		const visitor = new MermaidVisitor();
		let parameters = {} as any;
		parameters.fileWriter = new MemoryWriter();
		const virtualFileName = 'model.mmd';

		// parameters.fileWriter.openFile('model.mmd');
        // parameters.fileWriter.writeLine(0, 'classDiagram');
		modelManager.accept(visitor, parameters);
		// parameters.fileWriter.closeFile();

		// outputChannel.appendLine(`Result: ${JSON.stringify(parameters.fileWriter.getFiles())}`);

		return parameters.fileWriter.getFiles()['/model.mmd'];
	}
	catch(error) {
		vscode.window.showErrorMessage(`Error ${error}`);
	}

	return false;
}

export async function exportClassDiagram(file: vscode.Uri) {
	try {
		const outputPath = path.join(file.path, 'model');
		const template = await Template.fromDirectory(file.path, {skipUpdateExternalModels: true});
		const modelManager = template.getModelManager();
		const PlantUMLVisitor = CodeGen.PlantUMLVisitor;

		const visitor = new PlantUMLVisitor();
		let parameters = {} as any;
		parameters.fileWriter = new FileWriter( outputPath );
		modelManager.accept(visitor, parameters);

		vscode.window.showInformationMessage(`Exported class diagram to ${outputPath}`);
		return true;
	}
	catch(error) {
		vscode.window.showErrorMessage(`Error ${error}`);
	}

	return false;
}

export async function triggerClause(file: vscode.Uri) {
	try {
		outputChannel.show();
		const template = await Template.fromDirectory(file.path, {skipUpdateExternalModels: true});
		const clause = new Clause(template);
		const samplePath = path.join(file.path, 'text', 'sample.md');

		if(!fs.existsSync(samplePath)) {
			vscode.window.showErrorMessage('Cannot trigger: /text/sample.md file was not found.');
			return false;
		}

		const requestPath = path.join(file.path, 'request.json');

		if(!fs.existsSync(requestPath)) {
			vscode.window.showErrorMessage('Cannot trigger:/request.json file was not found.');
			return false;
		}

		const sampleText = fs.readFileSync( samplePath, 'utf8');
		clause.parse(sampleText);
		const parseResult = clause.getData();

		outputChannel.appendLine( 'template' );
		outputChannel.appendLine( '========' );
		outputChannel.appendLine( template.getIdentifier() );
		outputChannel.appendLine( '' );

		outputChannel.appendLine( 'sample.md parse result' );
		outputChannel.appendLine( '======================' );
		outputChannel.appendLine( JSON.stringify(parseResult, null, 2) );
		outputChannel.appendLine( '' );

		const request = JSON.parse(fs.readFileSync( requestPath, 'utf8'));

		outputChannel.appendLine( 'request.json' );
		outputChannel.appendLine( '============' );
		outputChannel.appendLine( JSON.stringify(request, null, 2) );
		outputChannel.appendLine( '' );

		const statePath = path.join(file.path, 'state.json');
		const engine = new Engine();
		let state = null;

		if(!fs.existsSync(statePath)) {
			const initResult = await engine.init(clause, null);
			state = initResult.state;
		} else {
			state = JSON.parse(fs.readFileSync( statePath, 'utf8'));
		}

		outputChannel.appendLine( 'state.json' );
		outputChannel.appendLine( '==========' );
		outputChannel.appendLine( JSON.stringify(state, null, 2) );
		outputChannel.appendLine( '' );	

		const result = await engine.trigger(clause, request, state, null );

		outputChannel.appendLine( 'response' );
		outputChannel.appendLine( '========' );
		outputChannel.appendLine( JSON.stringify(result, null, 2) );
		outputChannel.appendLine( '' );

		return true;
	}
	catch(error) {
		vscode.window.showErrorMessage(`Error ${error}`);
	}

	return false;
}

async function getHtml() {

	let html = 'To display preview please open a grammar.tem.md or a *.cto file.';

	if(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document) {
		if(vscode.window.activeTextEditor.document.languageId === 'ciceroMark') {
			html = md.render(vscode.window.activeTextEditor.document.getText());
		}
		else if (vscode.window.activeTextEditor.document.languageId === 'concerto') {

			const mermaid = await getMermaid(vscode.window.activeTextEditor.document.uri);
			if(mermaid) {
				outputChannel.appendLine(mermaid);
				html = `<h1>Class Diagram</h2>
<div class="mermaid" id="mermaid-main">
${mermaid}
</div>
<div class="mermaid" id="mermaid-preview" style="position: fixed; top: 0; left: 0; width: 75px; height: 50px; z-index: 100; display: block">
${mermaid}
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad:true, theme: 'dark'});</script>
				`;	
			}
			else {
				outputChannel.appendLine('Failed to created Mermaid diagram.');
			}
		}
	}

	// outputChannel.appendLine( html );
	return html;
}


export async function getWebviewContent() {
	const html = await getHtml();
	
	const styles = `
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