
// A password handler interface.
// This module use bcrypt to hash/compare passwords.

'use strict';

var bcrypt = require('bcrypt');

async function compare(plainPassword, hashedPassword){
	return await bcrypt.compare(plainPassword, hashedPassword);
}

async function hash(data, salt){
	return await bcrypt.hash(data, salt);
}

async function generateSalt(round){
	let salt = await bcrypt.genSalt(round);
	return salt;
}

module.exports.compare = compare;
module.exports.generateSalt = generateSalt;
module.exports.hash = hash;