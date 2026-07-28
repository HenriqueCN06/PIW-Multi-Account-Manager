// Gerenciador do Calculador de IV
const ivToggleBtn = document.getElementById('iv-toggle-btn');
const ivPanel = document.getElementById('iv-panel');
const ivCloseBtn = document.getElementById('iv-close-btn');

let ivWatcherActive = false;

function setWatcherState(state) {
    ivWatcherActive = state;
    document.querySelectorAll('webview').forEach(wv => {
        try { wv.executeJavaScript(`if(window.toggleIVWatcher) window.toggleIVWatcher(${state});`); } catch(e){}
    });
}

ivToggleBtn.addEventListener('click', () => {
    const isHidden = ivPanel.classList.toggle('hidden');
    setWatcherState(!isHidden);
});

ivCloseBtn.addEventListener('click', () => {
    ivPanel.classList.add('hidden');
    setWatcherState(false);
});

// Lógica para arrastar o painel
const ivHeader = document.querySelector('.iv-header');
let isDragging = false;
let startX, startY;

ivHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('.iv-close-btn') || e.target.closest('button')) return;
    isDragging = true;
    
    ivPanel.style.transition = 'none';
    const rect = ivPanel.getBoundingClientRect();
    ivPanel.style.transform = 'none';
    ivPanel.style.left = rect.left + 'px';
    ivPanel.style.top = rect.top + 'px';
    
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    ivHeader.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    ivPanel.style.left = (e.clientX - startX) + 'px';
    ivPanel.style.top = (e.clientY - startY) + 'px';
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        ivHeader.style.cursor = 'grab';
        ivPanel.style.transition = '';
    }
});
ivHeader.style.cursor = 'grab';

// Configuração matemática
const EXPOENTES = { hp: 0.95, atk: 0.80, def: 0.80, spa: 0.80, spd: 0.80, vel: 0.95 };
const MAX_IV_INDIVIDUAL = 32;
const MAX_IV_TOTAL = 192;

let creaturesData = [];
let creaturesMap = new Map();

const injectScriptCode = `
(function () {
    "use strict";
    if (window.__ivInjected) return;
    window.__ivInjected = true;
    
    console.log("__PGIV__" + JSON.stringify({ type: "debug_inj" }));

    let lastText = "";
    function extractSprite(tooltip) {
        if (!tooltip) return null;
        const img = tooltip.querySelector("img");
        if (img && img.src) return img.src;
        return null;
    }
    
    let creaturesList = [];
    async function getCreatureList() {
        if (creaturesList.length > 0) return creaturesList;
        try {
            const res = await fetch("/game/creatures.json");
            const data = await res.json();
            if (data && data.creatures) creaturesList = data.creatures;
        } catch(e) {}
        return creaturesList;
    }

    function normalizeName(nome) {
        if (!nome) return "";
        let n = String(nome).normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
        n = n.replace(/[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F600}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}]/gu, "");
        n = n.replace(/\\bshiny\\b/g, "").replace(/shiny/g, "");
        n = n.replace(/♀/g, "-f").replace(/♂/g, "-m");
        n = n.replace(/[^a-z0-9\\s-]/g, "").trim();
        n = n.replace(/\\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        return n;
    }

    async function checkTooltip() {
        const tooltips = document.querySelectorAll(".inv-tip");
        let activeTooltip = null;
        for (const t of tooltips) {
            if (t.style.display !== "none" && t.innerText.trim().length > 0) {
                activeTooltip = t;
                break;
            }
        }
        
        if (activeTooltip) {
            const text = activeTooltip.innerText;
            if (text && text !== lastText && (text.includes("Nível") || text.includes("Level") || text.includes("Nv") || text.includes("Lv"))) {
                lastText = text;
                const sprite = extractSprite(activeTooltip);
                const nameEl = activeTooltip.querySelector("b, strong, .name");
                const lines = text.split(/[\\n\\r]+/).map(l => l.trim()).filter(Boolean);
                
                const list = await getCreatureList();
                let foundCreature = null;
                
                // Procura nas primeiras 3 linhas pra evitar pegar ataques com nome de pokemon
                for (let i = 0; i < Math.min(3, lines.length); i++) {
                    const lNorm = normalizeName(lines[i]);
                    // Match exato
                    let c = list.find(cr => normalizeName(cr.name) === lNorm);
                    if (!c) {
                        // Match de prefixo (Ex: exeggutor-planta)
                        c = list.find(cr => {
                            const cn = normalizeName(cr.name);
                            return cn.length >= 3 && lNorm.startsWith(cn);
                        });
                    }
                    if (c) {
                        foundCreature = c;
                        break;
                    }
                }
                
                const normName = foundCreature ? normalizeName(foundCreature.name) : "nao_achou";
                console.log("__PGIV__" + JSON.stringify({ 
                    type: "debug_info", 
                    normName: normName,
                    listSize: list.length, 
                    found: !!foundCreature 
                }));

                console.log("__PGIV__" + JSON.stringify({ type: "hover", text: text, htmlName: null, sprite: sprite, creature: foundCreature || null }));
            }
        } else {
            lastText = "";
        }
    }

    window.__ivInterval = null;
    window.toggleIVWatcher = (state) => {
        if (state) {
            if (!window.__ivInterval) window.__ivInterval = setInterval(checkTooltip, 200);
        } else {
            if (window.__ivInterval) {
                clearInterval(window.__ivInterval);
                window.__ivInterval = null;
            }
            lastText = "";
        }
    };

})();
`;

    // Força injeção contínua para garantir que rode caso os eventos falhem
    setInterval(() => {
        document.querySelectorAll('webview').forEach(wv => {
            if (!wv.isLoading()) {
                wv.executeJavaScript(injectScriptCode).then(() => {
                    wv.executeJavaScript(`if(window.toggleIVWatcher) window.toggleIVWatcher(${ivWatcherActive});`);
                }).catch(() => {});
            }
        });
    }, 2000);

// Escuta mensagens do webview
document.querySelectorAll('webview').forEach((wv, index) => {
    wv.addEventListener('console-message', (e) => {
        if (e.message && e.message.startsWith('__PGIV__')) {
            try {
                const data = JSON.parse(e.message.replace('__PGIV__', ''));
                if (data.type === 'debug_inj') {
                    return;
                }
                if (data.type === 'debug_map_full') {
                    window.api.log("MAP FULL DUMP:");
                    window.api.log(data.html);
                    return;
                }
                if (data.type === 'debug_info') {
                    return;
                }
                if (data.type === 'hover') {
                    const accName = document.querySelector(`#panel-${index + 1} .panel-header span`).innerText;
                    processHover(data.text, data.htmlName, data.sprite, accName, data.creature);
                }
            } catch (err) {
                console.error("Erro processando IV msg", err);
            }
        }
    });
});

// Extrai dados usando regex igual ao PokeGrid
function extractDataFromText(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    
    const nome = lines[0] || "Desconhecido";
    
    const num = (rgx) => {
        const m = text.match(rgx);
        if (!m) return 0;
        const v = Number(m[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".").trim());
        return Number.isFinite(v) ? v : 0;
    };
    
    const dec = (rgx) => {
        const m = text.match(rgx);
        if (!m) return 1.0;
        const v = Number(m[1].replace(",", ".").replace(/[^\d.-]/g, ""));
        return Number.isFinite(v) ? v : 1.0;
    };

    const qualidadeTexto = text.match(/(?:Qualidade|Quality)\s+([^\n]+)/i)?.[1]?.trim();
    let multiplicador = 1.0;
    const multMatch = text.match(/(?:Qualidade|Quality)[^\n]+?([\d]+[.,][\d]+)/i);
    if (multMatch) {
        multiplicador = parseFloat(multMatch[1].replace(',', '.'));
    }

    return {
        nome,
        nivel: num(/(?:Nv|Lv)\s*(\d+)/i) || 1,
        qualidade: multiplicador,
        hp: num(/HP\s+([\d.,]+)/i),
        atk: num(/Atk\s+([\d.,]+)/i),
        def: num(/Def\s+([\d.,]+)/i),
        spa: num(/SpA\s+([\d.,]+)/i),
        spd: num(/SpD\s+([\d.,]+)/i),
        vel: num(/(?:Vel|Spe)\s+([\d.,]+)/i),
        ivTotal: num(/IV\s+(\d+)\s*\/\s*192/i),
        poder: num(/(?:Poder|Power)\s+([\d.,]+)/i),
    };
}

let currentBaseStats = null;
let currentExtractedData = null;

function processHover(text, htmlName, sprite, accName, creature) {
    const extracted = extractDataFromText(text);
    if (!extracted) return;
    
    const nameToUse = creature ? creature.name : (htmlName || extracted.nome);

    // Se achamos a criatura, preenchemos o UI
    if (creature) {
        currentBaseStats = creature;
        currentExtractedData = extracted;
        
        // Atualiza UI com nome e tipos
        document.getElementById('iv-name').innerText = nameToUse;
        document.getElementById('iv-account-name').innerText = accName;
        if (sprite) {
            const sprEl = document.getElementById('iv-sprite');
            sprEl.src = sprite;
            sprEl.style.display = 'block';
        }
        
        // Tipos
        const typesContainer = document.getElementById('iv-types');
        typesContainer.innerHTML = '';
        const types = [];
        if (creature.type1) types.push(creature.type1);
        if (creature.type2) types.push(creature.type2);
        
        types.forEach(t => {
            const badge = document.createElement('span');
            badge.className = 'iv-type-badge';
            // Simple type colors (Planta -> green, etc)
            const typeColors = {
                grass: '#78c850', fire: '#f08030', water: '#6890f0', bug: '#a8b820',
                normal: '#a8a878', poison: '#a040a0', electric: '#f8d030', ground: '#e0c068',
                fairy: '#ee99ac', fighting: '#c03028', psychic: '#f85888', rock: '#b8a038',
                ghost: '#705898', ice: '#98d8d8', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', flying: '#a890f0'
            };
            const c = typeColors[t.toLowerCase()] || '#888';
            badge.style.backgroundColor = c;
            badge.innerText = t;
            typesContainer.appendChild(badge);
        });

        // Set inputs
        document.getElementById('iv-inp-nivel').value = extracted.nivel;
        document.getElementById('iv-inp-qualidade').value = extracted.qualidade;
        
        Object.keys(EXPOENTES).forEach(k => {
            const map = {hp:'baseHp', atk:'baseAtk', def:'baseDef', spa:'baseSpAtk', spd:'baseSpDef', vel:'baseSpeed'};
            document.getElementById(`iv-inp-${k}-atual`).value = extracted[k];
            document.getElementById(`iv-inp-${k}-base`).value = creature[map[k]] || 0;
        });

        // Render Moves
        const movesList = document.getElementById('iv-moves-list');
        movesList.innerHTML = '';
        let moves = creature.moves || creature.attacks || creature.skills || [];
        moves.forEach(m => {
            const mName = m.name || m.moveName || m.move || m;
            const mPower = m.power || m.basePower || m.damage || m.dmg || '-';
            const mType = m.type || m.element || 'normal';
            const mCategory = m.category || '-';
            const mLevel = m.learnLevel !== undefined ? m.learnLevel : '-';
            
            const typeColors = {
                grass: '#78c850', fire: '#f08030', water: '#6890f0', bug: '#a8b820',
                normal: '#a8a878', poison: '#a040a0', electric: '#f8d030', ground: '#e0c068',
                fairy: '#ee99ac', fighting: '#c03028', psychic: '#f85888', rock: '#b8a038',
                ghost: '#705898', ice: '#98d8d8', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', flying: '#a890f0'
            };
            const c = typeColors[mType.toLowerCase()] || '#888';
            
            let catTag = '';
            let powerColor = '';
            if (mCategory !== '-') {
                const shortCat = mCategory === 'SPECIAL' ? 'SP' : (mCategory === 'PHYSICAL' ? 'PH' : mCategory);
                catTag = `<span class="iv-move-category">${shortCat}</span>`;
                if (mCategory === 'SPECIAL') powerColor = 'color: #58a6ff;';
                else if (mCategory === 'PHYSICAL') powerColor = 'color: #f0883e;';
                else powerColor = 'color: #8b949e;'; // Status moves
            }

            movesList.innerHTML += `
                <div class="iv-move-row">
                    <span class="iv-move-level">Lv ${mLevel}</span>
                    <span class="iv-type-badge" style="background-color: ${c}">${mType}</span>
                    <span class="iv-move-name">${mName}${catTag}</span>
                    <span class="iv-move-power" style="${powerColor}">${mPower}</span>
                </div>
            `;
        });

        recalcIVs();
    }
}

// Matemática de recalculo
function recalcIVs() {
    const nivel = Number(document.getElementById('iv-inp-nivel').value) || 1;
    const qualidade = Number(document.getElementById('iv-inp-qualidade').value) || 1.0;
    
    let somaIvs = 0;
    let somaPoder = 0;

    Object.keys(EXPOENTES).forEach(k => {
        const atual = Number(document.getElementById(`iv-inp-${k}-atual`).value) || 0;
        const base = Number(document.getElementById(`iv-inp-${k}-base`).value) || 0;
        
        // Estimar IV
        const fator = (nivel / 100) * Math.pow(qualidade, EXPOENTES[k]);
        let ivFloat = 0;
        if (fator > 0) {
            ivFloat = (((atual / fator) - base) / 2);
        }
        
        let iv = Math.min(MAX_IV_INDIVIDUAL, Math.max(0, ivFloat));
        somaIvs += Math.round(iv);
        
        // Calcular poder exato
        const calcPoder = Math.round((base + 2 * iv) * (nivel / 100) * Math.pow(qualidade, EXPOENTES[k]));
        somaPoder += calcPoder;
        
        // Atualiza UI da barra
        const valSpan = document.getElementById(`iv-${k}-val`);
        valSpan.innerText = iv.toFixed(1);
        
        const pct = Math.min(100, Math.max(0, (iv / MAX_IV_INDIVIDUAL) * 100));
        document.getElementById(`iv-${k}-bar`).style.width = pct + '%';
    });
    
    somaPoder = Math.round(somaPoder * qualidade);

    let totalReal = Math.round(somaIvs);
    let poderReal = somaPoder;
    if (currentExtractedData) {
        if (currentExtractedData.ivTotal > 0) totalReal = currentExtractedData.ivTotal;
        if (currentExtractedData.poder > 0) poderReal = currentExtractedData.poder;
    }

    // Update Totals
    document.getElementById('iv-val-total').value = totalReal;
    document.getElementById('iv-val-poder').value = poderReal.toLocaleString('pt-BR');
    
    // Update Potential Ring
    const pctGeral = Math.min(100, Math.max(0, (totalReal / MAX_IV_TOTAL) * 100));
    document.getElementById('iv-ring-txt').innerText = Math.round(pctGeral) + '%';
    
    let ringCor = "#58a6ff";
    let potTitle = "Normal";
    let potDesc = "Atributos medianos.";
    
    if (pctGeral >= 90) { ringCor = "#f85149"; potTitle = "Mítico"; potDesc = "Poder avassalador, status praticamente perfeitos."; }
    else if (pctGeral >= 80) { ringCor = "#f2c665"; potTitle = "Épico"; potDesc = "Status impressionantes, excelente para lutas decisivas."; }
    else if (pctGeral >= 70) { ringCor = "#ab7df8"; potTitle = "Raro"; potDesc = "Muito superior à maioria da sua espécie."; }
    else if (pctGeral >= 50) { ringCor = "#58a6ff"; potTitle = "Bom"; potDesc = "Bom equilíbrio de atributos para uso geral."; }
    
    document.getElementById('iv-ring').style.background = `conic-gradient(${ringCor} ${pctGeral}%, #0d1117 0)`;
    document.getElementById('iv-ring-txt').style.color = ringCor;
    
    const potEl = document.getElementById('iv-pot-title');
    potEl.innerText = potTitle;
    potEl.style.color = ringCor;
    document.getElementById('iv-pot-desc').innerText = potDesc;
}

// Ouvintes de evento para inputs
document.getElementById('iv-inp-nivel').addEventListener('input', recalcIVs);
document.getElementById('iv-inp-qualidade').addEventListener('input', (e) => {
    if (currentExtractedData) {
        currentExtractedData.ivTotal = null;
        currentExtractedData.poder = null;
    }
    recalcIVs();
});
Object.keys(EXPOENTES).forEach(k => {
    document.getElementById(`iv-inp-${k}-atual`).addEventListener('input', (e) => {
        if (currentExtractedData) {
            currentExtractedData.ivTotal = null;
            currentExtractedData.poder = null;
        }
        recalcIVs();
    });
    document.getElementById(`iv-inp-${k}-base`).addEventListener('input', (e) => {
        if (currentExtractedData) {
            currentExtractedData.ivTotal = null;
            currentExtractedData.poder = null;
        }
        recalcIVs();
    });
});

// Listener para atualizar anel quando digitar manualmente no IV Total
document.getElementById('iv-val-total').addEventListener('input', (e) => {
    let t = Number(e.target.value) || 0;
    const pctGeral = Math.min(100, Math.max(0, (t / MAX_IV_TOTAL) * 100));
    document.getElementById('iv-ring-txt').innerText = Math.round(pctGeral) + '%';
    
    let ringCor = "#58a6ff";
    let potTitle = "Normal";
    
    if (pctGeral >= 90) { ringCor = "#f85149"; potTitle = "Mítico"; }
    else if (pctGeral >= 80) { ringCor = "#f2c665"; potTitle = "Épico"; }
    else if (pctGeral >= 70) { ringCor = "#ab7df8"; potTitle = "Raro"; }
    else if (pctGeral >= 50) { ringCor = "#58a6ff"; potTitle = "Bom"; }
    
    document.getElementById('iv-ring').style.background = `conic-gradient(${ringCor} ${pctGeral}%, #0d1117 0)`;
    document.getElementById('iv-ring-txt').style.color = ringCor;
    
    const potEl = document.getElementById('iv-pot-title');
    potEl.innerText = potTitle;
    potEl.style.color = ringCor;
});
