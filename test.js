START /b mongod --dbpath ..\ >..\logs\mongodb.log
mongo blutag --eval "db.games.remove()"
START /b node server.js
mocha
