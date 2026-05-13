const axios = require('axios');

const client = axios.create({
  baseURL: 'https://kodikapi.com',
  timeout: 15000
});

function getToken() {
  const token = process.env.KODIK_TOKEN;
  if (!token) {
    const err = new Error('KODIK_TOKEN is not configured');
    err.status = 500;
    throw err;
  }
  return token;
}

async function kodikGet(path, params = {}) {
  const token = getToken();
  const response = await client.get(path, { params: { token, ...params } });
  return response.data;
}

module.exports = { kodikGet };
