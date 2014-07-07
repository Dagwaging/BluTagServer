exports = module.exports = createApi;

function createApi(db) {
    var self = this;

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
		    address : playerList[i]
		};
	    }

	    cursor = self.games.find({
		$or : playerQueries
	    });
	}

	cursor.toArray(function(err, docs) {
	    res.status(200).send(docs);
	});
    };

    self.createGame = function(req, res) {
	var game = req.body;

	game.tags = [];
	game.players = [];

	self.games.insert(game, function(err, inserted) {
	    if (err)
		console.log(err);
	    else
		res.status(201).send(game);
	});
    };

    self.getGame = function(req, res) {
	req.params.id;
    };

    self.tag = function(req, res) {
	req.params.id;
    };

    self.join = function(req, res) {
	var player = {
	    address : req.body.address,
	    pushId : req.body.pushId
	};

	self.games.update({
	    _id : mongo.ObjectID(req.params.id)
	}, {
	    $push : {
		players : player
	    }
	}, function(err, updated) {
	    if(err)
		console.log(err);
	    else
		res.status(201).send(player);
	});
    };

    self.leave = function(req, res) {
	req.params.id;
    };
}