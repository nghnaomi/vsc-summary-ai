import * as vscode from 'vscode';

import * as cp from 'child_process';
import * as path from 'path';

let flaskProcess: cp.ChildProcess | null = null;

function startFlaskBackend() {
    if (flaskProcess) return; // Already running

    const scriptPath = path.join(__dirname, "..", "..", "assistant.py");

    flaskProcess = cp.spawn("python", [scriptPath], {
        cwd: path.dirname(scriptPath),
        detached: true,
        stdio: "ignore"
    });

    flaskProcess.unref();
    console.log("🚀 Flask backend started.");
}

export function summarise() {
    const outputChannel = vscode.window.createOutputChannel("Repo Summary");

    vscode.window.showInformationMessage('Generating summary...');

    type SummaryResponse = {
        summary?: string;
        error?: string;
      };

    startFlaskBackend(); 

    fetch("http://127.0.0.1:5000/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            repo_path: "/Users/gaozilin/Desktop/vsc-summary-ai/dlw"
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