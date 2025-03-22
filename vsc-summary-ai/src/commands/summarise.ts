import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

const fs = require('fs');

let flaskProcess: cp.ChildProcess | null = null;

function startFlaskBackend() {
    if (flaskProcess) {
        return;
    }

    const scriptPath = path.join(__dirname, "..", "..", "assistant.py");

    flaskProcess = cp.spawn("python", [scriptPath], {
        cwd: path.dirname(scriptPath),
        detached: true,
        stdio: "ignore"
    });

    flaskProcess.unref();
    console.log("🚀 Flask backend started.");
}

export async function summarise() {
    const outputChannel = vscode.window.createOutputChannel("VSC Summary AI");

    const result = await vscode.window.showInformationMessage('Welcome to VSC Summary AI',
        { modal: true },
        'Select Repository'
    );

    if (result === 'Select Repository') {
        let repoPath = '';
        let validRepo = false;

        while (!validRepo) {
            const folderUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                openLabel: 'Select Folder'
            });

            if (folderUri && folderUri[0]) {
                repoPath = folderUri[0].fsPath;

                const gitDirPath = path.join(repoPath, '.git');
                if (fs.existsSync(gitDirPath) && fs.lstatSync(gitDirPath).isDirectory()) {
                    validRepo = true;
                    console.log('Repository set: ', repoPath);
                } else {
                    const retry = await  vscode.window.showWarningMessage('The selected folder is not a Git repository.',
                        'Try Again', 'Cancel'
                    );
                    if (retry === 'Cancel') {
                        return;
                    }
                }
            }
        }
        

        type SummaryResponse = {
            summary?: string;
            error?: string;
        }

        if (repoPath === '') {
            vscode.window.showWarningMessage('No repository is selected.');
        }

        startFlaskBackend();

        fetch("http://127.0.0.1:5000/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repo_path: repoPath
            })
        })
        .then(response => response.json())
        .then(data => {
            const result = data as SummaryResponse;
            if (result.summary) {
                vscode.window.showInformationMessage("Summary generated!");
                outputChannel.appendLine(result.summary);
                outputChannel.show();
            } else {
                vscode.window.showErrorMessage(result.error || "Something went wrong.");
            }
        })
        .catch(error => {
            vscode.window.showErrorMessage(`Request failed: ${error.message}`);
        });
    }
}