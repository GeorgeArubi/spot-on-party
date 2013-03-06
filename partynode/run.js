#!/usr/local/bin/node
/*jshint browser:false, node:true, nonew:false */

(function () {
    "use strict";

    var express = require('express');
    var app = express();
    var server = require('http').createServer(app);
    var socket_io = require('socket.io');
    var domain = require('domain');
    var winston = require("winston");
    var mongodb = require('mongodb');
    var config = require("./config");
    var partyconnection = require("./partyconnection");

    var db_error_domain = domain.create();

    db_error_domain.on("error", function (er) {
        winston.error("Error with database connection: " + er + "\n" + er.stack);
    });


    server.listen(8081);

    app.get('/', function (req, res) {
        res.sendfile(__dirname + '/index.html');
    });

    app.use('/app', express.static(__dirname + '/../app'));
    app.use('/app/shared', express.static(__dirname + '/../shared'));

    var mongoServer = new mongodb.Server(config.db.host, config.db.port, config.db.serverOptions);
    var db = new mongodb.Db(config.db.database, mongoServer, config.db.dbOptions);
    winston.info("STARTUP: connecting to database");
    db.open(db_error_domain.intercept(function () {
        db.authenticate(config.db.username, config.db.password, db_error_domain.intercept(function (success) {
            if (!success) {
                throw "DB authentication denied";
            }
            winston.info("STARTUP: connected");
            var db_collections = {
                actions: new mongodb.Collection(db, "actions"),
                partyindex: new mongodb.Collection(db, "partyindex"),
            };

            var io = socket_io.listen(server);
            io.set("authorization", partyconnection.Connection.authorize);
            io.set('log level', 1);
            io.sockets.on('connection', function (socket) {
                var connection = new socket.handshake.partynode.ConnectionClass(socket, db_collections, db_error_domain, socket.handshake.partynode);
                connection.listen();
            });

        }));
    }));

    setInterval(function () {
        ['http', 'https'].forEach(function (protocolname) {
            winston.info("Status " + (new Date()).toGMTString());
            var protocol = require(protocolname);
            var connectioncount = Object.keys(protocol.globalAgent.sockets).map(function (domain) {
                return domain + ": " + protocol.globalAgent.sockets[domain].length;
            });
            winston.info(protocolname + " connections (" + connectioncount.length + "): " + connectioncount.join(", "));
        });
    }, 60 * 60 * 1000);
})();

