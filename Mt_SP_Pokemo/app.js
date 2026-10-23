const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const requestLogger = require('morgan');

const server = express();

// Middleware
server.use(express.static(path.join(__dirname, 'public')));
server.use(express.urlencoded({ extended: false }));
server.use(requestLogger('dev'));

// EJS template engine and layouts
server.use(expressLayouts);
server.set('view engine', 'ejs');
server.set('views', path.join(__dirname, 'views'));
server.set('layout', 'layouts/main');

// Routes
server.get('/', (request, response) => {
  response.render('index', { title: 'Pokemo', text: 'Willkommen bei Pokemo.' });
});

server.get('/glutox', (request, response) => {
  response.render('index', { title: 'Glutox', text: 'Glutox' });
});

server.get('/pokecross', (request, response) => {
  response.render('index', { title: 'Pokecross', text: 'Pokecross' });
});

module.exports = server;