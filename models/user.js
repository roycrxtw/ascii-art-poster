

var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

// create a schema
var userSchema = mongoose.Schema({
	authId: String,
	name: String,
	password: String,
	email: String,
	created: Date,	//date of created. new Date.toString()
	avatorPath: String
});

var User = mongoose.model('User', userSchema);

// make this available to our users in our Node applications
module.exports = User;