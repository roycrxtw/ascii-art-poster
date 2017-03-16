

// a utility to record time cost between request and response.
// @Roy Lu

'use strict';

module.exports = function(req, res, next){
	// ignore the request for favicon.ico
	if(req.path === '/favicon.ico') return next();
	
	function onFinish(){
		req.session.t1 = Date.now();
		console.log('timelog: onFinish(), %s for %s in %sms.', 
				req.method, req.path, req.session.t1 - req.session.t0);
	}
	
	res.on('finish', onFinish);
	
	// action before every request
	req.session.t0 = Date.now();
	next();
};