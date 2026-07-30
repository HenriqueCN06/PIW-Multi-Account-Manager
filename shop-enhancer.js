const injectShopEnhancer = `
(() => {
    if (window.__shopEnhancerInjected) return;
    window.__shopEnhancerInjected = true;

    const style = document.createElement('style');
    style.innerHTML = \`
        .mk-row {
            position: relative !important;
        }
        .custom-shop-lock {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0.6;
            transition: opacity 0.2s;
            outline: none;
            z-index: 10;
        }
        .custom-shop-lock:hover {
            opacity: 1;
        }
        .custom-shop-lock svg {
            width: 18px;
            height: 18px;
            fill: #d1b46b; 
            filter: drop-shadow(0px 1px 1px rgba(0,0,0,0.5));
        }
        .mk-row.locked-item input[type="checkbox"] {
            opacity: 0.3 !important;
            cursor: not-allowed !important;
        }
        .mk-row.locked-item {
            background-color: rgba(0, 0, 0, 0.2) !important;
        }
        .mk-row.locked-item .mk-info,
        .mk-row.locked-item .mk-ico,
        .mk-row.locked-item .mk-price {
            opacity: 0.6 !important;
        }
    \`;
    if (document.head) document.head.appendChild(style);

    const lockClosedSVG = \`<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>\`;
    const lockOpenSVG = \`<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>\`;



    function getLockedItems() {
        return window.__piw_host_locks || [];
    }

    function saveLockedItems(items) {
        window.__piw_host_locks = items;
        console.log('__PIW_LOCK__' + JSON.stringify(items));
    }

    function toggleLock(itemName) {
        let items = getLockedItems();
        if (items.includes(itemName)) {
            items = items.filter(i => i !== itemName);
        } else {
            items.push(itemName);
        }
        saveLockedItems(items);
        updateAllRows();
    }

    function updateAllRows() {
        const activeTab = document.querySelector('.mk-tab.on');
        const isSellTab = activeTab && activeTab.innerText.trim().match(/Vender|Sell/i);
        
        if (!isSellTab) {
            // Se não estiver na aba Vender, podemos remover o hijack se existir para não interferir em outras abas
            const sellSelectAll = document.querySelector('.mk-selall');
            if (sellSelectAll && sellSelectAll.__piwIntercepted) {
                // A forma mais segura de remover é clonando o nó
                const clone = sellSelectAll.cloneNode(true);
                sellSelectAll.parentNode.replaceChild(clone, sellSelectAll);
            }
            return;
        }

        const lockedItems = getLockedItems();
        const rows = document.querySelectorAll('.mk-row');
        rows.forEach(row => {
            try {
                const nameEl = row.querySelector('.mk-name');
                const checkbox = row.querySelector('input[type="checkbox"]');
            
            if (!nameEl || !checkbox) return;
            const itemName = nameEl.innerText.trim();
            
            const hasNativeLock = Array.from(row.querySelectorAll('*')).some(el => {
                if (el.closest && el.closest('.custom-shop-lock')) return false;
                if (el.className && typeof el.className === 'string' && el.className.includes('lock')) return true;
                if (el.src && typeof el.src === 'string' && el.src.includes('lock')) return true;
                return false;
            });

            if (hasNativeLock) return;

            let lockBtn = row.querySelector('.custom-shop-lock');
            if (!lockBtn) {
                lockBtn = document.createElement('button');
                lockBtn.className = 'custom-shop-lock';
                lockBtn.type = 'button';
                lockBtn.title = 'Trancar/Destrancar Venda';
                
                lockBtn.innerHTML = \`
                    <span class="icon-open">\${lockOpenSVG}</span>
                    <span class="icon-closed" style="display: none;">\${lockClosedSVG}</span>
                \`;
                
                const preventBubbling = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                };
                lockBtn.addEventListener('mousedown', preventBubbling, true);
                lockBtn.addEventListener('mouseup', preventBubbling, true);
                
                lockBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentNameEl = row.querySelector('.mk-name');
                    if (currentNameEl) {
                        toggleLock(currentNameEl.innerText.trim());
                    }
                }, true);

                row.appendChild(lockBtn);
                const priceEl = row.querySelector('.mk-price');
                if (priceEl) priceEl.style.marginRight = '30px';
            }

            const isLocked = lockedItems.includes(itemName);

            if (isLocked) {
                row.classList.add('locked-item');
                const openIcon = lockBtn.querySelector('.icon-open');
                const closedIcon = lockBtn.querySelector('.icon-closed');
                if (openIcon) openIcon.style.display = 'none';
                if (closedIcon) closedIcon.style.display = 'block';
                
                if (checkbox.checked) {
                    checkbox.disabled = false; // Habilita rápido para receber o clique
                    checkbox.click(); // Simula um clique real do mouse para desmarcar
                }
                if (!checkbox.disabled) checkbox.disabled = true;
            } else {
                row.classList.remove('locked-item');
                const openIcon = lockBtn.querySelector('.icon-open');
                const closedIcon = lockBtn.querySelector('.icon-closed');
                if (openIcon) openIcon.style.display = 'block';
                if (closedIcon) closedIcon.style.display = 'none';
                if (checkbox.disabled) checkbox.disabled = false;
            }
            } catch (loopError) {
                console.error("PIW: Error updating row", loopError);
            }
        });

        // Intercepta o botão "Selecionar Tudo" nativo
        const sellSelectAll = document.querySelector('.mk-selall');
        if (sellSelectAll && !sellSelectAll.__piwIntercepted) {
            sellSelectAll.__piwIntercepted = true;
            sellSelectAll.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();

                const allRows = Array.from(document.querySelectorAll('.mk-row'));
                const unlockedRows = allRows.filter(r => !r.classList.contains('locked-item'));
                
                const anyUnchecked = unlockedRows.some(r => {
                    const cb = r.querySelector('input[type="checkbox"]');
                    return cb && !cb.disabled && !cb.checked;
                });

                unlockedRows.forEach(r => {
                    const cb = r.querySelector('input[type="checkbox"]');
                    if (cb && !cb.disabled) {
                        if (anyUnchecked && !cb.checked) cb.click();
                        else if (!anyUnchecked && cb.checked) cb.click();
                    }
                });
            }, true);
        }

        // Atualização contínua do texto do botão Selecionar Tudo
        if (sellSelectAll) {
            const allRows = Array.from(document.querySelectorAll('.mk-row'));
            const unlockedRows = allRows.filter(r => !r.classList.contains('locked-item'));
            if (unlockedRows.length > 0) {
                const anyUnchecked = unlockedRows.some(r => {
                    const cb = r.querySelector('input[type="checkbox"]');
                    return cb && !cb.disabled && !cb.checked;
                });
                const desiredText = anyUnchecked ? '☐ Selecionar todos' : '☑ Desmarcar todos';
                if (sellSelectAll.innerHTML !== desiredText) {
                    sellSelectAll.innerHTML = desiredText;
                }
            }
        }
    }

    setInterval(updateAllRows, 150);
})();
`;

// --- Host Window Logic ---
// Carrega as travas do disco na inicializao
window.api.loadCreds().then(creds => {
    window.__piw_locks_cache = creds.__piw_locks || {};
});

setInterval(() => {
    const allLocks = window.__piw_locks_cache || {};
    document.querySelectorAll('webview').forEach(wv => {
        const wvId = wv.id || 'default';
        const currentLocks = allLocks[wvId] || '[]';
        
        // Garante que o listener est colocado caso o webview tenha sido gerado depois
        if (!wv.__piwShopLockListenerAdded) {
            wv.__piwShopLockListenerAdded = true;
            wv.addEventListener('console-message', (e) => {
                if (e.message && e.message.startsWith('__PIW_LOCK__')) {
                    const itemsStr = e.message.substring(12);
                    window.__piw_locks_cache[wvId] = itemsStr;
                    
                    // Salva no disco (creds.json) mantendo a estrutura por aba
                    window.api.loadCreds().then(creds => {
                        creds.__piw_locks = window.__piw_locks_cache;
                        window.api.saveCreds(creds);
                    });
                }
            });
        }

        if (!wv.isLoading()) {
            wv.executeJavaScript(`window.__piw_host_locks = ${currentLocks};`).catch(() => {});
            wv.executeJavaScript(injectShopEnhancer).catch(() => {});
        }
    });
}, 2000);


