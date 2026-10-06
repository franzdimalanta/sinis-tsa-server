const express = require('express');
const cors = require('cors');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173' }));

app.get('/api/health', (req, res) => {
  res.json({ message: 'BrewLogic API is running' });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
