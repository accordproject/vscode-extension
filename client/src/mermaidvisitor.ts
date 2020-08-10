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

const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const TransactionDeclaration = require('@accordproject/concerto-core').TransactionDeclaration;
const AssetDeclaration = require('@accordproject/concerto-core').AssetDeclaration;
const ParticipantDeclaration = require('@accordproject/concerto-core').ParticipantDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EventDeclaration = require('@accordproject/concerto-core').EventDeclaration;

const Field = require('@accordproject/concerto-core').Field;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;

/**
 * Convert the contents of a ModelManager
 * to Mermaid format file.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 */
export default class MermaidVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing instanceof ModelManager) {
            return this.visitModelManager(thing, parameters);
        } else if (thing instanceof ModelFile) {
            return this.visitModelFile(thing, parameters);
        } else if (thing instanceof ParticipantDeclaration) {
            return this.visitParticipantDeclaration(thing, parameters);
        } else if (thing instanceof TransactionDeclaration) {
            return this.visitTransactionDeclaration(thing, parameters);
        } else if (thing instanceof AssetDeclaration) {
            return this.visitAssetDeclaration(thing, parameters);
        } else if (thing instanceof EnumDeclaration) {
            return this.visitEnumDeclaration(thing, parameters);
        } else if (thing instanceof EventDeclaration) {
            return this.visitEventDeclaration(thing, parameters);
        } else if (thing instanceof ClassDeclaration) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing instanceof Field) {
            return this.visitField(thing, parameters);
        } else if (thing instanceof RelationshipDeclaration) {
            return this.visitRelationship(thing, parameters);
        } else if (thing instanceof EnumValueDeclaration) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing) );
        }
    }

    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelManager(modelManager, parameters) {
        parameters.fileWriter.openFile('model.mmd');
        parameters.fileWriter.writeLine(0, 'classDiagram');

        modelManager.getModelFiles().forEach((decl) => {
            decl.accept(this, parameters);
        });

        parameters.fileWriter.closeFile();

        return null;
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelFile(modelFile, parameters) {
        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });
        return null;
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitAssetDeclaration(classDeclaration, parameters) {
        return this.visitClassDeclaration(classDeclaration, parameters, 'asset');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(classDeclaration, parameters) {
        return this.visitClassDeclaration(classDeclaration, parameters, 'enumeration');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEventDeclaration(classDeclaration, parameters) {
        return this.visitClassDeclaration(classDeclaration, parameters, 'event');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitParticipantDeclaration(classDeclaration, parameters) {
        return this.visitClassDeclaration(classDeclaration, parameters, 'participant');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitTransactionDeclaration(classDeclaration, parameters) {
        return this.visitClassDeclaration(classDeclaration, parameters, 'transaction');
    }


    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters, type='concept') {

        if(classDeclaration.getOwnProperties().length > 0) {
            parameters.fileWriter.writeLine(0, 'class ' + classDeclaration.getName() + ' {' );
            parameters.fileWriter.writeLine(0, '<< ' + type + '>>' );

            classDeclaration.getOwnProperties().forEach((property) => {
                if(!property._isRelationshipDeclaration) {
                    property.accept(this, parameters);
                }
            });
    
            parameters.fileWriter.writeLine(0,  '}\n' );
        }
        else {
            parameters.fileWriter.writeLine(0, 'class ' + classDeclaration.getName() );
            parameters.fileWriter.writeLine(0, '<< ' + type + '>>' + ' ' +  classDeclaration.getName() + '\n' );
        }

        classDeclaration.getOwnProperties().forEach((property) => {
            if(property._isRelationshipDeclaration) {
                property.accept(this, parameters);
            }
        });

        if(classDeclaration.getSuperType()) {
            parameters.fileWriter.writeLine(0, classDeclaration.getName() + ' --|> ' + classDeclaration.getSuperTypeDeclaration().getName());
        }

        return null;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        let array = '';

        // if(field.isPrimitive()) {
            if(field.isArray()) {
                array = '[]';
            }
    
            parameters.fileWriter.writeLine(1, ' +' + field.getType() + array + ' ' + field.getName());
        // }
        // else {
        //     if(field.isArray()) {
        //         array = '"many"';
        //     }
    
        //     parameters.fileWriter.writeLine(1, field.getParent().getName() + ' *-- ' + array + ' ' + field.getType() + ' : ' + field.getName());
        // }

        return null;
    }

    /**
     * Visitor design pattern
     * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        parameters.fileWriter.writeLine(1, enumValueDeclaration.getName());
        return null;
    }

    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationship - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationship(relationship, parameters) {
        let array = '"1"';
        if(relationship.isArray()) {
            array = '"*"';
        }
        parameters.fileWriter.writeLine(0, relationship.getParent().getName() + ' "1"' + ' o-- ' + array + ' ' + relationship.getType() + ' : ' + relationship.getName());
        return null;
    }
}