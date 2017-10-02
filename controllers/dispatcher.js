
'use strict';

var debug = require('debug')('router');
var express = require('express');
var router = express.Router();

const config = require('../config/main.config');

let logSettings = [];
if(config.env === 'production'){
	logSettings = [
		{level: config.LOG_LEVEL, path: 'log/dispatcher.log'},
		{level: 'error', path: 'log/error.log'}
	];
}else{
	logSettings = [{level: 'debug', stream: process.stdout}];
}

var log = require('bunyan').createLogger({
	name: 'dispatcher',
	streams: logSettings
});

var passport = require('passport');
var service = require('../services/main-service');
var expiryData = require('../services/expiryData');
var dispatcherConfig = require('./config.js');


router.get(['/', '/home'], function(req, res, next){
	debug('Request get>/home', {uid: req.session.uid, uname: req.session.uname});
	res.locals.css = ['home'];
	res.render('home', {uid: req.session.uid, uname: req.session.uname});
});


router.get('/about', async function(req, res, next){
	const data = await service.about();
	return res.render('about', data);
});


router.get('/login/facebook', 
		passport.authenticate('facebook'), 
		function(req, res, next){
	if(req.session.uid){
		res.redirect(303, '/home');
	}
});

router.get('/login/facebook/return', 
		passport.authenticate('facebook', { failureRedirect: '/login' }), 
		async function(req, res, next) {
	if(req.session.uid){
		res.redirect(303, '/home');
	}
	
	try{
		const user = await service.createAndLoginFbUser(req.user);
		req.session.uid = user.authId;
		req.session.uname = user.name;
		req.session.flash = '成功登入';
		res.redirect(303, '/');
	}catch(ex){
		log.error({ex: ex.stack}, 'Error in get>/login/facebook/return');
		req.session.flash = dispatcherConfig.msg.error;
		res.redirect(303, '/');
	}
});


router.get('/login/google',
		passport.authenticate('google', { scope: ['profile'] }), 
		function(req, res, next){
	if(req.session.uid){
		res.redirect(303, '/home');
	}
});


router.get('/login/google/return', 
		passport.authenticate('google', { failureRedirect: '/login' }), 
		async function(req, res, next) {
	if(req.session.uid){
		res.redirect(303, '/home');
	}

	try{
		let user = await service.createAndLoginGoogleUser(req.user);
		req.session.uid = user.authId;
		req.session.uname = user.name;
		req.session.flash = '成功登入';
		res.redirect(303, '/');
	}catch(ex){
		log.error({ex: ex.stack}, 'Error in get>%s', req.path);
		req.session.flash = dispatcherConfig.msg.error;
		res.redirect(303, '/');
	}
});


router.get('/list/:page?', async (req, res, next) => {
  const page = (parseInt(req.params.page) > 0)? parseInt(req.params.page): 1;
	log.info({page}, 'Request to get>/list/:page');
	try{
		const result = await service.queryPosts({page});
		res.locals.path = '/list';
		res.locals.css = ['list'];
		res.render('list', result);
		log.info({page, resultPostCount: result.postCount}, 'get>/list/:page end');
	}catch(ex){
		log.error({error: ex.stack}, 'Error in get>/list/:page');
		res.render('list');
	}
});


router.get('/login', function(req, res, next){
	debug('Request get>/login started.');
	if(req.session.uid){
		return res.redirect(303, '/list');
	}
	res.render('login', {css: ['form']});
});


router.post('/login', async function(req, res, next){
	debug('Request post>/login started.');
	if(req.session.uid){
		res.redirect(303, '/home');
	}

  try{
    const account = req.body.account;
    const password = req.body.password;

		const result = await service.login({account, password});
		if(result.failed){  // login failed
			req.session.flash = result.failed;
			req.session.cachedAccount = account;
			log.info({cachedAccount: req.session.cachedAccount}, 'post>/login: login failed. Redirect to /login.');
			return res.redirect(303, '/login');
		}
		
		req.session.flash = 'Login success. Welcome to Grumblers!';
		req.session.uid = result.authId;
		req.session.uname = result.name;
		return res.redirect(303, '/home');
	}catch(ex){
		log.error({error: ex.stack}, 'Error in post>/login');
		req.session.flash = dispatcherConfig.msg.error;
		return res.redirect(303, '/login');
	}
});

router.get("/logout", function(req, res, next){
	req.session.uid = null;
	req.session.uname = null;
	delete req.session.uid;
	delete req.session.uname;
	req.session.flash = '您已成功登出，歡迎再來。';
	res.redirect(303, '/home');
});


/**
 * Get user info for current login user.
 */
router.get('/user', function(req, res, next){
	if(!req.session.uid){
		req.session.flash = '你還沒登入喔!';
		return res.redirect(303, '/login');
	}
	return res.redirect(303, '/user/' + req.session.uid);
});


router.post('/user', async function(req, res, next){
	if(req.session.uid !== req.body.authId){
		req.session.flash = '不該這樣做喔';
		return res.redirect(303, '/home');
	}
	if(req.body.action === 'delete'){
		try{
			const flag = await service.deleteUser(req.session.uid);

			req.session.flash = '成功刪除帳號。';
			req.session.uid = null;
			req.session.uname = null;
			return res.sendStatus(200);
		}catch(ex){
			log.error({ex: ex.stack}, 'Error in Post request to /user');
			req.session.flash = dispatcherConfig.msg.error;
			return res.sendStatus(500);
		}
	}
});

router.get('/user/:uid', async function(req, res, next){
	let data = {};
  res.locals.css = ['form', 'user'];
	
	try{
		let result = await service.getUserInfo(req.params.uid);
		if(!result){
			req.session.flash = '抱歉，沒有這個使用者';
			return res.redirect(303, '/home');
		}
	
		data.user = result.user;
		data.user.postCount = result.postCount;
		data.user.allPostCount = result.allPostCount;
		// further process if this user is loged in
		if(req.params.uid === req.session.uid){
			data.editable = true;
			let match = /^(app|google|fb):/.exec(result.user.authId);
			if(match[1] === 'fb'){
				data.user.xauth = 'facebook';
			}else if(match[1] === 'google'){
				data.user.xauth = 'Google';
			}else{
				data.user.xauth = '本web app';
			}
		}
		return res.render('user', data);
	}catch(ex){
		log.error({uid: req.params.uid, error: ex.stack}, 'error in get>/user/:id');
		req.session.flash = dispatcherConfig.msg.error;
		res.render('user', data);
	}
});

/**
 * Update user data.
 */
router.post('/user/:id', async function(req, res, next){
	if(req.params.id !== req.session.uid){
		req.session.flash = dispatcherConfig.msg.noAuthority;
		return res.redirect(303, '/user/' + req.params.id);
	}
	
	try{
		const preparedUser = {
			authId: req.session.uid,
			name: req.body.name
		};
		
		const result = await service.updateUserName(preparedUser);
		if(result.ok){
			req.session.uname = req.body.name;
			req.session.flash = '更新成功囉';
		}else{
			req.session.flash = result.failed;
		}
		return res.redirect(303, '/user/' + req.params.id);
	}catch(ex){
		log.error({
      sessionId: req.session.uid, error: ex.stack
    }, 'Error in post>/user/:id');
		req.session.flash = '更新失敗，請再試看看。';
		return res.redirect(303, '/user/' + req.params.id);
	}
});


router.get('/user/:id/list/:page?', async function(req, res, next){
  debug('hihihixxx');
	if(req.params.id !== req.session.uid){
		req.session.flash = dispatcherConfig.msg.noAuthority;
		return res.redirect(303, '/list');
	}
	
	try{
    const page = (parseInt(req.params.page) > 0)? parseInt(req.params.page): 1;
		const result = await service.queryPosts({
			uid: req.session.uid, page
		});
		res.locals.isOwner = true;
		res.locals.path = '/user/' + req.session.uid + '/list';
		res.locals.css = ['list'];
		res.render('list', result);
	}catch(ex){
		log.error({
			id: req.params.id, 
      page: req.params.page,
      ex: ex.stack
		}, 'Error in get>/user/:id/list/:page');
		req.session.flash = dispatcherConfig.msg.error;
		res.redirect(303, '/user');
	}
});


router.get('/post', function(req, res, next){
	if(!req.session.uid){
		req.session.flash = '請先登入';
		return res.redirect(303, '/login');
	}
	const postSettings = service.getPostSettings();
	const data = {
		post: {
			title: req.body.title,
			content: '',
			category: postSettings.postCategory,
			expiry: postSettings.expiryTypes,
			ghost: false
		},
		recaptchaSiteKey: config.recaptchaSiteKey,
		scripts: ['<script src="https://www.google.com/recaptcha/api.js" async defer></script>']
	};
	res.locals.css = ['form', 'post-form'];
	res.render('post', data);
});


router.post('/post', async (req, res, next) => {
  if(!req.session.uid){
		req.session.flash = '請先登入';
		return res.redirect(303, '/login');
  }
  
	const post = {
    uid: req.session.uid,
    uname: req.session.uname,
		title: req.body.title,
		category: req.body.category,
		content: req.body.content,
		expiry: req.body.expiry,
		ghost: req.body.ghost || false,
		verify: req.body['g-recaptcha-response'] || null
	};
  
  try{
    const flag = await service.createPost(post);
    req.session.flash = '發表完成。';
		res.redirect(303, '/list');
  }catch(ex){
    log.error({post, error: ex.stack}, 'Error in post>/post');
		post.expiry = expiryData.expiryData;
		let data = {
			post: post,
			css: ['form', 'post-form'],
			scripts: ['<script src="https://www.google.com/recaptcha/api.js" async defer></script>'],
			flash: ex.toString()
		};
		res.render('post', data);
  }
});


/**
 * Get the register page.
 */
router.get('/register', function(req, res, next){
	if(req.session.uid){
		req.session.flash = '您已經有註冊帳號囉';
		return res.redirect(303, '/home');
	}
	res.render('register', {css: ['form']});
});


/**
 * Submit a register
 */
router.post("/register", async (req, res, next) => {
	var user = {
		account:  req.body.account,
		password: req.body.password,
		name: req.body.name,
		email: req.body.email
	};
  
  try{
    const result = await service.createAppUser(user);
    if(result.failed){
      req.session.flash = result.failed;
      return res.redirect(303, '/register');
    }

    req.session.uid = result.authId;
    req.session.uname = result.name;
    return res.redirect(303, '/register-done');
  }catch(ex){
    log.error({user, error: ex.stack}, 'Eror in post>/register');
		req.session.flash = '請重試 Please try again';
    return res.redirect(303, '/register');
  }
});


router.get("/register-done", function(req, res, next){
	res.render('register-done');
});


// handle 404 issues
router.use(function(req, res, next){
	res.render('404');
});

router.use(function(err, req, res, next){
	res.send("很抱歉，暫時無法提供此服務，請稍後再試。" 
			+ "The service is currently not available. Please try it later.");
	
});

module.exports = router;