const { contextBridge, webFrame } = require('electron');

// 1. Injetar o interceptador no Main World
webFrame.executeJavaScript(`
    const NativeWebSocket = window.WebSocket;
    let gameSocket = null;

    function handleGameSocketMessage(event) {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }
        
        if (message?.type === 'inventory') {
            window.dispatchEvent(new CustomEvent('poke-inventory-update', { detail: message.items || [] }));
        }
    }

    function TrackedWebSocket(url, protocols) {
        const socket = protocols === undefined
            ? new NativeWebSocket(url)
            : new NativeWebSocket(url, protocols);
            
        if (String(url).includes('/ws')) {
            gameSocket = socket;
            socket.addEventListener('message', handleGameSocketMessage);
            socket.addEventListener('close', () => {
                if (gameSocket === socket) gameSocket = null;
            });
        }
        return socket;
    }
    
    TrackedWebSocket.prototype = NativeWebSocket.prototype;
    Object.setPrototypeOf(TrackedWebSocket, NativeWebSocket);
    window.WebSocket = TrackedWebSocket;

    window.addEventListener('request-poke-inventory', () => {
        if (gameSocket && gameSocket.readyState === NativeWebSocket.OPEN) {
            gameSocket.send(JSON.stringify({ type: 'inv-get' }));
        }
    });
`);

function getGameTokens() {
    try {
        return JSON.parse(sessionStorage.getItem('pokeweb:tokens') || 'null');
    } catch {
        return null;
    }
}

async function refreshGameAccessToken() {
    const tokens = getGameTokens();
    if (!tokens?.refreshToken) return null;
    try {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: tokens.refreshToken })
        });
        if (!response.ok) return null;
        const refreshed = await response.json();
        if (!refreshed?.accessToken) return null;
        sessionStorage.setItem('pokeweb:tokens', JSON.stringify(refreshed));
        return refreshed.accessToken;
    } catch (e) {
        return null;
    }
}

async function gameApiRequest(url, options = {}) {
    const send = accessToken => fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(options.headers || {})
        }
    });

    let response = await send(getGameTokens()?.accessToken);
    if (response.status === 401) {
        const refreshedToken = await refreshGameAccessToken();
        if (refreshedToken) response = await send(refreshedToken);
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.message || `HTTP ${response.status}`);
    return result;
}

// Promessa para pegar inventário silenciosamente (sem abrir a mochila) via WebSocket
async function getInventorySilently() {
    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            window.removeEventListener('poke-inventory-update', listener);
            resolve([]); // Timeout de segurança se o socket não responder em 3s
        }, 3000);

        const listener = (e) => {
            clearTimeout(timeout);
            window.removeEventListener('poke-inventory-update', listener);
            resolve(e.detail);
        };

        window.addEventListener('poke-inventory-update', listener);
        window.dispatchEvent(new CustomEvent('request-poke-inventory'));
    });
}

contextBridge.exposeInMainWorld('markApi', {
    fetchMarkData: async () => {
        try {
            const [shopRes, ballsRes, charRes, inventoryArray] = await Promise.all([
                gameApiRequest('/api/game/shop').catch(() => ({})),
                gameApiRequest('/api/game/balls').catch(() => ({})),
                gameApiRequest('/api/characters/me').catch(() => ({})),
                getInventorySilently() // <--- Obtém do WebSocket!
            ]);

            if (!shopRes.catalog && !ballsRes.catalog && !shopRes.items && !ballsRes.balls) {
                throw new Error("Não foi possível acessar a loja. A conta está logada?");
            }

            // Mapeando a array do inventário (socket) para o formato { "id": qty }
            const wsItemCounts = {};
            if (inventoryArray && inventoryArray.length > 0) {
                for (let item of inventoryArray) {
                    wsItemCounts[String(item.itemId)] = Number(item.quantity) || 0;
                }
            }

            const shopCatalog = shopRes.catalog || shopRes;
            const balls = (shopCatalog.balls?.length > 0) ? shopCatalog.balls : (ballsRes.catalog || []);
            const items = shopCatalog.items || [];
            
            return {
                success: true,
                catalog: { balls, items },
                gold: charRes.character?.gold || charRes.gold || shopRes.gold || ballsRes.gold || 0,
                counts: Object.assign({}, wsItemCounts, shopRes.counts, ballsRes.counts, charRes.counts)
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },
    
    buyItem: async (productId, qty, isBall) => {
        try {
            const endpoint = isBall ? '/api/game/balls/buy' : '/api/game/shop/buy';
            const payloadKey = isBall ? 'ballId' : 'itemId';
            
            const data = await gameApiRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify({ [payloadKey]: productId, qty: qty })
            });

            return {
                success: true,
                gold: data.gold,
                counts: data.counts || {}
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
});
