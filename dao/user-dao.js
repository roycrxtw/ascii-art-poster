
// Data access object for 

'use strict';


var UserModel = require('../models/user');

// provide CRUD methods as a dao interface
exports.countUsers = countUsers;
exports.createUser = createUser;
exports.findUserById = findUserById;
exports.updateUser = updateUser;
exports.deleteUserById = deleteUserById;


/**
 * Return total users
 * @return {Promise<number>} Total number of users
 */
function countUsers(){
	return new Promise( (resolve, reject) => {
		UserModel.count({}, function(err, count){
			if(err){
				console.log('[user-dao] err=', err);
				return reject('db error');
			}
			return resolve(count);
		});
	});
}

/**
 * Create user doc using predefined UserModel.
 * This method doesn't responsible for data vaildation.
 * @param {Object} user ojbect which will be save into database
 * @return {Promise} A promise object which can be used by further process.
 */
function createUser(user){
	return new Promise(function(resolve, reject){
		new UserModel(user).save(function(err, doc){
			if(err){
				errorHandler(err, 'createUser.save()');
				return reject('[user-dao] Error in database process.');
			}
			return resolve(doc);
		});
	});
}

function errorHandler(ex, msg){
	console.error('[user-dao] error in database process:', msg);
	if(ex){
		console.log(ex.toString);
	}
}

/* 
 * Find a user by user id(uid)
 * @param {string} uid User id
 * @return {Promise<user|error>} Resolve a user object, or a null doc object 
 * if user is not found.
 */
function findUserById(uid){
	return new Promise( (resolve, reject)=>{
		if(typeof uid !== 'string'){
			errorHandler(null, 'uid should be a string.');
			return reject('user object is not valid');
		}
		
		UserModel.findOne({authId: uid}, function(err, result){
			if(err){
				errorHandler(err, 'findUserById()');
				return reject('database error');		//#todo-roy: more specific msg?
			}
			return resolve(result);
		});
	});
}

/**
 * Delete the specific user
 * @param {Object} uid user id
 * @return {Promise<true|error>} Promise object. It will resolve if delete is 
 *		successful.
 */
function deleteUserById(uid){
	return new Promise(function(resolve, reject){
		// 不做validation，只做基本確認uid是String
		if(typeof uid !== 'string') return reject('uid is not a string.');
		UserModel.findOneAndRemove({authId: uid}, function(err, doc){
			if(err){
				errorHandler(err, 'deleteUserById()');
				return reject('dao error');
			}
			if(doc){
				return resolve(true);
			}else{
				return reject('No such user');
			}
		});
	});
}


/**
 * Update the specific user
 * @param {object} user
 * @return {Promise<user|error>} Resolve the user obejct if update is successful.
 */
function updateUser(user){
	return new Promise( (resolve, reject) => {
		// Remember: DAO does not validate user data
		// You should do it in the service layer.
		var opt = {
			'new': true
		};
		
		UserModel.findOneAndUpdate({authId: user.authId}, user, opt, function(err, doc){
			if(err){
				errorHandler(err, 'updateUser()');
				return reject();
			}
			if(doc){
				return resolve(doc);
			}else{
				console.log('[user-dao] Doc is null after updateUser()');
				return reject('failed');
			}
		});
	});
}