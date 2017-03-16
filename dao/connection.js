
// User collection handler

'use strict';

var mongoose = require('mongoose');
var config = require('../config/main.config');


// this setting is recommended by mLab.
var options = {
	server: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 50000 } },
	replset: { socketOptions: { keepAlive: 300000, connectTimeoutMS : 50000 } }
};  

// create a connection to mongodb
mongoose.Promise = global.Promise;
mongoose.connect(config.dburl, options);
var conn = mongoose.connection;

// connect events
conn.once('open', function(){
	console.log('[mongoose] Mongodb is opened');
});
conn.on('disconnected', function(err){
	console.log('[mongoose] disconnected:', err.toString());
});
conn.on('error', function(err){
	console.log('[mongoose] error:', err);
});

exports.conn = conn;