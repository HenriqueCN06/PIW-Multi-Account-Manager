const injectMapEnhancer = `
(() => {
    if (window.__mapEnhancerInjected) return;
    window.__mapEnhancerInjected = true;

    // Injeta CSS para a bolinha de capturado
    const style = document.createElement('style');
    style.id = 'map-caught-style';
    style.innerHTML = \`
        .caught-marker::after {
            content: '';
            position: absolute;
            top: -2px;
            left: 50%;
            margin-left: 12px;
            width: 16px;
            height: 16px;
            background: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNmZmYiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTIyIDEyQTEwIDEwIDAgMDAyIDEyeiIgZmlsbD0iI2UzMzUwZCIvPjxwYXRoIGQ9Ik0yIDEyaDIwTTEyIDlhMyAzIDAgMTAwIDYgMyAzIDAgMDAwLTZ6IiBmaWxsPSIjZmZmIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==') no-repeat center center;
            background-size: contain;
            border-radius: 50%;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            pointer-events: none;
        }
    \`;
    document.head.appendChild(style);

    function checkMapMarkers() {
        // Encontra o mapa
        const mapWindow = document.querySelector('.map-body');
        if (!mapWindow) return;

        // Pega os capturados do localstorage
        const saved = localStorage.getItem('caught_pokemons');
        let caughtList = [];
        if (saved) {
            try {
                caughtList = JSON.parse(saved);
            } catch(e) {}
        }

        if (caughtList.length === 0) return;

        const markers = mapWindow.querySelectorAll('.hunt-marker');
        markers.forEach(marker => {
            const nameEl = marker.querySelector('.hunt-name');
            if (!nameEl) return;
            
            const name = nameEl.innerText.trim();
            // Evita reprocessar se o nome não mudou
            if (marker.__lastCheckedName === name) return;
            marker.__lastCheckedName = name;

            // Checa a lógica de sufixo inteligente
            const isCaught = caughtList.some(p => name === p || name.endsWith(' ' + p));
            
            if (isCaught) {
                marker.classList.add('caught-marker');
            } else {
                marker.classList.remove('caught-marker');
            }
        });

        // Configuração do Filtro
        const filters = mapWindow.parentElement.querySelector('.map-filters');
        if (filters && !filters.querySelector('.custom-map-filter')) {
            const sel = document.createElement('select');
            sel.className = 'custom-map-filter'; 
            // Usa o mesmo estilo visual de outros inputs
            sel.style.marginLeft = '10px';
            sel.style.padding = '2px 5px';
            sel.style.background = 'rgba(0,0,0,0.5)';
            sel.style.color = '#fff';
            sel.style.border = '1px solid #333';
            sel.style.borderRadius = '3px';

            sel.innerHTML = \`
                <option value="all">Status: Todos</option>
                <option value="caught">Capturados</option>
                <option value="uncaught">Não Capturados</option>
            \`;
            sel.value = window.__currentMapFilter || 'all';
            
            sel.addEventListener('change', (e) => {
                window.__currentMapFilter = e.target.value;
                let css = '';
                if (window.__currentMapFilter === 'caught') css = '.hunt-marker:not(.caught-marker) { display: none !important; }';
                else if (window.__currentMapFilter === 'uncaught') css = '.hunt-marker.caught-marker { display: none !important; }';
                
                let styleEl = document.getElementById('custom-map-filter-style');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'custom-map-filter-style';
                    document.head.appendChild(styleEl);
                }
                styleEl.innerHTML = css;
            });
            
            filters.appendChild(sel);
            
            // Aplica o estado atual imediatamente
            sel.dispatchEvent(new Event('change'));
        }
    }
    
    // Checa a cada 500ms
    setInterval(checkMapMarkers, 500);
})();
`;

// Injeta o script em todas as webviews a cada 2 segundos
setInterval(() => {
    document.querySelectorAll('webview').forEach(wv => {
        if (!wv.isLoading()) {
            wv.executeJavaScript(injectMapEnhancer).catch(() => {});
        }
    });
}, 2000);
