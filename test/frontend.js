var request = require('superagent');
var expect = require('expect.js');

var boot = require('../app').boot;
var shutdown = require('../app').shutdown;
var port = require('../app').port;

describe('Start server', function() {
   // first things first, start the application
   before(function(done) {
      boot();
      setTimeout(done, 1000);
   });

   // get the index page
   describe('GET /index.html', function() {
      it('respond with html', function(done) {
         request
            .get('http://localhost:' + port)
            .end(function(err, res) {
               expect(res.status).to.equal(200);
               done();
            });
      });
   });

   after(function(done) {
      shutdown();
      done();
   });

});
