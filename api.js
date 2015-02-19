var mongodb = require('mongodb');
var https = require('https');
var querystring = require('querystring');
var JSONStream = require('JSONStream');
var url = require('url');

exports = module.exports = createApi;

function createApi(db) {
    var self = this;

    self.key = 'AIzaSyBLBoExJLSqP0yRLHJNfTLVyKE-GpcERJ8';

    self.games = db.collection('games');

    self.middleware = function(req, res, next) {
	if (typeof(req.header['Content-Type']) === "undefined") {
		req.header['Content-Type'] = 'application/json';
	}
	else if (req.header['Content-Type'] != 'application/json') {
		res.status(415).send('Bad Content-Type ' + req.header['Content-Type']);
		return;
	}

	res.set('Content-Type', 'application/json');
	next();
    };

    self.getGames = function(req, res) {
	var players = req.query.players;

	if (typeof players === 'undefined') {
	    self.games.find({}, {
		'players.pushId' : 0,
		'players.authToken' : 0
	    }, function(err, result) {
		if (err) {
		    console.log(err);
		    res.status(500).send();
		} else {
		    result.stream().pipe(JSONStream.stringify()).pipe(res);
		}
	    });
	} else {
	    var playerList = players.split(',');

	    var playerQueries = [];

	    for ( var i in playerList) {
		playerQueries[i] = {
			players: {
				$elemMatch: {
					address: playerList[i],
					left: false
				}
			}
		};
	    }

	    self.games.find({
		$or : playerQueries
	    }, {
		'players.pushId' : 0,
		'players.authToken' : 0
	    }, function(err, result) {
		if (err) {
		    console.log(err);
		    res.status(500).send();
		} else {
		    result.stream().pipe(JSONStream.stringify()).pipe(res);
		}
	    });
	}
    };

    self.createGame = function(req, res) {
	var game = {
	    name : req.body.name,
	    playerCount : 0
	};

	game.tags = [];
	game.players = [];

	self.games.insert(game, function(err, inserted) {
	    if (err) {
		console.log(err);
		res.status(500).send();
	    } else {
		res.status(201).send(game);
	    }
	});
    };

    self.getGame = function(req, res) {
	try {
	    var id = mongodb.ObjectID(req.params.id);
	} catch (err) {
	    res.status(404).send('Invalid game id.');

	    return;
	}

	self.games.findOne({
	    _id : id
	}, {
	    'players.pushId' : 0,
	    'players.authToken' : 0
	}, function(err, result) {
	    if (result) {
		res.status(200).send(result);
	    } else {
		if (err) {
		    res.status(500).send(err);
		} else {
		    res.status(404).send(
			    'Game ' + req.params.id + ' does not exist.');
		}
	    }
	});
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

		self.games.findAndModify({
		    _id : mongodb.ObjectID(req.params.id)
		}, {}, {
		    $push : {
			tags : tag
		    }
		}, {'new': true}, function(err, updated) {
		    if (err) {
			console.log(err);
			res.status(500).send();
		    } else {
			res.status(201).send(tag);

			self.notifyAll({"tag": tag}, updated);
		    }
		});
	    } else {
		res.status(404).send();
	    }
	});
    };

    self.start = function(req, res) {
	self.games.findOne({
		_id : mongodb.ObjectID(req.params.id)
	}, {}, function(err, game) {
		if(game.tags.length > 0) {
			res.status(400).send("Game is already started");

			return;
		}

		var index = Math.floor(Math.random() * game.playerCount);
		var j = 0;
		var it;

		for(var i in game.players) {
			if(j == index) {
				it = game.players[i];
				break;
			}
			if(!game.players[i].left) {
				j++;
			}
		}

		var tag = {
			time : new Date().getTime(),
			player : it.address
		};
		
		self.games.findAndModify({
		    _id : mongodb.ObjectID(req.params.id)
		}, {}, {
		    $push : {
			tags : tag
		    }
		}, {'new': true}, function(err, updated) {
		    if (err) {
			console.log(err);
			res.status(500).send();
		    } else {
			res.status(201).send(tag);

			self.notifyAll({"tag": tag}, updated);
		    }
		});
	});
    };

    self.join = function(req, res) {
	if (!req.body) {
	    res
		    .status(400)
		    .send(
			    'Missing request body. See http://docs.blutag.apiary.io/#post-%2Fgames%2F%7Bid%7D%2Fplayers for more information.');
	    return;
	}

	var player = {
	    address : req.body.address,
	    pushId : req.body.pushId,
	    authToken : req.header('Authorization'),
	    familyName : '',
	    givenName : '',
	    image : '',
	    left: false
	};

	if (!player.authToken) {
	    res
		    .status(401)
		    .send(
			    'Missing Authorization header. This header should contain the player\'s Google+ auth token.');
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

	self.getUser(player.authToken, function(authRes, person) {
	    if (person) {
		if (!person.name || !person.image) {
		    res.status(authRes.statusCode).send(person);

		    return;
		}

		player.givenName = person.name.givenName;
		player.familyName = person.name.familyName;

		var image = url.parse(person.image.url, false);
		image.query = null;
		image.search = null;

		player.image = url.format(image);

		self.games.findAndModify({
		    _id : mongodb.ObjectID(req.params.id)
		}, {}, {
		    $pull : {
			players : {
				address : player.address
			}
		    }
		}, {'new': true}, function(err, updated) {
		    if (err) {
			console.log(err);
			res.status(500).send(
				'Error writing player to database.');
		    } else {
			self.games.findAndModify({
				_id : mongodb.ObjectID(req.params.id)
			}, {}, {
				$push : {
					players : player
				},
				$inc : {
					playerCount : 1
				}
			}, {'new': true}, function(err, updated) {
				if (err) {
					console.log(err);
					res.status(500).send(
						'Error writing player to database.');
				} else {
					delete player.pushId;
					delete player.authToken;

					res.status(201).send(player);

					self.notifyAll({"joined": player}, updated);
				}
			});
		    }
		});
	    } else {
		res.status(500).send('Unable to authorize to Google+.');
	    }
	});
    };

    self.getUser = function(authToken, callback) {
	https
		.get(
			{
			    host : "www.googleapis.com",
			    path : '/plus/v1/people/me?fields=image%2Furl%2Cname(familyName%2CgivenName)',
			    headers : {
				Authorization : 'Bearer ' + authToken
			    }
			}, function(res) {
			    var body = "";

			    res.on('data', function(chunk) {
				body += chunk;
			    }).on('end', function() {
				if (body.length == 0) {
				    callback(res, null);
				} else {
				    callback(res, JSON.parse(body));
				}
			    });
			});
    };

    var leave = function(game, player, callback) {
	self.games.findAndModify({
	    _id : mongodb.ObjectID(game),
	    'players.authToken': player
	}, {}, {
	    $set : {
		'players.$.left' : true
	    },
	    $inc : {
		playerCount : -1
	    }
	}, {'new': true}, function(err, updated) {
		callback(err);

		self.games.findOne({
			_id : mongodb.ObjectID(game)
		}, {
			players: {
				$elemMatch: {
					authToken: player
				}
			}
		}, {}, function(err, game) {
			var player = game.players[0];

			if(player) {
				self.notifyAll({"left": player}, updated);
			}

			if ((updated.tags.length > 0 && updated.playerCount <= 2) || (updated.tags.length == 0 && updated.playerCount == 0)) {
			    self.games.remove({
				_id : mongodb.ObjectID(updated._id)
			    }, function(err, num) {
				
			    });
			}
		});
	});
    };

    self.leave = function(req, res) {
	if (!req.body) {
	    res
		    .status(400)
		    .send(
			    'Missing Authorization header. This header should contain the player\'s Google+ auth token.');
	    return;
	}

	leave(req.params.id, req.header('Authorization'), function(err) {
		if(err) {
			console.log(err);
			res.send(500).send();
		} else {
			res.send(204).send();
		}
	});
    };

    self.notifyAll = function(data, game) {
	var ids = [];
	var players = [];

	for(var i in game.players) {
		var player = game.players[i];

		if(!player.left) {
			ids.push(player.pushId);
			players.push(player);
		}
	}

	if(ids.length > 0) {
		self.notify(data, ids, game, players);
	}
    };

    self.notify = function(data, list, game, players) {
	var message = {
	    'data' : data,
	    'registration_ids' : list
	};

	console.log(JSON.stringify(message));

	var options = {
	    hostname : 'android.googleapis.com',
	    path : '/gcm/send',
	    method : 'POST',
	    headers : {
		'Authorization' : 'key=' + self.key,
		'Content-Type' : 'application/json'
	    }
	};

	var request = https.request(options, function(res) {
		var data = '';
		
		if(res.statusCode != 200) {
			res.pipe(process.stdout);
			return;
		}

		res.setEncoding('utf8');

		res.on('data', function(chunk) {
			data += chunk;
		}).on('end', function() {
			var message = JSON.parse(data);

			if(message.failure > 0) {
				for(var i in message.results) {
					var result = message.results[i];

					if(result.error) {
						leave(game._id, players[i].authToken, function(err) {
							if(err) {
								console.log(err);
							}
						});
					}
				}
			}
		});
	});

	request.end(JSON.stringify(message));
    }
}
