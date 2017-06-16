
// TDD practice

'use strict';

var expect = require('chai').expect;
var PasswordService = require('../services/password-service');

describe('PasswordService.generateSalt(), async generate salt', function(){
	it('should be always size 29', async function(){
		for(let i = 0; i < 200; i++){
			let salt = await PasswordService.generateSalt(12);
			expect(salt.length).to.equal(29);
		}
	});
});

describe('PasswordService.hash(), asynchronous hash password', function(){
	it('should be same everytime with the same salt', async function(){
		let salt = '$2a$10$4l3wgfZ/4QkrFKI4Bl9/Bu';
		let plainPassword = 'testingPassWord';
		let hash0 = await PasswordService.hash(plainPassword, salt);
		for(let i = 0; i < 5; i++){
			let hash = await PasswordService.hash(plainPassword, salt);
			expect(hash).to.equal(hash0);
		}
	});
});

describe('PasswordService.compare(), compare two passwords', function(){
	it('should be same', async function(){
		let plainPassword = 'forthehorde';
		// pre-generated salt and hashed password
		let hash = '$2a$10$njjAJvCFITgtFn4.PDt17eo7qgbA2IcOOaf7.UOEQnSvuBtMlYRC.';
		
		// usage: boolean compare(plainData, hashedData);
		let result = await PasswordService.compare(plainPassword, hash);
		expect(result).to.equal(true);
	});
});

