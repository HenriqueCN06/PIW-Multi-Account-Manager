// login-manager.js

let credentials = {};

// Carrega as credenciais salvas via IPC (ou localStorage como fallback)
async function loadCredentials() {
    if (window.api) {
        credentials = await window.api.loadCreds();
    } else {
        credentials = JSON.parse(localStorage.getItem('piw_creds') || '{}');
    }

    for (let i = 1; i <= 4; i++) {
        const savedEmail = credentials[`acc_${i}_email`];
        const savedPass = credentials[`acc_${i}_pass`];
        
        if (savedEmail) {
            document.querySelector(`.login-email[data-acc="${i}"]`).value = savedEmail;
        }
        if (savedPass) {
            document.querySelector(`.login-password[data-acc="${i}"]`).value = savedPass;
        }
        
        if (window.api) window.api.log(`[Host] Conta ${i} carregou credenciais: Email=${!!savedEmail}, Senha=${!!savedPass}`);
    }
}

async function saveCredentials() {
    if (window.api) {
        await window.api.saveCreds(credentials);
    } else {
        localStorage.setItem('piw_creds', JSON.stringify(credentials));
    }
}

// Salva as credenciais no arquivo JSON de forma robusta quando o usuário digita
document.querySelectorAll('.login-input').forEach(input => {
    input.addEventListener('input', (e) => {
        const accId = e.target.getAttribute('data-acc');
        const isEmail = e.target.classList.contains('login-email');
        const key = isEmail ? `acc_${accId}_email` : `acc_${accId}_pass`;
        credentials[key] = e.target.value;
        saveCredentials();
    });
});

// Injeta o script de auto-login na webview
function injectAutoLogin(wv, accId) {
    const email = document.querySelector(`.login-email[data-acc="${accId}"]`).value;
    const senha = document.querySelector(`.login-password[data-acc="${accId}"]`).value;

    if (window.api) window.api.log(`[Host Conta ${accId}] injectAutoLogin chamado. url=${wv.getURL()}`);

    if (!email || !senha) {
        if (window.api) window.api.log(`[Host Conta ${accId}] Abortado: campos de email ou senha vazios no cabeçalho.`);
        return; 
    }

    if (window.api) window.api.log(`[Host Conta ${accId}] Injetando script no webview...`);

    const code = `
    (async () => {
        console.log("[PIW-AUTO-LOGIN] Injetado com sucesso na página!");
        if (window.__loginWatch) {
            console.log("[PIW-AUTO-LOGIN] Já existe um watcher rodando, abortando.");
            return;
        }
        
        const setVal = (el, val) => {
            const st = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            st.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        
        const findBtn = () => {
            const btns = [...document.querySelectorAll('button')];
            return btns.find(x => x.type === 'submit' || /auth-imgbtn/.test(x.className) || x.innerText?.toLowerCase().includes('entrar') || x.innerText?.toLowerCase().includes('login')) || document.querySelector('.login-btn, #login-btn');
        };
        
        // Tenta encontrar os campos de login por até 12 segundos (40 * 300ms)
        for (let t = 0; t < 40; t++) {
            const inputs = [...document.querySelectorAll('input')];
            const u = inputs.find(i => i.autocomplete === 'username' || i.type === 'email' || i.name === 'email' || i.name === 'username' || i.placeholder?.toLowerCase().includes('email') || i.placeholder?.toLowerCase().includes('user'));
            const p = inputs.find(i => i.autocomplete === 'current-password' || i.type === 'password' || i.name === 'password' || i.placeholder?.toLowerCase().includes('senha') || i.placeholder?.toLowerCase().includes('pass'));
            const b = findBtn();
            
            if (t === 0 || t === 10 || t === 25 || t === 39) {
                console.log("[PIW-AUTO-LOGIN] Tentativa " + t + " - Achou Usuário: " + !!u + ", Senha: " + !!p + ", Botão: " + !!b);
                if (b) console.log("[PIW-AUTO-LOGIN] Botão detectado:", b.outerHTML.substring(0, 50));
            }
            
            if (u && p && b) {
                console.log("[PIW-AUTO-LOGIN] Campos encontrados! Preenchendo dados...");
                const EMAIL = ${JSON.stringify(email)};
                const SENHA = ${JSON.stringify(senha)};
                
                const preenche = () => {
                    const ii = [...document.querySelectorAll('input')];
                    const uu = ii.find(i => i.autocomplete === 'username' || i.type === 'email' || i.name === 'email' || i.name === 'username' || i.placeholder?.toLowerCase().includes('email') || i.placeholder?.toLowerCase().includes('user'));
                    const pp = ii.find(i => i.autocomplete === 'current-password' || i.type === 'password' || i.name === 'password' || i.placeholder?.toLowerCase().includes('senha') || i.placeholder?.toLowerCase().includes('pass'));
                    if (uu && uu.value !== EMAIL) setVal(uu, EMAIL);
                    if (pp && pp.value !== SENHA) setVal(pp, SENHA);
                    return !!(uu && pp && uu.value === EMAIL && pp.value === SENHA);
                };
                
                preenche();
                
                window.__loginWatch = true;
                let ciclos = 0;
                
                const w = setInterval(() => {
                    const bb = findBtn();
                    // Se não achar o botão, ou passar de 10 min, desiste
                    if (!bb || ++ciclos > 1200) { 
                        clearInterval(w); 
                        window.__loginWatch = false; 
                        console.log("[PIW-AUTO-LOGIN] Desistindo da espera do Cloudflare (timeout ou botão sumiu).");
                        return; 
                    }
                    
                    const ok = preenche();
                    const tk = document.querySelector('input[name=cf-turnstile-response]');
                    
                    if (ciclos % 10 === 0) {
                        console.log("[PIW-AUTO-LOGIN] Aguardando Cloudflare... Token gerado: " + !!(tk && tk.value));
                    }
                    
                    // Se estiver tudo preenchido E o token do turnstile estiver pronto E botão não estiver desabilitado
                    if (ok && (!tk || tk.value) && !bb.disabled) { 
                        clearInterval(w); 
                        window.__loginWatch = false; 
                        console.log("[PIW-AUTO-LOGIN] Tudo pronto! Clicando em Entrar!");
                        bb.click(); 
                    }
                }, 500);
                
                return;
            }
            await new Promise(r => setTimeout(r, 300));
        }
        console.log("[PIW-AUTO-LOGIN] Desistiu após 40 tentativas de encontrar os campos na página.");
    })();
    `;
    
    wv.executeJavaScript(code).catch(() => {});
}

// Configura os listeners nas webviews
function setupAutoLoginWatchers() {
    if (window.api) window.api.log(`[Host] Configurando Watchers nas Webviews...`);
    document.querySelectorAll('webview').forEach((wv, index) => {
        const accId = index + 1;
        const inject = () => injectAutoLogin(wv, accId);
        
        wv.addEventListener('dom-ready', () => {
            if (window.api) window.api.log(`[Host Conta ${accId}] dom-ready disparado.`);
            inject();
        });
        wv.addEventListener('did-finish-load', () => {
            if (window.api) window.api.log(`[Host Conta ${accId}] did-finish-load disparado.`);
            inject();
        });
        
        wv.addEventListener('console-message', (e) => {
            if (e.message.includes('[PIW-AUTO-LOGIN]') && window.api) {
                window.api.log(`[Conta ${accId}] ${e.message}`);
            }
        });
        
        // Se a webview já carregou (ex: hot-reload), injeta imediatamente
        try {
            if (!wv.isLoading()) {
                if (window.api) window.api.log(`[Host Conta ${accId}] Webview já carregada, injetando...`);
                inject();
            }
        } catch (e) {
            // Ignora o erro. É comum o isLoading() falhar se a webview ainda estiver sendo criada pelo Electron.
            if (window.api) window.api.log(`[Host Conta ${accId}] Aguardando inicialização da webview...`);
        }
    });
}

// Inicializa
loadCredentials().then(() => {
    setupAutoLoginWatchers();
});
