var should = require('should');
var request = require('supertest');

var api = new request("http://blutag-dagwaging.rhcloud.com");

describe('Games', function() {
    var createdGame;

    describe('CreateGame', function(done) {
	it('should return a new Game instance', function(done) {
	    var game = {
		name : 'Test Game'
	    };

	    api.post("/games").send(game).set('Content-Type',
		    'application/json').expect(201).expect('Content-Type',
		    /json/).end(function(err, res) {
		if (err) {
		    done(err);
		}

		res.should.have.property('body');
		res.body.should.have.property('_id');
		res.body.should.have.property('name', 'Test Game');
		res.body.should.have.property('tags', []);
		res.body.should.have.property('players', []);

		createdGame = res.body;

		done();
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
		    'application/json').expect(200, done).end(
		    function(err, res) {
			if(err) {
			    done(err);
			}
			
			res.should.eql(createdGame);
			
			done();
		    });
	});
    });
});