// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

const api = {
  addLesson: (title, body_text) => ipcRenderer.invoke('add-lesson', title, body_text),
  deleteLesson: (lesson_id) => ipcRenderer.invoke('delete-lesson', lesson_id),
  updateLesson: (lesson_id, title, body_text) => ipcRenderer.invoke('update-lesson', lesson_id, title, body_text),
  getAllLessons: () => ipcRenderer.invoke('get-all-lessons')
}

contextBridge.exposeInMainWorld('api', api);
