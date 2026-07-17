import crypto from 'crypto';
import db from './db.mjs';

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// ----- Browse (public) -----

export function getSizes() {
  return all(`
    SELECT s.code, s.name, s.base_price, s.included_ingredients,
           s.max_dressings, s.daily_limit,
           s.daily_limit - COALESCE(SUM(os.quantity), 0) AS available
    FROM sizes s
    LEFT JOIN order_sandwiches os ON os.size_code = s.code
    GROUP BY s.code
    ORDER BY s.code
  `);
}

export function getMainIngredients() {
  return all(`SELECT id, name FROM main_ingredients ORDER BY id`);
}

export function getBreads() {
  return all(`SELECT id, name FROM breads ORDER BY id`);
}

export function getIngredients() {
  return all(`SELECT id, name FROM ingredients ORDER BY id`);
}

export function getDressings() {
  return all(`SELECT id, name FROM dressings ORDER BY id`);
}

// ----- Auth -----

export function getUserByCredentials(username, password) {
  return new Promise((resolve, reject) => {
    get(`SELECT * FROM users WHERE username = ?`, [username])
      .then(user => {
        if (!user) return resolve(false);
        crypto.scrypt(password, user.salt, 32, (err, derivedKey) => {
          if (err) return reject(err);
          const storedHash = Buffer.from(user.hash, 'hex');
          try {
            if (crypto.timingSafeEqual(storedHash, derivedKey)) resolve(user);
            else resolve(false);
          } catch (err) {
            resolve(false);
          }
        });
      })
      .catch(reject);
  });
}

export function getUserById(id) {
  return get(`SELECT * FROM users WHERE id = ?`, [id]);
}

export function updateLastTotpStep(userId, step) {
  return run(`UPDATE users SET last_totp_step = ? WHERE id = ?`, [step, userId]);
}

// ----- Orders -----

export function getOrdersByUser(userId) {
  return all(`SELECT id, total FROM orders WHERE user_id = ?`, [userId]);
}

export function getOrderById(orderId) {
  return get(`SELECT * FROM orders WHERE id = ?`, [orderId]);
}

export function getSandwichesByOrder(orderId) {
  return all(`SELECT * FROM order_sandwiches WHERE order_id = ?`, [orderId]);
}

export function getIngredientsBySandwich(sandwichId) {
  return all(
    `SELECT i.id, i.name FROM ingredients i
     JOIN sandwich_ingredients si ON si.ingredient_id = i.id
     WHERE si.sandwich_id = ?`,
    [sandwichId]
  );
}

export function getDressingsBySandwich(sandwichId) {
  return all(
    `SELECT d.id, d.name FROM dressings d
     JOIN sandwich_dressings sd ON sd.dressing_id = d.id
     WHERE sd.sandwich_id = ?`,
    [sandwichId]
  );
}

export function createOrder(userId, total) {
  return run(`INSERT INTO orders (user_id, total) VALUES (?, ?)`, [userId, total]);
}

export function createSandwich(orderId, sizeCode, mainId, breadId, quantity, unitPrice) {
  return run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price)
     VALUES (?,?,?,?,?,?)`,
    [orderId, sizeCode, mainId, breadId, quantity, unitPrice]
  );
}

export function addSandwichIngredient(sandwichId, ingredientId) {
  return run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [sandwichId, ingredientId]);
}

export function addSandwichDressing(sandwichId, dressingId) {
  return run(`INSERT INTO sandwich_dressings VALUES (?,?)`, [sandwichId, dressingId]);
}

export function deleteSandwichIngredients(sandwichId) {
  return run(`DELETE FROM sandwich_ingredients WHERE sandwich_id = ?`, [sandwichId]);
}

export function deleteSandwichDressings(sandwichId) {
  return run(`DELETE FROM sandwich_dressings WHERE sandwich_id = ?`, [sandwichId]);
}

export function deleteOrderSandwiches(orderId) {
  return run(`DELETE FROM order_sandwiches WHERE order_id = ?`, [orderId]);
}

export function deleteOrder(orderId) {
  return run(`DELETE FROM orders WHERE id = ?`, [orderId]);
}

export function updateUserCredit(userId, credit) {
  return run(`UPDATE users SET credit = ? WHERE id = ?`, [credit, userId]);
}
