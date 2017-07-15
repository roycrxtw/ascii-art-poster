
'use strict';

var serverConfig = require('./config/main.config');

const LOG_LEVEL = require('./config/main.config').LOG_LEVEL;
var log = require('bunyan').createLogger({
	name: 'index',
	streams: [{
		level: LOG_LEVEL,
		path: 'log/grumbler.log'
	}]
});

//var https = require('https');
var fs = require('fs');
var express = require('express');
//var subdomain = require('express-subdomain');
var handlebars = require('express-handlebars').create({
	defaultLayout: 'main'
});
var	bodyParser = require('body-parser');
var session = require('express-session');

// passport module for authentication(Facebook and google).
var passport = require('passport');
var Strategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;

// facebook passport strategy
passport.use(new Strategy({
	clientID: serverConfig.facebookClientID,
	clientSecret: serverConfig.facebookClientSecret,
	callbackURL: serverConfig.facebookCallbackURL,
	profileFields: ['id', 'name', 'emails', "age_range", "displayName", "about", "gender"]
}, function(accessToken, refreshToken, profile, cb) {
	return cb(null, profile);
}));

passport.use(new GoogleStrategy({
	clientID: serverConfig.googleClientID,
	clientSecret: serverConfig.googleClientSecret,
	callbackURL: serverConfig.googleCallbackURL
}, function(accessToken, refreshToken, profile, cb) {
	return cb(null, profile);
}));
passport.serializeUser(function(user, cb) { cb(null, user);});
passport.deserializeUser(function(obj, cb) { cb(null, obj);});

var app = express();

app.use(session({
	cookie: { secure: false },
	resave: false,
	saveUninitialized: true,
	secret: 'rockstone'
}));
app.use(express.static(__dirname + '/public'));

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views')

// setup time log middleware for response time recording.
app.use(require('./services/time-log'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
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

// Use for temporary data between redirect
app.use(function(req, res, next){
	if(req.session.fields){
		log.debug({tmp: req.session.fields}, 'Print middleware: req.session.fields');
		
		//res.locals.tmp = req.session.tmp;
		//log.debug({locals: res.locals}, 'Print locals');
		//delete req.session.tmp;
	}
	next();
});

// flash message middleware.
app.use(function(req, res, next){
	if(req.session.flash){
		res.locals.flash = req.session.flash;
		log.debug({locals: res.locals}, 'Print locals');
		delete req.session.flash;
	}
	next();
});

app.set('env', 'development');
app.set('port', 3002);

// setup subdomain in production time
//if(app.get('env') === 'production'){
//	app.use(subdomain('grumbler', require('./controllers/dispatcher')));
//}else{
//	app.use(require('./controllers/dispatcher'));
//}

app.use(require('./controllers/dispatcher'));

app.listen(app.get('port'), function(){
	log.info('------------------------------');
	log.info('Express server started in %s on port %s. baseurl=%s', 
			app.get('env'), app.get('port'), serverConfig.baseurl);
	log.info('伺服器已啟動');
});

//var httpsOpt = {
//	key: fs.readFileSync(serverConfig.mainkey),
//	cert: fs.readFileSync(serverConfig.maincert)
//};

// setup HTTPS server
//https.createServer(httpsOpt, app).listen(app.get('port'), function(){
//	log.info('------------------------------');
//	log.info('Express server started in %s on port %s. baseurl=%s', 
//			app.get('env'), app.get('port'), serverConfig.baseurl);
//	log.info('伺服器已啟動');
//});