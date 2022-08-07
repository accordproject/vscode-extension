const xregexp = require('xregexp');
const slash = require('slash');
const fsPath = require('path');
const languageTagRegex = require('ietf-language-tag-regex');

const vscode = require('vscode')
import { FileType } from 'vscode';
import { URI } from 'vscode-uri';
const templateLoader = require('@accordproject/cicero-core').TemplateLoader;

// Matches 'sample.md' or 'sample_TAG.md' where TAG is an IETF language tag (BCP 47)
const IETF_REGEXP = languageTagRegex({ exact: false }).toString().slice(1,-2);
const SAMPLE_FILE_REGEXP = xregexp('text[/\\\\]sample(_(' + IETF_REGEXP + '))?.md$');


/**
     * Loads the contents of all files under a path that match a regex
     * Note that any directories called node_modules are ignored.
     * @internal
     * @param {*} path the file path
     * @param {RegExp} regex the regex to match files
     * @return {Promise<object[]>} a promise to an array of objects with the name and contents of the files
*/
async function loadFilesContents(path, regex) {

	const subdirs = await vscode.workspace.fs.readDirectory(URI.parse(path));

	const result = await Promise.all(subdirs.map(async (subdir) => {
        // subdir an array where subdir[0] is string representing path to file/directory within 
        // and subdir[1] represents whether the path leads to a folder or a file
	    const res = fsPath.resolve(path, subdir[0]);

        // if the subdir is a directory then we call this function recursively on that directory
        // else we return the file contents of the file as result
		if(subdir[1]==FileType.Directory){
			if( /.*node_modules$/.test(res) === false) {
				return loadFilesContents(res, regex);
			}
			else {
				return null;
			}
		}
		else {
			if(regex.test(res)) {
				return {
					name: res,
					contents: await loadFileContents(path, res, false, true)
				};
			}
			else {
				return null;
			}
		}
	}));

	return result.reduce((a, f) => a.concat(f), []).filter((f) => f !== null);
}

/**
     * Loads a file as buffer from a directory, displaying an error if missing
     * @internal
     * @param {*} path the root path
     * @param {string} fileName the relative file name
     * @param {boolean} required whether the file is required
     * @return {Promise<Buffer>} a promise to the buffer of the file or null if
     * it does not exist and required is false
*/
async function loadFileBuffer(path, fileName, required=false) {
	const filePath = fsPath.resolve(path, fileName);

	try{
		return await vscode.workspace.fs.readFile(URI.file(filePath));
	}
	catch(e) {
        if(required){
            throw new Error(`Failed to find ${fileName} in directory ${e}`);
        }
	}
	return null;
}

/**
     * Loads a required file from a directory, displaying an error if missing
     * @internal
     * @param {*} path the root path
     * @param {string} fileName the relative file name
     * @param {boolean} json if true the file is converted to a JS Object using JSON.parse
     * @param {boolean} required whether the file is required
     * @return {Promise<string>} a promise to the contents of the file or null if it does not exist and
     * required is false
*/
async function loadFileContents(path, fileName, json=false, required=false) {
	const filePath = fsPath.resolve(path, fileName);

	try {
		const contents = Buffer.from(await vscode.workspace.fs.readFile(URI.file(filePath))).toString();
		if(json && contents) {
			return JSON.parse(contents);
		}
		else {
            // we replace all \r and \n with \n
			return templateLoader.normalizeNLs(contents);
		}
	}
	catch(e){
        if(required){
            throw new Error(`Failed to find ${fileName} in directory ${e}`);
        }
	}

	return null;
}

export async function fromDirectory(Template, path, options = {offline:false}) {
    try{
        // grab the README.md
        const readmeContents = await loadFileContents(path, 'README.md');

        // grab the logo.png
        const logo = Buffer.from(await loadFileBuffer(path, 'logo.png'));

        // grab the request.json
        const requestJsonObject = await loadFileContents(path, 'request.json', true );

        // grab the package.json
        const packageJsonObject = await loadFileContents(path, 'package.json', true, true );

        // grab the sample files
        const sampleFiles = await loadFilesContents(path, SAMPLE_FILE_REGEXP);
        const sampleTextFiles = {};

        sampleFiles.forEach((file) => {
            const matches = file.name.match(SAMPLE_FILE_REGEXP);

            let locale = 'default';
            // Match found
            if(matches !== null && matches[2]){
                locale = matches[2];
            }
            sampleTextFiles[locale] = file.contents;
        });

        // grab the signature.json
        const authorSignature = await loadFileContents(path, 'signature.json', true, false );

        // create the template
        const template = new Template (packageJsonObject, readmeContents, sampleTextFiles, requestJsonObject, logo, options, authorSignature);
        const modelFiles = [];
        const modelFileNames = [];
        const ctoFiles = await loadFilesContents(path, /model[/\\].*\.cto$/);
        ctoFiles.forEach((file) => {
            modelFileNames.push(slash(file.name));
            modelFiles.push(file.contents);
        });

        const externalModelFiles = await template.getModelManager().addAPModelFiles(modelFiles, modelFileNames, options && options.offline);
        if(!options || !options.offline){
            externalModelFiles.forEach(function (file) {
                vscode.workspace.fs.writeFile(URI.file(path + '/model/' + file.name), file.content);
            });
        }

        // load and add the template
        let grammar = await loadFileContents(path, 'text/grammar.tem.md', false, false);

        if(!grammar) {
            throw new Error('A template must either contain a grammar.tem.md file.');
        } else {
            const templateKind = template.getMetadata().getTemplateType() !== 0 ? 'clause' : 'contract';
            template.parserManager.setTemplate(grammar);
            template.parserManager.setTemplateKind(templateKind);
            template.parserManager.buildParser();
        }

        // load and add the ergo files
        if(template.getMetadata().getRuntime() === 'ergo') {
            const ergoFiles = await loadFilesContents(path, /logic[/\\].*\.ergo$/);
            ergoFiles.forEach((file) => {
                const resolvedPath = slash(fsPath.resolve(path));
                const resolvedFilePath = slash(fsPath.resolve(file.name));
                const truncatedPath = resolvedFilePath.replace(resolvedPath+'/', '');
                template.getLogicManager().addLogicFile(file.contents, truncatedPath);
            });
        } else {
            // load and add compiled JS files - we assume all runtimes are JS based (review!)
            const jsFiles = await loadFilesContents(path, /logic[/\\].*\.js$/);
            jsFiles.forEach((file) => {
                const resolvedPath = slash(fsPath.resolve(path));
                const resolvedFilePath = slash(fsPath.resolve(file.name));
                const truncatedPath = resolvedFilePath.replace(resolvedPath+'/', '');
                template.getLogicManager().addLogicFile(file.contents, truncatedPath);
            });
        }

        templateLoader.registerFormulas(template.parserManager,template.getLogicManager());

        // check the template
        authorSignature ? template.validate({verifySignature: true}) : template.validate();

        return template;
    }
    catch(e){
        throw e;
    }
}