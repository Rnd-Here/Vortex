import * as vscode from 'vscode';

export class AuthManager {
    private static TOKEN_KEY = 'vortex_token';
    private static EXPIRY_KEY = 'vortex_token_expiry';

    constructor(private context: vscode.ExtensionContext) {}

    public async login() {
        const username = vscode.workspace.getConfiguration('vortex').get<string>('username');
        const password = await vscode.window.showInputBox({ 
            prompt: 'Enter your Organization Password', 
            password: true 
        });

        if (!username || !password) {
            vscode.window.showErrorMessage('Username and Password required.');
            return;
        }

        // --- Logic to get token from LiteLLM Proxy / Playground ---
        // response = await axios.post(proxy + '/login', { username, password })
        const mockToken = "sk-vortex-" + Math.random().toString(36).substring(7);
        const oneHourLater = Date.now() + 3600000;

        await this.context.secrets.store(AuthManager.TOKEN_KEY, mockToken);
        await this.context.globalState.update(AuthManager.EXPIRY_KEY, oneHourLater);

        vscode.window.showInformationMessage('Vortex: Link Established (Valid for 1hr)');
        return mockToken;
    }

    public async getToken(): Promise<string | undefined> {
        const expiry = this.context.globalState.get<number>(AuthManager.EXPIRY_KEY);
        if (!expiry || Date.now() > expiry) {
            vscode.window.showWarningMessage('Vortex: Token Expired. Please login again.');
            return await this.login();
        }
        return await this.context.secrets.get(AuthManager.TOKEN_KEY);
    }
}