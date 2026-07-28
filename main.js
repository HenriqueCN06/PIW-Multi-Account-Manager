const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const userDataPath = path.join(os.homedir(), 'AppData', 'Local', 'PIW_Manager_Data');
app.setPath('userData', userDataPath);

const credsFile = path.join(userDataPath, 'credentials.json');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'PIW Multi Account Manager',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
}

// Handlers for persistent credentials using IPC
ipcMain.handle('save-creds', (event, creds) => {
    try {
        fs.writeFileSync(credsFile, JSON.stringify(creds));
        return true;
    } catch (e) {
        console.error("Erro ao salvar credenciais:", e);
        return false;
    }
});

ipcMain.handle('load-creds', () => {
    try {
        if (fs.existsSync(credsFile)) {
            return JSON.parse(fs.readFileSync(credsFile, 'utf8'));
        }
    } catch (e) {
        console.error("Erro ao ler credenciais:", e);
    }
    return {};
});

ipcMain.handle('log', (event, msg) => {
    console.log(msg);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
