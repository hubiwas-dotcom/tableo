const https  = require('https');
const crypto = require('crypto');

function verifyGoogleToken(credential) {
  return new Promise((resolve) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          if (info.error || !info.email) resolve(null);
          else resolve(info);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const { credential, trial_start } = req.body || {};
  if (!credential) {
    res.status(400).json({ error: 'Brak tokenu Google.' }); return;
  }

  const userInfo = await verifyGoogleToken(credential);
  if (!userInfo) {
    res.status(401).json({ error: 'Nieprawidłowy token Google.' }); return;
  }

  const secret = process.env.TOKEN_SECRET || 'tableo-secret-key-change-me';
  const ts     = trial_start || Date.now();

  const payload = Buffer.from(JSON.stringify({
    email:       userInfo.email,
    name:        userInfo.name  || '',
    picture:     userInfo.picture || '',
    google_sub:  userInfo.sub,
    trial_start: ts,
    iat:         Date.now()
  })).toString('base64');

  const sig   = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = `${payload}.${sig}`;

  res.json({
    ok:          true,
    token,
    email:       userInfo.email,
    name:        userInfo.name    || '',
    picture:     userInfo.picture || '',
    trial_start: ts
  });
};
