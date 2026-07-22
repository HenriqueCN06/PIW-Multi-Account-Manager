const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const os = require('os');

app.setPath('userData', path.join(os.homedir(), 'AppData', 'Local', 'PIW_Manager_Data'));

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'PIW Multi Account Manager',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
