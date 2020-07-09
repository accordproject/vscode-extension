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
// import * as glob from 'glob';
// import {
// 	ModelManager
// } from '@accordproject/concerto-core';

export async function downloadExternalModels(file: vscode.Uri) {

	// vscode.window.showInformationMessage(`Downloading models for ${file.path}`);

	// //     // Find all cto files in ./ relative to this file or in the parent directory if this is a Cicero template.
	// const modelFiles = glob.sync(`${file.path}/**/*.cto`);
	// const modelManager = new ModelManager();

	// for (const file of modelFiles) {
	// 	const textDocument = await vscode.workspace.openTextDocument(file);
	// 	modelManager.addModelFile(textDocument.getText(), file, true);
	// }

	// await modelManager.updateExternalModels();
	vscode.window.showInformationMessage(file.path);
}