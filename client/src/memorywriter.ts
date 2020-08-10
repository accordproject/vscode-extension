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

const path = require('path');
const Writer = require('@accordproject/concerto-core').Writer;

/**
 * MemoryWriter is an implementation of FileWriter that stores all files in memory
 * Basic usage is: openFile(fileName), writeLine(...), closeFile().
 *
 * @private
 * @extends Writer
 * @see See {@link Writer}
 * @class
 * @memberof module:concerto-core
 */
export default class MemoryWriter extends Writer {

    /**
     * Create a MemoryWriter.
     */
    constructor() {
        super();
		this.files = {};
        this.outputDirectory = '/';
        this.relativeDir = null;
        this.fileName = null;
    }

    /**
     * Opens a virtual file for writing.
     *
     * @param {string} fileName - the name of the file to open
     */
    openFile(fileName) {
        this.fileName = fileName;
        this.relativeDir = null;
    }

    /**
     * Opens a virtual file for writing, with a location relative to the
     * root directory.
     *
     * @param {string} relativeDir - the relative directory to use
     * @param {string} fileName - the name of the file to open
     */
    openRelativeFile(relativeDir, fileName) {
        this.relativeDir = relativeDir;
        this.fileName = fileName;
    }

    /**
     * Writes text to the current open file
     * @param {number} tabs - the number of tabs to use
     * @param {string} text - the text to write
     */
    writeLine(tabs,text) {
        if (this.fileName) {
            super.writeLine(tabs,text);
        } else {
            throw Error('File has not been opened!');
        }
    }

    /**
     * Writes text to the start of the current open file
     * @param {number} tabs - the number of tabs to use
     * @param {string} text - the text to write
     */
    writeBeforeLine(tabs,text) {
        if (this.fileName) {
            super.writeBeforeLine(tabs,text);
        } else {
            throw Error('File has not been opened!');
        }
    }

    /**
     * Closes the current open file
     */
    closeFile() {
        if (!this.fileName) {
            throw new Error('No file open');
        }

        let filePath = '/';
        if (this.relativeDir) {
            filePath = path.resolve(filePath, this.relativeDir);
        }
        filePath = path.resolve(filePath, this.fileName);
		this.files[filePath] = this.getBuffer();
        this.fileName = null;
        this.relativeDir = null;
        this.clearBuffer();
	}
	
	/**
	 * Return all the virtual files, an object where the keys are file names and the values
	 * is the contents of each file.
	 * @returns {*} the files object
	 */
	getFiles() {
		return this.files;
	}
}