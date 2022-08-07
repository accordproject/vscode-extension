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

const Template = require('@accordproject/cicero-core').Template;
const Clause = require('@accordproject/cicero-core').Clause;
const Engine = require('@accordproject/cicero-engine').Engine;

let outputChannel: vscode.OutputChannel

export function setOutputChannelForDesktopCommands(oc: vscode.OutputChannel) {
	outputChannel = oc;
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
