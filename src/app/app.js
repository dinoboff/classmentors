/**
 * Defines the SingPath Fire angular app and its main services and controllers.
 *
 * If was to become too big, only config and contants should be kept here;
 * controllers could be sent off to a main/main-controllers.js and services
 * to mani/main-services.js.
 *
 */
(function() {
  'use strict';

  angular.module('clm', [
    'angular-loading-bar',
    'firebase',
    'mgcrea.ngStrap',
    'ngAnimate',
    'ngMessages',
    'ngRoute'
  ]).

  /**
   * Label paths - to be used by each component to configure their route.
   *
   * See src/app/components/events for example.
   *
   */
  constant('routes', {
    home: '/events',
    events: '/events'
  }).

  /**
   * Configure routes default route and cfpLoadingBar options.
   *
   */
  config([
    '$routeProvider',
    'cfpLoadingBarProvider',
    'routes',
    function($routeProvider, cfpLoadingBarProvider, routes) {
      $routeProvider.otherwise({
        redirectTo: routes.home
      });

      cfpLoadingBarProvider.includeSpinner = false;
    }
  ]).

  config([
    '$provide',
    function($provide) {
      $provide.decorator('$firebase', [
        '$delegate',
        '$timeout',
        'cfpLoadingBar',
        function($delegate, $timeout, cfpLoadingBar) {
          var latencyThreshold = 100;
          var requests = 0;
          var completedRequest = 0;
          var timeout = null;
          var started = false;

          function start() {
            if (started) {
              cfpLoadingBar.start();
              return;
            }

            if (timeout) {
              return;
            }

            timeout = setTimeout(function() {
              if (requests) {
                cfpLoadingBar.start();
                started = true;
                timeout = null;
              }
            }, latencyThreshold);
          }

          function incr() {
            requests += 1;
            start();
          }

          function complete() {
            completedRequest += 1;
            if (requests === completedRequest) {
              cfpLoadingBar.complete();
              requests = completedRequest = 0;
              started = false;
              if (timeout) {
                $timeout.cancel(timeout);
                timeout = null;
              }
            }
          }


          ['$asArray', '$asObject'].map(function(k) {
            var _super = $delegate.prototype[k];
            $delegate.prototype[k] = function() {
              var result = _super.apply(this, arguments);

              incr();
              result.$loaded().finally(complete);

              return result;
            };
          });

          ['$push', '$remove', '$set', '$update'].map(function(k) {
            var _super = $delegate.prototype[k];
            $delegate.prototype[k] = function() {
              var result = _super.apply(this, arguments);

              incr();
              result.finally(complete);

              return result;
            };
          });


          return $delegate;
        }
      ]);
    }
  ]).

  /**
   * clmFirebaseRef return a Firebase reference to singpath database,
   * at a specific path, with a specific query; e.g:
   *
   *    // ref to "https://singpath.firebaseio.com/"
   *    clmFirebaseRef);
   *
   *    // ref to "https://singpath.firebaseio.com/auth/users/google:12345"
   *    clmFirebaseRef(['auth/users', 'google:12345']);
   *
   *    // ref to "https://singpath.firebaseio.com/events?limitTo=50"
   *    clmFirebaseRef(['events', 'google:12345'], {limitTo: 50});
   *
   *
   * The base url is configurable with `clmFirebaseProvider.setBaseUrl`:
   *
   *    angular.module('clm').config([
   *      'clmFirebaseRefProvider',
   *      function(clmFirebaseRefProvider){
   *          clmFirebaseRefProvider.setBaseUrl(newBaseUrl);
   *      }
   *    ])
   *
   */
  provider('clmFirebaseRef', function ClmFirebaseProvider() {
    var baseUrl = 'https://singpath.firebaseio.com/';

    this.setBaseUrl = function(url) {
      baseUrl = url;
    };

    this.$get = ['$window', '$log', function clmFirebaseRefFactory($window, $log) {
      return function clmFirebaseRef(paths, queryOptions) {
        var ref = new $window.Firebase(baseUrl);

        $log.debug('singpath base URL: "' + baseUrl + '".');

        paths = paths || [];
        ref = paths.reduce(function(ref, p) {
          return ref.child(p);
        }, ref);

        queryOptions = queryOptions || {};
        Object.keys(queryOptions).reduce(function(ref, k) {
          return ref[k](queryOptions[k]);
        }, ref);

        $log.debug('singpath ref path: "' + ref.path.toString() + '".');
        return ref;
      };
    }];

  }).

  /**
   * Like clmFirebaseRef by return an $firebase object.
   *
   */
  factory('clmFirebaseSync', [
    '$firebase',
    'clmFirebaseRef',
    function clmFirebaseSyncFactory($firebase, clmFirebaseRef) {
      return function clmFirebaseSync() {
        return $firebase(clmFirebaseRef.apply(null, arguments));
      };
    }
  ]).


  /**
   * Returns an object with `user` (Firebase auth user data) property,
   * and login/logout methods.
   */
  factory('clmAuth', [
    '$q',
    '$firebaseAuth',
    'clmFirebaseRef',
    function($q, $firebaseAuth, clmFirebaseRef) {
      var auth = $firebaseAuth(clmFirebaseRef());

      return {
        // The current user auth data (null is not authenticated).
        user: auth.$getAuth(),

        /**
         * Start Oauth authentication dance against google oauth2 service.
         *
         * It will attempt the process using a pop up and fails back on
         * redirect.
         *
         * Updates clmAuth.user and return a promise resolving to the
         * current user auth data.
         *
         */
        login: function() {
          var self = this;

          return auth.$authWithOAuthPopup('google').then(function(user) {
            self.user = user;
            return user;
          }, function(error) {
            // clmAlert.warning('You failed to authenticate with Google');
            if (error.code === 'TRANSPORT_UNAVAILABLE') {
              return auth.$authWithOAuthRedirect('google');
            }
            return $q.reject(error);
          });
        },

        /**
         * Unauthenticate user and reset clmAuth.user.
         *
         */
        logout: function() {
          auth.$unauth();
          this.user = undefined;
        },

        /**
         * Register a callback for the authentication event.
         */
        onAuth: function(fn, ctx) {
          return auth.$onAuth(fn, ctx);
        }

      };
    }
  ]).

  /**
   * Service to interact with singpath firebase db
   *
   */
  factory('clmDataStore', [
    '$q',
    'clmFirebaseRef',
    'clmFirebaseSync',
    'clmAuth',
    'crypto',
    function clmDataStoreFactory($q, clmFirebaseRef, clmFirebaseSync, clmAuth, crypto) {
      var userData, userDataPromise, api;

      api = {
        auth: {

          _user: function() {
            return clmFirebaseSync(['auth/users', clmAuth.user.uid]).$asObject();
          },

          /**
           * Returns a promise resolving to an angularFire $firebaseObject
           * for the current user data.
           *
           * The promise will be rejected if the is not authenticated.
           *
           */
          user: function() {
            if (!clmAuth.user || !clmAuth.user.uid) {
              return $q.reject(new Error('the user is not authenticated.'));
            }

            if (userData) {
              return $q.when(userData);
            }

            if (userDataPromise) {
              return $q.when(userDataPromise);
            }

            return api.auth._user().$loaded().then(
              api.auth.register
            ).then(function(data) {
              userData = data;
              userDataPromise = null;
              return data;
            });
          },

          /**
           * Setup initial data for the current user.
           *
           * Should run if 'auth.user().$value is `null`.
           *
           * Returns a promise resolving to the user data when
           * they become available.
           *
           */
          register: function(userData) {
            if (angular.isUndefined(userData)) {
              return $q.reject(new Error('A user should be logged in to register'));
            }

            // $value will be undefined and not null when the userData object
            // is set.
            if (userData.$value !== null) {
              return $q.when(userData);
            }

            userData.$value = {
              id: clmAuth.user.uid,
              nickName: clmAuth.user.google.displayName,
              displayName: clmAuth.user.google.displayName,
              createdAt: {
                '.sv': 'timestamp'
              }
            };

            return userData.$save().then(function() {
              return userData;
            });
          }
        },

        classMentor: {
          events: {
            list: function() {
              return clmFirebaseSync(['classMentors/events'], {
                orderByChild: 'timestamp',
                limitToLast: 50
              }).$asArray();
            },

            create: function(collection, data, password) {
              var hash, eventId;

              if (!clmAuth.user || !clmAuth.user.uid) {
                return $q.reject(new Error('A user should be logged in to create an event.'));
              }

              if (!password) {
                return $q.reject(new Error('An event should have a password.'));
              }

              return collection.$add(data).then(function(ref) {
                eventId = ref.key();
                hash = crypto.password.newHash(password);
                var opts = {
                  hash: hash.value,
                  options: hash.options
                };
                return clmFirebaseSync(['classMentors/eventPasswords']).$set(eventId, opts);
              }).then(function() {
                return eventId;
              });
            },

            join: function(eventId, pw) {
              if (!clmAuth.user || !clmAuth.user.uid) {
                return $q.reject(new Error('A user should be logged in to create an event.'));
              }

              var paths = {
                hashOptions: ['classMentors/eventPasswords', eventId, 'options'],
                application: ['classMentors/eventApplications', eventId, clmAuth.user.uid],
                participation: ['classMentors/eventParticipants', eventId, clmAuth.user.uid]
              };

              // The owner can join without password.
              if (pw === null) {
                return clmFirebaseSync(paths.participation).$set(true);
              }

              return clmFirebaseSync(paths.hashOptions).$asObject().$loaded().then(function(options) {
                var hash = crypto.password.fromSalt(pw, options.$value.salt, options.$value);
                return clmFirebaseSync(paths.application).$set(hash.value);
              }).then(function() {
                return clmFirebaseSync(paths.participation).$set(true);
              });
            }
          },

          leave: function(eventId) {
            if (!clmAuth.user || !clmAuth.user.uid) {
              return $q.reject(new Error('A user should be logged in to create an event.'));
            }

            return clmFirebaseSync([
              'classMentors/eventParticipants',
              eventId,
              clmAuth.user.uid
            ]).$set(false);
          }
        }
      };

      return api;
    }
  ]).

  /**
   * Service to show notification message in top right corner of
   * the window.
   *
   * Relies on Alert css properties sets in `src/app/app.css`.
   *
   * It takes as arguments the type of notification and the content
   * of the nofication.
   *
   * The type is used as title of the notification and is user to set
   * the class of the notication block: for type set `info`,
   * the block class will be set `alert` and `alert-info` (always lowercase).
   *
   * `clmAlert.success`, `clmAlert.info`, `clmAlert.warning`
   * and `clmAlert.danger` are shortcut for the clmAlert function.
   *
   * They take as agurment the notification content and set respectively the
   * type to "Success", "Info", "Warning" and "Danger".
   *
   */
  factory('clmAlert', [
    '$window',
    function clmAlertFactory($window) {
      var ctx = $window.alertify;
      var clmAlert = function(type, content) {
        type = type ? type.toLowerCase() : undefined;
        ctx.log(content, type);
      };

      clmAlert.success = clmAlert.bind(ctx, 'success');
      clmAlert.info = clmAlert.bind(ctx, null);
      clmAlert.warning = clmAlert.bind(ctx, 'error');
      clmAlert.danger = clmAlert.bind(ctx, 'error');
      clmAlert.error = clmAlert.bind(ctx, 'error');

      return clmAlert;
    }
  ]).

  provider('crypto', [
    function cryptoProvider() {
      var saltSize = 128 / 8;
      var hashOpts = {
        keySize: 256 / 32,
        iterations: 2024
      };

      this.setSaltSize = function(size) {
        saltSize = size;
      };

      this.setHashKeySize = function(keySize) {
        hashOpts.keySize = keySize;
      };

      this.setIterations = function(iterations) {
        hashOpts.iterations = iterations;
      };

      this.$get = [
        '$window',
        function cryptoFactory($window) {
          var CryptoJS = $window.CryptoJS;
          var algo = CryptoJS.algo;
          var pbkdf2 = CryptoJS.PBKDF2;
          var hex = CryptoJS.enc.Hex;
          var prf = 'SHA256';

          return {
            password: {
              /**
               * Return a hash for the password and options allowing
               * to rebuild the same against the same password.
               *
               * The options will include the hashing algorithm name, the
               * salt an other parameters.
               *
               */
              newHash: function(password) {
                var salt = CryptoJS.lib.WordArray.random(saltSize);
                var hash = pbkdf2(password, salt, {
                  keySize: hashOpts.keySize,
                  iterations: hashOpts.iterations,
                  hasher: algo[prf]
                });

                return {
                  value: hex.stringify(hash),
                  options: {
                    salt: hex.stringify(salt),
                    iterations: hashOpts.iterations,
                    keySize: hashOpts.keySize,
                    hasher: 'PBKDF2',
                    prf: prf
                  }
                };
              },

              /**
               * Return a hash built from the password, the hash and the
               * hashing options.
               *
               * The salt should be hex encoded.
               *
               */
              fromSalt: function(password, hexSalt, options) {
                var salt = hex.parse(hexSalt);
                var h = options.prf || prf;
                var hash = pbkdf2(password, salt, {
                  keySize: options.keySize || hashOpts.keySize,
                  iterations: options.iterations || hashOpts.iterations,
                  hasher: algo[h]
                });
                return hex.stringify(hash);
              }
            }
          };
        }
      ];
    }
  ]).

  directive('clmBsValidClass', [

    function clmBsValidClassFactory() {
      return {
        restrict: 'A',
        scope: false,
        require: 'ngModel',
        // arguments: scope, iElement, iAttrs, controller
        link: function clmBsValidClassPostLink(s, iElement, a, model) {
          var formControl, setPristine = model.$setPristine;

          function findFormController(input, className) {
            var formControl = input;
            while (formControl.length > 0) {
              formControl = formControl.parent();
              if (formControl.hasClass(className)) {
                return formControl;
              }
            }
          }

          formControl = findFormController(iElement, 'form-group');
          if (!formControl) {
            formControl = findFormController(iElement, 'radio');
          }

          if (!formControl) {
            return;
          }

          model.$setPristine = function augmentedSetPristine() {
            formControl.removeClass('has-error');
            formControl.removeClass('has-success');
            return setPristine.apply(model, arguments);
          };

          model.$viewChangeListeners.push(function clmBsValidClassOnChange() {

            if (model.$pristine) {
              formControl.removeClass('has-error');
              formControl.removeClass('has-success');
              return;
            }

            if (model.$valid) {
              formControl.removeClass('has-error');
              formControl.addClass('has-success');
            } else {
              formControl.addClass('has-error');
              formControl.removeClass('has-success');
            }
          });
        }
      };
    }
  ])

  ;

})();
