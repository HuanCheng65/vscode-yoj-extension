(() => {
    const vscode = acquireVsCodeApi();
    const currentTheme = document.body.getAttribute('data-vscode-theme-kind');
    const baseEditorTheme = currentTheme === 'vscode-dark' ? 'vs-dark' :
        currentTheme === 'vscode-high-contrast' ? 'hc-black' : 'vs';

    hljs.highlightAll();
    let blankCount = parseInt(document.getElementById('blank').getAttribute('data-count'));
    let compiler = document.getElementById('compiler').getAttribute('data-value');
    let matchTemplate = document.getElementById('matchTemplate').getAttribute('data-value') === 'true';
    let monacoEditor = [];
    let currentFocusEditor = 0;
    const scrollTo = (element) => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const jumpToNextBlank = () => {
        if (currentFocusEditor < blankCount - 1) {
            currentFocusEditor++;
            monacoEditor[currentFocusEditor].focus();
            scrollTo(monacoEditor[currentFocusEditor].getDomNode());
        }
    };
    const jumpToPrevBlank = () => {
        if (currentFocusEditor > 0) {
            currentFocusEditor--;
            monacoEditor[currentFocusEditor].focus();
            scrollTo(monacoEditor[currentFocusEditor].getDomNode());
        }
    };
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'jumpToPrevBlank':
                jumpToPrevBlank();
                break;
            case 'jumpToNextBlank':
                jumpToNextBlank();
                break;
        }
    });
    require.config({ baseUrl: document.getElementById('requirePath').getAttribute('data-value') });
    require(['vs/editor/editor.main'], () => {
        monaco.editor.defineTheme('yoj', {
            base: baseEditorTheme,
            inherit: true,
            rules: [],
            colors: {}
        });

        for (let i = 0; i < blankCount; i++) {
            monacoEditor[i] = monaco.editor.create(document.getElementById('monaco-editor-' + i), {
                value: matchTemplate ? document.getElementById(`code-block-${i}`).innerText : '',
                language: compiler,
                theme: 'yoj',
                minimap: { enabled: false },
                fontWeight: 'var(--vscode-editor-font-weight)',
                fontFamily: 'var(--vscode-editor-font-family)',
            });

            monacoEditor[i].onDidFocusEditorWidget(() => {
                currentFocusEditor = i;
            });
        }

        monacoEditor[0].focus();
        scrollTo(monacoEditor[0].getDomNode());
    });

    document.getElementById('submit').addEventListener('click', async (e) => {
        e.preventDefault();
        let code = [];
        for (let i = 0; i < blankCount; i++) {
            code[i] = monacoEditor[i].getValue();
        }
        vscode.postMessage({
            command: 'submitFillCode',
            problemId: parseInt(document.getElementById('submit').getAttribute('data-problem-id')),
            sessionId: document.getElementById('submit').getAttribute('data-session-id'),
            complier: compiler,
            code: code
        });
        document.getElementById('submit').setAttribute('disabled', 'disabled');
        document.getElementById('submit').innerText = '提交中...';
    });
})();