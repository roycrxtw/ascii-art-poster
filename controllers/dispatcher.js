
'use strict';

var express = require('express'),
	router = express.Router();

const LOG_LEVEL = require('../config/main.config').LOG_LEVEL;
var log = require('bunyan').createLogger({
	name: 'dispatcher',
	streams: [{
		level: LOG_LEVEL,
		path: 'log/grumbler.log'
	}]
});

var passport = require('passport');
var service = require('../services/main-service');
var expiryData = require('../services/expiryData');
var config = require('./config.js');
var mainConfig = require('../config/main.config');

router.use(function(req, res, next){
	next();
});

router.get(['/', '/home'], function(req, res, next){
	log.info({uid: req.session.uid, uname: req.session.uname}, 'Request get>/home');
	res.locals.css = ['home'];
	res.render('home', {uid: req.session.uid, uname: req.session.uname});
});

//#roy-todo
router.get('/api/list', function(req, res, next){
	//#roy-todo
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
		function(req, res, next) {
	if(req.session.uid){
		res.redirect(303, '/home');
	}
	
	service.createAndLoginFbUser(req.user).then( (doc) => {
		req.session.uid = doc.authId;
		req.session.uname = doc.name;
		req.session.flash = '成功登入';
		res.redirect(303, '/');
	}).catch(ex => {
		log.error({error: ex.stack}, 'Error in get>/login/facebook/return');
		req.session.flash = config.msg.error;
		res.redirect(303, '/');
	});
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
		function(req, res, next) {
	if(req.session.uid){
		res.redirect(303, '/home');
	}
	service.createAndLoginGoogleUser(req.user).then( (doc) => {
		req.session.uid = doc.authId;
		req.session.uname = doc.name;
		req.session.flash = '成功登入';
		res.redirect(303, '/');
	}).catch(ex => {
		log.error({error: ex.stack}, 'get>/login/google/return');
		req.session.flash = config.msg.error;
		res.redirect(303, '/');
	});
});

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
			let flag = await service.deleteUser(req.session.uid);

			req.session.flash = '成功刪除帳號。';
			req.session.uid = null;
			req.session.uname = null;
			return res.sendStatus(200);
		}catch(ex){
			log.error({error: ex.stack}, 'Error in Post request to /user');
			req.session.flash = config.msg.error;
			return res.sendStatus(303);	//#roy-todo: why send 303?
		}
	}
});

router.get('/user/:id', async function(req, res, next){
	let data = {
		css: ['form', 'user']
	};
	
	try{
		let result = await service.getUserInfo(req.params.id);
		if(!result){
			req.session.flash = '抱歉，沒有這個使用者';
			return res.redirect(303, '/home');
		}
	
		data.user = result.user;
		data.user.postCount = result.postCount;
		data.user.allPostCount = result.allPostCount;
		// further process if this user is loged in
		if(req.params.id === req.session.uid){
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
		log.error({error: ex.stack, uid: req.params.id}, 'error in get>/user/:id');
		req.session.flash = config.msg.error;
		res.render('user', data);
	}
});

router.post('/user/:id', async function(req, res, next){
	if(req.params.id !== req.session.uid){
		req.session.flash = config.msg.noAuthority;
		return res.redirect(303, '/user/' + req.params.id);
	}
	
	try{
		let preparedUser = {
			authId: req.session.uid,
			name: req.body.name
		};
		
		let result = await service.updateUserName(preparedUser);
		if(result.ok){
			req.session.uname = req.body.name;
			req.session.flash = '更新成功囉';
		}else{
			req.session.flash = result.msg;
		}
		return res.redirect(303, '/user/' + req.params.id);
	}catch(ex){
		log.error({error: ex.stack}, 'Error in post>/user/:id');
		req.session.flash = '更新失敗，請再試看看。';
		return res.redirect(303, '/user/' + req.params.id);
	}
});

router.get('/user/:id/list', function(req, res, next){
	res.redirect(302, '/user/' + req.params.id + '/list/1');
});

router.get('/user/:id/list/:pageNo', async function(req, res, next){
	if(req.params.id !== req.session.uid){
		req.session.flash = config.msg.noAuthority;
		return res.redirect(303, '/list');
	}
	
	try{
		let result = await service.queryPosts({
			uid: req.session.uid,
			pageNo: req.params.pageNo
		});
		res.locals.owner = true;
		res.locals.path = '/user/' + req.session.uid + '/list';
		res.locals.css = ['list'];
		res.render('list', result);
	}catch(ex){
		log.error({
			error: ex.stack, 
			id: req.params.id, 
			pageNo: req.params.pageNo
		}, 'Error in get>/user/:id/list/:pageNo');
		req.session.flash = config.msg.error;
		res.redirect(303, '/user');
	}
});

router.get("/about", async function(req, res, next){
	var data = await service.about();
	return res.render('about', data);
});

router.get('/list', (req, res, next) => {
	res.redirect(303, '/list/1');
});


router.get('/list/:pageNo', async function(req, res, next){
	log.info({pageNo: req.params.pageNo}, 'Request to get>/list/:pageNo');
	try{
		let result = await service.queryPosts({pageNo: req.params.pageNo});
		res.locals.path = '/list';
		res.locals.css = ['list'];
		res.render('list', result);
		log.info({resultPostCount: result.postCount}, 'get>/list/:pageNo end');
	}catch(ex){
		log.error({error: ex.stack}, 'Error in get>/list/:pageNo');
		res.render('list');
	}
});

router.get("/login", function(req, res, next){
	log.debug('Request get>/login started.');
	if(req.session.uid){
		return res.redirect(303, '/list');
	}

	if(req.session.fields){
		res.locals.account = req.session.fields.account;
		delete req.session.fields;
	}
	res.render('login', {css: ['form']});
	
});

router.post('/login', async function(req, res, next){
	log.debug('Request post>/login started.');
	let user = {
		account: req.body.account,
		password: req.body.password
	};
	
	if(req.session.uid){
		res.redirect(303, '/home');
	}
	try{
		let result = await service.login(user);
		if(result.failed){
			// login failed
			req.session.flash = result.failed;
			req.session.fields = {
				account: req.body.account
			};
			log.debug({fields: req.session.fields}, 'post>/login: login failed. Redirect to /login.');
			return res.redirect(303, '/login');
		}
		
		req.session.flash = 'Login success. Welcome to Grumblers!';
		req.session.uid = result.id;
		req.session.uname = result.name;
		res.redirect(303, '/home');
	}catch(ex){
		log.error({error: ex.stack}, 'Error in post>/login');
		user.flash = config.msg.error;
		user.css = ['form'];
		res.render('login', user);
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

router.get('/post', function(req, res, next){
	if(req.session.uid === undefined || req.session.uid === null){
		req.session.flash = '請先登入';
		return res.redirect(303, '/login');
	}
	let postSettings = service.getPostSettings();
	let data = {
		post: {
			title: req.body.title,
			content: 'content here',	//#roy-todo: need to remove after test.
			category: postSettings.postCategory,
			expiry: postSettings.expiryTypes,
			ghost: false
		},
		recaptchaSiteKey: mainConfig.recaptchaSiteKey,
		scripts: ['<script src="https://www.google.com/recaptcha/api.js" async defer></script>']
	};
	res.locals.css = ['form', 'post-form'];
	res.render('post', data);
});

router.post('/post', function(req, res, next){
	let post = {
		title: req.body.title,
		category: req.body.category,
		content: req.body.content,
		expiry: req.body.expiry,
		ghost: req.body.ghost || false,
		verify: req.body['g-recaptcha-response'] || null
	};
	
	if(req.session.uid){
		post.uid = req.session.uid;
		post.uname = req.session.uname;
	}
	
	service.createPost(post).then( ()=> {
		req.session.flash = '發表完成。';
		res.redirect(303, '/list/1');
	}).catch( ex => {
		log.error({error: ex.stack}, 'Error in post>/post');
		// #roy-todo: Maybe it should use redirect than res.render directly.
		post.expiry = expiryData.expiryData;
		let data = {
			post: post,
			css: ['form', 'post-form'],
			scripts: ['<script src="https://www.google.com/recaptcha/api.js" async defer></script>'],
			flash: ex.toString()
		};
		res.render('post', data);
	});
});

router.get("/register", function(req, res, next){
	if(req.session.uid){
		req.session.flash = '您已經有註冊帳號囉';
		return res.redirect(303, '/home');
	}
	res.render('register', {css: ['form']});
});

router.post("/register", function(req, res, next){
	var user = {
		account:  req.body.account,
		password: req.body.password,
		name: req.body.name,
		email: req.body.email
	};
	
	service.createAppUser(user).then(function(doc){
		req.session.uid = doc.authId;
		req.session.uname = doc.name;
		res.redirect(303, '/register-done');
	}).catch( ex => {
		log.error({error: ex.stack}, 'Eror in post>/register');
		var data = {
			user: user
		};
		res.locals.flash = '請重試';
		res.locals.css = ['form'];
		res.render('register', data);
	});
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