import crypto from 'crypto';
import db from './db.mjs';

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
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

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 32, (err, derivedKey) => {
      if (err) reject(err);
      else resolve({ hash: derivedKey.toString('hex'), salt });
    });
  });
}

async function seed() {
  // Clear in dependency order (most dependent first)
  await run('DELETE FROM sandwich_dressings');
  await run('DELETE FROM sandwich_ingredients');
  await run('DELETE FROM order_sandwiches');
  await run('DELETE FROM orders');
  await run('DELETE FROM users');
  await run('DELETE FROM dressings');
  await run('DELETE FROM ingredients');
  await run('DELETE FROM breads');
  await run('DELETE FROM main_ingredients');
  await run('DELETE FROM sizes');

  // Sizes: code, name, base_price, included_ingredients, max_dressings, daily_limit
  await run(`INSERT INTO sizes VALUES ('S','Small',5,2,1,10)`);
  await run(`INSERT INTO sizes VALUES ('M','Medium',7,3,2,8)`);
  await run(`INSERT INTO sizes VALUES ('L','Large',10,4,2,6)`);

  // Main ingredients
  await run(`INSERT INTO main_ingredients VALUES (1,'roast beef')`);
  await run(`INSERT INTO main_ingredients VALUES (2,'ham')`);
  await run(`INSERT INTO main_ingredients VALUES (3,'bacon')`);

  // Breads
  await run(`INSERT INTO breads VALUES (1,'wheat')`);
  await run(`INSERT INTO breads VALUES (2,'brown')`);

  // Optional ingredients (7)
  await run(`INSERT INTO ingredients VALUES (1,'lettuce')`);
  await run(`INSERT INTO ingredients VALUES (2,'olives')`);
  await run(`INSERT INTO ingredients VALUES (3,'onions')`);
  await run(`INSERT INTO ingredients VALUES (4,'cucumber')`);
  await run(`INSERT INTO ingredients VALUES (5,'yellow cheese')`);
  await run(`INSERT INTO ingredients VALUES (6,'tomatoes')`);
  await run(`INSERT INTO ingredients VALUES (7,'mozzarella')`);

  // Dressings
  await run(`INSERT INTO dressings VALUES (1,'olive oil')`);
  await run(`INSERT INTO dressings VALUES (2,'mustard')`);
  await run(`INSERT INTO dressings VALUES (3,'mayonnaise')`);

  // Users - hash passwords with crypto.scrypt(password, salt, 32)
  const TOTP_SECRET = 'LXBSMDTMSP2I5XFXIYRGFVWSFI';
  const [aliceCred, bobCred, carolCred, daveCred] = await Promise.all([
    hashPassword('pwd12345'),
    hashPassword('pwd12345'),
    hashPassword('pwd12345'),
    hashPassword('pwd12345'),
  ]);

  // alice: 2FA, credit=49 (100 - 51 paid)
  await run(
    `INSERT INTO users (username,name,hash,salt,credit,secret) VALUES (?,?,?,?,?,?)`,
    ['alice', 'Alice', aliceCred.hash, aliceCred.salt, 49, TOTP_SECRET]
  );
  // bob: no 2FA, credit=71 (100 - 29 paid)
  await run(
    `INSERT INTO users (username,name,hash,salt,credit,secret) VALUES (?,?,?,?,?,?)`,
    ['bob', 'Bob', bobCred.hash, bobCred.salt, 71, null]
  );
  // carol: 2FA, no orders, credit=100
  await run(
    `INSERT INTO users (username,name,hash,salt,credit,secret) VALUES (?,?,?,?,?,?)`,
    ['carol', 'Carol', carolCred.hash, carolCred.salt, 100, TOTP_SECRET]
  );
  // dave: no 2FA, no orders, credit=100
  await run(
    `INSERT INTO users (username,name,hash,salt,credit,secret) VALUES (?,?,?,?,?,?)`,
    ['dave', 'Dave', daveCred.hash, daveCred.salt, 100, null]
  );

  const alice = await get(`SELECT id FROM users WHERE username='alice'`);
  const bob = await get(`SELECT id FROM users WHERE username='bob'`);

  // ----- Alice's orders -----

  // A1: 1xL, roast beef(1), brown(2), 4 ingr (=included, 0 extras), 2 dressings -> unit=10, total=10
  const a1Id = await run(`INSERT INTO orders (user_id,total) VALUES (?,?)`, [alice.id, 10]);
  const a1s1Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [a1Id, 'L', 1, 2, 1, 10]
  );
  for (const ingId of [1, 2, 3, 4])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [a1s1Id, ingId]);
  for (const drId of [1, 2])
    await run(`INSERT INTO sandwich_dressings VALUES (?,?)`, [a1s1Id, drId]);

  // A2: mixed sizes - 1xS(2 ingr)+1xM(3 ingr)+1xL(5 ingr, 1 extra->unit=13) -> total=5+7+13=25
  const a2Id = await run(`INSERT INTO orders (user_id,total) VALUES (?,?)`, [alice.id, 25]);
  // 1xS, roast beef, wheat, 2 ingr
  const a2s1Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [a2Id, 'S', 1, 1, 1, 5]
  );
  for (const ingId of [1, 2])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [a2s1Id, ingId]);
  // 1xM, roast beef, wheat, 3 ingr
  const a2s2Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [a2Id, 'M', 1, 1, 1, 7]
  );
  for (const ingId of [1, 2, 3])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [a2s2Id, ingId]);
  // 1xL, roast beef, wheat, 5 ingr (1 extra -> unit=10*(1+0.30)=13)
  const a2s3Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [a2Id, 'L', 1, 1, 1, 13]
  );
  for (const ingId of [1, 2, 3, 4, 5])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [a2s3Id, ingId]);

  // A3: 4xS, ham(2), wheat(1), 2 ingr, 1 dressing -> unit=5, subtotal=20, 20% off -> total=16
  const a3Id = await run(`INSERT INTO orders (user_id,total) VALUES (?,?)`, [alice.id, 16]);
  const a3s1Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [a3Id, 'S', 2, 1, 4, 5]
  );
  for (const ingId of [1, 2])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [a3s1Id, ingId]);
  await run(`INSERT INTO sandwich_dressings VALUES (?,?)`, [a3s1Id, 1]);

  // ----- Bob's orders -----

  // B1: 1xM, bacon(3), brown(2), 3 ingr, 2 dressings -> total=7
  const b1Id = await run(`INSERT INTO orders (user_id,total) VALUES (?,?)`, [bob.id, 7]);
  const b1s1Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [b1Id, 'M', 3, 2, 1, 7]
  );
  for (const ingId of [1, 2, 3])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [b1s1Id, ingId]);
  for (const drId of [1, 2])
    await run(`INSERT INTO sandwich_dressings VALUES (?,?)`, [b1s1Id, drId]);

  // B2: 2xS, roast beef(1), wheat(1), 2 ingr, 1 dressing -> unit=5, total=10 (nSand=2, no discount)
  const b2Id = await run(`INSERT INTO orders (user_id,total) VALUES (?,?)`, [bob.id, 10]);
  const b2s1Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [b2Id, 'S', 1, 1, 2, 5]
  );
  for (const ingId of [1, 2])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [b2s1Id, ingId]);
  await run(`INSERT INTO sandwich_dressings VALUES (?,?)`, [b2s1Id, 1]);

  // B3: mixed - 1xS + 1xM -> total=5+7=12 (nSand=2, no discount)
  const b3Id = await run(`INSERT INTO orders (user_id,total) VALUES (?,?)`, [bob.id, 12]);
  // 1xS, ham(2), wheat(1), 2 ingr
  const b3s1Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [b3Id, 'S', 2, 1, 1, 5]
  );
  for (const ingId of [1, 2])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [b3s1Id, ingId]);
  // 1xM, ham(2), wheat(1), 3 ingr
  const b3s2Id = await run(
    `INSERT INTO order_sandwiches (order_id,size_code,main_id,bread_id,quantity,unit_price) VALUES (?,?,?,?,?,?)`,
    [b3Id, 'M', 2, 1, 1, 7]
  );
  for (const ingId of [1, 2, 3])
    await run(`INSERT INTO sandwich_ingredients VALUES (?,?)`, [b3s2Id, ingId]);

  console.log('Seed complete!');

  // Verify
  const users = await new Promise((res, rej) =>
    db.all(`SELECT username, credit FROM users ORDER BY username`, [], (e, r) => e ? rej(e) : res(r)));
  console.log('User credits:', users.map(u => `${u.username}=${u.credit}`).join(', '));

  const avail = await new Promise((res, rej) =>
    db.all(`
      SELECT s.code,
             s.daily_limit - COALESCE(SUM(os.quantity),0) AS available
      FROM sizes s
      LEFT JOIN order_sandwiches os ON os.size_code = s.code
      GROUP BY s.code ORDER BY s.code
    `, [], (e, r) => e ? rej(e) : res(r)));
  console.log('Availability:', avail.map(a => `${a.code}: ${a.available} left`).join(', '));

  db.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
