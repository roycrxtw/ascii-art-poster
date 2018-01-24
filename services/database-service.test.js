
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const connectionOptions = {
  keepAlive: 300000,
  connectTimeoutMS: 50000
}; 

const service = require('./database-service');

const GHOST_ID = '594187daf36d2813bffc79ba';
const rawPostSamples = require('../test/post-samples');
const postSampleCount = rawPostSamples.length;

// advanced process for postSamples
const postSamples = rawPostSamples.map(item => {
  item['_id'] = mongo.ObjectId(item.id);
  console.log(`new id=`, mongo.ObjectId.isValid(item['_id']));
  return item;
});

let client = null;
let db = null;

describe('DBService: posts collection', () => {
  let testCollection = null;

  beforeAll(async () => {
    await service.init('mongodb://localhost:27017/', 'test-asciiarts');
    client = await MongoClient.connect('mongodb://localhost:27017', connectionOptions);
    db = client.db('test-asciiarts');
    testCollection = db.collection('posts');
  });

  afterAll( (done) => {
    client.close();
    service.close();
    done();
  });

  beforeEach(async () => {
    const result = await testCollection.insertMany(postSamples);
    expect(result.result.n).toBe(postSamples.length);
  });

  afterEach( (done) => {
    testCollection.remove({}, (err, result) => {
      expect(err).toBeNull();
      done();
    });
  });

  describe(`Ensure the testing collection is online`, () => {
    test(`should has expected size of post samples`, async () => {
      testCollection.find().toArray( (err, docs) => {
        expect(err).toBeNull();
        expect(docs.length).toBe(postSampleCount);
      });
    });
  });

  describe('readPost()', () => {
    test('should return null if postId is empty string', async () => {
      let result = await service.readPost('');
      expect(result).toBe(null);
    });

    test('should throw a TypeError if postId is not a string', async () => {
      try{
        await service.readPost(56);
      }catch(ex){
        expect(ex.name).toBe('TypeError');
      }
    });

    test(`should return null if the post does not exist`, async () => {
      const post = await service.readPost(GHOST_ID);
      expect(post).toBeNull();
    });

    test(`should return an expected post for the given postId`, async () => {
      const post = await service.readPost('58bcd5abe01a7c47b882127b');
      expect(post).toEqual(postSamples[0]);
    });
  });

  describe('deletePost()', () => {
    test('should return false if postId is empty string', async () => {
      const flag = await service.deletePost('');
      expect(flag).toBeFalsy();
    });

    test('should return true if the post did delete', async () => {
      const flag = await service.deletePost('58bcd5abe01a7c47b882127b');
      expect(flag).toBe(true);

      const docs = await testCollection.find().toArray();
      expect(docs.length).toBe(1);
      expect(docs[0]).toEqual(postSamples[1]);
    });

    test('should return false if the post does not exist', async () => {
      const flag = await service.deletePost(GHOST_ID);
      expect(flag).toBe(false);

      const docs = await testCollection.find().toArray();
      expect(docs.length).toBe(2);
    });
  });
});
