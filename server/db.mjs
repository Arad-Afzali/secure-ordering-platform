import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('sandwich.sqlite', (err) => {
  if (err) throw err;
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS sizes (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_price REAL NOT NULL,
    included_ingredients INTEGER NOT NULL,
    max_dressings INTEGER NOT NULL,
    daily_limit INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS main_ingredients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS breads (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS dressings (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    credit REAL NOT NULL DEFAULT 0,
    secret TEXT,
    last_totp_step INTEGER NOT NULL DEFAULT -1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total REAL NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_sandwiches (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    size_code TEXT NOT NULL REFERENCES sizes(code),
    main_id INTEGER NOT NULL REFERENCES main_ingredients(id),
    bread_id INTEGER NOT NULL REFERENCES breads(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sandwich_ingredients (
    sandwich_id INTEGER NOT NULL REFERENCES order_sandwiches(id),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    PRIMARY KEY (sandwich_id, ingredient_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sandwich_dressings (
    sandwich_id INTEGER NOT NULL REFERENCES order_sandwiches(id),
    dressing_id INTEGER NOT NULL REFERENCES dressings(id),
    PRIMARY KEY (sandwich_id, dressing_id)
  )`);
});

export default db;
