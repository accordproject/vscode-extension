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

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { workspace } from 'vscode';

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', () => {
  const rootPath = path.dirname(__dirname);

  // open an ergo document should return the expected document id and line count
  test('should return a ergo document when open a ergo file', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/ergo/logic.ergo'));

    workspace.openTextDocument(uri).then((document) => {
      assert.equal(document.languageId, 'ergo');
      assert.ok(document.lineCount === 41);
    });
  });

  test('should return a cto document when open a cto file', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/cto/model.cto'));

    workspace.openTextDocument(uri).then((document) => {
      assert.equal(document.languageId, 'concerto');
      assert.ok(document.lineCount === 5);
    });
  });

  test('should return a ciceroMark document when open a .tem.md file', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/ciceroMark/grammar.tem.md'));

    workspace.openTextDocument(uri).then((document) => {
      assert.equal(document.languageId, 'ciceroMark');
      assert.ok(document.lineCount === 4);
    });
  });

  test('should execute exportArchive command', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/template/acceptance-of-delivery'));
    
    vscode.commands.executeCommand('cicero-vscode-extension.exportArchive', uri).then((result) => {
      assert.ok(result);
    });
  });

  test('should execute downloadModels command', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/template/acceptance-of-delivery'));

    vscode.commands.executeCommand('cicero-vscode-extension.downloadModels', uri).then((result) => {
      assert.ok(result);
    });
  });

  test('should execute exportClassDiagram command', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/template/acceptance-of-delivery'));

    vscode.commands.executeCommand('cicero-vscode-extension.exportClassDiagram', uri).then((result) => {
      assert.ok(result);
    });
  });

  test('should execute triggerClause command', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/template/acceptance-of-delivery'));

    vscode.commands.executeCommand('cicero-vscode-extension.triggerClause', uri).then((result) => {
      assert.ok(result);
    });
  });

  test('should execute parseClause command', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/template/acceptance-of-delivery'));

    vscode.commands.executeCommand('cicero-vscode-extension.parseClause', uri).then((result) => {
      assert.ok(result);
    });
  });

  test('should execute verify template command', () => {
    const uri = vscode.Uri.file(path.join(rootPath, '../test/data/valid/template/acceptance-of-delivery'));

    vscode.commands.executeCommand('cicero-vscode-extension.verifyTemplate', uri).then((result) => {
      assert.ok(result);
    });
  });

  test('should execute showPreview command', () => {
    vscode.commands.executeCommand('cicero-vscode-extension.showPreview').then((result) => {
      assert.ok(result);
    });
  });
});
