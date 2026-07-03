module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    google_client_id: (process.env.GOOGLE_CLIENT_ID || '').trim()
  });
};
