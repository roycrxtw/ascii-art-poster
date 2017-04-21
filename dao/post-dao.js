
// The data access object of Post collection 

'use strict';
var postModel = require('../models/post');

const MAX_RESULTS = 30;

// provide CRUD methods as a DAO interface
exports.createPost = createPost;
exports.readPost = readPost;
exports.listPosts = listPosts;
exports.updatePost = updatePost;
exports.deletePost = deletePost;
exports.countPosts = countPosts;

/**
 * 
 * @param {object} criteria Conditions for query
 * @return {Promise<number>} Resolve: a post count for the criteria argument.
 */
function countPosts(criteria){
	console.log('[post-dao] countPosts(), criteria=', criteria);
	return new Promise( (resolve, reject) => {
		postModel.count(criteria, function(err, count){
			if(err){
				return reject('db error');
			}
			console.log('[post-dao] countPosts()=', count);
			return resolve(count);
		});
	});
}

/**
 * Save a post to database
 * @param {object} post
 * @return {Promise<true|error>} Resolve the new created doc.
 */
function createPost(post){
	return new Promise(function(resolve, reject){
		new postModel(post).save(function(err, doc){
			if(err){
				errorHandler(err, 'createPost.save()');
				return reject('error in database process.');
			}
			if(doc){
				console.log('doc created.');
				return resolve(true);
			}else{
				errorHandler(err, 'Doc should not be null');
				return reject('null doc');
			}
		});
	});
}

function errorHandler(ex, msg){
	console.error('[post-dao] error in database process:', msg);
	if(ex){
		console.log(ex.toString);
	}
}

/**
 * Read a post from database.
 * @param {string} postId The id of target post.
 * @return {Promise<post|error>} Resolve retrieved doc, or null if no any result.
 */
function readPost(postId){
	return new Promise( (resolve, reject)=>{
		if(typeof postId !== 'string'){
			errorHandler(null, 'postId should be a string.');
			return reject('Post id is invalid.');
		}
		
		postModel.findOne({_id: postId}, function(err, doc){
			if(err){
				errorHandler(err, 'readPost()');
				return reject('database error');	//#todo-roy: more specific msg?
			}
			console.log('[post-dao] Return the result=', doc);
			return resolve(doc);
		});
	});
}

/**
 * Delete a post according to the post id
 * @param {string} postId
 * @return {Promise<true|error>}
 */
function deletePost(postId){
	return new Promise( (resolve, reject) => {
		// 不做validation，只做基本確認uid是String
		if(typeof postId !== 'string') return reject('postId is not a string.');
		
		postModel.findOneAndRemove({_id: postId}, function(err, doc){
			if(err){
				errorHandler(err, 'deletePost()');
				return reject('dao error');
			}
			if(doc){
				return resolve(true);
			}else{
				console.log('[post-dao] Delete failed, no such post.');
				return reject('No such post');
			}
		});
	});
}

/**
 * Get n posts from database
 * @return {Promise<Array<post>>}
 */
function listPosts(conditions){
	console.log('[post-dao] listPosts(), conditions=', conditions);
	
	return new Promise( (resolve, reject) => {
		if(!conditions.limit){
			conditions.limit = MAX_RESULTS;
		}
		var query = postModel.find(conditions.query)
				.sort({'created': -1})
				.skip(conditions.skip)
				.limit(conditions.limit)
				.lean(true);
		query.exec(function(err, docs){
			if(err){
				errorHandler(err, 'err in db.');
				return reject('db error');
			}
			return resolve(docs);
		});
	});
}

/**
 * Update a post.
 * @param {Object} criteria Conditions for query the post.
 * @param {Object} post The post which is ready for update.
 * @return {Promise<true|error>} Promise resolve true if update success.
 */
function updatePost(criteria, post){
	return new Promise( (resolve, reject) => {
		// Remember: DAO does not validate user data
		// You should do it in the service layer.
		//postModel.findOneAndUpdate(criteria, post, function(err, doc){
		postModel.update(criteria, post, {multi: true}, function(err, doc){
			if(err){
				errorHandler(err, 'updatePost()');
				return reject('dao-error');
			}
			console.log('[post-dao] updatePost(), doc=', doc);
			if(doc){
				console.log('updatePost() success.');
				return resolve(true);
			}else{
				console.log('[post-dao] Doc is null after updatePost()');
				return reject('failed');
			}
		});
	});
}

