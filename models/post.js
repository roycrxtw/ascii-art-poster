
var mongoose = require('mongoose');

mongoose.Promise = global.Promise;

// create a schema
var postSchema = mongoose.Schema({
	title: String,
	content: String,
	category: String,
	user:{
		authId: String,
		name: String
	},
	created: Date,		//date of created. new Date.toString()
	expiry: Date,
	anonymous: Boolean
});

var post = mongoose.model('post', postSchema);

// make this available to the Node applications
module.exports = post;