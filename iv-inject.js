// Script injetado na webview para capturar dados do Pokémon ao passar o mouse
(function () {
    "use strict";

    let lastText = "";
    
    // Pega a URL do sprite a partir do elemento da tooltip
    function extractSprite(tooltip) {
        if (!tooltip) return null;
        const img = tooltip.querySelector("img");
        if (img && img.src) return img.src;
        return null;
    }

    let creaturesList = [];

    // Pega o creatures.json uma vez no inicio
    fetch("/game/creatures.json")
        .then(res => res.json())
        .then(data => {
            if (data && data.creatures) {
                creaturesList = data.creatures;
            }
        }).catch(e => console.error("Erro ao carregar creatures:", e));

    function normalizeName(nome) {
        if (!nome) return "";
        let n = String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        n = n.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, "");
        n = n.replace(/\bshiny\b/g, "").replace(/shiny/g, "");
        n = n.replace(/♀/g, "-f").replace(/♂/g, "-m");
        n = n.replace(/[^a-z0-9\s-]/g, "").trim();
        n = n.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
        return n;
    }

    function checkTooltip() {
        const tooltip = document.querySelector(".inv-tip");
        if (tooltip && tooltip.style.display !== "none") {
            const text = tooltip.innerText;
            if (text && text !== lastText && (text.includes("Nível") || text.includes("Level") || text.includes("Nv") || text.includes("Lv"))) {
                lastText = text;
                const sprite = extractSprite(tooltip);
                
                const nameEl = tooltip.querySelector("b, strong, .name");
                const htmlName = nameEl ? nameEl.innerText : null;

                // Extrai nome direto do texto para fallback
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                const textName = lines[0] || "";
                
                const nameToSearch = htmlName || textName;
                const normName = normalizeName(nameToSearch);
                
                let foundCreature = creaturesList.find(c => normalizeName(c.name) === normName);
                if (!foundCreature) {
                    foundCreature = creaturesList.find(c => {
                        const cn = normalizeName(c.name);
                        return cn.includes(normName) || (normName && normName.includes(cn));
                    });
                }

                console.log("__PGIV__" + JSON.stringify({
                    type: "hover",
                    text: text,
                    htmlName: htmlName,
                    sprite: sprite,
                    creature: foundCreature || null
                }));
            }
        } else if (lastText !== "") {
            lastText = "";
        }
    }

    // Monitora as mudanças no DOM para capturar quando a tooltip aparece
    const observer = new MutationObserver((mutations) => {
        for (const mut of mutations) {
            if (mut.addedNodes.length || (mut.type === 'attributes' && mut.attributeName === 'style')) {
                checkTooltip();
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style']
    });

})();
