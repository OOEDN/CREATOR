// routes/creatorAuthRoutes.js — Creator login, signup, invite, password management
import { Router } from 'express';

export default function createCreatorAuthRoutes({ firestoreDAL, bcrypt, jwt, JWT_SECRET, JWT_EXPIRY, BCRYPT_ROUNDS, readMasterDB, writeMasterDB, scopeDataForCreator, creatorAuthMiddleware }) {
  const router = Router();

  // POST /api/creator/login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const inputEmail = email.toLowerCase().trim();
      const inputPassword = password.trim();

      const account = await firestoreDAL.getAccountByEmail(inputEmail);
      if (!account) {
        console.log(`[CreatorAuth] Login failed — no account for: ${inputEmail}`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      let passwordValid = false;
      if (account.password.startsWith('$2a$') || account.password.startsWith('$2b$')) {
        passwordValid = await bcrypt.compare(inputPassword, account.password);
      } else {
        passwordValid = account.password === inputPassword;
        if (passwordValid) {
          console.log(`[CreatorAuth] Auto-upgrading plain-text password for: ${inputEmail}`);
          const hashed = await bcrypt.hash(inputPassword, BCRYPT_ROUNDS);
          await firestoreDAL.updateAccount(account.id, { password: hashed });
        }
      }

      if (!passwordValid) {
        console.log(`[CreatorAuth] Login failed — wrong password for: ${inputEmail}`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const db = await readMasterDB();
      const creatorRecord = (db?.creators || []).find(c =>
        c.id === account.linkedCreatorId ||
        c.email?.toLowerCase() === account.email.toLowerCase() ||
        c.portalEmail?.toLowerCase() === account.email.toLowerCase()
      );

      const token = jwt.sign(
        { accountId: account.id, email: account.email, creatorId: creatorRecord?.id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      console.log(`[CreatorAuth] ✅ Login success: ${inputEmail}`);

      const scopedData = db ? scopeDataForCreator(db, creatorRecord) : {};

      res.json({
        token,
        account: { id: account.id, email: account.email, displayName: account.displayName, onboardingComplete: account.onboardingComplete, betaLabIntroSeen: account.betaLabIntroSeen, linkedCreatorId: account.linkedCreatorId },
        ...scopedData
      });
    } catch (e) {
      console.error('[CreatorAuth] Login error:', e);
      res.status(500).json({ error: 'Server error during login' });
    }
  });

  // POST /api/creator/signup
  router.post('/signup', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });
      if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

      const inputEmail = email.toLowerCase().trim();
      const existingAccount = await firestoreDAL.getAccountByEmail(inputEmail);
      if (existingAccount) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);

      const newCreator = {
        id: crypto.randomUUID(),
        name: name.trim(),
        handle: '@' + inputEmail.split('@')[0],
        platform: 'Instagram',
        profileImage: '',
        notes: 'Self-registered via Creator Portal',
        status: 'Active',
        paymentStatus: 'Unpaid',
        paymentOptions: [],
        rate: 0,
        email: inputEmail,
        dateAdded: new Date().toISOString(),
        rating: null,
        flagged: false,
        shipmentStatus: 'None',
        role: 'creator',
        portalEmail: inputEmail,
        notificationsEnabled: false,
        totalEarned: 0,
        lastActiveDate: new Date().toISOString(),
      };

      const newAccount = {
        id: crypto.randomUUID(),
        email: inputEmail,
        password: hashedPassword,
        displayName: name.trim(),
        createdAt: new Date().toISOString(),
        linkedCreatorId: newCreator.id,
      };

      await firestoreDAL.addAccount(newAccount);

      const db = await readMasterDB();
      if (db) {
        db.creators = [...(db.creators || []), newCreator];
        db.lastUpdated = new Date().toISOString();
        db.version = Date.now();
        writeMasterDB(db).catch(e => console.warn('[CreatorAuth] GCS write failed:', e));
      }

      const token = jwt.sign(
        { accountId: newAccount.id, email: newAccount.email, creatorId: newCreator.id },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      console.log(`[CreatorAuth] ✅ Signup success: ${inputEmail} (Firestore)`);

      const scopedData = db ? scopeDataForCreator(db, newCreator) : {};

      res.status(201).json({
        token,
        account: { id: newAccount.id, email: newAccount.email, displayName: newAccount.displayName, onboardingComplete: false, linkedCreatorId: newCreator.id },
        ...scopedData
      });
    } catch (e) {
      console.error('[CreatorAuth] Signup error:', e);
      res.status(500).json({ error: 'Server error during signup' });
    }
  });

  // GET /api/creator/me (JWT protected)
  router.get('/me', creatorAuthMiddleware, async (req, res) => {
    try {
      const account = await firestoreDAL.getAccountById(req.creatorAccountId);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const db = await readMasterDB();
      const creatorRecord = (db?.creators || []).find(c =>
        c.id === account.linkedCreatorId ||
        c.email?.toLowerCase() === account.email.toLowerCase() ||
        c.portalEmail?.toLowerCase() === account.email.toLowerCase()
      );

      const scopedData = db ? scopeDataForCreator(db, creatorRecord) : {};

      res.json({
        account: { id: account.id, email: account.email, displayName: account.displayName, onboardingComplete: account.onboardingComplete, betaLabIntroSeen: account.betaLabIntroSeen, linkedCreatorId: account.linkedCreatorId },
        ...scopedData
      });
    } catch (e) {
      console.error('[CreatorAuth] /me error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/creator/invite
  router.post('/invite', async (req, res) => {
    try {
      const { email, name, creatorId, plainPassword } = req.body;
      if (!email || !name || !plainPassword) return res.status(400).json({ error: 'Email, name, and password required' });

      const inputEmail = email.toLowerCase().trim();
      const existing = await firestoreDAL.getAccountByEmail(inputEmail);
      if (existing) {
        return res.status(409).json({ error: 'Account already exists for this email' });
      }

      const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

      const newAccount = {
        id: crypto.randomUUID(),
        email: inputEmail,
        password: hashedPassword,
        displayName: name,
        createdAt: new Date().toISOString(),
        linkedCreatorId: creatorId || undefined,
        invitedByTeam: true,
        inviteEmailSent: false,
      };

      await firestoreDAL.addAccount(newAccount);

      if (creatorId) {
        const db = await readMasterDB();
        if (db) {
          db.creators = (db.creators || []).map(c =>
            c.id === creatorId ? { ...c, portalEmail: inputEmail } : c
          );
          db.lastUpdated = new Date().toISOString();
          db.version = Date.now();
          writeMasterDB(db).catch(e => console.warn('[CreatorAuth] GCS update failed:', e));
        }
      }

      console.log(`[CreatorAuth] ✅ Invite created for: ${inputEmail} (Firestore)`);
      res.status(201).json({ success: true, accountId: newAccount.id });
    } catch (e) {
      console.error('[CreatorAuth] Invite error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/creator/change-password (JWT protected)
  router.post('/change-password', creatorAuthMiddleware, async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const account = await firestoreDAL.getAccountById(req.creatorAccountId);
      if (!account) return res.status(404).json({ error: 'Account not found' });

      const hashed = await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS);
      await firestoreDAL.updateAccount(account.id, { password: hashed });

      console.log(`[CreatorAuth] ✅ Password changed by creator: ${account.email}`);
      res.json({ success: true });
    } catch (e) {
      console.error('[CreatorAuth] Change password error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/creator/migrate-passwords (one-time admin utility)
  router.post('/migrate-passwords', async (req, res) => {
    try {
      const { adminKey } = req.body;
      if (adminKey !== 'ooedn-migrate-2026') return res.status(403).json({ error: 'Unauthorized' });

      const db = await readMasterDB();
      if (!db) return res.status(503).json({ error: 'Unable to connect to database' });

      const accounts = db.creatorAccounts || [];
      let migrated = 0;

      for (const account of accounts) {
        if (!account.password.startsWith('$2a$') && !account.password.startsWith('$2b$')) {
          account.password = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
          migrated++;
        }
      }

      if (migrated > 0) {
        db.creatorAccounts = accounts;
        db.lastUpdated = new Date().toISOString();
        db.version = Date.now();
        await writeMasterDB(db);
      }

      console.log(`[CreatorAuth] Migrated ${migrated}/${accounts.length} passwords to bcrypt`);
      res.json({ success: true, migrated, total: accounts.length });
    } catch (e) {
      console.error('[CreatorAuth] Migration error:', e);
      res.status(500).json({ error: 'Migration failed' });
    }
  });

  // POST /api/creator/reset-password (admin utility)
  router.post('/reset-password', async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) return res.status(400).json({ error: 'email and newPassword required' });

      const account = await firestoreDAL.getAccountByEmail(email.toLowerCase().trim());
      if (!account) return res.status(404).json({ error: `No account found for ${email}` });

      const hashed = await bcrypt.hash(newPassword.trim(), BCRYPT_ROUNDS);
      await firestoreDAL.updateAccount(account.id, { password: hashed });

      console.log(`[CreatorAuth] ✅ Password reset for: ${email}`);
      res.json({ success: true, email, accountId: account.id });
    } catch (e) {
      console.error('[CreatorAuth] Reset password error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/creator/delete-account (admin utility)
  router.post('/delete-account', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      const account = await firestoreDAL.getAccountByEmail(email.toLowerCase().trim());
      if (!account) return res.status(404).json({ error: `No account found for ${email}` });

      await firestoreDAL.deleteAccount(account.id);

      console.log(`[CreatorAuth] 🗑️ Deleted account: ${email}`);
      const remaining = await firestoreDAL.getAllAccounts();
      res.json({ success: true, deleted: email, remaining: remaining.length });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // POST /api/creator/debug-login (debug: test password without logging in)
  router.post('/debug-login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const account = await firestoreDAL.getAccountByEmail(email.toLowerCase().trim());
      if (!account) return res.json({ found: false, message: 'No account found', source: 'firestore' });

      const storedHash = account.password;
      const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$');
      const inputTrimmed = password.trim();

      let result = false;
      if (isBcrypt) {
        result = await bcrypt.compare(inputTrimmed, storedHash);
      } else {
        result = storedHash === inputTrimmed;
      }

      res.json({
        found: true,
        source: 'firestore',
        email: account.email,
        isBcrypt,
        hashPrefix: storedHash.substring(0, 10) + '...',
        inputLength: inputTrimmed.length,
        passwordMatch: result
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/creator/accounts-check (admin debug - no passwords)
  router.get('/accounts-check', async (req, res) => {
    try {
      const allAccounts = await firestoreDAL.getAllAccounts();
      const accounts = allAccounts.map(a => ({
        id: a.id, email: a.email, displayName: a.displayName, createdAt: a.createdAt,
        linkedCreatorId: a.linkedCreatorId, invitedByTeam: a.invitedByTeam,
        hasHashedPassword: a.password?.startsWith('$2') || false
      }));
      res.json({ count: accounts.length, accounts, source: 'firestore' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to check accounts' });
    }
  });

  return router;
}
