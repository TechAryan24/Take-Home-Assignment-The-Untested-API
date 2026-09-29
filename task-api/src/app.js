const express = require('express');
const path = require('path');
const taskRoutes = require('./routes/tasks');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/tasks', taskRoutes);


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}


module.exports = app;
