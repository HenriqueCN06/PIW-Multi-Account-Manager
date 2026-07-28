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
