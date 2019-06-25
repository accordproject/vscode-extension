'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const glob_1 = require("glob");
const fs = require("fs");
const path = require("path");
const fileUriToPath_1 = require("./fileUriToPath");
const util = require('util');
const cicero_core_1 = require("@accordproject/cicero-core");
const ergo_compiler_1 = require("@accordproject/ergo-compiler");
const composer_concerto_1 = require("composer-concerto");
// Creates the LSP connection
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
// Create a manager for open text documents
let documents = new vscode_languageserver_1.TextDocuments();
// The workspace folder this server is operating on
let workspaceFolder;
const FULL_RANGE = {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 },
};
/**
 * Lots of hacks to extract line numbers from exceptions
 *
 * @param error the exception
 */
function getRange(error) {
    if (error.fileLocation) {
        return {
            start: { line: error.fileLocation.start.line - 1, character: error.fileLocation.start.column },
            end: { line: error.fileLocation.end.line - 1, character: error.fileLocation.end.column }
        };
    }
    else if (error.descriptor) {
        if (error.descriptor.kind === 'CompilationError' || error.descriptor.kind === 'TypeError') {
            if (error.descriptor.locstart.line > 0) {
                const startRange = { line: error.descriptor.locstart.line - 1, character: error.descriptor.locstart.character };
                return {
                    start: startRange,
                    end: startRange
                };
            }
            if (error.descriptor.locend.line > 0) {
                return {
                    start: { line: 0, character: 0 },
                    end: { line: error.descriptor.locend.line - 1, character: error.descriptor.locend.character }
                };
            }
        }
        else {
            return {
                start: { line: error.descriptor.locstart.line - 1, character: error.descriptor.locstart.character },
                end: { line: error.descriptor.locend.line - 1, character: error.descriptor.locend.character },
            };
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
    connection.console.log(util.inspect(error, false, null));
    let fileName = error.fileName;
    // hack to extract the filename from the verbose message
    if (!fileName && error.descriptor && error.descriptor.verbose) {
        const regex = /.+at file (.+\.ergo).+/gm;
        const match = regex.exec(error.descriptor.verbose);
        connection.console.log(`Match: ${match}`);
        if (match && match.length > 0) {
            fileName = match[1];
            connection.console.log(`fileName: ${fileName}`);
        }
    }
    // hack to extract the filename from the model file
    if (!fileName && error.getModelFile && error.getModelFile()) {
        fileName = error.getModelFile().getName();
    }
    let diagnostic = {
        severity: vscode_languageserver_1.DiagnosticSeverity.Error,
        range: getRange(error),
        message: error.message,
        source: type
    };
    // if we have a fileName, then we use it
    if (fileName && textDocument.uri !== fileName) {
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
});
documents.listen(connection);
connection.onInitialize((params) => {
    workspaceFolder = params.rootUri;
    connection.console.log(`[Server(${process.pid}) ${workspaceFolder}] Started and initialize received`);
    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: vscode_languageserver_1.TextDocumentSyncKind.Full
            }
        }
    };
});
// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent((change) => __awaiter(this, void 0, void 0, function* () {
    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
}));
/**
 * Validate Ergo and CTO files.
 *
 * @param textDocument - a TextDocument
 */
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        connection.console.log(`File modified: ${textDocument.uri}`);
        const diagnostics = [];
        const pathStr = path.resolve(fileUriToPath_1.default(textDocument.uri));
        const fileExtension = path.extname(pathStr);
        // this will assemble all the models into a ModelManager
        // and validate - so it needs to always run before we do anything else
        yield validateModels(textDocument, diagnostics);
        // if the model is valid, then we proceed
        if (diagnostics.length === 0) {
            switch (fileExtension) {
                case '.cto':
                    // if a cto file has been modified then we check all ergo files and the template
                    yield compileErgoFiles(textDocument, diagnostics);
                    // if ergo is valid we proceed to check the template
                    if (diagnostics.length === 0) {
                        yield validateTemplateFile(textDocument, diagnostics);
                    }
                    break;
                case '.ergo':
                    // if ergo code has changed, we recompile all ergo
                    yield compileErgoFiles(textDocument, diagnostics);
                    break;
                case '.tem':
                    // if a template file has changed, we check we can parse sample.txt
                    yield validateTemplateFile(textDocument, diagnostics);
                    break;
            }
        }
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    });
}
/**
 * Validate a change to an ergo file: we recompile all ergo files.
 *
 * @param textDocument - a TextDocument (Ergo file or a CTO file)
 */
function compileErgoFiles(textDocument, diagnostics) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const pathStr = path.resolve(fileUriToPath_1.default(textDocument.uri));
            const folder = pathStr.substring(0, pathStr.lastIndexOf("/") + 1);
            // review DCS - this assumes that we don't have sub-folders under models or lib
            const parentDir = path.resolve(`${folder}../`);
            // get the template logic from cache
            let templateLogic = templateCache[parentDir];
            connection.console.log(`Compiling ergo files under: ${parentDir}`);
            try {
                // Find all ergo files in ./ relative to this file
                const ergoFiles = glob_1.glob.sync(`{${folder},${parentDir}/lib/}**/*.ergo`);
                for (const file of ergoFiles) {
                    if (file === pathStr) {
                        // Update the current file being edited
                        templateLogic.updateLogic(textDocument.getText(), pathStr);
                    }
                    else {
                        connection.console.log(file);
                        const contents = fs.readFileSync(file, 'utf8');
                        templateLogic.updateLogic(contents, file);
                    }
                }
                yield templateLogic.compileLogic(true);
            }
            catch (error) {
                pushError(textDocument, error, 'logic', diagnostics);
            }
        }
        catch (error) {
            connection.console.error(error.message);
            connection.console.error(error.stack);
        }
    });
}
/**
 * Rebuild the model manager and validates all the models
 *
 * @param textDocument - a TextDocument
 */
function validateModels(textDocument, diagnostics) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const pathStr = path.resolve(fileUriToPath_1.default(textDocument.uri));
            const folder = pathStr.substring(0, pathStr.lastIndexOf("/") + 1);
            // review DCS - this assumes that we don't have sub-folders under models or lib
            const parentDir = path.resolve(`${folder}../`);
            connection.console.log(`Validating model files under: ${parentDir}`);
            // get the template logic from cache
            let templateLogic = templateCache[parentDir];
            if (!templateLogic) {
                templateLogic = new ergo_compiler_1.TemplateLogic('cicero');
                templateCache[parentDir] = templateLogic;
            }
            const modelManager = templateLogic.getModelManager();
            modelManager.clearModelFiles();
            // Find all cto files in ./ relative to this file or in the parent directory if this is a Cicero template.
            const modelFiles = glob_1.glob.sync(`{${folder},${parentDir}/models/}**/*.cto`);
            // validate the model files
            try {
                for (const file of modelFiles) {
                    connection.console.log(file);
                    let contents = null;
                    if (file === pathStr) {
                        // Update the current file being edited
                        contents = textDocument.getText();
                    }
                    else {
                        contents = fs.readFileSync(file, 'utf8');
                    }
                    const modelFile = new composer_concerto_1.ModelFile(modelManager, contents, file);
                    if (!modelManager.getModelFile(modelFile.getNamespace())) {
                        modelManager.addModelFile(contents, file, true);
                    }
                    else {
                        modelManager.updateModelFile(contents, file, true);
                    }
                }
                // download external dependencies and validate
                yield modelManager.updateExternalModels();
            }
            catch (error) {
                pushError(textDocument, error, 'model', diagnostics);
            }
        }
        catch (error) {
            connection.console.error(error.message);
            connection.console.error(error.stack);
        }
    });
}
/**
 * Validates a Cicero template file
 *
 * @param textDocument - a TextDocument
 */
function validateTemplateFile(textDocument, diagnostics) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const pathStr = path.resolve(fileUriToPath_1.default(textDocument.uri));
            const folder = pathStr.substring(0, pathStr.lastIndexOf("/") + 1);
            // review DCS - this assumes that we don't have sub-folders under models or lib
            const parentDir = path.resolve(`${folder}../`);
            try {
                connection.console.log(`Validating template under: ${parentDir}`);
                const template = yield cicero_core_1.Template.fromDirectory(parentDir);
                template.parserManager.buildGrammar(textDocument.getText());
                template.validate();
                try {
                    connection.console.log(`Built template: ${template.getIdentifier()}`);
                    const sample = fs.readFileSync(parentDir + '/sample.txt', 'utf8');
                    const clause = new cicero_core_1.Clause(template);
                    clause.parse(sample);
                    connection.console.log(`Parsed sample.text: ${JSON.stringify(clause.getData(), null, 2)}`);
                }
                catch (error) {
                    error.fileName = parentDir + '/sample.txt';
                    pushError(textDocument, error, 'template', diagnostics);
                }
            }
            catch (error) {
                error.fileName = parentDir + '/grammar/template.tem';
                pushError(textDocument, error, 'template', diagnostics);
            }
        }
        catch (error) {
            connection.console.error(error.message);
            connection.console.error(error.stack);
        }
    });
}
connection.listen();
//# sourceMappingURL=server.js.map