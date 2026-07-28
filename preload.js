const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    saveCreds: (creds) => ipcRenderer.invoke('save-creds', creds),
    loadCreds: () => ipcRenderer.invoke('load-creds'),
    log: (msg) => ipcRenderer.invoke('log', msg)
});
