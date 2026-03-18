import * as vscode from 'vscode';
import { AuthManager } from './auth';

export function activate(context: vscode.ExtensionContext) {
    const auth = new AuthManager(context);
    
    console.log('Vortex AI Extension Active');

    // 1. Command: Login
    context.subscriptions.push(
        vscode.commands.registerCommand('vortex.login', () => auth.login())
    );

    // 2. Command: Generate File (Direct Filesystem Access)
    context.subscriptions.push(
        vscode.commands.registerCommand('vortex.generateFile', async (name: string, content: string) => {
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('No workspace open.');
                return;
            }
            const root = vscode.workspace.workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(root, name);
            
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content));
            vscode.window.showInformationMessage(`Vortex: File ${name} created.`);
        })
    );

    // 3. Real-time Analysis (Background Listener)
    let timeout: NodeJS.Timeout | undefined;
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const token = await auth.getToken();
                if (!token) return;

                const text = event.document.getText();
                // --- Logic: Send 'text' to VORTEX backend /analyze ---
                // If LLM finds logic error -> Show a Diagnostic or Comment
                console.log('Analyzing buffer context...');
            }, 1000);
        })
    );
}

export function deactivate() {}