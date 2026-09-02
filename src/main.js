import { app, BrowserWindow, ipcMain } from 'electron';
import path, { normalize } from 'node:path';
import fs from 'node:fs';
import { promises as fsp } from 'fs';
import started from 'electron-squirrel-startup';
import AppDatabase from './db/database';
import setUpHandlers from './db/ipcHandlers'; 
import { listFiles, downloadFileToCacheDir, snapshotDownload } from "@huggingface/hub";
import { pipeline, env } from '@huggingface/transformers';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';


let db;
env.allowRemoteModels = false;
env.cacheDir = path.join(app.getPath('userData'), 'cache');
env.cacheDir = env.cacheDir.replace(/\\/g, '/');
env.localModelPath = path.join(env.cacheDir);
env.localModelPath = env.localModelPath.replace(/\\/g, '/');
const translationModelPath = path.join(env.cacheDir, 'models--Xenova--opus-mt-fr-en');
const ttsModelFolderName = 'models--onnx-community--Supertonic-TTS-2-ONNX';
const ttsRepoName = 'onnx-community/Supertonic-TTS-2-ONNX';
const ttsModelPath = path.join(env.cacheDir, ttsModelFolderName);
let translationModelInstalled = false;
let ttsModelInstalled = false;

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
  ipcMain.handle('download-tts-model', downloadTtsModel);
  ipcMain.handle('check-for-translation-model', async () => { return translationModelInstalled });
  ipcMain.handle('check-for-tts-model', async () => { return ttsModelInstalled });
  ipcMain.handle('pronounce-text', pronounceText );
  createWindow();
  if (!fs.existsSync(env.cacheDir)) {
    fs.mkdirSync(env.cacheDir, { recursive: true });
  }
  if (fs.existsSync(translationModelPath)) {
    translationModelInstalled = true;
  }
  if (fs.existsSync(ttsModelPath)) {
    ttsModelInstalled = true;
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
    let files = [];
    // Make a list of all the files that should be downloaded. The repo has some large files that we'll ignore.
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
      }
      // Add the files that are not in the ONNX folder.
      if (!file.path.includes('onnx') && fileHasExtension) {
        files.push(file);
      }
    }

    await downloadFiles(files, 'Xenova/opus-mt-fr-en');
    // When HuggingFace downloads a repo, it creates a directory structure containing two folders called snapshots and blobs. The structure enables HuggingFace to auto-update the model as new versions become available, but it also prevents pipeline() from locating the files.
    // To fix that, we delete the blobs folder, which is only relevant for apps that need updates, and flatten the directory by moving the model's files up a level from the snapshots folder.
    await flattenDirectory(translationModelPath, 'llm');
    translationModelInstalled = true;
  }
  catch (error) {
    console.error('listFiles failed:', error);
  }
};

const downloadTtsModel = async () => {
  try {
    if (fs.existsSync(ttsModelPath)) {
      return;
    }
    await snapshotDownload({
      repo: ttsRepoName,
      cacheDir: env.cacheDir,
    });
    await flattenDirectory(ttsModelPath, 'tts');
    ttsModelInstalled = true;
    console.log('installed tts model');
  } catch (error) {
    console.log(`Error: ${error}`);
  }
};

const downloadFiles = async (files, repo) => {
  for (const el of files) {
    await downloadFileToCacheDir({
      repo: repo,
      revision: 'main',
      path: el.path,
      cacheDir: env.cacheDir,
    });
  }
};

const flattenDirectory = async (dir, modelType) => {
  const blobsDir = path.join(dir, 'blobs');
  const snapshotsDir = path.join(dir, 'snapshots');
  console.log(`flattening ${blobsDir} and ${snapshotsDir}`);
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
        let newFilePath;
        switch (modelType) {
          case 'tts':
            newFilePath = path.join(ttsModelPath, path.basename(oldFilePath));
            break;
          case 'llm':
            newFilePath = path.join(translationModelPath, path.basename(oldFilePath));
            break;
        }
        // Sometimes there are two folders named 'onnx', which causes conflicts when we copy the second folder. If the destination directory already has a folder with the same name, move the contents of this folder into that folder.
        if (fs.existsSync(newFilePath) && fs.lstatSync(newFilePath).isDirectory()) {
          const children = await fsp.readdir(oldFilePath);
          for (const child of children) {
            const oldChildPath = path.join(oldFilePath, child);
            const newChildPath = path.join(newFilePath, child);
            await fsp.rename(oldChildPath, newChildPath);
          }
        } else {
          await fsp.rename(oldFilePath, newFilePath);
        }
      }
    }
  }
}

const detector = async (text, task, modelName) => {
  const result = await pipeline(task, modelName, {
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
    const result = await detector(text, 'translation', 'models--Xenova--opus-mt-fr-en');
    return result[0]['translation_text'];
  } catch (error) {
    throw error;
  }
};

const withContext = async (step, fn) => {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`${step} failed: ${error.message}`, { cause: error });
  }
};

/* const pronounceText = async (_event, text) => {
  try {
    const tts = await pipeline('text-to-speech', ttsModelFolderName, {
      cache_dir: path.join(env.cacheDir),
      local_files_only: true,
    });

    const voicePath = path.join(ttsModelPath, 'voices', 'F1.bin');
    const voiceBuffer = await fsp.readFile(voicePath);
    const voiceData = new Float32Array(
      voiceBuffer.buffer,
      voiceBuffer.byteOffset,
      voiceBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );

    const input_text = `<fr>${text}</fr>`;
    const audio = await tts(input_text, {
      speaker_embeddings: voiceData,
      num_inference_steps: 50,
      speed: 1,
    });

    const wavPath = 'output.wav';
    const opusPath = 'output.opus';
    await audio.save(wavPath);
    await wavToOpus(wavPath, opusPath);
  } catch (error) {
    console.error(`TTS failed with error ${error}`);
  }
};
 */

const pronounceText = async (_event, text) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('pronounceText expected a non-empty string');
  }

  const tts = await withContext('Loading TTS pipeline', () =>
    pipeline('text-to-speech', ttsModelFolderName, {
      cache_dir: path.join(env.cacheDir),
      local_files_only: true,
    })
  );

  const voiceData = await withContext('Loading voice data', async () => {
    const voicePath = path.join(ttsModelPath, 'voices', 'F1.bin');
    const buffer = await fsp.readFile(voicePath);
    return new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
  });

  const audio = await withContext('Generating speech', () =>
    tts(`<fr>${text}</fr>`, {
      speaker_embeddings: voiceData,
      num_inference_steps: 50,
      speed: 1,
    })
  );

  await withContext('Saving audio output', async () => {
    const wavPath = path.join(app.getPath('temp'), 'output.wav');
    const opusPath = path.join(app.getPath('temp'), 'output.opus');
    await audio.save(wavPath);
    await wavToOpus(wavPath, opusPath);
    return { wavPath, opusPath };
  });
};

async function wavToOpus(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const executablePath = ffmpegPath.replace(
      `${path.sep}app.asar${path.sep}`,
      `${path.sep}app.asar.unpacked${path.sep}`,
    );

    execFile(executablePath, [
      '-y',
      '-i', inputPath,
      '-c:a', 'libopus', '-b:a', '48k', '-ac', '1',
      outputPath,
    ], (err) => (err ? reject(err) : resolve(outputPath)));
  });
}