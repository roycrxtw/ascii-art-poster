
// DAO testing.
// or even 整合測試?

var expect = require('chai').expect;
var mongoose = require('mongoose');

var UserModel = require('../models/user');
var userDao = require('../dao/user-dao');

// Create the database connection
before(async function(){
	this.timeout(5000);
	mongoose.Promise = global.Promise;
	
	await mongoose.connect('mongodb://root:root87@ds123182.mlab.com:23182/demo', function(err){
		console.log('connected');
	});
	
	console.log('Clear database');
	// clear database
	await UserModel.remove({}).exec();
	console.log('Add sample data.');
	
	let user0 = UserModel({
		authId: 'test:violet', name: 'violet', password: 'theking', email: 'testing@test.com'
	});
	let user1 = UserModel({
		authId: 'test:wheat', name: 'wheat', password: 'theking', email: 'testing@test.com'
	});
	let user2 = UserModel({
		authId: 'test:olive', name: 'olive', password: 'theking', email: 'testing@test.com'
	});
	await user0.save();
	await user1.save();
	await user2.save();
});

after(function(done){
	mongoose.disconnect();
	done();
});

describe('The mongoose connect', function(){
	it('should connect to the mongoDB.', function(done){
		expect(mongoose.connection.readyState).to.equal(1);
		done();
	});
});

describe('User Collection', function(){
	it('should contain 3 user documents for test.', function(done){
		UserModel.find({}, function(err, result){
			expect(result.length).to.equal(3);
			done();
		});
	});
});

describe('User DAO: findUserById()', function(){
	it('should find the expected user documents', async function(){
		let user = await userDao.findUserById('test:violet');
		
		expect(user.name).to.equal('violet');
		expect(user.email).to.equal('testing@test.com');
	});
});

describe('User DAO: countUsers()', function(){
	it('should return 3 users', async function(){
		let count = await userDao.countUsers();
		expect(count).to.equal(3);
	});
});

describe('User DAO: createUser(user)', function(){
	it('should create a new user', async function(){
		let sample = UserModel({
			authId: 'test:create', name: 'Test Sample', password: 'theking', email: 'testing@test.com'
		});
		let newUser = await userDao.createUser(sample);
		expect(newUser.authId).to.equal('test:create');
		expect(newUser.name).to.equal('Test Sample');
	});
});





