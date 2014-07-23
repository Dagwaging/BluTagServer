#!/bin/env node
// OpenShift sample Node application
var express = require('express');
var mongodb = require('mongodb');
var fs      = require('fs');
var api	    = require('./api');


/**
 * Define the application.
 */
var BluTag = function() {

    // Scope.
    var self = this;


    /* ================================================================ */
    /* Helper functions. */
    /* ================================================================ */

    /**
     * Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        // Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;
        
        self.dbhost    = process.env.OPENSHIFT_MONGODB_DB_HOST;
        self.dbport    = process.env.OPENSHIFT_MONGODB_DB_PORT || 27017;

        if (typeof self.ipaddress === "undefined") {
            // Log errors on OpenShift but continue w/ 127.0.0.1 - this
            // allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
        
        if (typeof self.dbhost === 'undefined') {
            // Log errors on OpenShift but continue w/ 127.0.0.1 - this
            // allows us to run/test the app locally.
            console.warn('No OPENSHIFT_MONGODB_DB_HOST var, using 127.0.0.1');
            self.dbhost = "127.0.0.1";
        }
    };


    /**
     * terminator === the termination handler Terminate server on receipt of the
     * specified signal.
     * 
     * @param {string}
     *                sig Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     * Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        // Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /* ================================================================ */
    /* App server functions (main app logic here). */
    /* ================================================================ */

    /**
     * Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
	self.api = new api(self.db);
	
        self.app.get('/games', self.api.getGames);
        
        self.app.post('/games', self.api.createGame);
        
        self.app.get('/games/:id', self.api.getGame);
        
        self.app.post('/games/:id/tags', self.api.tag);
        
        self.app.post('/games/:id/players', self.api.join);
        
        self.app.delete('/games/:id/players', self.api.leave);
    };


    /**
     * Initialize the server (express) and create the routes and register the
     * handlers.
     */
    self.initializeServer = function() {
        self.app = express.createServer();
        
        self.app.use(api.middleware);
        self.app.use(express.json());

        self.createRoutes();
    };

    
    /**
     * Initialize the database (mongodb) and connect to it
     */
    self.initializeDb = function() {
	mongodb.MongoClient.connect('mongodb://admin:pnnMptqKNB6k@' + self.dbhost + ':' + self.dbport + '/blutag', function(err, db) {
	    if(err) {
		console.log(err);
		
		return;
	    }
	    
	    self.db = db;
	    
	    self.db.createCollection('games', function(err, collection) {
		if(err)
		    console.log(err);
	    });
	    
	    // Create the express server and routes.
	    self.initializeServer();
	    
	    self.start();
	});
    };

    /**
     * Initializes the application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.setupTerminationHandlers();
        
        // Create the database and tables
        self.initializeDb();
    };


    /**
     * Start the server (starts up the application).
     */
    self.start = function() {
        // Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /* BluTag */



/**
 * main(): Main code.
 */
var zapp = new BluTag();
zapp.initialize();

