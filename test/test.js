var should = require('should');
var request = require('supertest');

var api = new request("http://blutag-dagwaging.rhcloud.com");

describe('Games', function() {
    describe('CreateGame', function(done) {
	it('should return a new Game instance', function(done) {
	    var game = {
		name : 'Test Game'
	    };

	    api.post("/games").send(game).set('Content-Type',
		    'application/json').expect(201).expect('Content-Type',
		    /json/).end(function(err, res) {
		if (err) {
		    throw err;
		}

		res.should.have.property('body');
		res.body.should.have.property('id');
		res.body.should.have.property('name', 'Test Game');
		res.body.should.have.property('tags', []);
		res.body.should.have.property('players', []);
	    });
	});
    });
});