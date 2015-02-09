var should = require('should');
var request = require('supertest');
var mongodb = require('mongodb');
var spawn = require('child_process').spawn;
var fs = require('fs');

var zaneToken = '1/0-hjiZZm1VFzOBZ3-Az2pKN-EkAbWGQhGASMe-RW7sA';

describe('Local integration test', function () {
	var api = new request("localhost:8080");
	var createdGame;

	var mongoProcess = null,
		nodeProcess = null;

	before(function (done) {
		this.timeout(10000);

		getMongoConnection(function (err, _mongoProcess) {
			mongoProcess = _mongoProcess;

			if (err) {
				done(err);
			} else {
				getNodeConnection(function (err, _nodeProcess) {
					nodeProcess = _nodeProcess;

					done(err);
				}, function (code) {
					if (nodeProcess == null) {
						done(new Error('node exited with code ' + code));
					}
				});
			}
		}, function (code) {
			if (mongoProcess == null) {
				done(new Error('mongo exited with code ' + code));
			}
		});

	});

	after(function () {
		if (mongoProcess) {
			mongoProcess.kill('SIGINT');
		}

		if (nodeProcess) {
			nodeProcess.kill('SIGINT');
		}
	});

	describe('Games', function () {
		describe('CreateGame', function () {
			it('should return a new Game instance', function (done) {
				var game = {
					name: 'Test Game'
				};

				api.post("/games").send(game).set('Content-Type', 'application/json').expect(201).expect('Content-Type', /json/).end(

				function (err, res) {
					res.body.should.have.property('_id');
					res.body.should.have.property('name', 'Test Game');
					res.body.should.have.property('playerCount', 0)
					res.body.should.have.property('tags', []);
					res.body.should.have.property('players', []);
					res.body.should.have.keys('_id', 'name', 'playerCount', 'tags', 'players');

					createdGame = res.body;

					done(err);
				});
			});
		});

		describe('CreateGameBadJSON', function () {
			it('should respond with a 400', function (done) {
				var game = '{ "name": "Test }';

				api.post('/games').send(game).set('Content-Type', 'application/json').expect(400, done);
			});
		});

		describe('GetGame', function () {
			it('should return a Game instance', function (done) {
				api.get('/games/' + createdGame._id).send().set('Accept', 'application/json').expect(200).end(

				function (err, res) {
					res.body.should.eql(createdGame);

					done(err);
				});
			});
		});

		describe('GetInvalidGame', function () {
			it('should respond with a 404 and an error message', function (done) {
				api.get('/games/invalidgameid').send().set('Accept', 'application/json').expect(
				404).expect('Invalid game id.', done);
			});
		});

		describe('GetNonexistentGame', function () {
			it('should respond with a 404', function (done) {
				api.get('/games/53b5bcdbe0b8cdf1dd000910').send().set('Accept', 'application/json').expect(404, done);
			});
		});
	});

	describe('Auth', function () {
		it('should get an auth token for the test user', function (done) {
			auth(zaneToken, function (err, authToken) {
				done(err);
			});
		});
	});

	describe('Players', function () {
		var authToken = '';

		var createdPlayer;

		describe('Join', function () {
			it('should return a Player instance and add a Player to the Game', function (done) {
				this.timeout(5000);

				var player = {
					address: 'fakemacaddress',
					pushId: 'fakepushid'
				};

				auth(
				zaneToken, function (err, token) {
					authToken = token;

					api.post('/games/' + createdGame._id + '/players').send(
					player).set('Content-Type', 'application/json').set('Authorization', authToken).expect(201).end(

					function (
					err, res) {
						res.body.should.have.property('address', player.address);
						res.body.should.have.property('givenName', 'Zane');
						res.body.should.have.property('familyName', 'Geiger');
						res.body.should.have.property('image');
						res.body.should.have.property('left', false);
						res.body.should.have.keys('address', 'givenName', 'familyName', 'image', 'left');

						createdPlayer = res.body;

						done(err);
					});
				});
			});
		});

		describe('JoinBadAuth', function () {
			it('should respond with a 401', function (done) {
				this.timeout(10000);

				var player = {
					address: 'secondfakemac',
					pushId: 'secondfakepush'
				};

				var authToken = 'badAuthToken';

				api.post('/games/' + createdGame._id + '/players').send(player).set('Content-Type', 'application/json').set('Authorization', authToken).expect(401, done);
			});
		});

		describe('GetGameWithPlayer', function () {
			it('should return a Game instance with a player', function (done) {
				api.get('/games/' + createdGame._id).set('Accept', 'application/json').send().expect(200).end(

				function (err, res) {
					var expectedGame = {
						_id: createdGame._id,
						name: createdGame.name,
						playerCount: 1,
						tags: [],
						players: [{
							address: 'fakemacaddress',
							givenName: 'Zane',
							familyName: 'Geiger',
							image: createdPlayer.image,
							left: false
						}]
					};

					res.body.should.eql(expectedGame);

					done(err);
				});
			});
		});

		describe('GetGamesWithPlayer', function () {
			it('should return an array containing a Game instance with a player', function (done) {
				api.get('/games').set('Accept', 'application/json').expect(200).end(

				function (err, res) {
					var expectedGames = [{
						_id: createdGame._id,
						name: createdGame.name,
						playerCount: 1,
						tags: [],
						players: [{
							address: 'fakemacaddress',
							givenName: 'Zane',
							familyName: 'Geiger',
							image: createdPlayer.image,
							left: false
						}]
					}];

					res.body.should.eql(expectedGames);

					done(err);
				});
			});
		});

		describe('SecondPlayerJoinAndLeave', function () {
			it('should respond with a 204 and remove the Player from the Game', function (done) {
				api['delete']('/games/' + createdGame._id + '/players').set('Authorization', authToken).send().expect(204, done);
			});
		});
	});
});

// Helper function to obtain a test account auth token
var auth = function (refreshToken, callback) {
		request('https://accounts.google.com').post('/o/oauth2/token').field('client_id', '812914528803-vac0gl87n5m1stic9bh6canraictkjd2.apps.googleusercontent.com').field('client_secret', 'haG5gwtoMptgfRlxpVHRFcvQ').field('refresh_token', refreshToken).field('grant_type', 'refresh_token').end(function (err, res) {
			if (err) {
				callback(err, null);
			} else {
				callback(err, res.body.access_token);
			}
		});
	};

var getMongoConnection = function (done, exited) {
		var mongoLog = fs.createWriteStream('test/mongodb.log');

		checkMongoConnection(function (err) {
			if (err) {
				initMongo(mongoLog, function (mongoProcess) {
					checkMongoConnection(function (err) {
						done(err, mongoProcess);
					});
				}, function (code) {
					exited(code);

					mongoLog.close();
				});
			} else {
				done(null, null);
			}
		});
	};

var getNodeConnection = function (done, exited) {
		var nodeLog = fs.createWriteStream('test/node.log');

		checkNodeConnection(function (err) {
			if (err) {
				initNode(nodeLog, function (nodeProcess) {
					checkNodeConnection(function (err) {
						done(err, nodeProcess);
					});
				}, function (code) {
					exited(code);

					nodeLog.close();
				});
			} else {
				done(null, null);
			}
		});
	};

var checkMongoConnection = function (done) {
		mongodb.MongoClient.connect('mongodb://127.0.0.1:27017/blutag', function (
		err, db) {
			if (err) {
				done(err);
			} else {
				db.collection('games').remove(function (err) {
					done(err);
				});
			}
		});
	};

var checkNodeConnection = function (done) {
		new request('http://127.0.0.1:8080/games').get().end(function (err, res) {
			done(err);
		});
	};

var initMongo = function (log, started, exited) {
		var mongoProcess = spawn('mongod', ['--dbpath', 'test/db', '--config', 'test/test.conf'], {
			stdio: 'pipe'
		});

		mongoProcess.stdout.on('data', function (data) {
			if (/\[initandlisten\] waiting for connections/.test(data)) {
				started(mongoProcess);
			}
		});

		mongoProcess.stdout.pipe(log);
		mongoProcess.stderr.pipe(log);

		mongoProcess.stdout.on('finish', function () {
			log.end();
		});

		mongoProcess.on('exit', function (code, signal) {
			exited(code);
		});
	};

var initNode = function (log, started, exited) {
		process.env.OPENSHIFT_NODEJS_IP = '127.0.0.1';
		process.env.OPENSHIFT_NODEJS_PORT = 8080;

		var nodeProcess = spawn('node', ['server.js'], {
			stdio: 'pipe'
		});

		nodeProcess.stdout.on('data', function (data) {
			if (/Node server started/.test(data)) {
				started(nodeProcess);
			}
		});

		nodeProcess.stdout.pipe(log);
		nodeProcess.stderr.pipe(log);

		nodeProcess.stdout.on('finish', function () {
			log.end();
		});

		nodeProcess.on('exit', function (code, signal) {
			exited(code);
		});
	};
