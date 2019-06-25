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
function getRange(err) {
    if (err.fileLocation) {
        return {
            start: { line: err.fileLocation.start.line - 1, character: err.fileLocation.start.column },
            end: { line: err.fileLocation.end.line - 1, character: err.fileLocation.end.column }
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
function createDiagnostic(fileUri, severity, range, errorMessage, type, relatedMessage) {
    let diagnostic = {
        severity: severity,
        range: fileUri, FULL_RANGE, range,
        message: errorMessage,
        source: type
    };
    if (fileUri) {
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
        let diagnostics = [];
        try {
            connection.console.log(`File modified: ${textDocument.uri}`);
            const pathStr = path.resolve(fileUriToPath_1.default(textDocument.uri));
            const folder = pathStr.substring(0, pathStr.lastIndexOf("/") + 1);
            // review DCS - this assumes that we don't have sub-folders under models or lib
            const parentDir = path.resolve(`${folder}../`);
            const thisTemplateLogic = new ergo_compiler_1.TemplateLogic('cicero');
            connection.console.log(`Validating template logic for: ${parentDir}`);
            const thisModelManager = thisTemplateLogic.getModelManager();
            thisModelManager.clearModelFiles();
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
                    const modelFile = new composer_concerto_1.ModelFile(thisModelManager, contents, file);
                    if (!thisModelManager.getModelFile(modelFile.getNamespace())) {
                        thisModelManager.addModelFile(contents, file, true);
                    }
                    else {
                        thisModelManager.updateModelFile(contents, file, true);
                    }
                }
                // download external dependencies and validate
                yield thisModelManager.updateExternalModels();
            }
            catch (err) {
                connection.console.log(`Concerto error: ${err}`);
                let fileName = err.fileName;
                connection.console.log(util.inspect(err, false, null));
                if (!fileName && err.getModelFile()) {
                    fileName = err.getModelFile().getName();
                    connection.console.log(`*** fileName: ${fileName}`);
                }
                let diagnostic = createDiagnostic(fileName, vscode_languageserver_1.DiagnosticSeverity.Error, getRange(err), err.message, 'concerto', 'Model error');
                diagnostics.push(diagnostic);
            }
            // validate the ergo files
            try {
                // Find all ergo files in ./ relative to this file
                const ergoFiles = glob_1.glob.sync(`{${folder},${parentDir}/lib/}**/*.ergo`);
                for (const file of ergoFiles) {
                    if (file === pathStr) {
                        // Update the current file being edited
                        thisTemplateLogic.updateLogic(textDocument.getText(), pathStr);
                    }
                    else {
                        connection.console.log(file);
                        const contents = fs.readFileSync(file, 'utf8');
                        thisTemplateLogic.updateLogic(contents, file);
                    }
                }
                const compiled = yield thisTemplateLogic.compileLogic(true);
            }
            catch (error) {
                const descriptor = error.descriptor;
                connection.console.log(`Ergo error: ${error}`);
                let fileName = null;
                if (descriptor) {
                    if (descriptor.verbose) {
                        // review (DCS) hack to extract the filename from the verbose message
                        const regex = /.+at file (.+\.ergo).+/gm;
                        const match = regex.exec(descriptor.verbose);
                        connection.console.log(`Match: ${match}`);
                        if (match.length > 0) {
                            fileName = match[1];
                            connection.console.log(`fileName: ${fileName}`);
                        }
                    }
                    const range = JSON.parse(JSON.stringify(FULL_RANGE));
                    if (descriptor.kind === 'CompilationError' || descriptor.kind === 'TypeError') {
                        if (descriptor.locstart.line > 0) {
                            range.start = { line: descriptor.locstart.line - 1, character: descriptor.locstart.character };
                            range.end = range.start;
                        }
                        if (descriptor.locend.line > 0) {
                            range.end = { line: descriptor.locend.line - 1, character: descriptor.locend.character };
                        }
                        let diagnostic = createDiagnostic(fileName, vscode_languageserver_1.DiagnosticSeverity.Error, range, descriptor.message, 'ergo', 'Ergo error');
                        diagnostics.push(diagnostic);
                    }
                    else {
                        let diagnostic = createDiagnostic(fileName, vscode_languageserver_1.DiagnosticSeverity.Error, {
                            start: { line: descriptor.locstart.line - 1, character: descriptor.locstart.character },
                            end: { line: descriptor.locend.line - 1, character: descriptor.locend.character },
                        }, descriptor.message, 'ergo', 'Ergo error');
                        diagnostics.push(diagnostic);
                    }
                }
                else {
                    if (error.getModelFile()) {
                        fileName = error.getModelFile().getName();
                        connection.console.log(`fileName: ${fileName}`);
                    }
                    let diagnostic = createDiagnostic(fileName, vscode_languageserver_1.DiagnosticSeverity.Error, range, error.message, 'ergo', 'Ergo error');
                    diagnostics.push(diagnostic);
                }
            }
        }
        catch (error) {
            connection.console.error(error.message);
            connection.console.error(error.stack);
        }
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    });
}
connection.listen();
//# sourceMappingURL=server.js.map