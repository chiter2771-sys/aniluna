const axios = require('axios');

const client = axios.create({
  baseURL: 'https://kodik-api.com',
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
  try {
    const response = await client.get(path, { params: { token, ...params } });
    return response.data;
  } catch (error) {
    const wrapped = new Error('Kodik upstream is unavailable');
    wrapped.status = 502;
    wrapped.cause = error;
    throw wrapped;
  }
}

module.exports = { kodikGet };
