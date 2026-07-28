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

    if (!email || !senha) {
        return; 
    }

    const code = `
    (async () => {
        if (window.__loginWatch) {
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
            
            if (u && p && b) {
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
                        return; 
                    }
                    
                    const ok = preenche();
                    const tk = document.querySelector('input[name=cf-turnstile-response]');
                    
                    // Se estiver tudo preenchido E o token do turnstile estiver pronto E botão não estiver desabilitado
                    if (ok && (!tk || tk.value) && !bb.disabled) { 
                        clearInterval(w); 
                        window.__loginWatch = false; 
                        bb.click(); 
                    }
                }, 500);
                
                return;
            }
            await new Promise(r => setTimeout(r, 300));
        }
    })();
    `;
    
    wv.executeJavaScript(code).catch(() => {});
}

// Configura os listeners nas webviews
function setupAutoLoginWatchers() {
    document.querySelectorAll('webview').forEach((wv, index) => {
        const accId = index + 1;
        const inject = () => injectAutoLogin(wv, accId);
        
        wv.addEventListener('dom-ready', () => {
            inject();
        });
        wv.addEventListener('did-finish-load', () => {
            inject();
        });
        
        // Se a webview já carregou (ex: hot-reload), injeta imediatamente
        try {
            if (!wv.isLoading()) {
                inject();
            }
        } catch (e) {
            // Ignora o erro se a webview não estiver totalmente inicializada
        }
    });
}

// Inicializa
loadCredentials().then(() => {
    setupAutoLoginWatchers();
});
