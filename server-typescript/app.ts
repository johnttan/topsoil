/// <reference path="typings/hapi/hapi.d.ts"/>
/// <reference path="./server/processManager.ts"/>

var Hapi = require("hapi");
var processManager = require('./server/processManager');
var stateRoutes = require('./server/stateAPI/stateRoutes');
var nconf = require('nconf');
var opn = require('opn');

nconf.file({file: './default_config.json'}).argv().env();
// Global configuration
global.nconf = nconf;

//// Create a server with a host and port
var server = new Hapi.Server();
var setupSocketAPI = require('./server/processManager');

server.connection({
    host: 'localhost',
    port: nconf.get('port')
});

var io = require('socket.io')(server.listener);

setupSocketAPI(io);

stateRoutes(server);

server.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
        directory: {
            path: 'client'
        }
    }
});

server.start();

console.log('started server on port: ' + nconf.get('port'));
opn('http://localhost:' + nconf.get('port'));
