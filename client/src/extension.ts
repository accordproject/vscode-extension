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

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('server/src', 'server.js'));
	// The debug options for the server
	let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
	
	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
	}
	
	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{scheme: 'file', language: 'ergo'}, 
			{scheme: 'file', language: 'concerto'},
			{scheme: 'file', language: 'ciceroTemplate'},
			{
				scheme: 'file', language: 'plaintext',
				pattern: '**/sample.md',
			}
		],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'Cicero',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	}
	
	// Create the language client and start the client.
	let disposable = new LanguageClient('Cicero', 'Cicero', serverOptions, clientOptions).start();
	
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);
}