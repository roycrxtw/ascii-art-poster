
/**
 * Project Grumbler
 * @author Roy Lu(royvbtw)
 * Sep, 2017
 */

'use strict';

var conn = require('../dao/connection');
var userDao = require('../dao/user-dao');
var postDao = require('../dao/post-dao');
var serviceData = require('./service-data');

var passwordService = require('./password-service');

let debug = require('debug')('main');
var request = require('request');

const config = require('../config/main.config');
const LOG_LEVEL = config.LOG_LEVEL;

let logSettings = [];
if(config.env === 'production'){
	logSettings = [
		{level: LOG_LEVEL, path: 'log/main.log'},
		{level: 'error', path: 'log/error.log'}
	];
}else{
	logSettings = [
		{level: 'debug', stream: process.stdout}
	];
}

let log = require('bunyan').createLogger({
	name: 'main-service',
	streams: logSettings
});

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
exports.updateUserName = updateUserName;

exports.login = login;

exports.createPost = createPost;
exports.deletePost = deletePost;
exports.countPosts = countPosts;


function getPostSettings(){
	let data = {};
	data.postCategory = serviceData.postCategory;
	data.expiryTypes = serviceData.expiryTypes;
	return data;
}

/**
 * Count post amount for the given uid
 * @param {string} uid User id
 * @param {boolean} ignoreExpiry 
 * @return {number} Post count Return -1 if counting has error.
 */
async function countPosts({uid, ignoreExpiry = false} = {}){
	debug(`countPosts() started: uid=${uid}, ignoreExpiry=${ignoreExpiry}`);
	
	let opt = {};
	
	if(uid){
		opt['user.authId'] = uid;
	}
	
	if(!ignoreExpiry){
		opt.expiry = {$gte: new Date()};
	}
	debug(`countPost(): ${opt}`);

	try{
		const count = await postDao.countPosts(opt);
		log.debug('countPosts()=%s', count);
		return count;
	}catch(ex){
		log.error({ex: ex.stack}, 'Error in countPage()');
		return -1;
	}
}


/**
 * Wrapper function
 * To create and/or login Facebook user. The argument is a profile object 
 * parsed by passport-facebook module.
 * @param {object} profile 
 */
async function createAndLoginFbUser(profile){
	return await createAndLoginOAuthUser(profile, 'fb');
}

/**
 * To create and/or login Google OAuth user. User info(google id, name and 
 * email) will be stored into database.
 * @param {object} profile Parsed by passport-google module.
 * @return {object}
 */
async function createAndLoginGoogleUser(profile){
	return await createAndLoginOAuthUser(profile, 'google');
}


/**
 * @param {object} profile Parsed by passport module.
 * @param {string} prefix
 * @return {object} 
 */
async function createAndLoginOAuthUser(profile, prefix){
	debug('createAndLoginOAuthUser() started.');
	//log.debug({profile}, 'createAndLoginOAuthUser() started');
	try{
		const preparedUser = {
			authId: prefix + ':' + profile.id,
			name: profile['_json'].name,
			password: null,
			email: profile['_json'].email || '0',
			created: new Date(),
			avator: 'nopath'	// Pre-reserved field.
		};
		debug('createAndLoginOAuthUser() preparedUser=', preparedUser);

		let result = {};
		const query = await userDao.findUserById(preparedUser.authId);
		if(query){
			debug('createAndLoginOAuthUser(): user exists. query=', query);
			result.authId = query.authId;
			result.name = query.name;
		}else{
			debug('User does not exists. Trying to create new user.');
			result = await doCreateUser(preparedUser);
		}
		
		debug('result=', result);
		return result;
	}catch(ex){
		log.error({ex: ex.stack}, 'Error in createAndLoginOAuthUser()');
		return false;
	}
}


/**
 * 前導函式
 * @param {object} user
 * @return {object} true if creation success.
 */
async function createAppUser(user){

  const salt = await passwordService.generateSalt(10);
  const hash = await passwordService.hash(user.password, salt);

  const preparedUser = {
    authId: 'app:' + user.account,
    name: user.name,
    password: hash,
    email: user.email || '0',
    created: new Date(),
    avator: 'nopath'	// Pre-reserved field.
  };

  try{
    const result = await doCreateUser(preparedUser);
    debug('createAppUser(): after creation, result=', result);
    return result;
  }catch(ex){
    log.error({ex: ex.stack}, 'Error in createAppUser(): doCreateUser');
    return false;
  }
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
	log.debug({user: user, check: check}, 'validateUserFields() start');
	var idPattern = /^(app|google|fb):[a-zA-Z0-9_-]{6,}[^_-]$/;
	var pwdPattern = /^[a-zA-Z0-9]{8,30}$/;
	// this email pattern is according to the w3c design
	var emailPattern = 
			/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
	
	var idResult = idPattern.test(user.authId);
	var pwdResult = pwdPattern.test(user.password);
	var emailResult = emailPattern.test(user.email);
	log.debug('User data validate results: id=%s, pwd=%s, email=', 
			idResult, pwdResult, emailResult);

	if(check.authId && !idResult) return false;
	if(check.pwd && !pwdResult) return false;
	if(check.email && !emailResult) return false;
	return true;
}


/**
 * 
 * @return {object} information about this project.
 */
async function about(){
  try{
    const result = {};
    result.userCount = await userDao.countUsers();
    result.postCount = await countPosts();
    result.allPostCount = await countPosts({ignoreExpiry: true});
    return result;
  }catch(ex){
    log.error({ex: ex.stack}, 'Error in about().');
  }
}


/**
 * 
 * @param {object} post
 * @return {Promise}
 */
function createPost(post){
	return new Promise( (resolve, reject) => {
		debug({post}, 'createPost() started.');
		
		// verify the google re-captcha
		var recaptchaOptions = {
			url: 'https://www.google.com/recaptcha/api/siteverify',
			form: {
				secret: config.recaptchaSecret,
				response: post.verify
			}
		};
		
		debug({recaptchaOptions}, 'createPost(): Print recaptchaOptions');
		
		request.post(recaptchaOptions, function (error, response, body) {
			if(error){
				log.error({error, errorStack: error.stack}, 'Error in recaptcha verification.');
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
        debug({preparedPost}, 'createPost(): Print preparedPost');
        
				postDao.createPost(preparedPost).then( ()=> {
					return resolve('ok');
				}).catch( ex => {
					log.error({ex: ex.stack}, 'Error in createPost()');
					return reject('error');
				});
			}else{
				log.info('Google re-captcha check is failed.');		// #todo: check the google doc
				return reject('Google re-captcha is invalid...');
			}
		});
	});
}


/**
 * Check if user is exist and create it.
 * @param {object} user object
 * @return {boolean} true if creation success, false if it's failed.
 */
async function doCreateUser(user){
	try{
		debug({user}, 'doCreateUser() started.');
		const result = await userDao.findUserById(user.authId);
		if(result){		// the account does exist.
			return {failed: '本帳號已存在，請重新設定'};
		}else{
			// the user does not exist, continue to create the user
			return await userDao.createUser(user);
		}
	}catch(ex){
		log.error({ex: ex.stack}, 'Error in doCreateUser()');
		return {failed: 'User register failed'};
	}
};


/**
 * Delete a post for the given postId
 * @param {string} postId Target post id
 * @param {string} uid Current user id
 * @return {object} Return an ok object if delete success, 
 * or return a failed object when delete failed.
 */
async function deletePost({postId, uid} = {}){
	try{
		const ownerId = await postDao.readPost(postId).user.authId;
		debug({ownerId}, 'deletePost(), print ownerId of this post.');
	
		if(ownerId === uid){
			const flag = await postDao.deletePost(postId);
			if(flag){
				return {ok: 'Delete ok'};
			}else{
				return {failed: 'Delete failed'};
			}
		}else{
			return {failed: 'ID不相符'}
		}
	}catch(ex){
		log.error({args: arguments, ex: ex.stack}, 'Error in main.deletePost()');
		return {failed: 'Error'}
	}
}


/**
 * 
 * @param {string} uid User id
 * @return {boolean} true if delete success.
 */
async function deleteUser(uid){
	log.info(`deleteUser(${uid}) started.`);
	try{
		return await userDao.deleteUserById(uid);
	}catch(ex){
		log.error({uid, ex: ex.stack}, 'Error in deleteUser()');
	}
}


async function doGetPosts(conditions){
  log.debug({conditions}, 'doGetPosts() started.');
  try{
    let posts = await postDao.listPosts(conditions);
    debug('doGetPosts(): posts.length=%s', posts.length);
    var current = new Date();
    for(var i in posts){
      posts[i].postId = posts[i]._id;	// re-map _id to postId
      delete posts[i]._id;
      
      if(posts[i].anonymous){
        posts[i].user.authId = '0';
        posts[i].user.name = '這是個忍者!';
      }
      delete posts[i].anonymous;
      
      if(posts[i].category === undefined){
        posts[i].category = '無';
      }
      posts[i].createdAt = formatDate(posts[i].created);
      if(posts[i].expiry){
        if(posts[i].expiry < current){
          posts[i].isExpired = true;
        }
        posts[i].expiry = formatDate(posts[i].expiry);
      }
    }
    return posts;
  }catch(ex){
    log.error({conditions, ex: ex.stack}, 'Error in doGetPosts()');
  }
}


async function queryPosts({uid, page = 1, pageSize} = {}){
	page = (parseInt(page) > 0)? parseInt(page): 1;
	pageSize = (pageSize >= PAGE_SIZE)? pageSize: PAGE_SIZE;
	
	let conditions = {
		query: {},
		limit: pageSize
	};
	if(uid){
		conditions.query['user.authId'] = uid;
	}else{
		conditions.projection = {expiry: 0};
		conditions.query.expiry = {$gt: new Date()};
	}
	
	try{
		const postCount = await countPosts({
			uid: uid, 
			ignoreExpiry: (uid)? true: false
    });
    
		const pageCount = Math.ceil(postCount / pageSize);
		
		page = (page > pageCount)? pageCount: page;
		conditions.skip = (page - 1) * pageSize;
		
		let result = {};
		result.posts = await doGetPosts(conditions);
		result.currentPage = page;
		result.pageCount = pageCount;
		result.postCount = postCount;

		// deal with pagination.
		result.page = {};
		result.page.first = (page === 1)? null: 1;
		result.page.next = (page < pageCount)? (page + 1): null;
		result.page.prev = (page > 1)? (page - 1): null;
		result.page.last = (page === pageCount)? null: pageCount;
		return result;
	}catch(ex){
		log.error({error: ex.stack}, 'Error in queryPosts()');
		return false;
	}
}


/**
 * 
 * @param {string} uid
 * @return {user|result} null if no such user
 */
async function getUser(uid){
	debug('getUser(%s) started.', uid);
	if(uid === '0'){
		let result = {};
		result.name = '這是個忍者';
		return result;
	}
	
	if(!validateUserFields({id: uid}, {id: true})){
		log.error('不該有這個id:', uid);
		let result = {};
		result.name = '不該有這id';
		return result;
	}
	
	try{
		const user = await userDao.findUserById(uid);
		debug({user, arg: uid}, 'getUser() finished.');
		return user;
	}catch(ex){
		log.error({error: ex}, 'Error in getUser().');
	}
}


/**
 * wrapper function.
 * @param {string} uid User id
 * @return {object} result User details, or false if the user doesn't exist.
 */
async function getUserInfo(uid){
	try{
		debug('getUserInfo(%s) start', uid);
		let result = {};
		result.user = await getUser(uid);
		debug({'result.user': result.user}, 'getUserInfo(): Print result.user');
		if(!result.user){
			debug('getUserInfo(%s): No such user.', uid);
			return false;
		}
		result.postCount = await countPosts({uid: uid});
		result.allPostCount = await countPosts({uid: uid, ignoreExpiry: true});
		return result;
	}catch(ex){
		log.error({error: ex}, 'Error in getUserInfo()');
	}
}


/**
 * @param {string} account
 * @param {string} password
 * @return {object} Return an ok object if login success, or a failed object when login failed.
 */
async function login({account, password} = {}){
	try{
		// #todo-roy: validate function doesn't test
		// vaildate the login account first.
//		if(!validateUserFields(user, {account: true})){
//			log.warn('login(): 輸入帳號有問題,有人不是透過browser發出post');
//			return {failed: '帳號或密碼格式錯誤'};
//		}
		
		debug(`main.login() started: account=${account}, pwd=${password}`);
		
		const result = await userDao.findUserById('app:' + account);
		debug('Print result=', result);
		if(result === null){
			debug({'login account': account}, 'login(): No such account exist.');
			return {failed: '帳號(或密碼)錯誤'};
		}
		
		if(await passwordService.compare(password, result.password) === true){
			debug(`main.login(): ${account} login success.`);
			return {ok: 'login success', authId: result.authId, name: result.name};
		}else{
			log.debug('login(): Password error.');
			return {failed: '帳號或密碼錯誤'};	// security:不要單單使用[密碼錯誤]
		}
	}catch(ex){
		log.error({error: ex.stack}, 'Error in login()');
		return {failed: 'error'};	// security: 不要單單使用[帳號錯誤]
	}
}


/**
 * Update user collection and all user sub-doc in post collection.
 * @param {object} user
 * @return {object} Return an ok object if update success.
 */
async function updateUserName(user){
	try{
		debug({user}, 'updateUserName() started');
		if(!validateUserFields(user, {name: true})){
			log.debug('updateUserName(): 資料驗證失敗');
			return {failed: '更新資料失敗，請確認資料'};
		}
		await userDao.updateUser(user);
		const criteria = {'user.authId': user.authId};
		const post = {'user.name': user.name};
		await postDao.updatePost({criteria, post});
		return {ok: 'Update success'};
	}catch(ex){
		log.error({user, error: ex.stack}, 'Error in main.updateUserName()');
		return {failed: '更新資料失敗，請重新送出'};
	};
}