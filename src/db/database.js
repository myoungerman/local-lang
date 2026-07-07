import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'node:path';


class AppDatabase{
  constructor(){
    const dbPath = path.join(app.getPath('userData'), 'langlocal.sqlite');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
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
  updateLesson(lesson_id, title, body_text){
    const stmt = this.db.prepare('UPDATE lessons SET title = ?, body_text = ? WHERE lesson_id = ?');
    stmt.run(title, body_text, lesson_id);
  }
  getAllLessons(){
    const stmt = this.db.prepare('SELECT * FROM lessons');
    return stmt.all();
  }
  close(){
    this.db.close();
    console.log('Database closed');
  }
}


export default AppDatabase;