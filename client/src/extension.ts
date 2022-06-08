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
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

import {
	exportArchive,
	downloadModels,
	exportClassDiagram,
	triggerClause,
	getWebviewContent,
	setOutputChannel,
	parseClause
} from './commandHandlers';

let client: LanguageClient;

async function onDocumentChange(event) {
	if (event.document.languageId === 'ciceroMark' || event.document.languageId === 'concerto') {
		return getWebviewContent();;
	}

	return null;
}

export function activate(context: vscode.ExtensionContext) {

	// Set the process.browser variable so that the Concerto logger doesn't try to create log files
	(process as any).browser = true;

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

	// The debug options for the server
	let debugOptions = {
		execArgv: ["--nolazy", "--inspect=6009"]
	};

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for documents
		documentSelector: [{
				scheme: 'file',
				language: 'ergo'
			},
			{
				scheme: 'file',
				language: 'concerto'
			},
			{
				scheme: 'file',
				language: 'ciceroMark'
			},
			{
				scheme: 'file',
				language: 'markdown',
				pattern: '**/sample*.md'
			}
		],
		synchronize: {
			// Synchronize the setting section 'Cicero' to the server
			configurationSection: 'Cicero',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// create the output channel
	const outputChannel = vscode.window.createOutputChannel('Cicero');
	setOutputChannel(outputChannel);

	// Register commands
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.exportArchive', exportArchive));
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.downloadModels', downloadModels));
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.exportClassDiagram', exportClassDiagram));
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.triggerClause', triggerClause));
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.parseClause', parseClause));

	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	context.subscriptions.push(
		vscode.commands.registerCommand('cicero-vscode-extension.showPreview', async (file: vscode.Uri) => {
			const columnToShowIn = vscode.ViewColumn.Beside;

			if (currentPanel) {
				// If we already have a panel, show it in the target column
				currentPanel.reveal(columnToShowIn);
			} else {
				// Otherwise, create a new panel
				currentPanel = vscode.window.createWebviewPanel(
					'cicero',
					'Accord Project Preview',
					columnToShowIn, {
						enableScripts: true
					  }
				);

				currentPanel.webview.html = await getWebviewContent();

				// Reset when the current panel is closed
				currentPanel.onDidDispose(
					() => {
						currentPanel = undefined;
					},
					null,
					context.subscriptions
				);

				// update the preview when the text document changes
				vscode.workspace.onDidChangeTextDocument( async (event) => {
					const content = await onDocumentChange(event);
					if(content) {
						currentPanel.webview.html = content;
					}
				});

				// update the preview when the active editor changes
				vscode.window.onDidChangeActiveTextEditor( async (event) => {
					const content = await onDocumentChange(event);
					if(content) {
						currentPanel.webview.html = content;
					}
				});
			}
		})
	);

	// Create the language client and start the client.
	client = new LanguageClient(
		'cicero',
		'Cicero Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable < void > | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}