const markToggleBtn = document.getElementById('remote-mark-btn');
const markPanel = document.getElementById('mark-panel');
const markCloseBtn = document.getElementById('mark-close-btn');
const markAccountSelect = document.getElementById('mark-account-select');
const markGoldAmount = document.getElementById('mark-gold-amount');
const markCatalog = document.getElementById('mark-catalog');
const markLoading = document.getElementById('mark-loading');
const markSellList = document.getElementById('mark-sell-list');
const markSellTotal = document.getElementById('mark-sell-total');
const markSellBtn = document.getElementById('mark-sell-btn');
const markTabs = document.querySelectorAll('.mark-tab');

let markDataCache = null;
let itemsDictionary = null;

async function fetchItemsDictionary() {
    if (itemsDictionary) return;
    try {
        const response = await fetch('https://poke.idleworld.online/game/items.json');
        const payload = await response.json();
        const catalogItems = Array.isArray(payload) ? payload : (payload.items || []);
        itemsDictionary = new Map(catalogItems.map(item => [String(item.id), item]));
    } catch (e) {
        console.error("Failed to load items dictionary", e);
    }
}

markTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        markTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.querySelectorAll('.mark-body').forEach(b => b.classList.add('hidden'));
        document.getElementById(targetId).classList.remove('hidden');
    });
});

// Alternar a visibilidade do painel
markToggleBtn.addEventListener('click', () => {
    const isHidden = markPanel.classList.contains('hidden');
    if (isHidden) {
        markPanel.classList.remove('hidden');
        updateMarkAccountOptions();
        const accId = markAccountSelect.value;
        if (accId) {
            loadMarkData(accId);
        } else {
            markCatalog.innerHTML = '<div style="color:#94a3b8; padding:10px;">Nenhuma conta logada encontrada.</div>';
            markSellList.innerHTML = '<div style="color:#94a3b8; padding:10px;">Nenhuma conta logada encontrada.</div>';
        }
    } else {
        markPanel.classList.add('hidden');
    }
});

// Fechar painel
markCloseBtn.addEventListener('click', () => {
    markPanel.classList.add('hidden');
});

// --- Lógica para arrastar o painel ---
const markHeader = document.querySelector('.mark-header');
let isMarkDragging = false;
let markStartX, markStartY;

markHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('.panel-close-btn') || e.target.closest('select') || e.target.closest('button')) return;
    isMarkDragging = true;
    
    markPanel.style.transition = 'none';
    const rect = markPanel.getBoundingClientRect();
    markPanel.style.transform = 'none';
    markPanel.style.left = rect.left + 'px';
    markPanel.style.top = rect.top + 'px';
    
    markStartX = e.clientX - rect.left;
    markStartY = e.clientY - rect.top;
    
    markHeader.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isMarkDragging) return;
    e.preventDefault();
    markPanel.style.left = (e.clientX - markStartX) + 'px';
    markPanel.style.top = (e.clientY - markStartY) + 'px';
});

document.addEventListener('mouseup', () => {
    if (isMarkDragging) {
        isMarkDragging = false;
        markHeader.style.cursor = 'grab';
        markPanel.style.transition = '';
    }
});
markHeader.style.cursor = 'grab';
// -------------------------------------

// Recarregar dados ao trocar de conta
markAccountSelect.addEventListener('change', (e) => {
    loadMarkData(e.target.value);
});

// Atualiza lista de contas para mostrar apenas logadas
function updateMarkAccountOptions() {
    const prevValue = markAccountSelect.value;
    markAccountSelect.innerHTML = '';
    
    document.querySelectorAll('webview').forEach((wv, index) => {
        let isLogged = false;
        try {
            const url = wv.getURL();
            if (url && url.includes('poke.idleworld.online') && !url.includes('login')) {
                isLogged = true;
            }
        } catch(e) {} // Ignora erros se a webview no estiver pronta
        
        if (isLogged) {
            const accName = wv.getAttribute('data-name') || `Conta ${index + 1}`;
            const opt = document.createElement('option');
            opt.value = wv.id.replace('webview-', '');
            opt.textContent = accName;
            markAccountSelect.appendChild(opt);
        }
    });

    if (markAccountSelect.options.length > 0) {
        const prevOpt = Array.from(markAccountSelect.options).find(o => o.value === prevValue);
        if (prevOpt) {
            markAccountSelect.value = prevValue;
        } else {
            markAccountSelect.selectedIndex = 0;
        }
    } else {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "Nenhuma logada";
        markAccountSelect.appendChild(opt);
    }
}

// Busca os dados do catálogo injetando script na webview
async function loadMarkData(accountId) {
    if (!accountId) return;
    
    const wv = document.getElementById(`webview-${accountId}`);
    if (!wv) return;

    markCatalog.innerHTML = '';
    markSellList.innerHTML = '';
    const msl = document.getElementById('mark-sell-stones-list');
    if(msl) msl.innerHTML = '';
    const msp = document.getElementById('mark-sell-pokemons-list');
    if(msp) msp.innerHTML = '';
    markLoading.classList.remove('hidden');
    markGoldAmount.textContent = '...';
    
    try {
        const result = await wv.executeJavaScript('window.markApi.fetchMarkData()');
        markLoading.classList.add('hidden');
        
        if (result.success) {
            markDataCache = result;
            renderMarkCatalog(result, accountId);
            
            await fetchItemsDictionary();
            renderSellCatalog(accountId);
            renderSellStonesCatalog(accountId);
            if (result.pokemons) {
                renderSellPokemons(result.pokemons, accountId);
            }
        } else {
            markCatalog.innerHTML = `<div style="grid-column: 1 / -1; color:#ef4444; padding: 60px 20px; text-align: center; font-size: 16px; font-weight: 500;">Erro: ${result.error}</div>`;
        }
    } catch (err) {
        markLoading.classList.add('hidden');
        markCatalog.innerHTML = `<div style="grid-column: 1 / -1; color:#ef4444; padding: 60px 20px; text-align: center; font-size: 16px; font-weight: 500;">Erro interno: ${err.message}</div>`;
        markSellList.innerHTML = `<div style="color:#ef4444; padding: 20px; text-align: center;">Erro interno: ${err.message}</div>`;
    }
}

// Renderiza a vitrine de produtos
function renderMarkCatalog(data, accountId) {
    markGoldAmount.textContent = Number(data.gold).toLocaleString('pt-BR');
    
    const balls = (data.catalog.balls || []).map(b => ({ ...b, isBall: true }));
    const items = (data.catalog.items || []).map(i => ({ ...i, isBall: false }));
    const allProducts = [...balls, ...items];
    
    if (allProducts.length === 0) {
        markCatalog.innerHTML = '<div style="color:#94a3b8; padding:10px;">Catálogo vazio.</div>';
        return;
    }
    
    markCatalog.innerHTML = allProducts.map(product => {
        let stock = (product.isBall ? data.ballCounts?.[product.id] : data.itemCounts?.[product.id]) || 0;
        let stockStr = Number(stock).toLocaleString('pt-BR');
        
        const price = Number(product.priceGold || 0);
        
        let imgPath = product.image || product.iconUrl || product.icon || '';
        let imgUrl = '';
        if (imgPath) {
            imgUrl = imgPath.startsWith('http') ? imgPath : `https://poke.idleworld.online/${imgPath.startsWith('/') ? imgPath.slice(1) : imgPath}`;
        } else {
            // fallback: tenta deduzir pelo nome (ex: "Poké Ball" -> "pokeball.png")
            let fallbackName = (product.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            if (!fallbackName) fallbackName = product.item_id || product.id;
            imgUrl = `https://poke.idleworld.online/images/items/${fallbackName}.png`;
        }
        
        const formatCost = (c) => c >= 1000000 ? (c/1000000).toFixed(1).replace('.0', '') + 'KK' : c >= 1000 ? (c/1000).toFixed(1).replace('.0', '') + 'K' : c;
        
        return `
        <div class="mark-item-card">
            <div class="mark-item-header">
                <div class="mark-item-info">
                    <img src="${imgUrl}" class="mark-item-img ${product.isBall ? 'mark-img-ball' : ''}" alt="${product.name}" onerror="this.src='https://poke.idleworld.online/images/items/pokeball.png'">
                    <div>
                        <div class="mark-item-name">${product.name}</div>
                        <div class="mark-item-stock">Possui: <span id="stock-${product.id}">${stockStr}</span></div>
                    </div>
                </div>
                <div class="mark-item-price">
                    <i data-lucide="circle-dollar-sign" width="14" height="14" style="color: #fbbf24;"></i>
                    ${price.toLocaleString('pt-BR')}
                </div>
            </div>
            <div class="mark-item-actions">
                <button class="mark-buy-btn" onclick="buyMarkItem('${accountId}', '${product.id}', 1, ${price}, ${product.isBall})">+1 <span class="mark-btn-price">$${formatCost(price)}</span></button>
                <button class="mark-buy-btn" onclick="buyMarkItem('${accountId}', '${product.id}', 10, ${price}, ${product.isBall})">+10 <span class="mark-btn-price">$${formatCost(price * 10)}</span></button>
                <button class="mark-buy-btn" onclick="buyMarkItem('${accountId}', '${product.id}', 100, ${price}, ${product.isBall})">+100 <span class="mark-btn-price">$${formatCost(price * 100)}</span></button>
                <button class="mark-buy-btn" onclick="buyMarkItem('${accountId}', '${product.id}', 1000, ${price}, ${product.isBall})">+1K <span class="mark-btn-price">$${formatCost(price * 1000)}</span></button>
                <button class="mark-buy-btn" onclick="buyMarkItem('${accountId}', '${product.id}', 10000, ${price}, ${product.isBall})">+10K <span class="mark-btn-price">$${formatCost(price * 10000)}</span></button>
            </div>
        </div>
        `;
    }).join('');
    
    lucide.createIcons({ root: markCatalog });
}

// Executa a compra
window.buyMarkItem = async function(accountId, productId, qty, unitPrice, isBall) {
    const wv = document.getElementById(`webview-${accountId}`);
    if (!wv) return;
    
    if (markDataCache && markDataCache.gold < (unitPrice * qty)) {
        alert("Ouro insuficiente para esta compra.");
        return;
    }
    
    // Bloqueia a UI para evitar glitches do dropdown fechando durante o update do DOM
    markAccountSelect.disabled = true;
    const allBtns = document.querySelectorAll('.mark-buy-btn');
    allBtns.forEach(btn => btn.style.opacity = '0.5');
    allBtns.forEach(btn => btn.style.pointerEvents = 'none');
    
    try {
        const result = await wv.executeJavaScript(`window.markApi.buyItem('${productId}', ${qty}, ${isBall})`);
        if (result.success) {
            if (result.gold !== undefined) {
                markGoldAmount.textContent = Number(result.gold).toLocaleString('pt-BR');
                if (markDataCache) markDataCache.gold = result.gold;
            }
            
            if (result.counts && result.counts[productId] !== undefined) {
                const stockEl = document.getElementById(`stock-${productId}`);
                if (stockEl) stockEl.textContent = Number(result.counts[productId]).toLocaleString('pt-BR');
                if (markDataCache) {
                    if (isBall && markDataCache.ballCounts) markDataCache.ballCounts[productId] = result.counts[productId];
                    else if (!isBall && markDataCache.itemCounts) markDataCache.itemCounts[productId] = result.counts[productId];
                }
            } else {
                // Se a API não retornou a quantidade oficial (ex: poções), nós simulamos a soma para o usuário não ficar no escuro
                const stockEl = document.getElementById(`stock-${productId}`);
                if (stockEl) {
                    const currentText = stockEl.textContent;
                    const currentStock = parseInt(currentText.replace(/[^0-9]/g, '')) || 0;
                    let newStock = currentStock + qty;
                    let stockStr = newStock.toLocaleString('pt-BR');
                    stockEl.textContent = stockStr;
                    
                    if (markDataCache) {
                        if (isBall && markDataCache.ballCounts) markDataCache.ballCounts[productId] = newStock;
                        else if (!isBall && markDataCache.itemCounts) markDataCache.itemCounts[productId] = newStock;
                    }
                }
            }
        } else {
            alert("Falha na compra: " + result.error);
        }
    } catch (err) {
        console.error(err);
        alert("Erro de comunicação ao comprar.");
    } finally {
        // Libera a UI
        markAccountSelect.disabled = false;
        allBtns.forEach(btn => btn.style.opacity = '1');
        allBtns.forEach(btn => btn.style.pointerEvents = '');
    }
};

function renderSellCatalog(accountId) {
    if (!itemsDictionary || !markDataCache) return;
    
    let lockedItems = [];
    try {
        const lockStr = window.__piw_locks_cache && window.__piw_locks_cache[`webview-${accountId}`];
        if (lockStr) lockedItems = JSON.parse(lockStr);
    } catch(e) {}

    const sellableItems = [];
    for (const [itemId, qty] of Object.entries(markDataCache.itemCounts || {})) {
        if (qty <= 0) continue;
        const dictItem = itemsDictionary.get(String(itemId));
        if (!dictItem) continue;
        const category = String(dictItem.category || '').toLowerCase();
        const npcPrice = Number(dictItem.npcPrice) || 0;
        
        if (npcPrice > 0 && !['heal', 'revive', 'stone'].includes(category)) {
            const isLocked = lockedItems.includes(dictItem.name);
            sellableItems.push({
                itemId,
                name: dictItem.name,
                qty: qty,
                price: npcPrice,
                isLocked,
                iconUrl: dictItem.image || dictItem.icon || dictItem.iconUrl || `images/items/${dictItem.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`
            });
        }
    }
    
    sellableItems.sort((a, b) => b.price - a.price);

    if (sellableItems.length === 0) {
        markSellList.innerHTML = '<div style="color:#94a3b8; padding:10px;">Nada para vender.</div>';
        markSellTotal.textContent = "0";
        markSellBtn.disabled = true;
        return;
    }
    
    markSellList.innerHTML = sellableItems.map(item => {
        let imgUrl = item.iconUrl.startsWith('http') ? item.iconUrl : `https://poke.idleworld.online/${item.iconUrl.startsWith('/') ? item.iconUrl.slice(1) : item.iconUrl}`;
        const lockIconSVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
        const lockIcon = `<div class="toggle-lock-btn" data-name="${item.name}" style="cursor:pointer; display:flex; align-items:center; justify-content:center; padding-left:10px; margin-left:10px; border-left:1px solid #1a2d3a; color:${item.isLocked ? '#ef4444' : '#475569'};" title="${item.isLocked ? 'Clique para destravar' : 'Clique para travar'}">${lockIconSVG}</div>`;
        
        return `
        <div class="mark-sell-item ${item.isLocked ? 'locked' : ''}" data-id="${item.itemId}" data-price="${item.price}">
            <input type="checkbox" class="mark-sell-item-checkbox" ${item.isLocked ? 'disabled title="Bloqueado"' : ''}>
            <img src="${imgUrl}" class="item-icon" alt="${item.name}" onerror="this.src='https://poke.idleworld.online/images/items/pokeball.png'">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-stock">Possui: ${item.qty.toLocaleString('pt-BR')}</div>
            </div>
            <div class="item-price-box">
                <div class="item-price">$${item.price.toLocaleString('pt-BR')}</div>
                <div class="item-subtotal hidden"></div>
            </div>
            <input type="number" class="item-input sell-qty-input" max="${item.qty}" min="0" value="0" ${item.isLocked ? 'disabled title="Bloqueado no jogo"' : ''}>
            ${lockIcon}
        </div>
        `;
    }).join('');
    
    updateSellTotal();
    
    document.querySelectorAll('.toggle-lock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que clique no card selecione o item
            const itemName = btn.getAttribute('data-name');
            const accountId = markAccountSelect.value;
            const wvId = `webview-${accountId}`;
            
            let lockedItems = window.__piw_locks_cache ? JSON.parse(window.__piw_locks_cache[wvId] || '[]') : [];
            const isCurrentlyLocked = lockedItems.includes(itemName);
            
            if (isCurrentlyLocked) {
                lockedItems = lockedItems.filter(i => i !== itemName);
                btn.style.color = '#475569';
                btn.title = 'Clique para travar';
            } else {
                lockedItems.push(itemName);
                btn.style.color = '#ef4444';
                btn.title = 'Clique para destravar';
            }
            
            if (!window.__piw_locks_cache) window.__piw_locks_cache = {};
            window.__piw_locks_cache[wvId] = JSON.stringify(lockedItems);
            
            if (window.api && window.api.loadCreds) {
                window.api.loadCreds().then(creds => {
                    creds.__piw_locks = window.__piw_locks_cache;
                    window.api.saveCreds(creds);
                });
            }
            
            const row = btn.closest('.mark-sell-item');
            const cb = row.querySelector('.mark-sell-item-checkbox');
            const inp = row.querySelector('.sell-qty-input');
            
            if (!isCurrentlyLocked) { // Ficou travado
                row.classList.add('locked');
                cb.disabled = true;
                cb.title = 'Bloqueado';
                cb.checked = false;
                inp.disabled = true;
                inp.title = 'Bloqueado no jogo';
                inp.value = 0;
            } else { // Ficou destravado
                row.classList.remove('locked');
                cb.disabled = false;
                cb.title = '';
                inp.disabled = false;
                inp.title = '';
            }
            inp.dispatchEvent(new Event('input'));
        });
    });

    document.querySelectorAll('.mark-sell-item').forEach(row => {
        row.addEventListener('click', (e) => {
            if (row.classList.contains('locked')) return;
            if (e.target.tagName.toLowerCase() === 'input' || e.target.closest('.toggle-lock-btn')) return;
            const cb = row.querySelector('.mark-sell-item-checkbox');
            const inp = row.querySelector('.sell-qty-input');
            cb.checked = !cb.checked;
            inp.value = cb.checked ? inp.getAttribute('max') : 0;
            // Dispara evento manual pra atualizar subtotal e estado selected
            inp.dispatchEvent(new Event('input'));
        });
    });
    
    document.querySelectorAll('.mark-sell-item-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const row = e.target.closest('.mark-sell-item');
            const inp = row.querySelector('.sell-qty-input');
            inp.value = e.target.checked ? inp.getAttribute('max') : 0;
            inp.dispatchEvent(new Event('input'));
        });
    });
    
    document.querySelectorAll('.sell-qty-input').forEach(inp => {
        inp.addEventListener('input', () => {
            let val = parseInt(inp.value);
            const max = parseInt(inp.getAttribute('max'));
            if (isNaN(val) || val < 0) val = 0;
            if (val > max) val = max;
            inp.value = val;
            
            const row = inp.closest('.mark-sell-item');
            const cb = row.querySelector('.mark-sell-item-checkbox');
            if (cb && !cb.disabled) {
                cb.checked = (val > 0);
            }
            
            if (val > 0) {
                row.classList.add('selected');
                const price = parseInt(row.getAttribute('data-price')) || 0;
                const subtotal = row.querySelector('.item-subtotal');
                subtotal.textContent = `+$${(price * val).toLocaleString('pt-BR')}`;
                subtotal.classList.remove('hidden');
            } else {
                row.classList.remove('selected');
                row.querySelector('.item-subtotal').classList.add('hidden');
            }
            
            updateSellTotal();
            updateSelectAllBtnState();
        });
    });
    
    const selectAllBtn = document.getElementById('mark-sell-select-all-btn');
    const newSelectAllBtn = selectAllBtn.cloneNode(true);
    selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);
    
    newSelectAllBtn.addEventListener('click', () => {
        const checkboxes = Array.from(document.querySelectorAll('#mark-sell-list .mark-sell-item-checkbox:not(:disabled)'));
        if (checkboxes.length === 0) return;
        
        const allChecked = checkboxes.every(cb => cb.checked);
        const newState = !allChecked;
        
        document.querySelectorAll('#mark-sell-list .mark-sell-item:not(.locked)').forEach(row => {
            const cb = row.querySelector('.mark-sell-item-checkbox');
            const inp = row.querySelector('.sell-qty-input');
            cb.checked = newState;
            inp.value = newState ? inp.getAttribute('max') : 0;
            inp.dispatchEvent(new Event('input'));
        });
    });
    updateSelectAllBtnState();
}

function updateSelectAllBtnState() {
    const selectAllBtn = document.getElementById('mark-sell-select-all-btn');
    const checkboxes = Array.from(document.querySelectorAll('#mark-sell-list .mark-sell-item-checkbox:not(:disabled)'));
    if (checkboxes.length === 0) return;
    const allChecked = checkboxes.every(cb => cb.checked);
    if (allChecked) {
        selectAllBtn.textContent = 'Desmarcar Tudo';
    } else {
        selectAllBtn.textContent = 'Selecionar Tudo';
    }
    // Debugging logic
    if (window.__piw_debug_select_all) {
        console.log('updateSelectAllBtnState:', {
            totalCheckboxes: checkboxes.length,
            checkedCheckboxes: checkboxes.filter(c => c.checked).length,
            allChecked,
            btnText: selectAllBtn.textContent
        });
    }
}

function updateSellTotal() {
    let total = 0;
    let selectedCount = 0;
    document.querySelectorAll('#mark-sell-list .mark-sell-item:not(.locked)').forEach(itemEl => {
        const price = parseInt(itemEl.getAttribute('data-price')) || 0;
        const inp = itemEl.querySelector('.sell-qty-input');
        const qty = parseInt(inp.value) || 0;
        total += (price * qty);
        if (qty > 0) selectedCount++;
    });
    
    markSellTotal.textContent = total.toLocaleString('pt-BR');
    markSellBtn.disabled = (selectedCount === 0 || total <= 0);
}

markSellBtn.addEventListener('click', async () => {
    const accountId = markAccountSelect.value;
    const wv = document.getElementById(`webview-${accountId}`);
    if (!wv) return;
    
    const itemsToSell = [];
    document.querySelectorAll('.mark-sell-item:not(.locked)').forEach(itemEl => {
        const itemId = parseInt(itemEl.getAttribute('data-id'));
        const qty = parseInt(itemEl.querySelector('.sell-qty-input').value) || 0;
        if (qty > 0) itemsToSell.push({ itemId, qty });
    });
    
    if (itemsToSell.length === 0) return;
    
    markSellBtn.disabled = true;
    markSellBtn.textContent = 'Vendendo...';
    
    try {
        const payloadStr = JSON.stringify(itemsToSell).replace(/'/g, "\\\\'");
        const result = await wv.executeJavaScript(`window.markApi.sellItems(${payloadStr})`);
        
        if (result.success) {
            if (result.gold !== undefined) {
                markGoldAmount.textContent = Number(result.gold).toLocaleString('pt-BR');
            }
            await loadMarkData(accountId);
        } else {
            alert("Falha ao vender: " + result.error);
        }
    } catch (err) {
        console.error(err);
        alert("Erro de comunicação ao vender.");
    } finally {
        markSellBtn.textContent = 'Vender Selecionados';
    }
});



const markSellStonesList = document.getElementById('mark-sell-stones-list');
const markSellStonesTotal = document.getElementById('mark-sell-stones-total');
const markSellStonesBtn = document.getElementById('mark-sell-stones-btn');

function renderSellStonesCatalog(accountId) {
    if (!itemsDictionary || !markDataCache) return;
    
    let lockedItems = [];
    try {
        const lockStr = window.__piw_locks_cache && window.__piw_locks_cache[`webview-${accountId}`];
        if (lockStr) lockedItems = JSON.parse(lockStr);
    } catch(e) {}

    const sellableStones = [];
    for (const [itemId, qty] of Object.entries(markDataCache.itemCounts || {})) {
        if (qty <= 0) continue;
        const dictItem = itemsDictionary.get(String(itemId));
        if (!dictItem) continue;
        
        const category = String(dictItem.category || '').toLowerCase();
        const itemNameLower = dictItem.name.toLowerCase();
        const npcPrice = Number(dictItem.npcPrice) || 0;
        
        // Verifica se É stone
        if (npcPrice > 0 && (category === 'stone' || itemNameLower.includes('stone'))) {
            const isLocked = lockedItems.includes(dictItem.name);
            sellableStones.push({
                itemId,
                name: dictItem.name,
                qty: qty,
                price: npcPrice,
                isLocked,
                iconUrl: dictItem.image || dictItem.icon || dictItem.iconUrl || `images/items/${dictItem.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`
            });
        }
    }
    
    sellableStones.sort((a, b) => b.price - a.price);

    if (sellableStones.length === 0) {
        markSellStonesList.innerHTML = '<div style="color:#94a3b8; padding:10px;">Nenhuma stone para vender.</div>';
        markSellStonesTotal.textContent = "0";
        markSellStonesBtn.disabled = true;
        return;
    }
    
    markSellStonesList.innerHTML = sellableStones.map(item => {
        let imgUrl = item.iconUrl.startsWith('http') ? item.iconUrl : `https://poke.idleworld.online/${item.iconUrl.startsWith('/') ? item.iconUrl.slice(1) : item.iconUrl}`;
        const lockIconSVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
        const lockIcon = `<div class="toggle-lock-btn" data-name="${item.name}" style="cursor:pointer; display:flex; align-items:center; justify-content:center; padding-left:10px; margin-left:10px; border-left:1px solid #1a2d3a; color:${item.isLocked ? '#ef4444' : '#475569'};" title="${item.isLocked ? 'Clique para destravar' : 'Clique para travar'}">${lockIconSVG}</div>`;
        
        return `
        <div class="mark-sell-item ${item.isLocked ? 'locked' : ''}" data-id="${item.itemId}" data-price="${item.price}">
            <input type="checkbox" class="mark-sell-item-checkbox" ${item.isLocked ? 'disabled title="Bloqueado"' : ''}>
            <img src="${imgUrl}" class="item-icon" alt="${item.name}" onerror="this.src='https://poke.idleworld.online/images/items/pokeball.png'">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-stock">Possui: ${item.qty.toLocaleString('pt-BR')}</div>
            </div>
            <div class="item-price-box">
                <div class="item-price">$${item.price.toLocaleString('pt-BR')}</div>
                <div class="item-subtotal hidden"></div>
            </div>
            <input type="number" class="item-input sell-qty-input" max="${item.qty}" min="0" value="0" ${item.isLocked ? 'disabled title="Bloqueado no jogo"' : ''}>
            ${lockIcon}
        </div>
        `;
    }).join('');
    
    updateSellStonesTotal();
    
    const listEl = document.getElementById('mark-sell-stones-list');
    
    listEl.querySelectorAll('.toggle-lock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemName = btn.getAttribute('data-name');
            const accountId = markAccountSelect.value;
            const wvId = `webview-${accountId}`;
            
            let lockedItems = window.__piw_locks_cache ? JSON.parse(window.__piw_locks_cache[wvId] || '[]') : [];
            const isCurrentlyLocked = lockedItems.includes(itemName);
            
            if (isCurrentlyLocked) {
                lockedItems = lockedItems.filter(i => i !== itemName);
                btn.style.color = '#475569';
                btn.title = 'Clique para travar';
            } else {
                lockedItems.push(itemName);
                btn.style.color = '#ef4444';
                btn.title = 'Clique para destravar';
            }
            
            if (!window.__piw_locks_cache) window.__piw_locks_cache = {};
            window.__piw_locks_cache[wvId] = JSON.stringify(lockedItems);
            
            if (window.api && window.api.loadCreds) {
                window.api.loadCreds().then(creds => {
                    creds.__piw_locks = window.__piw_locks_cache;
                    window.api.saveCreds(creds);
                });
            }
            
            const row = btn.closest('.mark-sell-item');
            const cb = row.querySelector('.mark-sell-item-checkbox');
            const inp = row.querySelector('.sell-qty-input');
            
            if (!isCurrentlyLocked) {
                row.classList.add('locked');
                cb.disabled = true;
                cb.title = 'Bloqueado';
                cb.checked = false;
                inp.disabled = true;
                inp.title = 'Bloqueado no jogo';
                inp.value = 0;
            } else {
                row.classList.remove('locked');
                cb.disabled = false;
                cb.title = '';
                inp.disabled = false;
                inp.title = '';
            }
            inp.dispatchEvent(new Event('input'));
        });
    });

    listEl.querySelectorAll('.mark-sell-item').forEach(row => {
        row.addEventListener('click', (e) => {
            if (row.classList.contains('locked')) return;
            if (e.target.tagName.toLowerCase() === 'input' || e.target.closest('.toggle-lock-btn')) return;
            const cb = row.querySelector('.mark-sell-item-checkbox');
            const inp = row.querySelector('.sell-qty-input');
            cb.checked = !cb.checked;
            inp.value = cb.checked ? inp.getAttribute('max') : 0;
            inp.dispatchEvent(new Event('input'));
        });
    });
    
    listEl.querySelectorAll('.mark-sell-item-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const row = e.target.closest('.mark-sell-item');
            const inp = row.querySelector('.sell-qty-input');
            inp.value = e.target.checked ? inp.getAttribute('max') : 0;
            inp.dispatchEvent(new Event('input'));
        });
    });
    
    listEl.querySelectorAll('.sell-qty-input').forEach(inp => {
        inp.addEventListener('input', () => {
            let val = parseInt(inp.value);
            const max = parseInt(inp.getAttribute('max'));
            if (isNaN(val) || val < 0) val = 0;
            if (val > max) val = max;
            inp.value = val;
            
            const row = inp.closest('.mark-sell-item');
            const cb = row.querySelector('.mark-sell-item-checkbox');
            if (cb && !cb.disabled) {
                cb.checked = (val > 0);
            }
            
            if (val > 0) {
                row.classList.add('selected');
                const price = parseInt(row.getAttribute('data-price')) || 0;
                const subtotal = row.querySelector('.item-subtotal');
                subtotal.textContent = `+$${(price * val).toLocaleString('pt-BR')}`;
                subtotal.classList.remove('hidden');
            } else {
                row.classList.remove('selected');
                row.querySelector('.item-subtotal').classList.add('hidden');
            }
            
            updateSellStonesTotal();
            updateSellStonesSelectAllBtnState();
        });
    });
    
    const selectAllBtn = document.getElementById('mark-sell-stones-select-all-btn');
    const newSelectAllBtn = selectAllBtn.cloneNode(true);
    selectAllBtn.parentNode.replaceChild(newSelectAllBtn, selectAllBtn);
    
    newSelectAllBtn.addEventListener('click', () => {
        const checkboxes = Array.from(listEl.querySelectorAll('.mark-sell-item-checkbox:not(:disabled)'));
        if (checkboxes.length === 0) return;
        
        const allChecked = checkboxes.every(cb => cb.checked);
        const newState = !allChecked;
        
        listEl.querySelectorAll('.mark-sell-item:not(.locked)').forEach(row => {
            const cb = row.querySelector('.mark-sell-item-checkbox');
            const inp = row.querySelector('.sell-qty-input');
            cb.checked = newState;
            inp.value = newState ? inp.getAttribute('max') : 0;
            inp.dispatchEvent(new Event('input'));
        });
    });
    updateSellStonesSelectAllBtnState();
}

function updateSellStonesSelectAllBtnState() {
    const listEl = document.getElementById('mark-sell-stones-list');
    const selectAllBtn = document.getElementById('mark-sell-stones-select-all-btn');
    const checkboxes = Array.from(listEl.querySelectorAll('.mark-sell-item-checkbox:not(:disabled)'));
    if (checkboxes.length === 0) return;
    const allChecked = checkboxes.every(cb => cb.checked);
    if (allChecked) {
        selectAllBtn.textContent = 'Desmarcar Tudo';
    } else {
        selectAllBtn.textContent = 'Selecionar Tudo';
    }
}

function updateSellStonesTotal() {
    const listEl = document.getElementById('mark-sell-stones-list');
    let total = 0;
    let selectedCount = 0;
    listEl.querySelectorAll('.mark-sell-item:not(.locked)').forEach(itemEl => {
        const price = parseInt(itemEl.getAttribute('data-price')) || 0;
        const inp = itemEl.querySelector('.sell-qty-input');
        const qty = parseInt(inp.value) || 0;
        total += (price * qty);
        if (qty > 0) selectedCount++;
    });
    
    markSellStonesTotal.textContent = total.toLocaleString('pt-BR');
    markSellStonesBtn.disabled = (selectedCount === 0 || total <= 0);
}

markSellStonesBtn.addEventListener('click', async () => {
    const accountId = markAccountSelect.value;
    const wv = document.getElementById(`webview-${accountId}`);
    if (!wv) return;
    
    const itemsToSell = [];
    const listEl = document.getElementById('mark-sell-stones-list');
    listEl.querySelectorAll('.mark-sell-item:not(.locked)').forEach(itemEl => {
        const itemId = parseInt(itemEl.getAttribute('data-id'));
        const qty = parseInt(itemEl.querySelector('.sell-qty-input').value) || 0;
        if (qty > 0) itemsToSell.push({ itemId, qty });
    });
    
    if (itemsToSell.length === 0) return;
    
    markSellStonesBtn.disabled = true;
    markSellStonesBtn.textContent = 'Vendendo...';
    
    try {
        const payloadStr = JSON.stringify(itemsToSell).replace(/'/g, "\\'");
        const result = await wv.executeJavaScript(`window.markApi.sellStones(${payloadStr})`);
        
        if (result.success) {
            if (result.gold !== undefined) {
                markGoldAmount.textContent = Number(result.gold).toLocaleString('pt-BR');
            }
            await loadMarkData(accountId);
        } else {
            alert("Falha ao vender: " + result.error);
        }
    } catch (err) {
        console.error(err);
        alert("Erro de comunicação ao vender.");
    } finally {
        markSellStonesBtn.textContent = 'Vender Selecionados';
    }
});



// =========================================================
// POKEMONS SELL LOGIC
// =========================================================

function getQualityName(q) {
    if (q >= 4.0) return 'Divina';
    if (q >= 3.0) return 'Anciã';
    if (q >= 2.0) return 'Mítica';
    if (q >= 1.7) return 'Lendária';
    if (q >= 1.5) return 'Épica';
    if (q >= 1.3) return 'Rara';
    if (q >= 1.1) return 'Incomum';
    if (q >= 1.0) return 'Comum';
    return 'Fraca';
}

function getQualityColor(q) {
    if (q >= 4.0) return '#f8fafc'; // Divina
    if (q >= 3.0) return '#ca8a04'; // Anciã
    if (q >= 2.0) return '#a855f7'; // Mítica
    if (q >= 1.7) return '#fb923c'; // Lendária
    if (q >= 1.5) return '#facc15'; // Épica
    if (q >= 1.3) return '#c084fc'; // Rara
    if (q >= 1.1) return '#38bdf8'; // Incomum
    if (q >= 1.0) return '#4ade80'; // Comum
    return '#9ca3af'; // Fraca
}

function renderSellPokemons(pokemons, accountId) {
    const listEl = document.getElementById('mark-sell-pokemons-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    const sellable = pokemons.filter(poke => !poke.team && !poke.starter && Number(poke.sellValue) > 0);
    
    if (sellable.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #a0aec0;">Nenhum Pokémon vendável no inventário.</div>';
        updateMarkSellPokemonsTotal();
        return;
    }
    
    sellable.forEach(poke => {
        const isProtected = Boolean(poke.locked || poke.shiny || poke.market || poke.listed);
        const pokeId = String(poke.id);
        const sellValue = Number(poke.sellValue) || 0;
        const iv = poke.ivTotal ?? '?';
        const quality = Number.isFinite(Number(poke.quality)) ? Number(poke.quality).toFixed(2) : '?';
        


        const row = document.createElement('div');
        row.className = 'mark-sell-item' + (isProtected ? ' locked' : '');
        row.dataset.pokeId = pokeId;
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'mark-sell-item-checkbox mark-sell-pokemon-checkbox';
        checkbox.dataset.pokeId = pokeId;
        checkbox.dataset.value = sellValue;
        checkbox.disabled = isProtected;
        checkbox.addEventListener('change', (e) => {
            if (checkbox.checked) row.classList.add('selected');
            else row.classList.remove('selected');
            updateMarkSellPokemonsTotal();
        });

        row.addEventListener('click', (e) => {
            if (isProtected) return;
            if (e.target.tagName === 'INPUT' || e.target.closest('i')) return;
            checkbox.checked = !checkbox.checked;
            if (checkbox.checked) row.classList.add('selected');
            else row.classList.remove('selected');
            updateMarkSellPokemonsTotal();
        });
        
        // Info container
        const info = document.createElement('div');
        info.className = 'item-info';
        
        // Name and flags
        const nameRow = document.createElement('div');
        nameRow.className = 'item-name';
        
        const nameText = document.createElement('span');
        nameText.textContent = poke.name || `Pokémon ${poke.speciesId}`;
        nameRow.appendChild(nameText);
        
        if (poke.shiny) {
            const shinyIcon = document.createElement('span');
            shinyIcon.textContent = '✨';
            shinyIcon.title = 'Shiny';
            nameRow.appendChild(shinyIcon);
        }
        
        // Details
        const detailsRow = document.createElement('div');
        detailsRow.className = 'item-stock';
        const qNum = Number.isFinite(Number(poke.quality)) ? Number(poke.quality) : 1.0;
          const qName = getQualityName(qNum);
          const qColor = getQualityColor(qNum);
          row.dataset.qname = qName;
        detailsRow.innerHTML = `IV: ${iv} | Qualidade: <span style="color:${qColor}">${qNum.toFixed(2)} (${qName})</span>`;
        
        info.appendChild(nameRow);
        info.appendChild(detailsRow);
        
        // Value
        const valueBox = document.createElement('div');
        valueBox.className = 'item-price-box';
        
        const valueDiv = document.createElement('div');
        valueDiv.className = 'item-price';
        valueDiv.textContent = '$' + sellValue.toLocaleString('pt-BR');
        
        valueBox.appendChild(valueDiv);
        
        // Lock Icon on the right
        const lockContainer = document.createElement('div');
        lockContainer.style.display = 'flex';
        lockContainer.style.alignItems = 'center';
        lockContainer.style.justifyContent = 'center';
        lockContainer.style.paddingLeft = '10px';
        lockContainer.style.marginLeft = '10px';
        lockContainer.style.borderLeft = '1px solid #1a2d3a';
        lockContainer.title = isProtected ? 'Bloqueado (Trava do jogo)' : 'Desbloqueado';
        
        const lockIconSVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
        lockContainer.style.color = isProtected ? '#ef4444' : '#475569';
        lockContainer.innerHTML = lockIconSVG;

        row.appendChild(checkbox);
        row.appendChild(info);
        row.appendChild(valueBox);
        row.appendChild(lockContainer);
        
        listEl.appendChild(row);
    });
    
    // Refresh lucide icons for the locks
    if (window.lucide) {
        window.lucide.createIcons();
    }
    applyPokemonFilters();
}

function updateMarkSellPokemonsTotal() {
    const checkboxes = document.querySelectorAll('.mark-sell-pokemon-checkbox:checked');
    const sellBtn = document.getElementById('mark-sell-pokemons-btn');
    const selectAllBtn = document.getElementById('mark-sell-pokemons-select-all-btn');
    
    let totalItems = checkboxes.length;
    
    if (sellBtn) {
        sellBtn.disabled = totalItems === 0;
    }
    
    document.getElementById('mark-sell-pokemons-total').textContent = totalItems.toLocaleString('pt-BR');
    
    if (selectAllBtn) {
        const visibleRows = Array.from(document.querySelectorAll('#mark-sell-pokemons-list .mark-sell-item')).filter(r => r.style.display !== 'none');
        const visibleCheckboxes = visibleRows.map(r => r.querySelector('.mark-sell-pokemon-checkbox:not(:disabled)')).filter(Boolean);
        if (visibleCheckboxes.length > 0) {
            const allChecked = visibleCheckboxes.every(cb => cb.checked);
            selectAllBtn.textContent = allChecked ? 'Desmarcar Tudo' : 'Selecionar Tudo';
        } else {
            selectAllBtn.textContent = 'Selecionar Tudo';
        }
    }
}

// Select All Botão
const sellPokemonsSelectAllBtn = document.getElementById('mark-sell-pokemons-select-all-btn');
if (sellPokemonsSelectAllBtn) {
    sellPokemonsSelectAllBtn.addEventListener('click', () => {
        const visibleRows = Array.from(document.querySelectorAll('#mark-sell-pokemons-list .mark-sell-item')).filter(r => r.style.display !== 'none');
        const checkboxes = visibleRows.map(r => r.querySelector('.mark-sell-pokemon-checkbox:not(:disabled)')).filter(Boolean);
        if (checkboxes.length === 0) return;
        const allChecked = checkboxes.every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            const row = cb.closest('.mark-sell-item');
            if (cb.checked) row.classList.add('selected');
            else row.classList.remove('selected');
        });
        
        updateMarkSellPokemonsTotal();
    });
}

// Vender Botão
const sellPokemonsBtn = document.getElementById('mark-sell-pokemons-btn');
if (sellPokemonsBtn) {
    sellPokemonsBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('.mark-sell-pokemon-checkbox:checked');
        const pokeIds = Array.from(checkboxes).map(cb => String(cb.dataset.pokeId));
        
        if (pokeIds.length === 0) return;
        
        const accountId = markAccountSelect.value;
        const wv = document.getElementById(`webview-${accountId}`);
        if (!wv) return;
        
        sellPokemonsBtn.disabled = true;
        const originalText = sellPokemonsBtn.textContent;
        sellPokemonsBtn.textContent = 'Vendendo...';
        
        try {
            const payloadStr = JSON.stringify(pokeIds);
            const script = `window.markApi.sellPokemons(${payloadStr})`;
            const result = await wv.executeJavaScript(script);
            
            if (result && result.success) {
                // Sucesso
            } else {
                console.error("Falha ao vender pokemons", result);
                alert("Erro ao vender: " + (result?.error || "Desconhecido"));
            }
        } catch (e) {
            console.error(e);
        }
        
        // Recarregar os dados do Mark independente do resultado
        await loadMarkData(accountId);
        
        sellPokemonsBtn.textContent = originalText;
    });
}

function applyPokemonFilters() {
    const listEl = document.getElementById('mark-sell-pokemons-list');
    if (!listEl) return;
    
    const activeQualities = Array.from(document.querySelectorAll('.mark-q-filter.active')).map(btn => btn.dataset.quality);
    
    listEl.querySelectorAll('.mark-sell-item').forEach(row => {
        const qname = row.dataset.qname;
        if (activeQualities.includes(qname)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
            const cb = row.querySelector('.mark-sell-item-checkbox');
            if (cb && cb.checked) {
                cb.checked = false;
                row.classList.remove('selected');
            }
        }
    });
    
    updateMarkSellPokemonsTotal();
}

document.querySelectorAll('.mark-q-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        applyPokemonFilters();
    });
});
