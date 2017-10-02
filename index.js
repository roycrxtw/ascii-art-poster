
/**
 * Project Grumbler
 * Entry point
 * @author Roy Lu
 * Sep, 2017
 */

'use strict';

const config = require('./config/main.config');
const LOG_LEVEL = config.LOG_LEVEL;
const PORT = config.port;

var log = require('bunyan').createLogger({
	name: 'index',
	streams: [{
		level: LOG_LEVEL,
		path: 'log/grumbler.log'
	}]
});

var debug = require('debug')('main');

var express = require('express');
var handlebars = require('express-handlebars').create({
	defaultLayout: 'main'
});

// Set up passport middleware module for authentication(Facebook and google).
var passport = require('passport');
var Strategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;

// facebook passport strategy
passport.use(new Strategy({
	clientID: config.facebookClientID,
	clientSecret: config.facebookClientSecret,
	callbackURL: config.facebookCallbackURL,
	profileFields: ['id', 'name', 'emails', "age_range", "displayName", "about", "gender"]
}, function(accessToken, refreshToken, profile, cb) {
	return cb(null, profile);
}));

passport.use(new GoogleStrategy({
	clientID: config.googleClientID,
	clientSecret: config.googleClientSecret,
	callbackURL: config.googleCallbackURL
}, function(accessToken, refreshToken, profile, cb) {
	return cb(null, profile);
}));
passport.serializeUser(function(user, cb) { cb(null, user);});
passport.deserializeUser(function(obj, cb) { cb(null, obj);});

var app = express();
var session = require('express-session');
app.use(session({
  cookie: { secure: false },
  resave: false,
  saveUninitialized: true,
  secret: 'rockstone'
}));
app.use(express.static(__dirname + '/public'));

var	bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');

// setup time log middleware for response time recording.
//app.use(require('./services/time-log'));

app.use(passport.initialize());
app.use(passport.session());

// Set information from session
app.use(function(req, res, next){
	if(req.session.uid){
		res.locals.uid = req.session.uid;
		res.locals.displayName = req.session.uname;
	}
	next();
});


// flash variable handler middleware.
app.use(function(req, res, next){
	if(req.session.flash){
		res.locals.flash = req.session.flash;
		log.debug({locals: res.locals}, 'Print locals');
		delete req.session.flash;
	}

	if(req.session.cachedAccount){
		res.locals.cachedAccount = req.session.cachedAccount;
		delete req.session.cachedAccount;
	}

	next();
});

app.set('env', config.env);

app.use(require('./controllers/dispatcher'));

app.listen(PORT, function(){
  log.info('------------------------------');
  log.info('Express server started in %s on port %s. baseurl=%s', 
      app.get('env'), PORT, config.baseurl);
  log.info('伺服器已啟動');
});
