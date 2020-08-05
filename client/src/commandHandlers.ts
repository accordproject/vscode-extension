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