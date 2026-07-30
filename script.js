// elements
const mainGrid = document.getElementById('main-grid');
const maximizeBtns = document.querySelectorAll('.maximize-btn');
const closeBtns = document.querySelectorAll('.close-btn');
const panels = document.querySelectorAll('.panel-wrapper');

let activeAccounts = [1, 2, 3, 4]; // Mantém estado de quais contas estão ativas
let currentlyMaximizedId = null;

const maxNavLeft = document.getElementById('max-nav-left');
const maxNavRight = document.getElementById('max-nav-right');

function updateMaxNavArrows() {
    if (!currentlyMaximizedId) {
        maxNavLeft.style.display = 'none';
        maxNavRight.style.display = 'none';
        return;
    }
    
    const idx = activeAccounts.indexOf(currentlyMaximizedId);
    if (idx === -1) {
        maxNavLeft.style.display = 'none';
        maxNavRight.style.display = 'none';
        return;
    }

    maxNavLeft.style.display = 'flex';
    maxNavLeft.onclick = () => {
        let prevIdx = idx - 1;
        if (prevIdx < 0) prevIdx = activeAccounts.length - 1;
        switchMaximizedAccount(activeAccounts[prevIdx]);
    };

    maxNavRight.style.display = 'flex';
    maxNavRight.onclick = () => {
        let nextIdx = idx + 1;
        if (nextIdx >= activeAccounts.length) nextIdx = 0;
        switchMaximizedAccount(activeAccounts[nextIdx]);
    };
}

function updateLayout() {
    // Remove eventuais placeholders de maximização
    document.querySelectorAll('.panel-placeholder').forEach(el => el.remove());

    // Esconde todos os painéis e remove as classes de posição
    panels.forEach(p => {
        p.style.display = 'none';
        p.classList.remove('pos-0', 'pos-1', 'pos-2', 'pos-3');
    });

    const count = activeAccounts.length;
    let gridClass = 'grid-' + count;

    // Lógica especial para o modo de 3 contas
    if (count === 3) {
        // Se a Conta 1 e a Conta 2 estão ambas abertas, o topo fica cheio (2 em cima, 1 embaixo)
        // Caso contrário, a base fica cheia (1 em cima, 2 embaixo)
        if (activeAccounts.includes(1) && activeAccounts.includes(2)) {
            gridClass = 'grid-3-top-heavy';
        } else {
            gridClass = 'grid-3-bottom-heavy';
        }
    }

    mainGrid.className = 'grid-container ' + gridClass;

    // Mostra contas ativas e atribui a posição dinâmica para o layout não quebrar
    activeAccounts.forEach((id, index) => {
        const panel = document.getElementById('panel-' + id);
        if (panel) {
            panel.style.display = 'flex';
            panel.classList.add('pos-' + index);
        }
    });
}

function triggerLayoutUpdate() {
    if (document.startViewTransition) {
        document.startViewTransition(() => updateLayout());
    } else {
        updateLayout();
    }
}

function restoreAccount(id) {
    if (!activeAccounts.includes(id)) {
        const finalizeRestore = () => {
            activeAccounts.push(id);
            activeAccounts.sort((a, b) => a - b); // Mantém a ordem 1, 2, 3, 4
            updateLayout();
            
            // Remove botão da doca
            const btn = document.getElementById('restore-btn-' + id);
            if (btn) btn.remove();
        };

        if (document.startViewTransition) {
            document.startViewTransition(() => finalizeRestore());
        } else {
            finalizeRestore();
        }
    }
}

function closeAccount(id) {
    if (activeAccounts.length <= 1) {
        alert("Você precisa manter pelo menos uma conta aberta!");
        return;
    }
    
    const index = activeAccounts.indexOf(id);
    if (index > -1) {
        let wasMaximized = (currentlyMaximizedId === id);
        let nextId = null;
        
        if (wasMaximized) {
            nextId = (index < activeAccounts.length - 1) ? activeAccounts[index + 1] : activeAccounts[index - 1];
        }

        const finalizeClose = () => {
            activeAccounts.splice(index, 1);
            
            // Desmaximiza se estava maximizada
            const panel = document.getElementById('panel-' + id);
            if (wasMaximized && panel) {
                panel.classList.remove('maximized');
                const maxBtn = panel.querySelector('.maximize-btn');
                if (maxBtn) {
                    maxBtn.innerHTML = '<i data-lucide="maximize" width="16" height="16"></i>';
                    maxBtn.setAttribute('title', 'Maximizar');
                    lucide.createIcons({ root: maxBtn });
                }
                
                // Remove o placeholder caso exista
                const ph = document.getElementById('ph-panel-' + id);
                if (ph) ph.remove();

                currentlyMaximizedId = null;
                updateMaxNavArrows();
                
                // Restaura opacidade de todos antes de mudar
                document.querySelectorAll('.panel-wrapper').forEach(p => p.style.opacity = '1');
            }

            updateLayout();
            // Adiciona botão no canto respectivo da tela
            const btn = document.createElement('button');
            btn.className = 'restore-btn corner-' + id;
            btn.style.viewTransitionName = 'restore-btn-' + id;
            btn.id = 'restore-btn-' + id;
            btn.title = 'Restaurar Conta ' + id;
            btn.innerHTML = '<i data-lucide="plus" width="20" height="20"></i>';
            btn.onclick = () => restoreAccount(id);
            document.body.appendChild(btn);
            lucide.createIcons({ root: btn });

            if (wasMaximized && nextId !== null) {
                performMaximizeToggle(nextId);
            } else if (wasMaximized && nextId === null) {
                document.querySelectorAll('.panel-wrapper').forEach(p => p.style.opacity = '1');
            }
        };

        if (document.startViewTransition) {
            let originalNames = [];
            
            // Se estava maximizado, desativamos as animações de slide de TODOS os painéis
            // para que a transição seja apenas um cross-fade da tela inteira, escondendo o shuffle de fundo.
            if (wasMaximized) {
                document.querySelectorAll('.panel-wrapper').forEach(p => {
                    originalNames.push({ el: p, name: p.style.viewTransitionName });
                    p.style.viewTransitionName = 'none';
                });
            }

            const transition = document.startViewTransition(() => finalizeClose());
            
            transition.finished.then(() => {
                if (wasMaximized) {
                    originalNames.forEach(item => {
                        // Só tenta restaurar se o painel ainda existir no DOM
                        if (document.body.contains(item.el)) {
                            item.el.style.viewTransitionName = item.name;
                        }
                    });
                }
            });
        } else {
            finalizeClose();
        }
    }
}

// Configura botões de fechar
closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'));
        closeAccount(id);
    });
});

// Inicializa layout no load
updateLayout();

// Funções Globais de Maximização
function performMaximizeToggle(id) {
    const targetPanel = document.getElementById('panel-' + id);
    if (!targetPanel) return;
    const btn = targetPanel.querySelector('.maximize-btn');
    if (!btn) return;

    if (targetPanel.classList.contains('maximized')) {
        // Restore
        targetPanel.classList.remove('maximized');
        btn.innerHTML = '<i data-lucide="maximize" width="16" height="16"></i>';
        btn.setAttribute('title', 'Maximizar');
        
        const ph = document.getElementById('ph-panel-' + id);
        if (ph) ph.remove();

        document.querySelectorAll('.panel-wrapper').forEach(p => p.style.opacity = '1');
        currentlyMaximizedId = null;
        
        // Retorna o zoom para o tamanho reduzido na grade
        const wv = document.getElementById('webview-' + id);
        if (wv) {
            zoomState[wv.id] = 0.6;
            try { wv.setZoomFactor(0.6); } catch(e) {}
        }
    } else {
        // Maximize
        const ph = document.createElement('div');
        ph.id = 'ph-panel-' + id;
        ph.className = targetPanel.className + ' panel-placeholder';
        ph.classList.remove('maximized', 'panel-wrapper');
        ph.style.display = 'block';
        mainGrid.insertBefore(ph, targetPanel);

        targetPanel.classList.add('maximized');
        btn.innerHTML = '<i data-lucide="minimize-2" width="16" height="16"></i>';
        btn.setAttribute('title', 'Restaurar');
        
        // Define o zoom padrão normal para quando maximizado
        const wv = document.getElementById('webview-' + id);
        if (wv) {
            zoomState[wv.id] = 1.0;
            try { wv.setZoomFactor(1.0); } catch(e) {}
        }
        
        targetPanel.style.opacity = '1'; // Ensure the target panel is fully visible

        document.querySelectorAll('.panel-wrapper').forEach(p => {
            if (p.id !== 'panel-' + id) {
                p.style.opacity = '0';
            }
        });
        currentlyMaximizedId = id;
    }
    lucide.createIcons({ root: btn });
    updateMaxNavArrows();
}

function toggleMaximizeAccount(id) {
    const targetPanel = document.getElementById('panel-' + id);
    if (!targetPanel) return;

    if (document.startViewTransition) {
        let originalNames = [];
        document.querySelectorAll('.panel-wrapper').forEach(p => {
            originalNames.push({ el: p, name: p.style.viewTransitionName });
            p.style.viewTransitionName = 'none';
        });
        
        const transition = document.startViewTransition(() => performMaximizeToggle(id));
        
        transition.finished.then(() => {
            originalNames.forEach(item => {
                item.el.style.viewTransitionName = item.name;
            });
        });
    } else {
        performMaximizeToggle(id);
    }
}

function switchMaximizedAccount(newId) {
    if (!currentlyMaximizedId) return;

    const oldId = currentlyMaximizedId;
    const oldPanel = document.getElementById('panel-' + oldId);
    const newPanel = document.getElementById('panel-' + newId);
    if (!oldPanel || !newPanel) return;

    if (document.startViewTransition) {
        let originalNames = [];
        document.querySelectorAll('.panel-wrapper').forEach(p => {
            originalNames.push({ el: p, name: p.style.viewTransitionName });
            p.style.viewTransitionName = 'none';
        });

        const transition = document.startViewTransition(() => {
            performMaximizeToggle(oldId); // Restaura atual
            performMaximizeToggle(newId); // Maximiza o novo
        });

        transition.finished.then(() => {
            originalNames.forEach(item => {
                item.el.style.viewTransitionName = item.name;
            });
        });
    } else {
        performMaximizeToggle(oldId);
        performMaximizeToggle(newId);
    }
}

// Handle maximize/restore click nos botões
maximizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetIdString = btn.getAttribute('data-target'); // "panel-1"
        const id = parseInt(targetIdString.replace('panel-', ''));
        toggleMaximizeAccount(id);
    });
});

// Handle refresh
const refreshBtns = document.querySelectorAll('.refresh-btn');
refreshBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetWebview = document.getElementById(targetId);
        if (targetWebview) {
            targetWebview.reload();
        }
    });
});

// Handle clear cache
const clearCacheBtns = document.querySelectorAll('.clear-cache-btn');
clearCacheBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetWebview = document.getElementById(targetId);
        if (targetWebview) {
            if (confirm("Tem certeza que deseja forçar o recarregamento ignorando o cache? (Isso baixará as imagens e arquivos do jogo novamente sem apagar seu login)")) {
                targetWebview.reloadIgnoringCache();
            }
        }
    });
});

// Initialize icons on load
lucide.createIcons();

// Handle zoom in/out
const zoomState = {};
document.querySelectorAll('webview').forEach(wv => {
    zoomState[wv.id] = 0.6; // Padrão para minijanelas
    wv.addEventListener('dom-ready', () => {
        wv.setZoomFactor(zoomState[wv.id]);
    });
});

document.querySelectorAll('.zoom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const webview = document.getElementById(targetId);
        
        if (btn.classList.contains('zoom-in')) {
            zoomState[targetId] += 0.1;
        } else {
            zoomState[targetId] -= 0.1;
        }
        
        webview.setZoomFactor(zoomState[targetId]);
    });
});

// Tools Menu Logic
const toolsMenuBtn = document.getElementById('tools-menu-btn');
const toolsMenuContainer = document.getElementById('tools-menu-container');

toolsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toolsMenuContainer.classList.toggle('open');
});
