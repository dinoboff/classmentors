/**
 * It should be served by ./bin/server who will provide `firebaseUrl`.
 *
 */
exports.module = function(angular, config) {
  'use strict';

  angular.module('clmMocked', ['clm', 'ngMockE2E']).

  constant('firebaseConfig', config).

  config([
    'clmFirebaseRefProvider',
    function(clmFirebaseRefProvider) {
      clmFirebaseRefProvider.setBaseUrl(config.url);
    }
  ]).

  config([
    '$provide',
    function($provide) {
      $provide.decorator('clmAuth', [
        '$q',
        '$delegate',
        '$firebaseAuth',
        'clmFirebase',
        function($q, $delegate, $firebaseAuth, clmFirebase) {
          var auth = $firebaseAuth(clmFirebase());

          $delegate.login = function() {
            return auth.$authWithCustomToken(config.tokens.bob).then(function(user) {
              $delegate.user = user.auth;
            });
          };

          return $delegate;
        }
      ]);
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
  ])

  ;

};
