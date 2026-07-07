import { ipcMain } from "electron";

export default function setUpHandlers(db) {
    ipcMain.handle('add-lesson', (event, title, body_text) => {
        return db.addLesson(title, body_text);
    });

    ipcMain.handle('delete-lesson', (event, lesson_id) => {
        return db.deleteLesson(lesson_id);
    });

    ipcMain.handle('update-lesson', (event, lesson_id, title, body_text) => {
        return db.updateLesson(lesson_id, title, body_text);
    });

    ipcMain.handle('get-all-lessons', () => {
        return db.getAllLessons();
    });
}