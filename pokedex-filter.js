const injectPokedexFilter = `
(() => {
    if (window.__pokedexFilterInjected) return;
    window.__pokedexFilterInjected = true;

    // Adiciona bloco de CSS estático no head para filtrar a grid
    const style = document.createElement('style');
    style.id = 'custom-dex-style';
    document.head.appendChild(style);

    function checkPokedex() {
        const dexHead = document.querySelector('.dex-head');
        if (dexHead) {
            const dexWindow = dexHead.parentElement;
            
            // Lógica para salvar a memória de capturados sempre que a pokedex existir
            const caughtCells = dexWindow.querySelectorAll('.dex-cell.caught .dex-cell-name');
            if (caughtCells.length > 0) {
                const caughtList = Array.from(caughtCells).map(el => el.innerText.trim());
                localStorage.setItem('caught_pokemons', JSON.stringify(caughtList));
            }

            if (!dexWindow.__pokedexFilterSetup) {
                const controls = dexWindow.querySelector('.dex-controls');
                if (controls && !controls.querySelector('.custom-dex-filter')) {
                    dexWindow.__pokedexFilterSetup = true;

                    const sel = document.createElement('select');
                    sel.className = 'dex-typef custom-dex-filter'; 
                    sel.style.marginLeft = '5px'; 
                    sel.innerHTML = \`
                        <option value="all">Status: Todos</option>
                        <option value="caught">Capturados</option>
                        <option value="uncaught">Não Capturados</option>
                        <option value="unlocked">Desbloqueados</option>
                        <option value="locked">Bloqueados</option>
                    \`;
                    
                    sel.addEventListener('change', (e) => {
                        const val = e.target.value;
                        let css = '';
                        if (val === 'caught') css = '.dex-cell:not(.caught) { display: none !important; }';
                        else if (val === 'uncaught') css = '.dex-cell.caught { display: none !important; }';
                        else if (val === 'unlocked') css = '.dex-cell.locked { display: none !important; }';
                        else if (val === 'locked') css = '.dex-cell:not(.locked) { display: none !important; }';
                        
                        document.getElementById('custom-dex-style').innerHTML = css;
                    });
                    
                    controls.appendChild(sel);
                }
            }
        }
    }
    
    // Checa a cada 500ms se a Pokédex foi aberta
    setInterval(checkPokedex, 500);
})();
`;

// Injeta o script em todas as webviews a cada 2 segundos, igual ao iv-manager
setInterval(() => {
    document.querySelectorAll('webview').forEach(wv => {
        if (!wv.isLoading()) {
            wv.executeJavaScript(injectPokedexFilter).catch(() => {});
        }
    });
}, 2000);
