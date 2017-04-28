
// User collection handler

'use strict';

var mongoose = require('mongoose');
var config = require('../config/db.config');

const LOG_LEVEL = require('../config/main.config').LOG_LEVEL;
var bunyan = require('bunyan');
var log = bunyan.createLogger({
	name: 'connector',
	streams: [{
		level: LOG_LEVEL,
		path: 'log/grumbler.log'
	}]
});


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
	log.info('[mongoose] Mongodb is opened');
});
conn.on('disconnected', function(err){
	log.error({error: err}, '[mongoose] disconnected event.');
});
conn.on('error', function(err){
	log.error({error: err}, '[mongoose] error event.');
});

exports.conn = conn;