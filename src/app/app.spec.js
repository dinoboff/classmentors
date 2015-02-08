/* jshint camelcase: false*/
/* global describe, beforeEach, module, it, inject, expect, jasmine */

(function() {
  'use strict';

  describe('clm', function() {

    /**
     * Test core singpath fire controllers.
     *
     */
    describe('controllers', function() {
      var $controller, $rootScope, $q;

      beforeEach(module('clm'));

      beforeEach(inject(function(_$rootScope_, _$q_, _$controller_) {
        $controller = _$controller_;
        $rootScope = _$rootScope_;
        $q = _$q_;
      }));


    });


    /**
     * Test core singpath fire services
     */
    describe('services', function() {


      describe('crypto', function() {

        describe('password', function() {
          var provider, crypto;

          beforeEach(module('clm', function(cryptoProvider) {
            provider = cryptoProvider;
          }));

          beforeEach(inject(function(_crypto_) {
            crypto = _crypto_;
          }));

          it('should create a hash using 256b hash (128b salt, 2024 iteration', function() {
            var hash = crypto.password.newHash('foo');

            expect(hash.options.hasher).toBe('PBKDF2');
            expect(hash.options.prf).toBe('SHA256');
            expect(hash.value.length).toBe(256 / 8 * 2); // 256 bit hex encoded
            expect(hash.options.salt.length).toBe(128 / 8 * 2); // 64 bit hex encoded
            expect(hash.options.iterations).toBe(2024);
          });

          it('should let you configure the hasher', function() {
            var hash;

            provider.setSaltSize(128 / 8);
            provider.setHashKeySize(128 / 32);
            provider.setIterations(100);

            hash = crypto.password.newHash('foo');

            expect(hash.value.length).toBe(128 / 8 * 2); // 256 bit hex encoded
            expect(hash.options.salt.length).toBe(128 / 8 * 2); // 64 bit hex encoded
            expect(hash.options.iterations).toBe(100);
          });

          it('should be able to create hash from salts and options', function() {
            var hash = crypto.password.fromSalt('password', '11111111', {
              keySize: 128 / 32,
              iterations: 10,
              prf: 'SHA1'
            });

            expect(hash).toBe('1a9e75789b45e1e072d420e2995ad5f9');
          });

        });

      });


      describe('clmDataStore', function() {

        beforeEach(module('clm'));

        describe('auth', function() {
          var clmFirebaseSync, clmAuth, sync, userObj;

          beforeEach(function() {
            sync = jasmine.createSpyObj('$angularfire', ['$asObject']);
            userObj = jasmine.createSpyObj('$firebaseObject', ['$loaded', '$save']);
            clmFirebaseSync = jasmine.createSpy().and.returnValue(sync);
            sync.$asObject.and.returnValue(userObj);
            clmAuth = {
              user: {
                uid: 'custome:1',
                google: {
                  displayName: 'Bob Smith'
                }
              }
            };

            module(function($provide) {
              $provide.value('clmFirebaseSync', clmFirebaseSync);
              $provide.value('clmAuth', clmAuth);
            });
          });

          it('should resolved to user data', function() {
            inject(function($q, $rootScope, clmDataStore) {
              var result;

              userObj.$loaded.and.returnValue($q.when(userObj));
              clmDataStore.auth.user().then(function(_result_) {
                result = _result_;
              });
              $rootScope.$apply();

              expect(result).toBe(userObj);
              expect(userObj.$save).not.toHaveBeenCalled();
            });
          });

          it('should return undefined if the user is not logged in', function() {
            inject(function($rootScope, clmDataStore) {
              var result, error;

              clmAuth.user = null;
              clmDataStore.auth.user().then(function(_result_) {
                result = _result_;
              }, function(e) {
                error = e;
              });

              $rootScope.$apply();
              expect(result).toBeUndefined();
              expect(error).toBeDefined();
            });
          });

          it('should setup user date', function() {
            inject(function($rootScope, $q, clmDataStore) {
              var result;

              userObj.$loaded.and.returnValue($q.when(userObj));
              userObj.$save.and.returnValue($q.when(true));
              userObj.$value = null;

              clmDataStore.auth.user().then(function(_result_) {
                result = _result_;
              });

              $rootScope.$apply();
              expect(result).toBe(userObj);
              expect(userObj.$value).toEqual({
                id: clmAuth.user.uid,
                nickName: clmAuth.user.google.displayName,
                displayName: clmAuth.user.google.displayName,
                createdAt: {'.sv': 'timestamp'}
              });
              expect(userObj.$save).toHaveBeenCalled();
            });
          });

        });

      });


      describe('clmFirebaseSync', function() {
        var $firebase, clmFirebaseRef, ref, sync;

        beforeEach(module('clm'));

        beforeEach(function() {
          ref = jasmine.createSpy('ref');
          sync = jasmine.createSpy('sync');
          $firebase = jasmine.createSpy('$firebase').and.returnValue(sync);
          clmFirebaseRef = jasmine.createSpy('clmFirebaseRef').and.returnValue(ref);

          module(function($provide) {
            $provide.value('$firebase', $firebase);
            $provide.value('clmFirebaseRef', clmFirebaseRef);
          });
        });

        it('should create an angularFire object', inject(function(clmFirebaseSync) {
          expect(clmFirebaseSync()).toBe(sync);
          expect($firebase).toHaveBeenCalledWith(ref);
          expect(clmFirebaseRef).toHaveBeenCalledWith();
        }));

        it('should create an angularFire object with ref to child', inject(function(clmFirebaseSync) {
          clmFirebaseSync(['foo', 'bar'], {limitToLast: 50});
          expect(clmFirebaseRef).toHaveBeenCalledWith(['foo', 'bar'], {limitToLast: 50});
        }));

      });


      describe('clmFirebaseRef', function() {
        var provider, factory, Firebase, firebaseSpy, clmFirebaseRef, ref;

        beforeEach(module('clm', function(clmFirebaseRefProvider) {
          var log = jasmine.createSpyObj('$log', ['info', 'debug']);
          provider = clmFirebaseRefProvider;
          factory = function() {
            return provider.$get.slice(-1).pop()({
              Firebase: Firebase
            }, log);
          };
        }));

        beforeEach(function(){
          firebaseSpy = jasmine.createSpy('Firebase');
          ref = jasmine.createSpyObj('ref', ['child', 'orderBy', 'limitToLast']);
          ref.child.and.returnValue(ref);
          ref.orderBy.and.returnValue(ref);
          ref.limitToLast.and.returnValue(ref);
          ref.path = {};
          Firebase = function(url) {
            firebaseSpy(url);
            this.child = ref.child.bind(ref);
            this.path = {};
          };
        });

        it('should return a Firebase ref', inject(function() {
          clmFirebaseRef = factory();
          expect(clmFirebaseRef().constructor).toBe(Firebase);
        }));

        it('should return ref to singpath database', function() {
          clmFirebaseRef = factory();
          clmFirebaseRef();
          expect(firebaseSpy).toHaveBeenCalledWith('https://singpath.firebaseio.com/');
        });

        it('should allow to configure the ref baseurl', function() {
          provider.setBaseUrl('https://singpath-dev.firebaseio.com/');
          clmFirebaseRef = factory();
          clmFirebaseRef();
          expect(firebaseSpy).toHaveBeenCalledWith('https://singpath-dev.firebaseio.com/');
        });

        it('should allow to point to a specific child path', function() {
          clmFirebaseRef = factory();
          clmFirebaseRef(['auth', 'users']);
          expect(ref.child.calls.count()).toBe(2);
          expect(ref.child.calls.argsFor(0)).toEqual(['auth']);
          expect(ref.child.calls.argsFor(1)).toEqual(['users']);
        });

        it('should allow to point to a specific query options', function() {
          expect(ref.child.calls.count()).toBe(0);
          clmFirebaseRef = factory();
          clmFirebaseRef(['events'], {
            orderBy: 'timestamps',
            limitToLast: 50
          });

          expect(ref.orderBy).toHaveBeenCalledWith('timestamps');
          expect(ref.limitToLast).toHaveBeenCalledWith(50);
        });

      });


      describe('clmAuth', function() {
        var auth, clmFirebaseRef;

        beforeEach(module('clm'));

        beforeEach(function() {
          var $firebaseAuth;

          clmFirebaseRef = jasmine.createSpy('clmFirebaseRef');
          auth = jasmine.createSpyObj('auth', ['$getAuth', '$authWithOAuthPopup', '$authWithOAuthRedirect', '$unauth']);
          $firebaseAuth = jasmine.createSpy('$firebaseAuth').and.returnValue(auth);

          module(function($provide) {
            $provide.value('clmFirebaseRef', clmFirebaseRef);
            $provide.value('$firebaseAuth', $firebaseAuth);
          });

        });

        it('should authenticate current user', function() {
          var user = {
            uid: '1234'
          };

          auth.$getAuth.and.returnValue(user);

          inject(function(clmAuth) {
            expect(clmAuth.user).toBe(user);
          });
        });

        it('should authenticate current user (guest)', function() {
          auth.$getAuth.and.returnValue(null);

          inject(function(clmAuth) {
            expect(clmAuth.user).toBeNull();
          });
        });


        describe('login', function() {
          var user;

          beforeEach(function() {
            user = {
              uid: '1234'
            };
          });

          it('should authenticate against a google account', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth) {
              auth.$authWithOAuthPopup.and.returnValue($q.when(user));

              clmAuth.login();
              expect(auth.$authWithOAuthPopup).toHaveBeenCalledWith('google');
            });
          });

          it('should set clmAuth.user on success', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth, $rootScope) {
              auth.$authWithOAuthPopup.and.returnValue($q.when(user));

              clmAuth.login();
              $rootScope.$apply();
              expect(clmAuth.user).toBe(user);
            });
          });

          it('should resolve to auth user on success', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth, $rootScope) {
              var result;

              auth.$authWithOAuthPopup.and.returnValue($q.when(user));

              clmAuth.login().then(function(resp) {
                result = resp;
              });

              $rootScope.$apply();
              expect(result).toBe(user);
            });
          });

          it('should reject on error', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth, $rootScope) {
              var result;
              var err = new Error();

              auth.$authWithOAuthPopup.and.returnValue($q.reject(err));

              clmAuth.login().catch(function(e) {
                result = e;
              });

              $rootScope.$apply();
              expect(result).toBe(err);
            });
          });

          it('should resolve to $firebaseAuth.$authWithOAuthRedirect promise when popup is not available', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth, $rootScope) {
              var result;
              var err = new Error();
              var redirectResult = {};

              err.code = 'TRANSPORT_UNAVAILABLE';
              auth.$authWithOAuthPopup.and.returnValue($q.reject(err));
              // I am guessing the redirect promise only resolve if it fails
              // (redirect not available), but for the test it doesn't matter.
              auth.$authWithOAuthRedirect.and.returnValue($q.when(redirectResult));

              clmAuth.login().then(function(resp) {
                result = resp;
              });

              $rootScope.$apply();
              expect(result).toBe(redirectResult);
            });
          });

          it('should authenticate against a google account when popup is not available', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth, $rootScope) {
              var err = new Error();
              var redirectResult = {};

              err.code = 'TRANSPORT_UNAVAILABLE';
              auth.$authWithOAuthPopup.and.returnValue($q.reject(err));
              auth.$authWithOAuthRedirect.and.returnValue($q.when(redirectResult));

              clmAuth.login();
              $rootScope.$apply();
              expect(auth.$authWithOAuthRedirect).toHaveBeenCalledWith('google');
            });
          });

          it('should reject when neither popup or redirect is available', function() {
            auth.$getAuth.and.returnValue(null);

            inject(function($q, clmAuth, $rootScope) {
              var result;
              var popUpErr = new Error();
              var redirectErr = new Error();

              popUpErr.code = 'TRANSPORT_UNAVAILABLE';
              auth.$authWithOAuthPopup.and.returnValue($q.reject(popUpErr));
              auth.$authWithOAuthRedirect.and.returnValue($q.reject(redirectErr));

              clmAuth.login().catch(function(e) {
                result = e;
              });

              $rootScope.$apply();
              expect(result).toBe(redirectErr);
            });
          });

        });


        describe('logout', function() {

          it('should unauthenticates current user', function() {
            auth.$getAuth.and.returnValue({
              uid: '1234'
            });

            inject(function($q, clmAuth) {
              auth.$unauth.and.returnValue(null);

              clmAuth.logout();
              expect(auth.$unauth).toHaveBeenCalled();
            });
          });

          it('should reset clmAuth.user', function() {
            auth.$getAuth.and.returnValue({
              uid: '1234'
            });

            inject(function($q, clmAuth) {
              auth.$unauth.and.returnValue(null);

              clmAuth.logout();
              expect(auth.user).toBeUndefined();
            });
          });

        });

      });


      describe('clmAlert', function() {
        var log, clmAlert;

        beforeEach(module('clm'));

        beforeEach(function() {
          module(function($provide) {
            log = jasmine.createSpy();
            log.and.returnValue(null);
            $provide.value('$window', {
              alertify: {
                log: log
              }
            });
          });

          inject(function(_clmAlert_) {
            clmAlert = _clmAlert_;
          });
        });

        it('should alert users', function() {
          clmAlert('Type', 'Content');
          expect(log).toHaveBeenCalledWith('Content', 'type');
        });

        describe('clmAlert.success', function() {

          it('should send a notification of type "success"', function() {
            clmAlert.success('Content');
            expect(log).toHaveBeenCalledWith('Content', 'success');
          });

        });

        describe('clmAlert.info', function() {

          it('should send a notification of type "info"', function() {
            clmAlert.info('Content');
            expect(log).toHaveBeenCalledWith('Content', undefined);
          });

        });

        describe('clmAlert.warning', function() {

          it('should send a notification of type "warning"', function() {
            clmAlert.warning('Content');
            expect(log).toHaveBeenCalledWith('Content', 'error');
          });

        });


        describe('clmAlert.danger', function() {

          it('should send a notification of type "danger"', function() {
            clmAlert.danger('Content');
            expect(log).toHaveBeenCalledWith('Content', 'error');
          });

        });

        describe('clmAlert.error', function() {

          it('should send a notification of type "error"', function() {
            clmAlert.error('Content');
            expect(log).toHaveBeenCalledWith('Content', 'error');
          });

        });

      });

    });


  });

})();
