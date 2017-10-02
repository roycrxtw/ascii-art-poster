
/**
 * The data access object of the Post collection 
 * @author Roy Lu(royvbtw)
 * Sep, 2017
 */

'use strict';

const LOG_LEVEL = require('../config/main.config').LOG_LEVEL;
var log = require('bunyan').createLogger({
	name: 'post-dao',
	streams: [{
		level: LOG_LEVEL,
		path: 'log/grumblers.log'
	}]
});

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
 * Get post counts.
 * @param {object} criteria Conditions for this query
 * @return {Promise<number>} Resolve: a post count for the criteria argument.
 */
function countPosts(criteria){
	log.info({criteria}, 'countPost() started');
	return new Promise( (resolve, reject) => {
		postModel.count(criteria, function(err, count){
			if(err){
				log.error({err}, 'Error in countPosts()');
				return reject('error');
			}
			return resolve(count);
		});
	});
}


/**
 * Save a post to the database
 * @param {object} post
 * @return {Promise<true|error>} Resolve true if creation success, or reject an
 * error if something wrong.
 */
function createPost(post){
	return new Promise( (resolve, reject) => {
		new postModel(post).save(function(err, doc){
			if(err){
				log.error({err}, 'Error in createPost()');
				return reject('error');
			}
			log.info('createPost() success.');
			return resolve(true);
		});
	});
}


/**
 * Read a post from database.
 * @param {string} postId The id of target post.
 * @return {Promise<post|error>} Resolve retrieved doc, or null if no any result.
 */
function readPost(postId){
	return new Promise( (resolve, reject) => {
		if(typeof postId !== 'string'){
			throw new TypeError('postId should be a string.');
		}
		
		postModel.findOne({_id: postId}, function(err, doc){
			if(err){
				log.error({postId, err}, 'Error in readPost()');
				return reject('error');
			}
			return resolve(doc);
		});
	});
}


/**
 * Delete a post with the given post id
 * @param {string} postId
 * @return {Promise<boolean|error>}
 */
function deletePost(postId){
	return new Promise( (resolve, reject) => {
		if(typeof postId !== 'string'){
			throw new TypeError('postId should be a string.');
		}
		
		postModel.findOneAndRemove({_id: postId}, function(err, doc){
			if(err){
				log.error({postId, err}, 'Error in deletePost()');
				return reject('error');
			}
			if(doc){
				log.info('deletePost() success.');
				return resolve(true);
			}else{
				log.info({doc}, 'deletePost() result is null');
				return resolve(false);
			}
		});
	});
}


/**
 * Get posts from database
 * @return {Promise<Array<post>>}
 */
function listPosts(conditions){
	log.info({conditions}, 'listPosts() started.');
	return new Promise( (resolve, reject) => {
		let query = postModel.find(conditions.query, conditions.projection)
				.sort({'created': -1})
				.skip(conditions.skip)
				.limit(conditions.limit)
				.lean(true);
		query.exec(function(err, docs){
			if(err){
				log.error({err}, 'Error in listPosts().');
				return reject('error');
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
function updatePost({criteria, post}){
	log.info({criteria, post}, 'updatePost() started.');
	return new Promise( (resolve, reject) => {
		// Remember: DAO does not validate user data
		// You should do it in the service layer.
		postModel.update(criteria, post, {multi: true}, function(err, doc){
			if(err){
				log.error({err}, 'updatePost()');
				return reject('error');
			}
			if(doc){
				log.info('updatePost() success.');
				return resolve(true);
			}else{
				log.info('updatePost() has some problem.');
				return resolve(false);
			}
		});
	});
}

