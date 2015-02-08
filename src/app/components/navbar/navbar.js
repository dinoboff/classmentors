 (function() {
  'use strict';

  angular.module('clm').

  /**
   * Controler for the header novigation bar.
   *
   * Set an auth property bound to clmAuth. Its user property can used
   * to display the state of the authentication and the user display name
   * when the user is logged in.
   *
   * The ctrl set a login and logout property to autenticate/unauthenticate
   * the current user.
   *
   */
  controller('ClmSharedNavBarCtrl', [
    '$q',
    '$aside',
    'clmAlert',
    'clmAuth',
    function($q, $aside, clmAlert, clmAuth) {
      this.auth = clmAuth;

      this.login = function() {
        return clmAuth.login().catch(function(e) {
          clmAlert.warning('You failed to authenticate with Google');
          return $q.reject(e);
        });
      };

      this.logout = function() {
        return clmAuth.logout();
      };

      this.openSideMenu = function(conf) {
        var aside = $aside({
          contentTemplate: conf.contentTemplate,
          title: 'Menu',
          animation: 'am-fade-and-slide-left',
          placement: 'left',
          container: 'body'
        });
        aside.$promise.then(function() {
          aside.show();
        });
      };

    }
  ])



  ;

})();
