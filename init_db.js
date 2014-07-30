var mongodb = new Mongo();
db = mongodb.getDB("blutag");

db.createCollection("games", {autoIndexId: true});
db.games.ensureIndex({"players.address": 1}, {unique: true, sparse: true});