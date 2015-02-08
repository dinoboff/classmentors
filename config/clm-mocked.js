/**
 * It should be served by ./bin/server who will provide `firebaseUrl`.
 *
 */
exports.module = function(angular, firebaseUrl) {
  'use strict';

  angular.module('clmMocked', ['clm', 'ngMockE2E']).

  config([
    'clmFirebaseRefProvider',
    function(clmFirebaseRefProvider) {
      clmFirebaseRefProvider.setBaseUrl(firebaseUrl);
    }
  ]).

  run([
    '$httpBackend',
    function($httpBackend) {
      // Requests to mock


      // Anything else should pass.
      //
      $httpBackend.whenGET(/.*/).passThrough();
      $httpBackend.whenPOST(/.*/).passThrough();
      $httpBackend.whenPUT(/.*/).passThrough();
      $httpBackend.whenDELETE(/.*/).passThrough();
      $httpBackend.whenJSONP(/.*/).passThrough();
    }
  ]);

};
