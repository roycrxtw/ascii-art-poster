
/**
 * Project Ascii-art Poster
 * Database service
 * @author Roy Lu(royvbtw)
 * 25 Jan 2018
 */

'use strict';

const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;

//const DB_URL = require('../config/db.config').dburl;
let conn = null;
const connectOptions = {
  keepAlive: 300000,
  connectTimeoutMS: 50000,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 2000
};

let client;
let postCollection;

async function init(dburl, name){
  try{
    console.log(`db-service.init(${dburl}, ${name}`);
    client = await MongoClient.connect(dburl, connectOptions);
    const db = client.db(name);
    postCollection = db.collection('posts');

    console.log(`isConnected=${client.isConnected()}`);
  }catch(ex){
    console.log(`Error in init()`, ex)
  }
}


function close(){
  client.close();
}


async function readPost(postId){
  if(typeof postId !== 'string'){
    throw new TypeError('The postId should be a string.');
  }

  if(postId === ''){
    return null;
  }

  const post = await postCollection.findOne({'_id': mongo.ObjectId(postId)});
  return post;
}

async function deletePost(postId){
  if(postId === ''){ return false; }

  try{
    const result = await postCollection.findOneAndDelete({'_id': mongo.ObjectId(postId)});
    if(result.value){
      return true;
    }else{
      return false;
    }
  }catch(ex){
    console.log(`ex=`, ex);
  }
  
}

module.exports.init = init;
module.exports.readPost = readPost;
module.exports.deletePost = deletePost;
module.exports.close = close;