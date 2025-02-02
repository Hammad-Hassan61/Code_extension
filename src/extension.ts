import * as vscode from 'vscode';
import ollama from 'ollama';

export function activate(context: vscode.ExtensionContext) {


    // Helper function for context file
    async function getFileContext(uris: vscode.Uri[]): Promise<string> {
        const contents = await Promise.all(
            uris.map(async (uri) => {
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    return `// File: ${uri.fsPath}\n${doc.getText()}\n`;
                } catch (error) {
                    console.error(`Error reading file ${uri.fsPath}:`, error);
                    return '';
                }
            })
        );
        return contents.join('\n');
    }



    const provider = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        {
            async provideInlineCompletionItems(document, position) {
                const line = document.lineAt(position);
                const commentPattern = /^(\/\/|\/\*|#|--)/; // For comment pattern, replace by dictionary in future for code file based comment

                if (!commentPattern.test(line.text.trim())) {
                    return [];
                }

                try {

                    // Gather context from the current document and two most recent documents
                    const recentFiles = [
                        document.uri,
                        ...vscode.workspace.textDocuments
                            .slice(-2)
                            .filter(doc => doc.uri.toString() !== document.uri.toString())
                            .map(doc => doc.uri)
                    ];

                    const contextText = await getFileContext(recentFiles);
                    const fileExtension = document.fileName.split('.').pop() || '';
                    const startTime = new Date().getTime();

                    // Prompt need to be re-engineered
                    const prompt = [
                        // `Context:\n${contextText}`,
                        `Please provide only the code for ${line.text.trim()}. Do not include explanations or additional details. Write code in ${fileExtension} language.`
                    ].join('\n\n');

                    console.log('Sending prompt to Ollama:', prompt);

                    const response = await ollama.chat({
                        model: 'deepseek-coder:latest',
                        messages: [{ role: 'user', content: prompt }],
                        options: { temperature: 0.2 }
                    });
                    const endTime = new Date().getTime();

                    console.log('Ollama Response:', response);
                    const timeDifference = (endTime - startTime) / 60000;
                    console.log(`%cThe response is generated in ${timeDifference.toFixed(2)} minutes`, 'color: yellow');

                    let code = response.message.content.trim();
                    code = code.replace(/```(?:\w+)?\n?|```/g, '');
                    code = code.split('\n')
                        .filter(l => !commentPattern.test(l))
                        .join('\n')
                        .trim();

                    if (code) {
                        // Prepend a newline so that the inline suggestion appears on the next line
                        const insertionCode = '\n' + code;
                        const lineEnd = line.range.end;
                        

                        return [
                            new vscode.InlineCompletionItem(
                                insertionCode,
                                new vscode.Range(lineEnd, lineEnd) // Insert at end of the current line
                            )
                        ];
                    }
                } catch (error) {
                    console.error('Error getting code from Ollama:', error);
                }

                return [];
            }
        }
    );

    // Command to select context files (For testing purpose only)
    const selectContextCommand = vscode.commands.registerCommand(
        'ollama-copilot.selectContext',
        async () => {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: true,
                openLabel: 'Select Context Files'
            });

            if (files) {
                vscode.window.showInformationMessage(
                    `Selected ${files.length} context file(s) for Ollama Copilot`
                );
            }
        }
    );

    context.subscriptions.push(provider, selectContextCommand);
}

export function deactivate() {}
