'use strict';

import {
	createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind,
	Diagnostic, DiagnosticSeverity, TextDocument
} from 'vscode-languageserver';

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import fileUriToPath from './fileUriToPath';
const util = require('util');

import { TemplateLogic } from '@accordproject/ergo-compiler';
import { ModelFile } from 'composer-concerto';

// Creates the LSP connection
let connection = createConnection(ProposedFeatures.all);

// Create a manager for open text documents
let documents = new TextDocuments();

// The workspace folder this server is operating on
let workspaceFolder: string;

const FULL_RANGE = {
    start: { line: 0, character: 0 },
    end:  { line: 0, character: 0 },
};

function getRange(err) {
    if(err.fileLocation) {
        return {
            start: { line: err.fileLocation.start.line-1, character: err.fileLocation.start.column },
            end: { line: err.fileLocation.end.line-1, character: err.fileLocation.end.column }
        };
    }
    else {
        return FULL_RANGE;
    }
}

/**
 * Utility method to create a diagnostic
 * @param fileUri the URI of the associated file
 * @param severity the severity of the error
 * @param range the range for the error
 * @param errorMessage the error message
 * @param type the type of the message
 * @param relatedMessage any additional message
 */
function createDiagnostic(fileUri, severity, range, errorMessage, type : string, relatedMessage : string ) {
    let diagnostic: Diagnostic = {
        severity: severity,
        range: fileUri : FULL_RANGE ? range,
        message: errorMessage,
        source: type
    };

    if(fileUri) {
        diagnostic.relatedInformation = [
            {
              location: {
                uri: fileUri,
                range: Object.assign({}, range)
              },
              message: relatedMessage
            },
          ];    
    }

    return diagnostic;
}

documents.onDidOpen((event) => {
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
})
documents.listen(connection);

connection.onInitialize((params) => {
	workspaceFolder = params.rootUri;
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Full
			}
		}
	}
});

// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
	  // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
});


/**
 * Validate Ergo and CTO files.
 * 
 * @param textDocument - a TextDocument
 */
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    let diagnostics: Diagnostic[] = [];

    try {
        connection.console.log(`File modified: ${textDocument.uri}`);

        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const folder = pathStr.substring(0,pathStr.lastIndexOf("/")+1);
    
        // review DCS - this assumes that we don't have sub-folders under models or lib
        const parentDir = path.resolve(`${folder}../`);
    
        const thisTemplateLogic = new TemplateLogic('cicero');
        connection.console.log(`Validating template logic for: ${parentDir}`);
        const thisModelManager = thisTemplateLogic.getModelManager();
        thisModelManager.clearModelFiles();
    
        // Find all cto files in ./ relative to this file or in the parent directory if this is a Cicero template.
        const modelFiles = glob.sync(`{${folder},${parentDir}/models/}**/*.cto`);

        // validate the model files
        try {
            for (const file of modelFiles) {
                connection.console.log(file);
                let contents = null;
                if (file === pathStr) {
                    // Update the current file being edited
                    contents = textDocument.getText();
                } else {
                    contents = fs.readFileSync(file, 'utf8');
                }

                const modelFile: any = new ModelFile(thisModelManager, contents, file);
                if (!thisModelManager.getModelFile(modelFile.getNamespace())) {
                    thisModelManager.addModelFile(contents, file, true);
                } else {
                    thisModelManager.updateModelFile(contents, file, true);
                }
            }

            // download external dependencies and validate
            await thisModelManager.updateExternalModels();
        }
        catch(err) {
            connection.console.log(`Concerto error: ${err}`);

            let fileName = err.fileName;
            connection.console.log(util.inspect(err, false, null))

            if(!fileName && err.getModelFile()) {
                fileName = err.getModelFile().getName();
                connection.console.log(`*** fileName: ${fileName}`);
            }
            let diagnostic: Diagnostic = 
                createDiagnostic(fileName, DiagnosticSeverity.Error, getRange(err),
                    err.message,
                    'concerto',
                    'Model error');              
            diagnostics.push(diagnostic);
        }

        // validate the ergo files
        try {
            // Find all ergo files in ./ relative to this file
            const ergoFiles = glob.sync(`{${folder},${parentDir}/lib/}**/*.ergo`);
            for (const file of ergoFiles) {
                if (file === pathStr) {
                    // Update the current file being edited
                    thisTemplateLogic.updateLogic(textDocument.getText(), pathStr);
                } else {
                    connection.console.log(file);
                    const contents = fs.readFileSync(file, 'utf8');
                    thisTemplateLogic.updateLogic(contents, file);
                }
            }

            const compiled = await thisTemplateLogic.compileLogic(true);
        } catch (error) {
            const descriptor = error.descriptor;
            connection.console.log(`Ergo error: ${error}`);
            let fileName = null;

            if(descriptor) {
                if(descriptor.verbose) {
                    // review (DCS) hack to extract the filename from the verbose message
                    const regex = /.+at file (.+\.ergo).+/gm;
                    const match = regex.exec(descriptor.verbose);
                    connection.console.log(`Match: ${match}`);
                    if(match.length > 0) {
                        fileName = match[1];
                        connection.console.log(`fileName: ${fileName}`);
                    }    
                }

                const range = JSON.parse(JSON.stringify(FULL_RANGE));

                if(descriptor.kind === 'CompilationError' || descriptor.kind === 'TypeError' ){
                    
                    if(descriptor.locstart.line > 0) {
                        range.start =  { line: descriptor.locstart.line-1, character: descriptor.locstart.character };
                        range.end = range.start;
                    }
                    if(descriptor.locend.line > 0) {
                        range.end = { line: descriptor.locend.line-1, character: descriptor.locend.character };
                    }
                    let diagnostic: Diagnostic = 
                    createDiagnostic(fileName, DiagnosticSeverity.Error, range,
                        descriptor.message,
                        'ergo',
                        'Ergo error');                
                    diagnostics.push(diagnostic);
                } else {
                    let diagnostic: Diagnostic = 
                    createDiagnostic(fileName, DiagnosticSeverity.Error, {
                        start: { line: descriptor.locstart.line-1, character: descriptor.locstart.character },
                        end:  { line: descriptor.locend.line-1, character: descriptor.locend.character },
                    },
                    descriptor.message,
                    'ergo',
                    'Ergo error');                
                    diagnostics.push(diagnostic);
                }
            }
            else {
                if(error.getModelFile()) {
                    fileName = error.getModelFile().getName();
                    connection.console.log(`fileName: ${fileName}`);
                }
                let diagnostic: Diagnostic = 
                createDiagnostic(fileName, DiagnosticSeverity.Error, range,
                error.message,
                'ergo',
                'Ergo error');
                diagnostics.push(diagnostic);
            }
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.listen();