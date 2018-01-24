
module.exports = [
  {
    id: '58bcd5abe01a7c47b882127b',
    title: 'title-teemo',
    content: 'content-teemo',
    anonymous: true,
    author: {
      authId: "app:teemo",
      name: "Teemo"
    },
    createdAt: new Date('2018-01-01T12:30:26.000Z'),
    expiry: new Date('2028-08-06T13:24:26.000Z'),
    likeCount: 2,
    likes: ['app:tester01', 'app:tester02']
  }, {
    id: '58bcd88faa1bf8345c5daf35',
    title: 'title-sona',
    content: 'content-sona',
    anonymous: true,
    author: {
      authId: "app:sona",
      name: "Sona"
    },
    createdAt: new Date('2018-01-02T12:30:26.000Z'),
    expiry: new Date('2028-08-02T13:24:26.000Z'),
    likeCount: 5,
    likes: ['app:tester01', 'app:tester02', 'app:teemo', 'app:tester03', 'app:tester04']
  }
];
