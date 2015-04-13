/// <reference path="../../typings/node/node.d.ts"/>
/// <reference path="../utility/utility.ts"/>
/// <reference path="terminal.ts"/>
var fs = require('fs');
var _ = require('lodash');
var utility = require('../utility/utility');
var streaming = require('../streaming/streaming');
var createGenericStreamFunc = streaming.createGenericStream;
var createSpawnStreamFunc = streaming.createSpawnStream;

var fsAPI = <any> {};

fsAPI.ls = fsSingleWrapper(fs.readdir);

fsAPI.readFile = fsStreamWrapper(fs.createReadStream, ['dir'], 0);

fsAPI.writeFile = fsStreamWrapper(fs.createWriteStream, ['dir'], 1);

fsAPI.unlink = fsSingleWrapper(fs.unlink);

fsAPI.appendFile = fsStreamWrapper(fs.createWriteStream, ['dir'], 1, {
  flags: 'a'
});

fsAPI.mkdir = fsSingleWrapper(fs.mkdir);

fsAPI.rmdir = fsSingleWrapper(fs.rmdir);

fsAPI.listAllFilesAndDirs = function(opts){
  var listStream = createSpawnStreamFunc('ls', ['-R']);
  return listStream.pipe(fsSingleWrapper(listAllFilesAndDirs)());
};

function listAllFilesAndDirs (data, cb){
  function cleanFolder(folder: Array<string>) {
    if(_.first(folder) === ".") {
      folder = folder.slice(1);
    }

    //refactor this into a chain.
    if(_.endsWith(_.last(folder)), ":") {
      folder[folder.length - 1] = _.trimRight(_.last(folder), ":");
    }

    return folder;
  }

  function filterDirs(arr) {
    return arr.filter(function(file) { return file.indexOf(".") > -1});
  }
  var dirs = data.split("\n\n");
  /*
     The data comes in the format:

     ./dir_path
       file
       folder
       file

     ./dir_path2
       file
       ..
       ...
  */

  var pwdFiles = dirs[0].split("\n");
  dirs.shift(); //Get rid of pwd.

  var result = {files: filterDirs(pwdFiles), folders: {}};

  cb(null, dirs.reduce(function(result, dir) {
    var foldersAndFiles = dir.split("\n");
    var folder = cleanFolder(foldersAndFiles[0].split("/"));
    var files = filterDirs(foldersAndFiles.slice(1));
    var folderArr = _.range(0, folder.length).map(function() { return "folders" });

    return utility.updateIn(result, utility.interleave(folderArr, folder), {files: files, folders: {}});
  }, result));
}

module.exports = fsAPI;

function fsStreamWrapper(createStream, args, mode : number, options?){
  // Mode 0=read, 1=write, 2=duplex
  // Options will be default options passed in as last argument
  return function(opts){
    if(!opts.dir) opts.dir = '/';

    var arguments = args.map(function(arg){
        return opts[arg];
    });
    //check to see if there are additional arguments passed in
    if(opts.options){
        arguments.push(opts.options);
    }else{
        arguments.push(options);
    }
    var stream = createStream.apply(null, arguments);
    var returnStream;
    if(mode === 1){
      returnStream = createGenericStreamFunc(function(chunk : string, enc : string, cb){
        stream.write(chunk);
        cb();
      })
    }else{
      returnStream = stream;
    }

    return returnStream;
  }
};

function fsSingleWrapper(fsCallback){
  return function(){
    return createGenericStreamFunc(function(chunk, enc : string, cb){
      fsCallback(String(chunk), function(err, data){
        if(typeof data === 'object'){
          data = JSON.stringify(data);
        }else if(typeof data !== 'string'){
          data = String(data);
        }
        cb(err, data);
      })
    })
  }
};

function fsWrapper(fsCallback, args){
    return function(socket){
        return function(opts){
            //Set values for default directory and data if not provided, need to delete this later

            if(!opts.dir) opts.dir = '/';

            var arguments = args.map(function(arg){
                return opts[arg];
            });

            //check to see if there are additional arguments passed in
            if(opts.options){
                arguments.push(opts.options);
            }

            //push in a callback function that emits data to server
            arguments.push(function(err, data){
                socket.emit(opts.uid, utility.wrapperResponse(err, data));
            });

            fsCallback.apply(null, arguments);
        }
    }
}
