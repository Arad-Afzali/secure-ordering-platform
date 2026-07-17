import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { check, validationResult } from 'express-validator';
import { TOTP } from 'otpauth';
import './db.mjs';
import * as dao from './dao.mjs';

const app = express();
const port = 3001;

app.use(morgan('dev'));
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ----- Session + Passport -----

app.use(session({
  secret: 'sandwich-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.authenticate('session'));  // init passport to use sessions (as done in lectures)

passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await dao.getUserByCredentials(username, password);
    if (!user) return done(null, false, { message: 'Incorrect username or password.' });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await dao.getUserById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// ----- Middleware -----

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'not authenticated' });
}

function isTotp(req, res, next) {
  if (req.session.method === 'totp') return next();
  res.status(401).json({ error: '2FA required' });
}

function clientUserInfo(req) {
  const user = req.user;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    credit: user.credit,
    canDoTotp: user.secret ? true : false,
    isTotp: req.session.method === 'totp',
  };
}

// ----- Public browse routes -----

app.get('/api/sizes', async (req, res) => {
  try {
    res.json(await dao.getSizes());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/main-ingredients', async (req, res) => {
  try {
    res.json(await dao.getMainIngredients());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/breads', async (req, res) => {
  try {
    res.json(await dao.getBreads());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ingredients', async (req, res) => {
  try {
    res.json(await dao.getIngredients());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dressings', async (req, res) => {
  try {
    res.json(await dao.getDressings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Auth routes -----

app.post('/api/sessions',
  check('username').isLength({ min: 1 }),
  check('password').isLength({ min: 1 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: 'Invalid input.' });

    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: 'Incorrect username or password.' });
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(clientUserInfo(req));
      });
    })(req, res, next);
  }
);

app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) return res.json(clientUserInfo(req));
  res.status(401).json({ error: 'not authenticated' });
});

app.delete('/api/sessions/current', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({});
  });
});

app.post('/api/login-totp', isLoggedIn, async (req, res) => {
  if (!req.user.secret) return res.status(400).json({ error: 'Cannot auth with TOTP' });

  const { code } = req.body;
  if (!code) return res.status(422).json({ error: 'Missing code.' });

  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: req.user.secret,   // per-user secret, stored as base32 in the users table
  });

  const delta = totp.validate({ token: String(code), window: 1 });
  if (delta === null) return res.status(401).json({ error: 'Invalid or expired TOTP code.' });

  const actualStep = totp.counter() + delta;
  if (actualStep <= req.user.last_totp_step) {
    return res.status(401).json({ error: 'Invalid or expired TOTP code.' });
  }

  try {
    await dao.updateLastTotpStep(req.user.id, actualStep);
    req.session.method = 'totp';
    res.json({ otp: 'authorized' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Orders -----

const round2 = x => Math.round(x * 100) / 100;

// Manual dedupe: drop ids the client sent more than once
function dedupeIds(ids) {
  const result = [];
  for (const id of ids)
    if (!result.includes(id)) result.push(id);
  return result;
}

app.post('/api/orders',
  isLoggedIn,
  check('sandwiches').isArray({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ error: 'Invalid input.' });

    const { sandwiches } = req.body;

    try {
      // Load all reference data for validation
      const sizes = await dao.getSizes();
      const sizeMap = {};
      for (const s of sizes) sizeMap[s.code] = s;

      const mainIds = (await dao.getMainIngredients()).map(m => m.id);
      const breadIds = (await dao.getBreads()).map(b => b.id);
      const ingredientIds = (await dao.getIngredients()).map(i => i.id);
      const dressingIds = (await dao.getDressings()).map(d => d.id);

      // Validate shape, ids and dressing caps
      for (const s of sandwiches) {
        if (!['S', 'M', 'L'].includes(s.size))
          return res.status(422).json({ error: 'Invalid size.' });
        if (!Number.isInteger(s.quantity) || s.quantity < 1)
          return res.status(422).json({ error: 'Invalid quantity.' });
        if (!mainIds.includes(s.main_id))
          return res.status(422).json({ error: 'Invalid main ingredient.' });
        if (!breadIds.includes(s.bread_id))
          return res.status(422).json({ error: 'Invalid bread.' });
        if (!Array.isArray(s.ingredient_ids) || !Array.isArray(s.dressing_ids))
          return res.status(422).json({ error: 'Invalid input.' });

        // Ignore duplicate ids: price, cap check and stored rows must agree
        s.ingredient_ids = dedupeIds(s.ingredient_ids);
        s.dressing_ids = dedupeIds(s.dressing_ids);

        for (const id of s.ingredient_ids)
          if (!ingredientIds.includes(id))
            return res.status(422).json({ error: 'Invalid ingredient.' });
        for (const id of s.dressing_ids)
          if (!dressingIds.includes(id))
            return res.status(422).json({ error: 'Invalid dressing.' });
        if (s.dressing_ids.length > sizeMap[s.size].max_dressings)
          return res.status(422).json({ error: `Too many dressings for size ${s.size}.` });
      }

      // Availability check (authoritative, computed from DB)
      const sizeQty = {};
      for (const s of sandwiches)
        sizeQty[s.size] = (sizeQty[s.size] || 0) + s.quantity;
      for (const code in sizeQty) {
        if (sizeMap[code].available < sizeQty[code])
          return res.status(409).json({ error: `not enough ${code} sandwiches` });
      }

      // Recompute price server-side (ignore any price from client)
      let subtotal = 0;
      let nSand = 0;
      const computed = sandwiches.map(s => {
        const size = sizeMap[s.size];
        const extras = Math.max(0, s.ingredient_ids.length - size.included_ingredients);
        const unitPrice = round2(size.base_price * (1 + 0.30 * extras));
        subtotal += unitPrice * s.quantity;
        nSand += s.quantity;
        return { ...s, unitPrice };
      });
      const orderTotal = nSand >= 4 ? round2(subtotal * 0.80) : round2(subtotal);

      // Credit check
      if (req.user.credit < orderTotal)
        return res.status(422).json({ error: 'insufficient credit' });

      // Insert order + sandwiches
      const orderId = await dao.createOrder(req.user.id, orderTotal);
      for (const s of computed) {
        const sandwichId = await dao.createSandwich(
          orderId, s.size, s.main_id, s.bread_id, s.quantity, s.unitPrice
        );
        for (const ingId of s.ingredient_ids)
          await dao.addSandwichIngredient(sandwichId, ingId);
        for (const drId of s.dressing_ids)
          await dao.addSandwichDressing(sandwichId, drId);
      }

      // Deduct credit
      const newCredit = round2(req.user.credit - orderTotal);
      await dao.updateUserCredit(req.user.id, newCredit);

      res.status(201).json({ id: orderId, total: orderTotal, credit: newCredit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get('/api/orders', isLoggedIn, async (req, res) => {
  try {
    const orders = await dao.getOrdersByUser(req.user.id);
    const result = [];
    for (const order of orders) {
      const sandwiches = await dao.getSandwichesByOrder(order.id);
      const fullSandwiches = [];
      for (const s of sandwiches) {
        const ingredients = await dao.getIngredientsBySandwich(s.id);
        const dressings = await dao.getDressingsBySandwich(s.id);
        fullSandwiches.push({ ...s, ingredients, dressings });
      }
      result.push({ ...order, sandwiches: fullSandwiches });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', isLoggedIn, isTotp, async (req, res) => {
  try {
    const order = await dao.getOrderById(Number(req.params.id));
    // 404 for not found OR wrong owner - never reveal existence to non-owner
    if (!order || order.user_id !== req.user.id)
      return res.status(404).json({ error: 'Order not found.' });

    // Delete in FK dependency order
    const sandwiches = await dao.getSandwichesByOrder(order.id);
    for (const s of sandwiches) {
      await dao.deleteSandwichDressings(s.id);
      await dao.deleteSandwichIngredients(s.id);
    }
    await dao.deleteOrderSandwiches(order.id);
    await dao.deleteOrder(order.id);

    // 90% refund
    const refund = round2(order.total * 0.9);
    const newCredit = round2(req.user.credit + refund);
    await dao.updateUserCredit(req.user.id, newCredit);

    res.json({ credit: newCredit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
