const path = require('path');
const { app, BrowserWindow, shell } = require('electron');

let localServer;
let mainWindow;

async function createWindow() {
  const { createApp } = await import('../server/app.js');
  const dbPath = path.join(app.getPath('userData'), 'serverlens.sqlite');
  localServer = await createApp({ dbPath }).listen(0);
  const port = localServer.address().port;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 760,
    backgroundColor: '#f5f7fb',
    title: 'ServerLens',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (localServer) {
    localServer.close();
    localServer = undefined;
  }
});
