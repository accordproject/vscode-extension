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