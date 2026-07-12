import { app } from 'electron';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

class AppDatabase{
  constructor(){
    const userDbPath = path.join(app.getAppPath(), 'src', 'db', 'langlocal.sqlite');

    this.db = new Database(userDbPath);
    this.db.pragma('journal_mode = WAL');

    const translationDbPath = path.join(app.getAppPath(), 'src', 'db', 'fr-en.sqlite3');
    this.translationDb = new Database(translationDbPath, { readonly: true });
    this.setUpDataBase();
  }

  setUpDataBase(){
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lessons (
        lesson_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body_text TEXT NOT NULL,
        language_target TEXT DEFAULT 'fr',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_opened TIMESTAMP,
        percent_completed INTEGER DEFAULT 0
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS word_progress (
        word TEXT PRIMARY KEY,
        familiarity INTEGER DEFAULT 1,
        notes TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_compound BOOLEAN DEFAULT FALSE
      )
    `);
  }

  addLesson(title, body_text){
    const stmt = this.db.prepare('INSERT INTO lessons (title, body_text) VALUES (?, ?)');
    const info = stmt.run(title, body_text);
    return{
        lesson_id: info.lastInsertRowid,
        title: title,
        percent_completed: 0
    }
  }

  deleteLesson(lesson_id){
    const stmt = this.db.prepare('DELETE FROM lessons WHERE lesson_id = ?');
    const info = stmt.run(lesson_id);
    return info.changes > 0;
  }

  updateLesson(lesson_id, updates){
    const allowedColumns = ['title', 'body_text', 'language_target', 'last_opened', 'percent_completed'];
    const entries = Object.entries(updates || {}).filter(([column]) => allowedColumns.includes(column));

    if (entries.length === 0) {
      return false;
    }

    const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
    const values = entries.map(([, value]) => value);
    values.push(lesson_id);

    const stmt = this.db.prepare(`UPDATE lessons SET ${setClause} WHERE lesson_id = ?`);
    const info = stmt.run(...values);
    return info.changes > 0;
  }

  getAllLessons(){
    const stmt = this.db.prepare('SELECT * FROM lessons');
    return stmt.all();
  }

  getLessonById(lesson_id){
    const stmt = this.db.prepare('SELECT * FROM lessons WHERE lesson_id = ?');
    return stmt.get(lesson_id);
  }

  getTranslationByFrenchWord(frenchWord){
    const stmt = this.translationDb.prepare(
      'SELECT written_rep, trans_list, max_score, rel_importance FROM simple_translation WHERE written_rep = ? COLLATE NOCASE LIMIT 1'
    );
    return stmt.get(frenchWord);
  }

  getWordProgress(word){
    const stmt = this.db.prepare('SELECT word, familiarity, notes FROM word_progress WHERE word = ?');
    return stmt.get(word);
  }

  saveWordProgress(word, familiarity, notes, is_compound){
    const stmt = this.db.prepare(`
      INSERT INTO word_progress (word, familiarity, notes, updated_at, is_compound)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(word) DO UPDATE SET
        familiarity = excluded.familiarity,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP,
        is_compound = excluded.is_compound
    `);
    stmt.run(word, familiarity, notes, is_compound);
    return { word, familiarity, notes, is_compound };
  }

  close(){
    this.db.close();
    this.translationDb.close();
    console.log('Database closed');
  }
}


export default AppDatabase;