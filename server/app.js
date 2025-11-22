require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../client/views'));

// Simple routes to test your pages
app.get('/', (req, res) => {
  res.send('<h1>BabyStar App</h1><a href="/login">Login</a> | <a href="/register">Register</a>');
});

app.get('/login', (req, res) => {
  res.render('pages/auth/login');
});

app.get('/register', (req, res) => {
  res.render('pages/auth/register');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📄 Login page: http://localhost:${PORT}/login`);
  console.log(`📄 Register page: http://localhost:${PORT}/register`);
});
