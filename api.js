var mongodb = require('mongodb');

exports = module.exports = createApi;

function createApi(db) {
    var self = this;

    self.key = 'AIzaSyBLBoExJLSqP0yRLHJNfTLVyKE-GpcERJ8';

    self.games = db.collection('games');

    self.getGames = function(req, res) {
	var players = req.query.players;

	var cursor;

	if (typeof players === 'undefined') {
	    cursor = self.games.find({});
	} else {
	    var playerList = players.split(',');

	    var playerQueries = [];

	    for ( var i in playerList) {
		playerQueries[i] = {
		    'players.address' : playerList[i]
		};
	    }

	    cursor = self.games.find({
		$or : playerQueries
	    }, {
		'players.authToken' : 0
	    });
	}

	cursor.toArray(function(err, docs) {
	    if (err) {
		console.log(err);
		res.status(500).send();
	    } else {
		res.status(200).send(docs);
	    }
	});
    };

    self.createGame = function(req, res) {
	var game = {
	    name : req.body.name
	};

	game.tags = [];
	game.players = [];

	self.games.insert(game, function(err, inserted) {
	    if (err) {
		console.log(err);
		res.status(500).send();
	    } else {
		res.status(201).set('Content-Type', 'application/json').send(game);
	    }
	});
    };

    self.getGame = function(req, res) {
	req.params.id;
    };

    self.tag = function(req, res) {
	var cursor = self.games.find({
	    _id : mongodb.ObjectID(req.params.id)
	}, {
	    players : {
		$elemMatch : {
		    authToken : req.header('Authorization')
		}
	    }
	});

	var address = cursor.nextObject(function(err, item) {
	    if (item) {
		var address = item.players[0].address;

		var tag = {
		    time : new Date().getTime(),
		    player : address
		};

		self.games.update({
		    _id : mongodb.ObjectID(req.params.id)
		}, {
		    $push : {
			tags : tag
		    }
		}, function(err, updated) {
		    if (err) {
			console.log(err);
			res.status(500).send();
		    } else {
			res.status(201).send(tag);
		    }
		});
	    } else {
		res.status(404).send();
	    }
	});
    };

    self.join = function(req, res) {
	var player = {
	    address : req.body.address,
	    pushId : req.body.pushId,
	    authToken : req.header('Authorization')
	};

	if (!req.body) {
	    res.status(400).send('Missing request body. See http://docs.blutag.apiary.io/#post-%2Fgames%2F%7Bid%7D%2Fplayers for more information.');
	    return;
	}

	if (!player.authToken) {
	    res.status(401).send('Missing Authorization header. This header should contain the player\'s Google+ auth token.');
	    return;
	}

	if (!player.address) {
	    res
		    .status(400)
		    .send(
			    'Missing address field. This field should contain the bluetooth MAC address of the player\'s device.');
	    return;
	}

	if (!player.pushId) {
	    res
		    .status(400)
		    .send(
			    'Missing pushId field. This field should contain the GCM id of the player\'s device.');
	    return;
	}

	self.games.update({
	    _id : mongodb.ObjectID(req.params.id)
	}, {
	    $push : {
		players : player
	    }
	}, function(err, updated) {
	    if (err) {
		console.log(err);
		res.status(500).send();
	    } else {
		res.status(201).send(player);
	    }
	});
    };

    self.leave = function(req, res) {
	if(! req.body) {
	    res.status(400).send('Missing Authorization header. This header should contain the player\'s Google+ auth token.');
	    return;
	}
	
	self.games.update({
	    _id : mongodb.ObjectID(req.params.id)
	}, {
	    $pull : {
		players : {
		    authToken : req.header('Authorization')
		}
	    }
	}, function(err, updated) {
	    if (err) {
		console.log(err);
		res.status(500).send();
	    } else {
		res.status(204).send();

		if (updated.players.length == 0) {
		    self.games.remove({
			_id : mongodb.ObjectID(updated._id)
		    });
		}
	    }
	});
    };

    self.notify = function(data, list) {
	var message = {
	    'data' : data,
	    'registration_ids' : list
	};

	var options = {
	    hostname : 'android.googleapis.com',
	    path : '/gcm/send',
	    method : 'POST',
	    headers : {
		'Authorization' : self.key,
		'Content-Type' : 'application/json'
	    }
	};

	var request = https.request(options, function(res) {

	});

	request.end(JSON.stringify(message));
    }
}