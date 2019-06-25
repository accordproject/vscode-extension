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

import { Template, Clause } from '@accordproject/cicero-core';
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

/**
 * Lots of hacks to extract line numbers from exceptions
 * 
 * @param error the exception
 */
function getRange(error) {
    if(error.fileLocation) {
        return {
            start: { line: error.fileLocation.start.line-1, character: error.fileLocation.start.column },
            end: { line: error.fileLocation.end.line-1, character: error.fileLocation.end.column }
        };
    }
    else if(error.descriptor) {
        if(error.descriptor.kind === 'CompilationError' || error.descriptor.kind === 'TypeError') {
            if(error.descriptor.locstart.line > 0) {
                const startRange = { line: error.descriptor.locstart.line-1, character: error.descriptor.locstart.character };
                return {
                    start: startRange,
                    end: startRange
                }
            }
            if(error.descriptor.locend.line > 0) {
                return {
                    start: { line: 0, character: 0 },
                    end: { line: error.descriptor.locend.line-1, character: error.descriptor.locend.character }
                }
            }
        }
        else {
            return {
                start: { line: error.descriptor.locstart.line-1, character: error.descriptor.locstart.character },
                end:  { line: error.descriptor.locend.line-1, character: error.descriptor.locend.character },
            }
        }
    }
    
    return FULL_RANGE;
}

/**
 * A cache of TemplateLogic instances. The keys are
 * the root folder names. The values are the TemplateLogic instances.
 * Note that we will leak instances if people rename the root folder...
 */
const templateCache = {};

/**
 * 
 * @param textDocument 
 * @param error 
 * @param type 
 */
function pushError(textDocument, error, type, diagnostics) {

    connection.console.log(util.inspect(error, false, null))

    let fileName = error.fileName;

    // hack to extract the filename from the verbose message
    if(!fileName && error.descriptor && error.descriptor.verbose) {
        const regex = /.+at file (.+\.ergo).+/gm;
        const match = regex.exec(error.descriptor.verbose);
        connection.console.log(`Match: ${match}`);
        if(match && match.length > 0) {
            fileName = match[1];
            connection.console.log(`fileName: ${fileName}`);
        }
    }

    // hack to extract the filename from the model file
    if(!fileName && error.getModelFile && error.getModelFile()) {
        fileName = error.getModelFile().getName();
    }

    let diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: getRange(error),
        message: error.message,
        source: type
    };

    // if we have a fileName, then we use it
    if(fileName && textDocument.uri !== fileName) {
        diagnostic.relatedInformation = [
            {
              location: {
                uri: fileName,
                range: Object.assign({}, getRange(error))
              },
              message: error.message
            },
          ];    
    }

    diagnostics.push(diagnostic);
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
    connection.console.log(`File modified: ${textDocument.uri}`);
    const diagnostics = [];

    const pathStr = path.resolve(fileUriToPath(textDocument.uri));
    const fileExtension = path.extname(pathStr);

    // this will assemble all the models into a ModelManager
    // and validate - so it needs to always run before we do anything else
    await validateModels(textDocument, diagnostics);

    // if the model is valid, then we proceed
    if(diagnostics.length === 0) {
        switch(fileExtension) {
            case '.cto':
                    // if a cto file has been modified then we check all ergo files and the template
                    await compileErgoFiles(textDocument, diagnostics);

                    // if ergo is valid we proceed to check the template
                    if(diagnostics.length === 0) {
                        await validateTemplateFile(textDocument, diagnostics);
                    }
                break;
            case '.ergo':
                // if ergo code has changed, we recompile all ergo
                await compileErgoFiles(textDocument, diagnostics);
                break;
            case '.tem':
                // if a template file has changed, we check we can parse sample.txt
                await validateTemplateFile(textDocument, diagnostics);
                break;
        }    
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

/**
 * Validate a change to an ergo file: we recompile all ergo files.
 * 
 * @param textDocument - a TextDocument (Ergo file or a CTO file)
 */
async function compileErgoFiles(textDocument: TextDocument, diagnostics): Promise<void> {

    try {
        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const folder = pathStr.substring(0,pathStr.lastIndexOf("/")+1);

        // review DCS - this assumes that we don't have sub-folders under models or lib
        const parentDir = path.resolve(`${folder}../`);

        // get the template logic from cache
        let templateLogic = templateCache[parentDir];
        connection.console.log(`Compiling ergo files under: ${parentDir}`);

        try {
            // Find all ergo files in ./ relative to this file
            const ergoFiles = glob.sync(`{${folder},${parentDir}/lib/}**/*.ergo`);
            for (const file of ergoFiles) {
                if (file === pathStr) {
                    // Update the current file being edited
                    templateLogic.updateLogic(textDocument.getText(), pathStr);
                } else {
                    connection.console.log(file);
                    const contents = fs.readFileSync(file, 'utf8');
                    templateLogic.updateLogic(contents, file);
                }
            }
            await templateLogic.compileLogic(true);
        } catch (error) {
            pushError(textDocument, error, 'logic', diagnostics);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }
}

/**
 * Rebuild the model manager and validates all the models
 * 
 * @param textDocument - a TextDocument
 */
async function validateModels(textDocument: TextDocument, diagnostics): Promise<void> {
    try {
        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const folder = pathStr.substring(0,pathStr.lastIndexOf("/")+1);    
        // review DCS - this assumes that we don't have sub-folders under models or lib
        const parentDir = path.resolve(`${folder}../`);
        connection.console.log(`Validating model files under: ${parentDir}`);

        // get the template logic from cache
        let templateLogic = templateCache[parentDir];

        if(!templateLogic) {
            templateLogic = new TemplateLogic('cicero');
            templateCache[parentDir] = templateLogic;
        }
        
        const modelManager = templateLogic.getModelManager();
        modelManager.clearModelFiles();
    
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

                const modelFile: any = new ModelFile(modelManager, contents, file);
                if (!modelManager.getModelFile(modelFile.getNamespace())) {
                    modelManager.addModelFile(contents, file, true);
                } else {
                    modelManager.updateModelFile(contents, file, true);
                }
            }

            // download external dependencies and validate
            await modelManager.updateExternalModels();
        }
        catch(error) {
            pushError(textDocument, error, 'model', diagnostics);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }
}

/**
 * Validates a Cicero template file
 * 
 * @param textDocument - a TextDocument
 */
async function validateTemplateFile(textDocument: TextDocument, diagnostics): Promise<void> {

    try {
        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const folder = pathStr.substring(0,pathStr.lastIndexOf("/")+1);    
        // review DCS - this assumes that we don't have sub-folders under models or lib
        const parentDir = path.resolve(`${folder}../`);

        try {
            connection.console.log(`Validating template under: ${parentDir}`);
            const template = await Template.fromDirectory(parentDir);
            template.parserManager.buildGrammar(textDocument.getText());
            template.validate();

            try {
                connection.console.log(`Built template: ${template.getIdentifier()}`);
                const sample = fs.readFileSync(parentDir + '/sample.txt', 'utf8');
                const clause = new Clause(template);
                clause.parse(sample);
                connection.console.log(`Parsed sample.text: ${JSON.stringify(clause.getData(), null, 2)}`);
            }
            catch(error) {
                error.fileName = parentDir + '/sample.txt';
                pushError(textDocument, error, 'template', diagnostics);
            }
        }
        catch(error) {
            error.fileName = parentDir + '/grammar/template.tem';
            pushError(textDocument, error, 'template', diagnostics);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }
}

connection.listen();