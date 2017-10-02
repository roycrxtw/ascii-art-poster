
/**
 * Project Grumbler
 * A password handling service.
 * This module uses bcrypt to hash/compare passwords.
 * @author Roy Lu
 * Sep, 2017
 */

'use strict';

var bcrypt = require('bcrypt');

/**
 * 
 * @param {string} plainPassword 
 * @param {string} hashedPassword
 * @return {boolean} true if passwords are same.
 */
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