/**
 * Data access object for the user collection.
 * @author Roy Lu(royvbtw)
 * Sep, 2017
 */

'use strict';

const LOG_LEVEL = require('../config/main.config').LOG_LEVEL;
var log = require('bunyan').createLogger({
	name: 'user-dao',
	streams: [{
		level: LOG_LEVEL,
		path: 'log/grumblers.log'
	}]
});

var UserModel = require('../models/user');

// provide CRUD methods as a dao interface
exports.countUsers = countUsers;
exports.createUser = createUser;
exports.findUserById = findUserById;
exports.updateUser = updateUser;
exports.deleteUserById = deleteUserById;


/**
 * Get user counts.
 * @return {Promise<number>} Resolve user counts if query success.
 */
function countUsers(){
	return new Promise( (resolve, reject) => {
		UserModel.count({}, function(err, count){
			if(err){
				log.error({err}, 'countUser() error');
				return reject('error');
			}
			return resolve(count);
		});
	});
}


/**
 * Create user doc using predefined UserModel.
 * This method is not responsible for data vaildation.
 * @param {object} user A user ojbect which will be save into database
 * @return {Promise<object>} Resolve a user document object when process
 * success.
 */
function createUser(user){
	return new Promise( (resolve, reject) => {
		new UserModel(user).save(function(err, doc){
			if(err){
				log.error({err}, 'createUser() error');
				return reject('error');
			}
			return resolve(doc);
		});
	});
}


/**
 * Find a user by user id
 * @param {string} uid User id
 * @return {Promise<user|error>} Resolve a user object, or a null doc object 
 * if found nothing.
 */
function findUserById(uid){
	return new Promise( (resolve, reject) => {
		if(typeof uid !== 'string'){
			throw new TypeError('The uid argument should be a string');
		}
		
		UserModel.findOne({authId: uid}, function(err, user){
			if(err){
				log.error({uid, err}, 'Error in findUserById()');
				return reject('error');
			}
			return resolve(user);
		});
	});
}


/**
 * Delete the specific user
 * @param {string} uid user id
 * @return {Promise<boolean|error>} Resolve true if 
 *		delete is successful. Or resolve false if no any match.
 */
function deleteUserById(uid){
	return new Promise(function(resolve, reject){
		if(typeof uid !== 'string'){
			throw new TypeError('The uid argument should be a string');
		}
		
		UserModel.findOneAndRemove({authId: uid}, function(err, doc){
			if(err){
				log.error({uid, err}, 'Error in deleteUserById()');
				return reject('error');
			}
			if(doc){
				return resolve(true);
			}else{
				return resolve(false);
			}
		});
	});
}


/**
 * Update the specific user
 * @param {object} user
 * @return {Promise<user|error>} Resolve the user obejct if update success. Or
 * resolve null if no any match.
 */
function updateUser(user){
	return new Promise( (resolve, reject) => {
		// Remember: DAO does not validate user data
		// You should do it in the service layer.
		let opt = {
			'new': true
		};
		
		UserModel.findOneAndUpdate({authId: user.authId}, user, opt, function(err, doc){
			if(err){
				log.error({err}, 'Error in updateUser()');
				return reject('error');
			}
			resolve(doc);
		});
	});
}
