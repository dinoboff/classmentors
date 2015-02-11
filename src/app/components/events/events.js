(function() {
  'use strict';

  angular.module('clm').

  config([
    '$routeProvider',
    'routes',
    function($routeProvider, routes) {
      $routeProvider.when(routes.events, {
        templateUrl: 'app/components/events/events-view.html',
        controller: 'ClassMentorsEventList',
        controllerAs: 'ctrl',
        resolve: {
          'initialData': [
            'classMentorsEventListRsolver',
            function(classMentorsEventListRsolver) {
              return classMentorsEventListRsolver();
            }
          ]
        }
      });
    }
  ]).

  /**
   * Use to resolve `initialData` of `SomeCtrl`.
   *
   */
  factory('classMentorsEventListRsolver', [
    '$q',
    'clmAuth',
    'clmDataStore',
    function classMentorsEventListRsolverFactory($q, clmAuth, clmDataStore) {
      return function classMentorsEventRsolver() {
        return $q.all({
          events: clmDataStore.classMentor.events.list().$loaded(),
          auth: clmAuth
        });
      };
    }
  ]).

  /**
   * SomeCtrl
   *
   */
  controller('ClassMentorsEventList', [
    '$q',
    'initialData',
    'clmDataStore',
    'clmAlert',
    function ClassMentorsEventList($q, initialData, clmDataStore, clmAlert) {
      var self = this;

      this.events = initialData.events;
      this.auth = initialData.auth;

      self.creatingEvent = false;

      this.save = function(eventCollection, newEvent, password, eventForm) {
        self.creatingEvent = false;
        clmDataStore.auth.user().then(function(userData) {
          var data = Object.assign({
            ownerId: self.auth.user.uid,
            ownerName: userData.displayName,
            createdAt: {
              '.sv': 'timestamp'
            }
          }, newEvent);

          return clmDataStore.classMentor.events.create(eventCollection, data, password);
        }).then(function() {
          clmAlert.success('New event created.');
          self.reset(eventForm);
        }).catch(function(e) {
          clmAlert.error(e.toString());
        }).finally(function() {
          self.creatingEvent = false;
        });
      };

      this.reset = function(eventForm) {
        this.newEvent = {
          data: {},
          password: ''
        };

        if (eventForm && eventForm.$setPristine) {
          eventForm.$setPristine();
        }
      };

      this.reset();
    }
  ])

  ;

})();
