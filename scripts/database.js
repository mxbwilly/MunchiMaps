// scripts/database.js
// Refactored database helper with full legacy helpers + starter data population

const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

const DB_PATH = path.join(__dirname, 'munchiData.db');

let _db = null;
async function connect() {
  if (_db) return _db;
  _db = await sqlite.open({ filename: DB_PATH, driver: sqlite3.Database });
  await _db.run('PRAGMA foreign_keys = ON;');
  return _db;
}

async function initializeDatabase() {
  const db = await connect();

  // buildings table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS building (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      x_coord REAL NOT NULL,
      y_coord REAL NOT NULL,
      time_opens TEXT NOT NULL,
      time_closes TEXT NOT NULL,
      num_snack_machines INTEGER,
      num_drink_machines INTEGER,
      num_ratings INTEGER,
      average_ratings REAL,
      needs_service BOOLEAN
    );
  `);

  // reviews table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS review (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment TEXT,
      building_id INTEGER,
      product_rating INTEGER,
      FOREIGN KEY (building_id) REFERENCES building(id)
    );
  `);

  // canonical reports table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER,
      title TEXT,
      description TEXT,
      type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (building_id) REFERENCES building(id)
    );
  `);
}

// --- Starter data population ---
async function populateWithStarterData() {
  const db = await connect();
  try {
    const data = await fs.readFile(path.join(__dirname, '../database/originalBuildings.JSON'), 'utf8');
    const jsonData = JSON.parse(data);

    const stmt = await db.prepare(`
      INSERT INTO building (name, x_coord, y_coord, time_opens, time_closes, num_snack_machines, num_drink_machines, num_ratings, average_ratings, needs_service)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of jsonData) {
      await stmt.run(
        item.name,
        item.x_coord,
        item.y_coord,
        item.time_opens,
        item.time_closes,
        item.num_snack_machines,
        item.num_drink_machines,
        item.num_ratings,
        item.average_ratings,
        item.needs_service
      );
    }
    await stmt.finalize();
  } catch (err) {
    console.error('Error in populateWithStarterData:', err.message);
  }
}

// --- Report functions ---
async function addReport(building_id, title, description, type) {
  const db = await connect();
  const stmt = `INSERT INTO reports (building_id, title, description, type, created_at) VALUES (?, ?, ?, ?, datetime('now'))`;
  const result = await db.run(stmt, [building_id, title, description, type]);
  return { id: result.lastID };
}

async function getAllReports() {
  const db = await connect();
  return db.all('SELECT id, building_id, title, description, type, created_at FROM reports ORDER BY created_at DESC');
}

async function getReportsByBuilding(building_id) {
  const db = await connect();
  return db.all('SELECT id, building_id, title, description, type, created_at FROM reports WHERE building_id = ? ORDER BY created_at DESC', [building_id]);
}

async function getReportsByType(type) {
  const db = await connect();
  return db.all('SELECT id, building_id, title, description, type, created_at FROM reports WHERE type = ? ORDER BY created_at DESC', [type]);
}

async function getReportCount() {
  const db = await connect();
  const row = await db.get('SELECT COUNT(*) AS total FROM reports');
  return row.total || 0;
}

async function getRecentReports() {
  const db = await connect();
  return db.all("SELECT id, building_id, title, description, type, created_at FROM reports WHERE created_at >= datetime('now', '-1 day') ORDER BY created_at DESC");
}

async function updateReportDescription(id, newDescription) {
  const db = await connect();
  const res = await db.run('UPDATE reports SET description = ? WHERE id = ?', [newDescription, id]);
  return res.changes > 0;
}

async function deleteReport(id) {
  const db = await connect();
  const res = await db.run('DELETE FROM reports WHERE id = ?', [id]);
  return res.changes > 0;
}

async function searchReports(keyword) {
  const db = await connect();
  const q = `%${keyword}%`;
  return db.all('SELECT id, building_id, title, description, type, created_at FROM reports WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC', [q, q]);
}

async function getReportStats() {
  const db = await connect();
  const rows = await db.all('SELECT type, COUNT(*) AS count FROM reports GROUP BY type');
  const byType = {};
  let total = 0;
  rows.forEach(r => { byType[r.type] = r.count; total += r.count; });
  return { total, byType };
}

// --- Legacy building/review helpers preserved ---
async function fetchSpecificBuildingByName(name) {
  const db = await connect();
  return db.get('SELECT * FROM building WHERE name = ?', [name]);
}

async function fetchSpecificBuildingByKey(id) {
  const db = await connect();
  return db.get('SELECT * FROM building WHERE id = ?', [id]);
}

async function getBuildingIDByName(name) {
  const db = await connect();
  return db.get('SELECT id FROM building WHERE name = ?', [name]);
}

async function getX(name) {
  const db = await connect();
  return db.get('SELECT x_coord FROM building WHERE name = ?', [name]);
}

async function getY(name) {
  const db = await connect();
  return db.get('SELECT y_coord FROM building WHERE name = ?', [name]);
}

async function fetchAllBuildingNames() {
  const db = await connect();
  return db.all('SELECT name FROM building');
}

async function getNumSnackMachines(name) {
  const db = await connect();
  return db.get('SELECT num_snack_machines FROM building WHERE name = ?', [name]);
}

async function getNumDrinkMachines(name) {
  const db = await connect();
  return db.get('SELECT num_drink_machines FROM building WHERE name = ?', [name]);
}

async function insertBuilding(name, x_coord, y_coord, time_opens, time_closes, num_snack_machines, num_drink_machines, num_ratings, average_ratings, needs_service) {
  const db = await connect();
  await db.run(
    'INSERT INTO building (name, x_coord, y_coord, time_opens, time_closes, num_snack_machines, num_drink_machines, num_ratings, average_ratings, needs_service) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, x_coord, y_coord, time_opens, time_closes, num_snack_machines, num_drink_machines, num_ratings, average_ratings, needs_service]
  );
}

async function insertReview(comment, building_id, product_rating) {
  const db = await connect();
  await db.run('INSERT INTO review (comment, building_id, product_rating) VALUES (?, ?, ?)', [comment, building_id, product_rating]);
}

async function fetchAllBuildings() {
  const db = await connect();
  return db.all('SELECT * FROM building');
}

async function fetchAllReviews() {
  const db = await connect();
  return db.all('SELECT * FROM review');
}

// Export API
module.exports = {
  connect,
  initializeDatabase,
  populateWithStarterData,
  addReport,
  getAllReports,
  getReportsByBuilding,
  getReportsByType,
  getReportCount,
  getRecentReports,
  updateReportDescription,
  deleteReport,
  searchReports,
  getReportStats,
  // legacy helpers
  fetchSpecificBuildingByName,
  fetchSpecificBuildingByKey,
  getBuildingIDByName,
  getX,
  getY,
  fetchAllBuildingNames,
  getNumSnackMachines,
  getNumDrinkMachines,
  insertBuilding,
  insertReview,
  fetchAllBuildings,
  fetchAllReviews
};
