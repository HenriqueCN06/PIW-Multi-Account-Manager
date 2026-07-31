const markToggleBtn = document.getElementById('remote-mark-btn');
const markPanel = document.getElementById('mark-panel');
const markCloseBtn = document.getElementById('mark-close-btn');
const markAccountSelect = document.getElementById('mark-account-select');
const markGoldAmount = document.getElementById('mark-gold-amount');
const markCatalog = document.getElementById('mark-catalog');
const markLoading = document.getElementById('mark-loading');

let markDataCache = null;

// Alternar a visibilidade do painel
markToggleBtn.addEventListener('click', () => {
    const isHidden = markPanel.classList.contains('hidden');
    if (isHidden) {
        markPanel.classList.remove('hidden');
        loadMarkData(markAccountSelect.value);
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

// Busca os dados do catálogo injetando script na webview
async function loadMarkData(accountId) {
    const wv = document.getElementById(`webview-${accountId}`);
    if (!wv) return;

    markCatalog.innerHTML = '';
    markLoading.classList.remove('hidden');
    markGoldAmount.textContent = '...';
    
    try {
        const result = await wv.executeJavaScript('window.markApi.fetchMarkData()');
        markLoading.classList.add('hidden');
        
        if (result.success) {
            if (result.debugHtml) {
                alert("DEBUG SLOT HTML:\n\n" + result.debugHtml);
            }
            markDataCache = result;
            renderMarkCatalog(result, accountId);
        } else {
            markCatalog.innerHTML = `<div style="grid-column: 1 / -1; color:#ef4444; padding: 60px 20px; text-align: center; font-size: 16px; font-weight: 500;">Erro: ${result.error}</div>`;
        }
    } catch (err) {
        markLoading.classList.add('hidden');
        markCatalog.innerHTML = `<div style="grid-column: 1 / -1; color:#ef4444; padding: 60px 20px; text-align: center; font-size: 16px; font-weight: 500;">Erro ao comunicar com o jogo. A conta está logada?</div>`;
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
        let stock = data.counts[product.id] || 0;
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
                if (markDataCache) markDataCache.counts[productId] = result.counts[productId];
            } else {
                // Se a API não retornou a quantidade oficial (ex: poções), nós simulamos a soma para o usuário não ficar no escuro
                const stockEl = document.getElementById(`stock-${productId}`);
                if (stockEl) {
                    const currentText = stockEl.textContent;
                    const currentStock = parseInt(currentText.replace(/[^0-9]/g, '')) || 0;
                    let newStock = currentStock + qty;
                    let stockStr = newStock.toLocaleString('pt-BR');
                    stockEl.textContent = stockStr;
                    
                    if (markDataCache && markDataCache.counts) {
                        markDataCache.counts[productId] = newStock;
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
