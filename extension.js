'use strict';

const vscode = require('vscode');
const postcss = require('postcss');
const safeParser = require('postcss-safe-parser');
const lessParser = require('postcss-less');
const lessStringifier = require('postcss-less/dist/less-stringify');
const scssParser = require('postcss-scss');

const resolve = require('npm-module-path').resolveOne;

let autoprefixer = null;

function getPostcssOptions(language) {
	switch (language) {
		case 'less': {
			return {
				parser: lessParser,
				stringifier: lessStringifier
			};
		}
		case 'scss': {
			return {
				parser: scssParser
			};
		}
		case 'css': {
			return {
				parser: safeParser
			};
		}
		default: {
			return null;
		}
	}
}

function runAutoprefixer(document, onDidSaveStatus) {
	const browsers = vscode.workspace.getConfiguration('autoprefixer').browsers;

	const content = document.getText();
	const lang = document.languageId;
	const options = getPostcssOptions(lang);

	postcss([autoprefixer(browsers)])
		.process(content, options)
		.then((result) => {
			result.warnings().forEach((x) => {
				console.warn(x.toString());
			});

			const editor = vscode.editor || vscode.window.activeTextEditor;
			if (!editor) {
				throw new Error('Ooops...');
			}

			const document = editor.document;
			const lastLine = document.lineAt(document.lineCount - 1);
			const start = new vscode.Position(0, 0);
			const end = new vscode.Position(document.lineCount - 1, lastLine.text.length);
			const range = new vscode.Range(start, end);

			if (document.autoprefixer) {
				delete document.autoprefixer;
				return;
			}

			if (onDidSaveStatus) {
				const we = new vscode.WorkspaceEdit();
				we.replace(document.uri, range, result.css);
				document.autoprefixer = true;
				vscode.workspace.applyEdit(we).then(() => {
					document.save();
				});
			} else {
				editor.edit((builder) => {
					builder.replace(range, result.css);
				});
			}
		})
		.catch(console.error);
}

function init(document, onDidSaveStatus) {
	const workspace = vscode.workspace.rootPath ? vscode.workspace.rootPath : '';

	if (autoprefixer) {
		return runAutoprefixer(document, onDidSaveStatus);
	}

	resolve('autoprefixer', workspace).then((filepath) => {
		console.log(filepath);
		autoprefixer = require(filepath);

		runAutoprefixer(document, onDidSaveStatus);
	}).catch((err) => {
		vscode.window.showErrorMessage('Failed to load autoprefixer library. Please install autoprefixer in your workspace folder using **npm install autoprefixer** or globally using **npm install -g autoprefixer** and then run command again.');
		console.error(err);
	});
}

function activate(context) {
	const findExternalPackage = vscode.workspace.getConfiguration('autoprefixer').findExternalAutoprefixer;
	if (!findExternalPackage) {
		autoprefixer = require('autoprefixer');
	}

	const disposable = vscode.commands.registerTextEditorCommand('autoprefixer.execute', (textEditor) => {
		init(textEditor.document, false);
	});

	context.subscriptions.push(disposable);

	const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
		const onDidSave = vscode.workspace.getConfiguration('autoprefixer').prefixOnSave;
		if (onDidSave) {
			init(document, true);
		}
	});

	context.subscriptions.push(onSave);
}

exports.activate = activate;
