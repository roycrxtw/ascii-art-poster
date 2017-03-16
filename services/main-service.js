
'use strict';

var conn = require('../dao/connection');
var userDao = require('../dao/user-dao');
var postDao = require('../dao/post-dao');
var data = require('./expiryData');
var mainConfig = require('../config/main.config');

var request = require('request');

var log = log;
var standardRejectMessage = '服務暫時無法使用，請稍後重試。';

exports.about = about;
exports.createAndLoginFbUser = createAndLoginFbUser;
exports.createAndLoginGoogleUser = createAndLoginGoogleUser;
exports.createAppUser = createAppUser;
exports.deleteUser = deleteUser;
exports.getUser = getUser;
exports.getUserInfo = getUserInfo;
exports.updateUserName = updateUserName;
exports.login = login;
exports.createPost = createPost;
exports.getPost = getPost;
exports.getPosts = getPosts;
exports.getPostsByUser = getPostsByUser;
exports.updatePost = updatePost;
exports.deletePost = deletePost;
exports.countPosts = countPosts;

exports.test = test;


function countPosts(uid){
	return new Promise( (resolve, reject) => {
		postDao.countPosts({'user.authId': uid}).then( (count) => {
			return resolve(count);
		}).catch( ex => {
			return reject( standardRejectMessage );
		});
	});
}

/**
 * To create and/or login Facebook user. The argument is a profile object 
 * parsed by passport-facebook module.
 * @param {Object} profile object. Parsed by passport-facebook module.
 * @return {Object} A promise object.
 */
function createAndLoginFbUser(profile){
	return new Promise( (resolve, reject) => {
		console.log('[service] createAndLoginFbUser(), fb-id=', profile.id);
		var authId = 'fb:' + profile.id;
		
		getUser(authId).then( (doc) => {
			if(doc){
				console.log('The facebook user is exist. Updating user name.');
				return resolve(doc);
			}else{
				var preparedUser = {
					authId: authId,
					name: profile['_json'].name,
					password: null,
					email: profile['_json'].email || '0',
					created: new Date(),
					avator: 'nopath'	// Pre-reserved field.
				};
				
				// create fb user to database
				doCreateUser(preparedUser).then( (doc) => {
					return resolve(doc);
				}).catch( ex => {
					console.log('[service] createAndLoginFbUser, ex=', ex);
					return reject('暫時無法為您服務，請稍後再試。');
				});
			}
		}).catch( (ex) => {
			console.log('[service] ex', ex);
			return  reject('暫時無法為您服務，請稍後再試。');
		});
	});
}

/**
 * To create and/or login Google OAuth user. User info(google id, name and 
 * email will be stored into database.
 * @param {Object} profile
 * @return {Promise}
 */
function createAndLoginGoogleUser(profile){
	return new Promise( (resolve, reject) => {
		console.log('[service] createAndLoginGoogleUser(), google-id=', profile.id);
		var authId = 'google:' + profile.id;
		

		getUser(authId).then( (doc) => {
			if(doc){
				return resolve(doc);
			}else{
				var preparedUser = {
					authId: authId,
					name: profile.displayName || profile['_json'].name,
					password: null,
					email: profile['_json'].email || '0',
					created: new Date(),
					avator: 'nopath'	// Pre-reserved field.
				};
				
				// Create google user to database
				doCreateUser(preparedUser).then( (doc) => {
					return resolve(doc);
				}).catch( ex => {
					console.log('[service] createAndLoginGoogleUser, ex=', ex);
					return reject( standardRejectMessage );
				});
			}
		}).catch( (ex) => {
			console.log('[service] ex', ex);
			return  reject( standardRejectMessage );
		});
	});

}

/**
 * Wrapper function
 * @param {object} user
 * @return {Object} a Promise object
 */
function createAppUser(user){
	return new Promise(function(resolve, reject){
		var preparedUser = {
			authId: 'app:' + user.account,
			name: user.name,
			password: user.password,
			email: user.email || '0',
			created: new Date(),
			avator: 'nopath'	// Pre-reserved field.
		};
		if(!validateUserFields(preparedUser)){
			return reject('您的欄位含有不允許的字元');
		}
		doCreateUser(preparedUser).then( doc => {
			return resolve(doc);
		}).catch(ex => {
			return reject(ex);
		});
	});
}

function log(msg, obj){
	console.log('[serivce] %s, obj=%s', msg, obj);
}

function test(){
	console.log('expiryData=', data.expiryData);
}

/**
 * Format date to yyyy/mm/dd-hh:mm
 * @param {Date} d A date object which will be format
 * @return {string} formattedDate formated date
 */
function formatDate(d){
	var formattedDate = d.getFullYear() + '/' + (d.getMonth() + 1) + '/'
			+ d.getDate() + ', ' + d.getHours() + ':' + d.getMinutes();
	return formattedDate;
}

/**
 * Validate user data(account, password, email) by regex patterns.
 * @param {object} user
 * @return {boolean} true if user data is valid
 */
function validateUserFields(user, opt){
	var check = {};
	if(opt === undefined){
		check = {
			authId: true,
			pwd: true,
			email: true
		};
	}else{
		check = {
			authId: opt.authId || false,
			email: opt.email || false,
			pwd: opt.password || false
		};
	}
	console.log('[service] validateUserFields()=', user);
	console.log('[service] validation opt=', check);
	var idPattern = /^(app|google|fb):[a-zA-Z0-9_-]{6,}[^_-]$/;
	var pwdPattern = /^[a-zA-Z0-9]{8,30}$/;
	// this email pattern is according to the w3c design
	var emailPattern = 
			/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
	
	var idResult = idPattern.test(user.authId);
	var pwdResult = pwdPattern.test(user.password);
	var emailResult = emailPattern.test(user.email);
	console.log('User data validate results: id=%s, pwd=%s, email=', 
			idResult, pwdResult, emailResult);

	if(check.authId && !idResult) return false;
	if(check.pwd && !pwdResult) return false;
	if(check.email && !emailResult) return false;
	return true;
}

/*
 * #need-review: Need to review the result of async-await syntax.
 * @return {nm$_main-service.about.main-serviceAnonym$2}
 */
async function about(){
	try{
		var userCount = await userDao.countUsers();
		var postCount = await postDao.countPosts({});
		var data = {userCount: userCount, postCount: postCount};
		//console.log('[service] about: data=', data);
		return data;
	}catch(ex){
		console.log(ex);
	}
	
	/*
	return new Promise( (resolve, reject) => {
		var userCount = await userDao.countUsers();
		
		
		
		var userPromise = userDao.countUsers();
		var postPromise = postDao.countPosts({});
		
		Promise.all([userPromise, postPromise]).then((values) => {
			var data = {
				userCount: values[0],
				postCount: values[1]
			};
			resolve(data);
		}).catch( (ex) => {
			reject(standardRejectMessage);
		});
	});
	*/
}

/**
 * 
 * @param {object} post
 * @return {Promise}
 */
function createPost(post){
	return new Promise( (resolve, reject) => {
		console.log('[service] createPost(), post=', post);
		
		// verify the google re-captcha
		var recaptchaOptions = {
			url: 'https://www.google.com/recaptcha/api/siteverify',
			form: {
				secret: mainConfig.recaptchaSecret,
				response: post.verify
			}
		};
		
		request.post(recaptchaOptions, function (error, response, body) {
			if(error){
				console.log('error=', error);
				return reject('Google re-captcha error.');
			}
			var verifyResult = JSON.parse(body);
			if(response.statusCode === 200 && verifyResult.success === true){
				var preparedPost = {
					title: post.title,
					content: post.content,
					user:{
						authId: post.uid,
						name: post.uname
					},
					created: new Date(),	//date of created. new Date.toString()
					expiry: new Date(new Date().getTime() + data.expiryData[post.expiry].offset),
					anonymous: post.ghost
				};
				console.log('preparedPost=', preparedPost);
				postDao.createPost(preparedPost).then( ()=> {
					return resolve('ok');
				}).catch( (ex) => {
					return reject('文章發表失敗，請重新再試');
				});
			}else{
				console.log('Google re-captcha check is failed.');
				return reject('Google re-captcha is invalid...');
			}
		});
		
		
		
	});
}



/**
 * #todo-roy: need to review.
 * @param {Object} user object
 * @return {Promise}
 */
function doCreateUser(user){
	return new Promise(function(resolve, reject){
		console.log('[service] doCreateUser(), user=', user);
		userDao.findUserById(user.authId).then(function(doc){
			if(doc){ return reject('本帳號已存在，請重新設定'); }
			// the user is not exist, continue to create the user
			userDao.createUser(user).then( (doc) => {
				return resolve(doc);
			}).catch( (ex) => {
				// db error, but don't directly send back to client
				console.log('[serivce] ex=', ex);
				return reject( standardRejectMessage );
			});

		}).catch( (ex) => {
			console.log('[service] createUser.ex=', ex);
			return reject('User register failed');
		});
	});
};

function deletePost(postId, currentId){
	// check if currentId === post.user.authId
	return new Promise( (resolve, reject) => {
		postDao.getPost(postId).then( (doc) => {
		if(doc.user.authId !== currentId){
			return reject('ID不相符');
		}else{
			postDao.deletePost(postId).then( () => {
				return resolve('ok');
			}).catch( (ex) => {
				return reject('failed');
			});
		}
	}).catch();
	});
	
}

/**
 * 
 * @param {object} user
 * @return {Promise}
 */
function deleteUser(uid){
	console.log('[service] deleteUser(), uid=', uid);
	return new Promise(function(resolve, reject){
		userDao.deleteUserById(uid).then( (doc) => {
			console.log('[service] deleteUser success.');
			return resolve('done');
		}).catch ( (ex) => {
			console.log('[service] deleteUser failed.');
			return reject('failed to delete user.');
		});
	});
}

//#todo-roy
function getPost(postId){}

function doGetPosts(conditions, selection = ''){
	return new Promise( (resolve, reject) => {
		postDao.listPosts(conditions, selection).then( (docs) => {
			console.log('[service] docs.length', docs.length);
			var d = new Date();
			for(var i in docs){
				docs[i].postId = docs[i]._id;	// remap _id to postId
				delete docs[i]._id;
				if(docs[i].anonymous){
					docs[i].user.authId = '0';
					docs[i].user.name = '這是個忍者!';
				}
				delete docs[i].anonymous;
				docs[i].created = formatDate(docs[i].created);
				if(docs[i].expiry){
					if(docs[i].expiry < d){
						docs[i].isExpired = true;
					}
					docs[i].expiry = formatDate(docs[i].expiry);
				}
				//console.log('[service] Modified doc[%s]=', i, docs[i]);
			}
			return resolve(docs);
		}).catch( (ex) => {
			console.log('[service] ', ex);
			return reject('本服務出錯囉');
		});
	});
}

function getPosts(limit){
	var conditions = {
		query: {
			expiry: {$gt: new Date()}
		},
		n: (typeof limit === 'number')? limit: 20
	};
	return doGetPosts(conditions, '-expiry -__v');
	
}

function getPostsByUser(uid){
	var conditions = {
		query: {
			'user.authId': uid
		},
		n: 20
	};
	return doGetPosts(conditions);
}

/**
 * 
 * @param {object} user
 * @return {Promise}
 */
function getUser(uid){
	return new Promise( (resolve, reject) => {
		console.log('[service] getUser, uid=', uid);
		if(uid === '0'){
			return reject('這是個忍者!');
		}
		if(!validateUserFields({id: uid}, {id: true})){
			console.error('不該有這個id:', uid);
			return reject('不該有這個id');
		}
		userDao.findUserById(uid).then( (result) => {
			console.log('[service] getUser(%s), result=', uid, result);
			return resolve(result);
		}).catch( (ex) => {
			console.log('[service] dao error, ex=', ex);
			return reject( standardRejectMessage );
		});
	});
}

function getUserInfo(uid){
	return new Promise( (resolve, reject) => {
		var userPromise = getUser(uid);
		var postCountPromise = countPosts(uid);
		
		Promise.all([userPromise, postCountPromise]).then( values => {
			var data = {
				user: values[0],
				postCount: values[1]
			};
			return resolve(data);
		}).catch(ex => {
			return reject( ex);
		});
		
	});
	
	
}

/**
 * 
 * @param {user} user object
 * @return {Promise}
 */
function login(user){
	return new Promise(function(resolve, reject){
		// vaildate the login account first.
		if(!validateUserFields(user, {account: true})){
			console.log('輸入帳號有問題,有人不是透過browser發出post');
			return reject('帳號或密碼格式錯誤');
		}
		
		userDao.findUserById('app:' + user.account).then( (result) => {
			if(result === null){
				console.log('No such account exist.');
				return reject('帳號或密碼錯誤');
			}
			if(result.password === user.password){
				console.log('%s login success.', user.account);
				return resolve({id: result.authId, name: result.name});
			}else{
				console.log('Password error');
				return reject('帳號或密碼錯誤');	// security:不要單單使用[密碼錯誤]
			}
		}).catch( (ex) => {
			console.log('[service] login.catch(ex)=', ex);
			return reject('帳號或密碼錯誤');	// security:不要單單使用[帳號錯誤]
		});
	});
};

//#todo-roy
function updatePost(post){}

/**
 * Update user collection and a user sub-doc in post collection.
 * @param {object} user
 * @return {Promise}
 */
function updateUserName(user){
	return new Promise(function(resolve, reject){
		log('updateUser(), user', user);
		if(!validateUserFields(user, {name: true})){
			console.log('[service] 資料驗證失敗');
			return reject('更新資料失敗，請確認資料');
		}
		var p1 = userDao.updateUser(user, '+name');
		
		var p2 = postDao.updatePost({'user.authId': user.authId}, {'user.name': user.name});
		
		Promise.all([p1, p2]).then( values => {
			return resolve('ok');
		}).catch( ex => {
			console.log('[service] updateUserName() error=', ex);
			return reject('更新資料失敗，請重新送出');
		});
	});
}