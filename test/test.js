var should = require('should');
var request = require('supertest');
var mongodb = require('mongodb');
var spawn = require('child_process').spawn;

var api = new request("localhost:8080");

var createdGame;

// Helper function to obtain a test account auth token
var auth = function(callback) {
    var refreshToken = '1/0-hjiZZm1VFzOBZ3-Az2pKN-EkAbWGQhGASMe-RW7sA';

    request('https://accounts.google.com')
	    .post('/o/oauth2/token')
	    .field('client_id',
		    '812914528803-vac0gl87n5m1stic9bh6canraictkjd2.apps.googleusercontent.com')
	    .field('client_secret', 'haG5gwtoMptgfRlxpVHRFcvQ').field(
		    'refresh_token', refreshToken).field('grant_type',
		    'refresh_token').end(function(err, res) {
		if (err) {
		    callback(err, null);
		} else {
		    callback(err, res.body.access_token);
		}
	    });
}

describe('Local integration test', function() {
    var mongoProcess = null;
    var nodeProcess = null;

    before(function(done) {
	this.timeout(10000);

	mongoProcess = spawn('mongod', [ '--dbpath', 'test' ], {
	    stdio : 'pipe'
	});
	
	var mongoOut = '';
	
	mongoProcess.stdout.on('data', function(data) {
	    mongoOut += data;
	    
	    if (/\[initandlisten\] waiting for connections/.test(data)) {
		mongodb.MongoClient.connect(
			'mongodb://127.0.0.1:27017/blutag',
			function(err, db) {
			    if (err) {
				done(err);
				return;
			    }

			    process.env.OPENSHIFT_NODEJS_IP = '127.0.0.1';
			    process.env.OPENSHIFT_NODEJS_PORT = 8080;
			    
			    nodeProcess = spawn('node', [ 'server.js' ], {
				stdio : 'pipe'
			    });
			    
			    var nodeOut = '';
			    
			    nodeProcess.stdout.on('data', function(data) {
				nodeOut += data;
				
				if (/Node server started/.test(data)) {
				    done();
				}
			    });
			    
			    nodeProcess.on('exit', function(code, signal) {
				console.log(nodeOut);
				
				done(new Error('node exited with code ' + code));

				nodeProcess = null;
			    });
			});
	    }
	});
	
	mongoProcess.on('exit', function(code, signal) {
	    console.log(mongoOut);
	    
	    done(new Error('mongod exited with code ' + code));

	    mongoProcess = null;
	});
    });

    after(function() {
	if (mongoProcess) {
	    mongoProcess.kill();

	    mongoProcess = null;
	}

	if (nodeProcess) {
	    nodeProcess.kill();

	    nodeProcess = null;
	}
    });

    describe('Games', function() {
	describe('CreateGame', function(done) {
	    it('should return a new Game instance', function(done) {
		var game = {
		    name : 'Test Game'
		};

		api.post("/games").send(game).set('Content-Type',
			'application/json').expect(201).expect('Content-Type',
			/json/).end(function(err, res) {
		    res.body.should.have.property('_id');
		    res.body.should.have.property('name', 'Test Game');
		    res.body.should.have.property('tags', []);
		    res.body.should.have.property('players', []);

		    createdGame = res.body;

		    done(err);
		});
	    });
	});

	describe('CreateGameBadJSON', function(done) {
	    it('should respond with a 400', function(done) {
		var game = '{ "name": "Test }';

		api.post('/games').send(game).set('Content-Type',
			'application/json').expect(400, done);
	    });
	});

	describe('GetGame', function(done) {
	    it('should return a Game instance', function(done) {
		api.get('/games/' + createdGame._id).send().set('Accept',
			'application/json').expect(200).end(function(err, res) {
		    res.body.should.eql(createdGame);

		    done(err);
		});
	    });
	});

	describe('GetInvalidGame', function(done) {
	    it('should respond with a 404 and an error message',
		    function(done) {
			api.get('/games/invalidgameid').send().set('Accept',
				'application/json').expect(404).expect(
				'Invalid game id.', done);
		    });
	});

	describe('GetNonexistentGame', function(done) {
	    it('should respond with a 404', function(done) {
		api.get('/games/53b5bcdbe0b8cdf1dd000910').send().set('Accept',
			'application/json').expect(404, done);
	    });
	});
    });

    describe('Auth', function(done) {
	it('should get an auth token for the test user', function(done) {
	    auth(function(err, authToken) {
		done(err);
	    });
	});
    });

    describe('Players', function() {
	describe('Join', function(done) {
	    it('should return a Player instance', function(done) {
		var player = {
		    address : 'fakemacaddress',
		    pushId : 'fakepushid'
		};

		auth(function(err, authToken) {
		    api.post('/games/' + createdGame._id + '/players').send(
			    player).set('Content-Type', 'application/json')
			    .set('Authorization', authToken).expect(201).end(
				    function(err, res) {
					res.body.should.have.property(
						'address', player.address);
					res.body.should.have
						.property('givenName');
					res.body.should.have
						.property('familyName');
					res.body.should.have.property('image');

					done(err);
				    });
		});
	    });
	})
    });
});
