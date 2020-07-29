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

import * as path from 'path';

import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

import { exportArchive, downloadModels } from './commandHandlers';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {

	// HACK - set the process.browser variable so that the Concerto
	// logger doesn't try to create log files. The node.js process created
	// for the Electron app doesn't seem to have a cwd so Concerto tries
	// to create logs in the file system root, which will fail, causing
	// the module to fail to log, which crashes the extension
	(process as any).browser = true;

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));	
	
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
	
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	};
	
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for documents
		documentSelector: [
			{scheme: 'file', language: 'ergo'}, 
			{scheme: 'file', language: 'concerto'},
			{scheme: 'file', language: 'ciceroMark'},
			{scheme: 'file', language: 'markdown', pattern: '**/sample*.md'}
		],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'Cicero',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};
	
	// Register commands
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.exportArchive', exportArchive));
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.downloadModels', downloadModels));

	// Create the language client and start the client.
	client = new LanguageClient(
		'Cicero',
		'Cicero',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}
	
export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}