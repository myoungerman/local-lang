import { ipcMain } from "electron";

export default function setUpHandlers(db) {
    ipcMain.handle('add-lesson', (event, title, body_text) => {
        return db.addLesson(title, body_text);
    });

    ipcMain.handle('delete-lesson', (event, lesson_id) => {
        return db.deleteLesson(lesson_id);
    });

    ipcMain.handle('update-lesson', (event, lesson_id, updates) => {
        return db.updateLesson(lesson_id, updates);
    });

    ipcMain.handle('get-all-lessons', () => {
        return db.getAllLessons();
    });
    ipcMain.handle('get-lesson-by-id', (event, lesson_id) => {
        return db.getLessonById(lesson_id);
    });
    ipcMain.handle('get-translation-for-word', (event, word) => {
        return db.getTranslationByFrenchWord(word);
    });
    ipcMain.handle('get-word-progress', (event, word) => {
        return db.getWordProgress(word);
    });
    ipcMain.handle('save-word-progress', (event, word, familiarity, notes, is_compound) => {
        return db.saveWordProgress(word, familiarity, notes, is_compound);
    });
}