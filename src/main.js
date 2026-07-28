import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import AppDatabase from './db/database';
import setUpHandlers from './db/ipcHandlers'; 
import { listFiles, downloadFileToCacheDir } from "@huggingface/hub";
import { pipeline, env } from "@xenova/transformers";

let db;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  db = new AppDatabase();
  db.setUpDataBase();
  setUpHandlers(db);
  createWindow();

  // Check if the translation model has been downloaded, and if not, download it.
  const translationModelPath = path.join(app.getAppPath(), '/src/models/translation');
  if (fs.existsSync(translationModelPath) && fs.readdirSync(translationModelPath).length === 0) {
    downloadTranslationModel();
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

/*
Get the list of filtered files by using the listFiles method,
filtering out the files the user shouldn't download, and sending that list to downloadFileToCacheDir.
That process will download the ONXX version of the model.
Once the model is downloaded, update the path so we can call the model.
*/

const downloadTranslationModel = async () => {
  try {
    let files = [];
    for await (const file of listFiles({
      repo: 'Xenova/opus-mt-fr-en',
      revision: 'main',
      recursive: true,
  })) {
      // Add just the encoder_model_quantized.onnx and decoder_model_merged_quantized.onnx files from the ONNX folder.
      if (file.path.includes('onnx') && (file.path.includes('encoder_model_quantized.onnx') || file.path.includes('decoder_model_merged_quantized.onnx'))) {
        files.push(file);
      }
      // Add the files that are not in the ONNX folder.
      if (!file.path.includes('onnx')) {
        files.push(file);
      }
    }

    await downloadFiles(files);
  }
  catch (error) {
    console.error('listFiles failed:', error);
  }
};

const downloadFiles = async (files) => {

  const saveLocation = path.join(app.getAppPath(), '/src/models/translation');
  for (const el of files) {

    const savedFile = await downloadFileToCacheDir({
      repo: 'Xenova/opus-mt-fr-en',
      revision: 'main',
      path: el.path,
      cacheDir: path.join(app.getAppPath(), '/src/models/translation'),
    });
  }
};