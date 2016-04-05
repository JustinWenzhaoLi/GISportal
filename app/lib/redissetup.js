
var redis = {};

module.exports = redis;

redis.startRedis = function(app, config) {
   // Redis config 
   var url = require('url');
   var redis = require('redis')

   var redisConfig = url.parse(config.redisURL);
   var redisClient = redis.createClient(redisConfig.port, redisConfig.hostname);

   redisClient
      .on('error', function(err) {
         console.log('Error connecting to redis %j', err);
      }).on('connect', function() {
         // no need to do anything
      }).on('ready', function() {
         // no need to do anything
      });

   return redisClient;
}