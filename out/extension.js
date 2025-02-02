"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ollama_1 = __importDefault(require("ollama"));
function activate(context) {
    // Get context from selected files
    async function getFileContext(uris) {
        const contents = await Promise.all(uris.map(async (uri) => {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                return `// File: ${uri.fsPath}\n${doc.getText()}\n`;
            }
            catch (error) {
                console.error(`Error reading file ${uri.fsPath}:`, error);
                return '';
            }
        }));
        return contents.join('\n');
    }
    // Inline Completion Provider
    const provider = vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, {
        async provideInlineCompletionItems(document, position) {
            const line = document.lineAt(position);
            const commentPattern = /^(\/\/|\/\*|#|--)/;
            if (commentPattern.test(line.text.trim())) {
                try {
                    // Get context from recent files
                    const recentFiles = [
                        document.uri,
                        ...vscode.workspace.textDocuments
                            .slice(-2)
                            .filter(doc => doc.uri !== document.uri)
                            .map(doc => doc.uri)
                    ];
                    const context = await getFileContext(recentFiles);
                    const fileExtension = document.fileName.split('.').pop() || '';
                    // Generate prompt
                    const prompt = [
                        'Context:\n' + context,
                        `Write code for this ${fileExtension} comment:`,
                        line.text.trim(),
                        'Respond ONLY with code, no explanations, no markdown.'
                    ].join('\n\n');
                    // Get Ollama response
                    const response = await ollama_1.default.chat({
                        model: 'deepseek-coder:6.7b',
                        messages: [{ role: 'user', content: prompt }],
                        options: { temperature: 0.2 }
                    });
                    // Clean response
                    let code = response.message.content.trim();
                    code = code.replace(/```[\s\S]*?\n|```/g, ''); // Remove markdown
                    code = code.split('\n')
                        .filter(l => !commentPattern.test(l)) // Remove comment lines
                        .join('\n')
                        .trim();
                    // Return as ghost text suggestion
                    return [{
                            insertText: new vscode.SnippetString(code),
                            range: new vscode.Range(position.line, 0, position.line, line.text.length),
                            filterText: line.text
                        }];
                }
                catch (error) {
                    console.error('Ollama Error:', error);
                }
            }
            return [];
        }
    });
    // Context Selection Command
    const selectContextCommand = vscode.commands.registerCommand('ollama-copilot.selectContext', async () => {
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Select Context Files'
        });
        if (files) {
            vscode.window.showInformationMessage(`Selected ${files.length} context files for Ollama Copilot`);
        }
    });
    context.subscriptions.push(provider, selectContextCommand);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map