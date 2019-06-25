"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const path = require("path");
const vscode_1 = require("vscode");
// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', () => {
    const rootPath = path.dirname(__dirname);
    // open a cto document should return the expected document id and line count
    test('activate should return a ergo document when open a ergo file', () => {
        // const rootPath = path.dirname(__dirname);
        const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/ergo/logic.ergo'));
        vscode_1.workspace.openTextDocument(uri).then((document) => {
            assert.equal(document.languageId, 'ergo');
            assert.ok(document.lineCount === 41);
        });
    });
});
//# sourceMappingURL=extension.test.js.map