// app/routes/index.js

const url = require('url');

const cors = require('../helpers/cors');
const extendResponse = require('../helpers/response');
const { getChannels } = require('../controllers/channels');
const { getProgramsByChannel } = require('../controllers/programs');
const { getHealth } = require('../controllers/health');
const { getCountries } = require('../controllers/countries');

const router = (req, res) => {
  const { pathname } = url.parse(req.url, true);
  if (pathname === '/api/channels' && req.method === 'GET') {
    return getChannels(req, res);
  }

  if (pathname.match('^/api/channels/.{1,}/programs$') && req.method === 'GET') {
    return getProgramsByChannel(req, res);
  }

  if (pathname === '/health' && req.method === 'GET') {
    return getHealth(req, res);
  }

  if (pathname === '/api/countries' && req.method === 'GET') {
    return getCountries(req, res);
  }

  return res.status(404).end('Not Found');
};

module.exports = cors(extendResponse(router));
