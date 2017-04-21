
'use strict';

var conn = require('../dao/connection');
var userDao = require('../dao/user-dao');
var postDao = require('../dao/post-dao');
var serviceData = require('./service-data');
var mainConfig = require('../config/main.config');

var request = require('request');

var log = log;
var standardRejectMessage = '服務暫時無法使用，請稍後重試。';

const PAGE_SIZE = 10;

exports.getPostSettings = getPostSettings;

// wrapper functions
exports.about = about;
exports.getUserInfo = getUserInfo;
exports.queryPosts = queryPosts;

exports.createAndLoginFbUser = createAndLoginFbUser;
exports.createAndLoginGoogleUser = createAndLoginGoogleUser;
exports.createAppUser = createAppUser;
exports.deleteUser = deleteUser;
exports.getUser = getUser;

exports.updateUserName = updateUserName;
exports.login = login;
exports.createPost = createPost;
exports.getPost = getPost;

exports.updatePost = updatePost;
exports.deletePost = deletePost;
exports.countPosts = countPosts;

function getPostSettings(){
	console.log('getPostSettings()');
	let data = {};
	data.postCategory = serviceData.postCategory;
	data.expiryTypes = serviceData.expiryTypes;
	console.log('getPostSettings(), data.postCategory=', data.postCategory);
	return data;
}

async function countPosts({uid, ignoreExpiry = false} = {}){
	//let opt = (uid)? {'user.authId': uid}: {};
	
	try{
		console.log('[service] countPosts(), uid=%s, ignoreExpiry=%s', uid, ignoreExpiry);
		let opt = {};
		
		if(uid){
			opt['user.authId'] = uid;
		}
		
		if(!ignoreExpiry){
			opt.expiry = {$gte: new Date()};
		}

		console.log('[service] countPosts(), opt=', opt);

	
		let count = await postDao.countPosts(opt);
		console.log('[service] countPosts() uid: %s=%s', uid, count);
		return count;
	}catch(ex){
		console.log('[error] countPage(), ex:', ex);
		return false;
	}
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


/**
 * 
 * @return {result} object
 */
async function about(){
	try{
		let result = {};
		result.userCount = await userDao.countUsers();
		result.postCount = await countPosts();
		result.allPostCount = await countPosts({ignoreExpiry: true});
		//console.log('[service] about: data=', data);
		return result;
	}catch(ex){
		console.log(ex);
	}
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
					category: post.category,
					user:{
						authId: post.uid,
						name: post.uname
					},
					created: new Date(),	//date of created. new Date.toString()
					expiry: new Date(new Date().getTime() + serviceData.expiryTypes[post.expiry].offset),
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

async function doGetPosts(conditions){
	console.log('[service] doGetPost(), conditions: ', conditions);
	let posts = await postDao.listPosts(conditions);
	console.log('[service] doGetPosts(): posts.length=', posts.length);
	var d = new Date();
	for(var i in posts){
		//console.log('post[%s]=', i, posts[i]);
		posts[i].postId = posts[i]._id;	// remap _id to postId
		delete posts[i]._id;
		
		if(posts[i].anonymous){
			posts[i].user.authId = '0';
			posts[i].user.name = '這是個忍者!';
		}
		delete posts[i].anonymous;
		
		if(posts[i].category === undefined){
			posts[i].category = '無';
		}
		posts[i].created = formatDate(posts[i].created);
		if(posts[i].expiry){
			if(posts[i].expiry < d){
				posts[i].isExpired = true;
			}
			posts[i].expiry = formatDate(posts[i].expiry);
		}
		//console.log('[service] Modified doc[%s]=', i, docs[i]);
	}
	return posts;
}

async function queryPosts({uid, pageNo = 1, pageSize} = {}){
	pageNo = Number(pageNo);
	pageSize = (pageSize >= PAGE_SIZE)? pageSize: PAGE_SIZE;
	
	let conditions = {
		query: {
			//'user.authId': 'fb:1645788332105202',
			//expiry: {$gt: new Date()}
		},
		limit: pageSize
	};
	if(uid){
		conditions.query['user.authId'] = uid;
	}else{
		conditions.query.expiry = {$gt: new Date()};
	}
	
	let postCount = await countPosts({
		uid: uid, 
		ignoreExpiry: (uid)? true: false
	});
	let pageCount = Math.ceil(postCount / pageSize);
	
	
	if(isNaN(pageNo)){
		console.log('pageNo is not a number');
		pageNo = 1;
	}
	pageNo = (pageNo > pageCount)? pageCount: pageNo;
	conditions.skip = (pageNo - 1) * pageSize;
	
	let result = {};
	result.posts = await doGetPosts(conditions);
	//#roy-todo: what to do if no any result?
	result.currentPage = pageNo;
	result.pageCount = pageCount;
	result.postCount = postCount;
	
	// deal with pagination.
	
	result.page = {};
	result.page.first = (pageNo === 1)? null: 1;
	result.page.next = (pageNo < pageCount)? (pageNo + 1): null;
	result.page.prev = (pageNo > 1)? (pageNo - 1): null;
	result.page.last = (pageNo === pageCount)? null: pageCount;
	return result;
}

/**
 * 
 * @param {type} uid
 * @return {user|result} null if no such user
 */
async function getUser(uid){
	console.log('[service] getUser(%s)', uid);
	
	if(uid === '0'){
		let result = {};
		result.name = '這是個忍者';	//#roy-todo: need to test
		return result;
	}
	
	if(!validateUserFields({id: uid}, {id: true})){
		console.error('不該有這個id:', uid);
		let result = {};
		result.name = '不該有這id';	//#roy-todo: need to test
		return result;
	}
	
	try{
		let user = await userDao.findUserById(uid);
		console.log('[service] getUser(%s)=', uid, user);
		console.log('[service] getUser(): ok');
		return user;
	}catch(ex){
		console.log('[service] dao error, ex=', ex);
	}
}

/**
 * wrapper function.
 * @param {string} uid User id
 * @return {object} result User details, or false if the user doesn't exist.
 */
async function getUserInfo(uid){
	try{
		let result = {};
		result.user = await getUser(uid);
		console.log('[service] getUserInfo: result.user=', result.user);
		if(!result.user){
			console.log('No such user: %s', uid);
			return false;
		}
		result.postCount = await countPosts({uid: uid});
		result.allPostCount = await countPosts({uid: uid, ignoreExpiry: true});
		return result;
	}catch(ex){
		console.log(ex);
	}
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