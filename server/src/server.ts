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

import {
	createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind,
	Diagnostic, DiagnosticSeverity, TextDocument
} from 'vscode-languageserver';

import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import fileUriToPath from './fileUriToPath';

import { Template, Clause } from '@accordproject/cicero-core';
import { LogicManager } from '@accordproject/ergo-compiler';
import { ModelFile } from '@accordproject/concerto-core';

const util = require('util');
// Creates the LSP connection
let connection = createConnection(ProposedFeatures.all);

// Create a manager for open text documents
let documents = new TextDocuments();

// The workspace folder this server is operating on
let workspaceFolder: string;

// an empty range (this will highlight the first word in the document)
const FULL_RANGE = {
    start: { line: 0, character: 0 },
    end:  { line: 0, character: 0 },
};

/**
 * Gets the root file path for a template, from a path under the root, by walking
 * up the directory hierarchy looking for a package.json file that contains the 
 * 'accordproject' key. If a valid package.json is missing then a diagnostic error is
 * pushed for the textDocument and null is returned
 * @param {string} pathStr the full path
 * @param {TextDocument} textDocument the textDocument we are processing
 * @returns {string} the root file path
 */
function getTemplateRoot(pathStr, textDocument, diagnosticMap) {

    let currentPath = pathStr;

    while(currentPath !== '/' && currentPath.split(":").pop() !== '\\') {
        connection.console.log( `- ${currentPath}`);

        try {
            const packageJsonContents = getEditedFileContents(currentPath + '/package.json');
            const packageJson = JSON.parse(packageJsonContents);
            if(packageJson.accordproject) {
                return currentPath;
            }
        }
        catch(err) {
            connection.console.log( `- exception ${err}`);
            currentPath = path.normalize(path.join(currentPath, '..'));
        }
    }

    connection.console.log( `Failed to find template path for ${pathStr}`);
    const error = {message: `${pathStr} is not a sub-folder of an Accord Project template. Ensure a parent folder contains a valid package.json.`};
    pushDiagnostic(DiagnosticSeverity.Error, textDocument, error, 'template', diagnosticMap);
    return null;
}

/**
 * Returns the contents of a file from disk, or if the file
 * has been opened for editing, then the edited contents is returned.
 * @param file 
 */
function getEditedFileContents(file) {

    const key = 'file://' + file;
    const document = documents.get(key);

    connection.console.log(`Getting ${key}`)

    if(document) {
        connection.console.log(`- returning editor content`)
        return document.getText();
    }
    else {
        connection.console.log(`- returning file system content`)
        return fs.readFileSync(file, 'utf8');    
    }
}

/**
 * Extract line numbers from exceptions
 * 
 * @param error the exception
 * @returns the range object
 */
function getRange(error: any) {
    if(error.fileLocation) {
        return {
            start: { line: error.fileLocation.start.line-1, character: error.fileLocation.start.column },
            end: { line: error.fileLocation.end.line-1, character: error.fileLocation.end.column }
        };
    }
    
    return FULL_RANGE;
}

/**
 * Converts an error (exception) to a VSCode Diagnostic and
 * pushes it onto the diagnosticMap
 * @param severity the severity level for the diagnostic
 * @param textDocument the text document associated (the doc that has been modified)
 * @param error the exception
 * @param type the type of the exception
 */
function pushDiagnostic(severity, textDocument: TextDocument, error : any, type : string, diagnosticMap) {

    connection.console.log(util.inspect(error, false, null))

    let fileName = error.fileName;

    let diagnostic: Diagnostic = {
        severity,
        range: getRange(error),
        message: error.message,
        source: type
    };

    // last resort, we assume the error is related
    // to the document that was just changed
    if(!fileName) {
        fileName = textDocument.uri;
    }

    // add the diagnostic
    if(!diagnosticMap[fileName]) {
        diagnosticMap[fileName] = new Set();
    }
    
    diagnosticMap[fileName].add(diagnostic);
}

/**
 * Declares that a file has no errors in the diagnostic map.
 * We need to call this on all files that DO NOT have errors
 * to ensure that error markers are removed.
 * 
 * @param fileName the uri of the file
 * @param diagnosticMap the diagnostic map
 */
function clearErrors(fileName, type, diagnosticMap) {

    const errors = diagnosticMap[fileName];

    if(!errors) {
        diagnosticMap[fileName] = new Set();
    }
    else {
        errors.forEach(function(error){
            if (error.source === type) {
              errors.delete(error);
            }
          });
    }
}

/**
 * Called when a document is opened
 */
documents.onDidOpen((event) => {
	connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`);
})

/**
 * Connect the document connection to the client
 */
documents.listen(connection);

/**
 * Called when the extension initializes
 */
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

/**
 * The content of a text document has changed. This event is emitted
 * when the text document is first opened or when its content has changed.
 */
documents.onDidChangeContent(async (change) => {
	  // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
});

/**
 * A cache of LogicManager/template instances. The keys are the root folder names.
 * Values have a logicManager and a template property
 */
const templateCache = {};

/**
 * Called when the contents of a document changes
 * 
 * @param textDocument - a TextDocument
 */
async function validateTextDocument(textDocument: TextDocument): Promise<void> {

    try {
        connection.console.log(`*** Document modified: ${textDocument.uri}`);

        /**
         * Map of diagnostics, with the key being the document URI
         * and the value being a Set of Diagnostic instances
         */
        const diagnosticMap = {
        }

        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        let fileExtension = path.extname(pathStr);
        if (fileExtension === '.md') {
            if (path.extname(path.basename(pathStr)) === '.tem') {
                fileExtension = '.tem.md';
            }
        }

        // this will assemble all the models into a ModelManager
        // and validate - so it needs to always run before we do anything else
        const modelValid = await validateModels(textDocument, diagnosticMap, templateCache);
        let ergoValid = true;
    
        // if the model is valid, then we proceed
        if(modelValid) {
            switch(fileExtension) {
                case '.cto':
                case '.ergo':
                    // if a cto or ergo file has been modified then we compile all ergo files
                    ergoValid = await compileErgoFiles(textDocument, diagnosticMap, templateCache);    
                    break;
                case '.tem.md':
                    break;
                case '.md':
                    // if a md file has changed we try to parse it
                    await parseSampleFile(textDocument, diagnosticMap, templateCache);
                    break;
            }

            // if ergo is valid we proceed to check we can build the template
            if(ergoValid) {
                await validateTemplateFile(textDocument, diagnosticMap, templateCache);
            }            
        }
    
        // send all the diagnostics we have accumulated back to the client
        Object.keys(diagnosticMap).forEach(function(key) {
            const fileDiagnostics : Set<Diagnostic> = diagnosticMap[key];
            connection.sendDiagnostics({ uri: key, diagnostics : [...fileDiagnostics] });
          });
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }
}

/**
 * Validate a change to an ergo file: we recompile all ergo files.
 * 
 * @param textDocument - a TextDocument (Ergo file or a CTO file)
 * @return Promise<boolean> true the ergo files are valid
 */
async function compileErgoFiles(textDocument: TextDocument, diagnosticMap, templateCache): Promise<boolean> {

    try {
        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const folder = pathStr.substring(0,pathStr.lastIndexOf("/")+1);
        const parentDir = getTemplateRoot(pathStr, textDocument, diagnosticMap);

        if(!parentDir) {
            return false;
        }

        try {
            // get the template logic from cache
            let logicManager = templateCache[parentDir].logicManager;
            connection.console.log(`Compiling ergo files under: ${parentDir}`);
    
            // Find all ergo files in ./ relative to this file
            const ergoFiles = glob.sync(`{${folder},${parentDir}/logic/}**/*.ergo`);
            for (const file of ergoFiles) {
                clearErrors(file, 'logic', diagnosticMap);
                const contents = getEditedFileContents(file);
                logicManager.updateLogic(contents, file);
            }
            await logicManager.compileLogic(true);
            return true;
        } catch (error) {
            pushDiagnostic(DiagnosticSeverity.Error, textDocument, error, 'logic', diagnosticMap);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }

    return false;
}

/**
 * Rebuild the model manager and validates all the models
 * 
 * @param textDocument - a TextDocument
 * @return Promise<boolean> true the model is valid
 */
async function validateModels(textDocument: TextDocument, diagnosticMap, templateCache): Promise<boolean> {
    const pathStr = path.resolve(fileUriToPath(textDocument.uri));
    const folder = pathStr.substring(0,pathStr.lastIndexOf("/")+1);

    try {
        const parentDir = getTemplateRoot(pathStr, textDocument, diagnosticMap);
        if(!parentDir) {
            return false;
        }
        connection.console.log(`Validating model files under: ${parentDir}`);

        // get the template logic from cache
        let templateCacheEntry = templateCache[parentDir];
        let logicManager = null;

        if(!templateCacheEntry) {
            logicManager = new LogicManager('cicero');
            templateCache[parentDir] = {
                logicManager,
                template: null
            }
        }
        else {
            logicManager = templateCacheEntry.logicManager;
        }
        
        const modelManager = logicManager.getModelManager();
        modelManager.clearModelFiles();
    
        // Find all cto files in ./ relative to this file or in the parent directory if this is a Cicero template.
        const modelFiles = glob.sync(`{${folder},${parentDir}/model/}**/*.cto`);

        // validate the model files
        try {
            for (const file of modelFiles) {
                clearErrors(file, 'model', diagnosticMap);
                const contents = getEditedFileContents(file);
                const modelFile: any = new ModelFile(modelManager, contents, file);
                if (!modelManager.getModelFile(modelFile.getNamespace())) {
                    modelManager.addModelFile(contents, file, true);
                } else {
                    modelManager.updateModelFile(contents, file, true);
                }
            }

            // download external dependencies and validate
            try {
                await modelManager.updateExternalModels();
            }
            catch(err) {
                // we may be offline? Validate without external models
                modelManager.validateModelFiles();
                pushDiagnostic(DiagnosticSeverity.Warning, textDocument, err, 'model', diagnosticMap);
            }
            return true;
        }
        catch(error) {
            pushDiagnostic(DiagnosticSeverity.Error, textDocument, error, 'model', diagnosticMap);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }

    return false;
}

/**
 * Validate that we can build the template archive
 * 
 * @param textDocument - a TextDocument. WARNING, this may not be the .tem file!
 * @return Promise<boolean> true the template is valid
 */
async function validateTemplateFile(textDocument: TextDocument, diagnosticMap, templateCache): Promise<boolean> {

    try {
        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const parentDir = getTemplateRoot(pathStr, textDocument, diagnosticMap);
        if(!parentDir) {
            return false;
        }

        try {
            connection.console.log(`Validating template under: ${parentDir}`);
            clearErrors(parentDir + '/text/grammar.tem.md', 'template', diagnosticMap);
            const template = await Template.fromDirectory(parentDir);
            const grammar = getEditedFileContents(parentDir + '/text/grammar.tem.md');
            template.parserManager.buildGrammar(grammar);
            template.validate();
            templateCache[parentDir].template = template;
            connection.console.log(`==> saved grammar: ${template.getIdentifier()}`);
            return true;
        }
        catch(error) {
            templateCache[parentDir].template = null;
            error.fileName = parentDir + '/text/grammar.tem.md';
            pushDiagnostic(DiagnosticSeverity.Error, textDocument, error, 'template', diagnosticMap);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }

    return false;
}

/**
 * Parse sample.md
 * 
 * @param textDocument - a TextDocument
 * @return Promise<boolean> true the template and sample.md are valid
 */
async function parseSampleFile(textDocument: TextDocument, diagnosticMap, templateCache): Promise<boolean> {

    try {
        const pathStr = path.resolve(fileUriToPath(textDocument.uri));
        const parentDir = getTemplateRoot(pathStr, textDocument, diagnosticMap);
        if(!parentDir || !templateCache[parentDir] || !templateCache[parentDir].template) {
            return false;
        }

        const template = templateCache[parentDir].template;

        if(!template) {
            return false;
        }

        connection.console.log(`Parsing text file using template: ${template.getIdentifier()}`);
        clearErrors(textDocument.uri, 'sample', diagnosticMap);
        
        try {
            const clause = new Clause(template);
            clause.parse(textDocument.getText());
            connection.console.log(`Parsed sample.md: ${JSON.stringify(clause.getData(), null, 2)}`);
            return true;
        }
        catch(error) {
            error.fileName = textDocument.uri;
            pushDiagnostic(DiagnosticSeverity.Error, textDocument, error, 'sample', diagnosticMap);
        }
    }
    catch(error) {
        connection.console.error(error.message);
        connection.console.error(error.stack);
    }

    return false;
}

connection.listen();