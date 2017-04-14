
'use strict';

var express = require('express'),
	router = express.Router();

var passport = require('passport');
var service = require('../services/main-service');
var expiryData = require('../services/expiryData');
var dataConfig = require('../data');
var mainConfig = require('../config/main.config');

router.use(function(req, res, next){
	next();
});

router.get(['/', '/home'], function(req, res, next){
	res.locals.css = ['home'];
	res.render('home', {uid: req.session.uid, uname: req.session.uname});
});


router.get('/api/list', function(req, res, next){
	service.getPosts(5).then( (docs) => {
		res.status(200).json({ posts: docs });
	}).catch( () => {
		res.sendStatus(404);
	});
});

router.get('/delete', (req, res, next) => {
	res.render('delete', {editable: true, uid: req.session.uid, uname: req.session.uname});
	
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
		req.session.flash = ex.toString();
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
		console.log('[dispatcher] get>/login/google/return, ex=', ex);
		req.session.flash = dataConfig.standardFlashMessage;
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

router.post('/user', function(req, res, next){
	if(req.session.uid !== req.body.authId){
		req.session.flash = '不該這樣做喔';
		return res.redirect(303, '/home');
	}
	if(req.body.action === 'delete'){
		service.deleteUser(req.session.uid).then( (ex) => {
			req.session.flash = '成功刪除帳號。';
			req.session.uid = null;
			req.session.uname = null;
			return res.sendStatus(200);
		}).catch( (ex) => {
			console.log('[dispatcher] post>/user ex=', ex);
			req.session.flash = dataConfig.standardFlashMessage;
			return res.sendStatus(303);
		});
	}
});

router.get('/user/:id', function(req, res, next){
	var data = {
		css: ['form', 'user']
	};
	
	service.getUserInfo(req.params.id).then( (doc) => {
		if(!doc){
			req.session.flash = '沒有這個使用者';
			return res.redirect(303, '/home');
		}
		data.user = doc.user;
		data.user.postCount = doc.postCount;
		if(req.params.id === req.session.uid){
			data.editable = true;
			var match = /^(app|google|fb):/.exec(doc.user.authId);
			if(match[1] === 'fb'){
				data.user.xauth = 'facebook';
			}else if(match[1] === 'google'){
				data.user.xauth = 'Google';
			}else{
				data.user.xauth = '本web app';
			}
		}
		
		return res.render('user', data);
	}).catch( ex => {
		console.log('[service] ex=', ex);
		data.flash = ex.toString();
		res.render('user', data);
	});
});

router.post('/user/:id', function(req, res, next){
	if(req.params.id !== req.session.uid){
		req.session.flash = '您沒有權限可以做這件事情';
		return res.redirect(303, '/user/' + req.params.id);
	}else{
		var preparedUser = {
			authId: req.session.uid,
			name: req.body.name
		};
	
		service.updateUserName(preparedUser).then( (doc) => {
			req.session.uname = req.body.name;
			req.session.flash = '更新成功囉';
		}).catch( (ex) => {
			req.session.flash = '更新失敗，請再試看看。';
		}).then(() =>{
			return res.redirect(303, '/user/' + req.params.id);
		});
	}
});



router.get('/user/:id/posts', function(req, res, next){
	if(req.params.id !== req.session.uid){
		return res.redirect(303, '/list');
	}else{
		service.getPostsByUser(req.session.uid).then( (docs) => {
			var data = {};
			if(docs === 0){
				data = null;
			}else{
				data = {
					post: docs,
					owner: true,
					css: ['list']
				};
			}
			res.render('list', data);
		}).catch( (ex) => {
			req.session.flash = '很抱歉，暫時無法提供此服務，請稍後再試';
			res.redirect(303, '/user');
		});
	}
});

// first function apply async-await pattern
router.get("/about", async function(req, res, next){
	var data = await service.about();
	return res.render('about', data);

	/*
	service.about().then((result) => {
		var data = {
			postCount: result.postCount,
			userCount: result.userCount
		};
		return res.render('about', data);
	}).catch( (ex) => {
		return res.render('about');
	});
	*/
});

router.get("/list", function(req, res, next){
	service.getPosts().then( (docs) => {
		var data = {
			post: docs
		};
		res.locals.css = ['list'];
		res.render('list', data);
	}).catch( () => {
		res.render('list');
	});
});

router.get("/login", function(req, res, next){
	res.render('login', {css: ['form']});
});

router.post('/login', function(req, res, next){
	let user = {
		account: req.body.account,
		password: req.body.password
	};
	
	if(req.session.uid){
		res.redirect(303, '/home');
	}
	
	service.login(user).then(function(user){
		req.session.flash = 'Login success. Welcome to Grumblers!';
		req.session.uid = user.id;
		req.session.uname = user.name;
		res.redirect(303, '/home');
	}).catch(function(e){
		console.log('[dispatcher] promise catched');
		if(typeof e === 'string'){
			user.flash = e;
		}else{
			// check database callback first.
		}
		user.css = ['form'];
		res.render('login', user);
	});
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
	var data = {
		post: {
			title: req.body.title,
			content: '',
			expiry: expiryData.expiryData,
			ghost: false
		},
		css: ['form', 'post-form'],
		recaptchaSiteKey: mainConfig.recaptchaSiteKey,
		scripts: ['<script src="https://www.google.com/recaptcha/api.js" async defer></script>']
	};
	res.render('post', data);
});

router.post('/post', function(req, res, next){
	var post = {
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
		res.redirect(303, '/list');
	}).catch( (ex) => {
		post.expiry = expiryData.expiryData;
		var data = {
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
	}).catch( (ex) => {
		console.log('[dispatcher] newUser() is failed. ex=', ex);
		var data = {
			user: user,
			flash: ex.toString(),
			css: ['form']
		};
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