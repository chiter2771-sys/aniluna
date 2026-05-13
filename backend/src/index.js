require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const { errorHandler, notFound } = require('./middleware/errors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`AniLuna backend started on port ${port}`);
});
