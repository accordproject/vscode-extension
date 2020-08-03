import {
    CodeAction,
    CodeActionParams,
    DiagnosticSeverity,
    CodeActionKind
} from 'vscode-languageserver';


/**
 * Provide quickfix only for:
 * not fully uppercased keywords
 *
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} parms
 * @returns {CodeAction[]}
 */
export function quickfix(connection, templateModel, modelDocument, params: CodeActionParams): CodeAction[] {

    if(!templateModel) {
        connection.console.log(`- failed to find template model`);
        return [];
    }

    connection.console.log(`- template model: ${templateModel.getName()}`);
    const assetLocation = templateModel.ast.location;

    const diagnostics = params.context.diagnostics;
    if (!diagnostics || diagnostics.length === 0) {
        return [];
    }

    const UNKNOWN_PROP = 'Unknown property ';
    const codeActions: CodeAction[] = [];
    diagnostics.forEach((diag) => {
        connection.console.log(`- diagnostic: ${JSON.stringify(diag)}`);
        if (diag.severity === DiagnosticSeverity.Error && diag.source === 'grammar' &&
            diag.message.startsWith(UNKNOWN_PROP)) {
            const variableName = diag.message.substring(UNKNOWN_PROP.length);
            connection.console.log(`- missing variable: ${variableName}`);

            codeActions.push({
                title: "Add variable",
                kind: CodeActionKind.QuickFix,
                isPreferred : true,
                diagnostics: [diag],
                edit: {
                    changes: {
                        [modelDocument.uri]: [{
                            range: {
                                start: {
                                    line: assetLocation.end.line-1,
                                    character: assetLocation.end.column - 2
                                },
                                end: {
                                    line: assetLocation.end.line-1,
                                    character: assetLocation.end.column - 2
                                },
                            },
                            newText: `  o String ${variableName}\n`
                        }]
                    }
                }
            });
            return;
        }
    });

    return codeActions;
}