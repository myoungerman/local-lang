import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'fs';
import started from 'electron-squirrel-startup';
import AppDatabase from './db/database';
import setUpHandlers from './db/ipcHandlers'; 
import { listFiles, downloadFileToCacheDir } from "@huggingface/hub";
import { pipeline, env } from "@xenova/transformers";

let db;
env.allowRemoteModels = false;
env.cacheDir = path.join(app.getPath('userData'), 'cache');
const translationModelPath = path.join(env.cacheDir, 'models--Xenova--opus-mt-fr-en');


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
  ipcMain.handle('translate-text', translate);
  ipcMain.handle('download-translation-model', downloadTranslationModel);
  createWindow();
  if (!fs.existsSync(env.cacheDir)) {
    console.log(`Cache not found, creating directory.`);
    fs.mkdirSync(env.cacheDir, { recursive: true });
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

const downloadTranslationModel = async () => {
  try {
    if (fs.existsSync(translationModelPath)) {
      return;
    }
    console.log('Downloading translation model...');
    let files = [];
    for await (const file of listFiles({
      repo: 'Xenova/opus-mt-fr-en',
      revision: 'main',
      recursive: true,
  })) {
      const fileHasExtension = path.extname(file.path) !== '';
      // Add just the encoder_model_quantized.onnx and decoder_model_merged_quantized.onnx files from the ONNX folder, and add the ONNX folder itself.
      if (file.path.includes('onnx') && (file.path.includes('encoder_model_quantized.onnx') || file.path.includes('decoder_model_merged_quantized.onnx'))) {
        const normalizedPath = file.path.replace(/\\/g, '/');
        files.push({ ...file, path: normalizedPath });
        console.log(`Added file ${file.path} to download list`);
      }
      // Add the files that are not in the ONNX folder.
      if (!file.path.includes('onnx') && fileHasExtension) {
        files.push(file);
      }
    }

    let saveLocation = await downloadFiles(files);
    // When HuggingFace downloads a repo, it creates two folders called snapshots and blobs. It uses those folders to auto-update the model as new versions become available, but that structure prevents pipeline() from locating the files.
    // To fix that, we delete the blobs folder, which contains symlinks that are irrelevant for an offline app, and move the model's files up a level from the snapshots folder.
    await flattenDirectory(saveLocation);
  }
  catch (error) {
    console.error('listFiles failed:', error);
  }
};

const downloadFiles = async (files) => {
  for (const el of files) {
    const savedFile = await downloadFileToCacheDir({
      repo: 'Xenova/opus-mt-fr-en',
      revision: 'main',
      path: el.path,
      cacheDir: env.cacheDir,
    });
    console.log(`Downloaded ${el.path} to ${env.cacheDir}`);
  }
  // Return the directory to be flattened.
  return translationModelPath; 
};

const flattenDirectory = async (dir) => {
  const blobsDir = path.join(dir, 'blobs');
  const snapshotsDir = path.join(dir, 'snapshots');
  // Delete the blobs folder.
  if (fs.existsSync(blobsDir)) {
    await fsp.rm(blobsDir, { recursive: true, force: true });
  }
  // Move the contents of the snapshots folder up to the model directory.
  if (fs.existsSync(snapshotsDir)) {
    const subFolders = await fsp.readdir(snapshotsDir);
    for (const subFolder of subFolders) {
      // Move the subfolder's contents up to the model directory. The subfolder name is a hash like 8f725e8.
      const subFolderPath = path.join(snapshotsDir, subFolder);
      const files = await fsp.readdir(subFolderPath);
      // Ex. ...\snapshots\8f725e8\onnx\encoder_model_quantized.onnx
      const currentFilePaths = files.map(file => path.join(subFolderPath, file));
      for (const oldFilePath of currentFilePaths) {
        // Ex. oldFilePath = ...\snapshots\8f725e8\onnx\encoder_model_quantized.onnx -> newFilePath = ...\models--Xenova--opus-mt-fr-en\encoder_model_quantized.onnx
        const newFilePath = path.join(translationModelPath, path.basename(oldFilePath));
        // if the destination directory already has a folder (NOT a file) with the same name, get the children of this item and move them into that folder that has the name of this folder
        if (fs.existsSync(newFilePath) && fs.lstatSync(newFilePath).isDirectory()) {
          const children = await fsp.readdir(oldFilePath);
          for (const child of children) {
            const oldChildPath = path.join(oldFilePath, child);
            const newChildPath = path.join(newFilePath, child);
            await fsp.rename(oldChildPath, newChildPath);
            console.log(`Moved ${oldChildPath} to ${newChildPath}`);
          }
        } else {
          await fsp.rename(oldFilePath, newFilePath);
          console.log(`Moved ${oldFilePath} to ${newFilePath}`);
        }
      }
    }
  }
}

const detector = async (text) => {
  const result = await pipeline("translation", "models--Xenova--opus-mt-fr-en", {
    cache_dir: path.join(env.cacheDir),
    local_files_only: true,
  });
  return result(text);
};

const translate = async (_event, text) => {
  try {
    if (typeof text !== 'string') {
      throw new TypeError(`translate expected a string, received ${typeof text}`);
    }
    const result = await detector(text);
    return result[0]['translation_text'];
  } catch (error) {
    throw error;
  }
};

