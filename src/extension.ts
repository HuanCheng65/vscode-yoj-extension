/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { getFillCodeTemplate, getLoggedInUser, getProblemDetail, getProblemList, getSubmissionDetail, getSubmissionList, login, logout, submitProblem, submitProblemFill } from './api';
import { LoggedInUser, ProblemType } from './api/types';
import path = require('path');

const getSessionId = (context: vscode.ExtensionContext): Promise<string> => {
	return new Promise((resolve, reject) => {
		let sessionId = context.globalState.get<string>('sessionId');
		if (sessionId) {
			let expires = context.globalState.get<string>('sessionIdExpires');
			if (expires && Date.parse(expires) > Date.now()) {
				resolve(sessionId);
				return;
			}
		}
		fetch('http://yoj.ruc.edu.cn/').then(res => {
			const cookie = res.headers.get('set-cookie');
			if (cookie) {
				const sessionId = cookie.split(';')[0].split('=')[1];
				const expires = cookie.split(';')[1].split('=')[1];
				context.globalState.update('sessionId', sessionId);
				context.globalState.update('sessionIdExpires', expires);
				resolve(sessionId);
			}
		}).catch(err => {
			reject(err);
		});
	});
};

let statusBarItem: vscode.StatusBarItem | undefined;
let loggedInUser: LoggedInUser | undefined;
let currentPanel: vscode.WebviewPanel | undefined;
let waitingSubmissionId: number | undefined;

const showStatus = (text: string) => {
	if (statusBarItem) {
		statusBarItem.text = `YOJ: ${text}`;
		statusBarItem.command = '';
		statusBarItem.show();
	}
};

const resetStatus = () => {
	if (statusBarItem) {
		if (loggedInUser && loggedInUser.status) {
			statusBarItem.text = `YOJ: ${loggedInUser.nickname}`;
			statusBarItem.command = 'vscode-yoj.submit';
		} else {
			statusBarItem.text = 'YOJ: 未登录';
			statusBarItem.command = 'vscode-yoj.login';
		}
		statusBarItem.show();
	}
};

const encodeCodeInHtml = (code: string) => {
	return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const waitForResult = (context: vscode.ExtensionContext, sessionId: string, submissionId: number) => {
	waitingSubmissionId = submissionId;
	showStatus('$(sync~spin) 等待评测中');
	const interval = setInterval(async () => {
		let submissionDetail = await getSubmissionDetail(sessionId, submissionId);
		if (submissionDetail.submission.status !== 'Waiting') {
			clearInterval(interval);
			vscode.window.showInformationMessage(`评测 #${submissionDetail.submission.id} 结果：${submissionDetail.submission.status}`, {
				modal: true,
				detail: `运行时长：${submissionDetail.submission.runTime}\n内存占用：${submissionDetail.submission.memory}`
			});
			resetStatus();
			waitingSubmissionId = undefined;
		}
	}, 3000);
};

const getWebViewContent = (
	context: vscode.ExtensionContext,
	panel: vscode.WebviewPanel,
	code: string,
	codeTemplate: string,
	sessionId: string,
	problemId: number,
	compiler: string
) => {
	const codeBlocks = compareCodeWithTemplate(code, codeTemplate);
	let html = "";
	let blocks = codeTemplate.split('____qcodep____');
	blocks.forEach((block, index) => {
		html += `<pre><code>${encodeCodeInHtml(block)}</code></pre>`;
		if (index < blocks.length - 1) {
			html += `<div class="blank-tip">填空区 ${index + 1}</div><div id="monaco-editor-${index}" class="editor-container"></div><div class="blank-tip">填空区 ${index + 1}</div>`;
		}
	});
	if (codeBlocks) {
		html += `<div id="matchTemplate" data-value="true"></div>`;
		codeBlocks.forEach((block, index) => {
			html += `<pre id="code-block-${index}" style="display: none;"><code>${encodeCodeInHtml(block)}</code></pre>`;
		});
	} else {
		html += `<div id="matchTemplate" data-value="false"></div>`;
	}
	const blankCount = blocks.length - 1;
	const stylesheets = [
		path.join(context.extensionPath, 'resource', 'libs', 'highlight', 'styles', 'vs2015.min.css'),
		path.join(context.extensionPath, 'resource', 'style', 'style.css')
	];
	const scripts = [
		path.join(context.extensionPath, 'resource', 'libs', 'highlight', 'highlight.min.js'),
		path.join(context.extensionPath, 'resource', 'libs', 'monaco', 'vs', 'loader.js'),
		path.join(context.extensionPath, 'resource', 'js', 'submitFillCode.js'),
	];
	const stylesheetHtml = stylesheets.map(uri => `<link rel="stylesheet" href="${panel.webview.asWebviewUri(vscode.Uri.file(uri))}">`).join('\n');
	const scriptHtml = scripts.map(uri => `<script src="${panel.webview.asWebviewUri(vscode.Uri.file(uri))}"></script>`).join('\n');
	const requirePath = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'resource', 'libs', 'monaco')));
	return panel.webview.html = `
	<!DOCTYPE html>
	<html>
		<head>
			<meta charset="utf-8">
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>提交代码 - YOJ</title>
			${stylesheetHtml}
		</head>
		<body>
			<div id="blank" data-count="${blankCount}"></div>
			<div id="compiler" data-value="${compiler}"></div>
			<div id="requirePath" data-value="${requirePath}"></div>
			${html}
			<div class="button-container">
				<button id="submit" class="button" data-problem-id="${problemId}" data-session-id="${sessionId}">提交</button>
			</div>
			${scriptHtml}
		</body>
	</html>
  `;
};


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem('yoj-status', vscode.StatusBarAlignment.Left, 10);

	vscode.commands.registerCommand('vscode-yoj.jumpToPrevBlank', () => {
		currentPanel?.webview.postMessage({ command: 'jumpToPrevBlank' });
	});

	vscode.commands.registerCommand('vscode-yoj.jumpToNextBlank', () => {
		currentPanel?.webview.postMessage({ command: 'jumpToNextBlank' });
	});

	vscode.commands.registerCommand('vscode-yoj.downloadCodeTemplate', async () => {
		if (!loggedInUser) {
			await vscode.commands.executeCommand('vscode-yoj.login');
			if (loggedInUser) {
				vscode.commands.executeCommand('vscode-yoj.downloadCodeTemplate');
			}
			return;
		}
		let sessionId = await getSessionId(context);
		let problemList = await getProblemList(sessionId);
		const problemPick = await vscode.window.showQuickPick(problemList.map((problem) => `#${problem.id} ${problem.name}`), {
			placeHolder: '请选择题目'
		});
		if (problemPick) {
			let problemId = parseInt(problemPick.split(' ')[0].substring(1));
			let problemDetail = await getProblemDetail(sessionId, problemId);
			let codeTemplate = problemDetail.codeTemplate;
			if (problemDetail.type !== ProblemType.FillInTheBlank) {
				vscode.window.showErrorMessage('该题目不是填空题');
				return;
			}
			if (!codeTemplate) {
				vscode.window.showErrorMessage('该题目暂无代码模板');
				return;
			}
			let codeTemplateType = problemDetail.useCompiler?.includes('python') ? 'py' : 'cpp';
			let codeTemplateSaveUri = await vscode.window.showSaveDialog({
				filters: {
					'代码模板': [codeTemplateType]
				},
				saveLabel: '保存',
				title: '保存代码模板',
				defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '', `${problemId}.${codeTemplateType}`))
			});
			if (codeTemplateSaveUri) {
				await vscode.workspace.fs.writeFile(codeTemplateSaveUri, Buffer.from(codeTemplate));
				vscode.window.showInformationMessage('代码模板保存成功');
				vscode.workspace.openTextDocument(codeTemplateSaveUri).then((doc) => {
					vscode.window.showTextDocument(doc);
				});
			}
		}
	});


	vscode.commands.registerCommand('vscode-yoj.submit', async () => {
		if (waitingSubmissionId) {
			vscode.window.showErrorMessage('上一次提交还未结束，请稍后再提交');
			return;
		}
		if (!loggedInUser) {
			await vscode.commands.executeCommand('vscode-yoj.login');
			if (loggedInUser) {
				vscode.commands.executeCommand('vscode-yoj.submit');
			}
			return;
		}
		let sessionId = await getSessionId(context);
		if (vscode.window.activeTextEditor) {
			let fileName = vscode.window.activeTextEditor.document.fileName.split(path.sep).pop()?.split('.')[0] || '';
			let code = vscode.window.activeTextEditor.document.getText();
			let problems = await getProblemList(sessionId);
			const problemPick = vscode.window.createQuickPick();
			problemPick.value = fileName;
			problemPick.items = problems.map(problem => {
				return {
					label: `#${problem.id} ${problem.name}`
				};
			});
			problemPick.onDidChangeSelection(async selection => {
				if (selection[0]) {
					let problem = problems.find(problem => `#${problem.id} ${problem.name}` === selection[0].label);
					if (problem) {
						let problemDetail = await getProblemDetail(sessionId, problem.id);
						console.log(problemDetail);
						if (problemDetail.type === ProblemType.Normal && problemDetail.supportLanguages) {
							const languagePick = vscode.window.createQuickPick();
							languagePick.items = problemDetail.supportLanguages.map(language => {
								return {
									label: language.name,
									description: language.extension
								};
							});
							languagePick.onDidChangeSelection(selection => {
								if (selection[0]) {
									languagePick.hide();
									showStatus('$(sync~spin) 提交中');
									submitProblem(sessionId, problemDetail.id, selection[0].description!, code).then(submitRes => {
										if (submitRes.status === 1 && submitRes.submissionId) {
											const submissionId = submitRes.submissionId;
											waitForResult(context, sessionId, submissionId);
										} else {
											vscode.window.showErrorMessage('提交失败！');
											resetStatus();
										}
									});
								}
							});
							languagePick.show();
						} else if (problemDetail.type === ProblemType.FillInTheBlank) {
							const compiler = problemDetail.useCompiler!;
							const codeTemplate = problemDetail.codeTemplate!;
							currentPanel = vscode.window.createWebviewPanel(
								'yoj.submitFillCode',
								`提交 #${problem.id} ${problem.name}`,
								vscode.ViewColumn.Beside,
								{
									localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'resource'))],
									enableScripts: true,
									retainContextWhenHidden: true
								}
							);
							currentPanel.webview.html = getWebViewContent(context, currentPanel, code, codeTemplate, sessionId, problem.id, compiler);
							currentPanel.webview.onDidReceiveMessage(async message => {
								console.log(message);
								switch (message.command) {
									case 'submitFillCode': {
										showStatus('$(sync~spin) 提交中');
										let result = await submitProblemFill(message.sessionId, message.problemId, message.compiler, message.code);
										if (result.status === 1) {
											waitForResult(context, sessionId, result.submissionId!);
										} else {
											vscode.window.showErrorMessage(`提交失败：${result.info}`);
											resetStatus();
										}
										currentPanel?.dispose();
										currentPanel = undefined;
										break;
									}
								}
							}, undefined, context.subscriptions);
						}
					}
				}
			});
			problemPick.show();
		}
	});

	vscode.commands.registerCommand('vscode-yoj.logout', async () => {
		let sessionId = await getSessionId(context);
		await logout(sessionId);
		context.globalState.update('sessionId', undefined);
		loggedInUser = undefined;
		resetStatus();
		vscode.window.showInformationMessage('您已退出登录！');
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('vscode-yoj.login', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		try {
			let sessionId = await getSessionId(context);
			loggedInUser = await getLoggedInUser(sessionId);
			if (loggedInUser.status) {
				vscode.window.showInformationMessage(`您已登录，欢迎您，${loggedInUser.nickname}！`);
				resetStatus();
				return loggedInUser;
			}
			let autoLogin = vscode.workspace.getConfiguration('yoj.autoLogin').get<boolean>('enable');
			if (autoLogin) {
				let username = context.globalState.get<string>('username');
				let password = context.globalState.get<string>('password');
				if (username && password) {
					let loginRes = await login(sessionId, username, password);
					if (loginRes.status === 1) {
						loggedInUser = await getLoggedInUser(sessionId);
						if (loggedInUser.status) {
							vscode.window.showInformationMessage(`登录成功，欢迎您，${loggedInUser.nickname}！`);
							return loggedInUser;
						}
					}
					return;
				}
			}
			let username = await vscode.window.showInputBox({ prompt: '请输入用户名' });
			if (username) {
				let password = await vscode.window.showInputBox({ prompt: '请输入密码', password: true });
				if (password) {
					let loginRes = await login(sessionId, username, password);
					if (loginRes.status === 1) {
						loggedInUser = await getLoggedInUser(sessionId);
						if (loggedInUser.status) {
							vscode.window.showInformationMessage(`登录成功，欢迎您，${loggedInUser.nickname}！`);
							vscode.window.showInformationMessage('下次是否自动登录？', '是', '否').then(async selection => {
								if (selection === '是') {
									vscode.workspace.getConfiguration('yoj.autoLogin').update('enable', true);
									vscode.workspace.getConfiguration('yoj.autoLogin').update('username', username);
									vscode.workspace.getConfiguration('yoj.autoLogin').update('password', password);
								}
							});
						} else {
							vscode.window.showErrorMessage(loggedInUser.message || '登录失败');
						}
						resetStatus();
					} else {
						vscode.window.showErrorMessage('登录失败');
					}
				}
			}
		} catch (err) {
			vscode.window.showErrorMessage(`登录失败：${err}`);
		}
		return loggedInUser;
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

function compareCodeWithTemplate(code: string, codeTemplate: string) {
	let defineLines = code.split('\n').filter(line => line && (line.startsWith('#') || line.startsWith('using'))).map(line => line.trim());
	let templateDefineLines = codeTemplate.split('\n').filter(line => line && (line.startsWith('#') || line.startsWith('using'))).map(line => line.trim());
	let diffDefineLines = defineLines.filter(line => !templateDefineLines.includes(line));
	let templateBlocks = codeTemplate.split('____qcodep____')
		.map(
			block => block.split('\n')
				.filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('#') && !line.trim().startsWith('using'))
				.join('\n')
				.replace(/\s+/g, '')
		);
	let codeBlock = code.split('\n')
		.filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('#') && !line.trim().startsWith('using'))
		.join('\n')
		.trim();
	let codeBlockChars: Array<string> = [];
	let codeBlockCharIndexMapping: Array<number> = [];
	codeBlock.split('').forEach((char, index) => {
		switch (char) {
			case '\n':
			case '\t':
			case '\r':
			case '\f':
			case '\v':
			case ' ':
				break;
			default:
				codeBlockChars.push(char);
				codeBlockCharIndexMapping.push(index);
		}
	});
	let codeBlocks: Array<string> = [];
	templateBlocks.forEach((block, index) => {
		if (index !== templateBlocks.length - 1) {
			let templateStartIndex = codeBlockChars.join('').indexOf(block);
			if (templateStartIndex !== -1) {
				let codeStartIndex = templateStartIndex + block.length;
				let codeEndIndex = codeBlockChars.join('').indexOf(templateBlocks[index + 1]);
				codeBlocks.push(codeBlock.substring(codeBlockCharIndexMapping[codeStartIndex], codeBlockCharIndexMapping[codeEndIndex]).trim());
			}
		}
	});
	if (codeBlocks.length !== templateBlocks.length - 1) {
		return false;
	}
	codeBlocks[0] = diffDefineLines.concat(codeBlocks[0].split('\n')).join('\n');
	return codeBlocks;
}

