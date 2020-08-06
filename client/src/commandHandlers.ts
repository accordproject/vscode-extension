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
import { TypeDefinitionRequest } from 'vscode-languageclient';
var md = require('markdown-it')()
	.use(require('@accordproject/markdown-it-template'))
	.use(require('@accordproject/markdown-it-cicero'));
	
let outputChannel: vscode.OutputChannel

export function setOutputChannel(oc : vscode.OutputChannel) {
	outputChannel = oc;
}

export async function exportArchive(file: vscode.Uri) {
	try {
		// HACK - we load the module lazily so that process.browser is set 
		// (see extension.ts)
		const Template = require('@accordproject/cicero-core').Template;
		const template = await Template.fromDirectory(file.path);
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
		// HACK - we load the module lazily so that process.browser is set 
		// (see extension.ts)
		const Template = require('@accordproject/cicero-core').Template;
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

export async function exportClassDiagram(file: vscode.Uri) {
	try {
		// HACK - we load the module lazily so that process.browser is set 
		// (see extension.ts)
		const outputPath = path.join(file.path, 'model');
		const Template = require('@accordproject/cicero-core').Template;
		const template = await Template.fromDirectory(file.path);
		const modelManager = template.getModelManager();

		const CodeGen = require('@accordproject/concerto-tools').CodeGen;
		const PlantUMLVisitor = CodeGen.PlantUMLVisitor;
		const FileWriter = require('@accordproject/concerto-tools'). FileWriter;

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
		// HACK - we load the module lazily so that process.browser is set 
		// (see extension.ts)
		outputChannel.show();

		const Template = require('@accordproject/cicero-core').Template;
		const Clause = require('@accordproject/cicero-core').Clause;
		const Engine = require('@accordproject/cicero-engine').Engine;

		const template = await Template.fromDirectory(file.path);
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


export function getWebviewContent() {
	const html = vscode.window.activeTextEditor ? md.render(vscode.window.activeTextEditor.document.getText()) : 'To display preview please open a grammar.tem.md file.';
	const styles = `
	.variable {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
	}

	a {
		color: #0f52ba;
	}
	
	.formula {   
		border: #AF54C4 1px solid;
		border-radius: 2px;
		background-color: grey;
		cursor: pointer;
	}
	
	.clause_block {
		position: relative;
		margin: 10px -10px;
		background-color: darkgrey;
		border: 1px solid black;
		border-radius: 3px;
	}
	
	.ulist_block {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
	}
	
	.olist_block {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
	}
	
	.join_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
	}
	
	.if_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
	}
	
	.else_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
	}
	
	.optional_inline {
		border: #A4BBE7 1px solid;
		padding: 0px 3px;
		border-radius: 2px;
		background-color: grey;
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
		border: 1px solid #141F3C;
		background-color: #141F3C;
		transition-duration: 0.25s;
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
		border-color: rgba(0,0,0,0.85) transparent transparent transparent;
	  }
	  span:hover:after{ visibility: visible; opacity: 1; bottom: 20px; }
	  span:hover:before{ visibility: visible; opacity: 1; bottom: 14px; }
	`
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Template Preview</title>
	  <style>${styles}</style>
  </head>
  <body>
	  ${html}
  </body>
  </html>`;
  }