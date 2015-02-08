/* global describe, beforeEach, it, browser */

describe('angularjs homepage', function() {
  'use strict';

  beforeEach(function() {
    browser.addMockModule('e2eSpfMock', function() {
      angular.module('e2eSpfMock', ['spf']);
    });
  });

  it('should show an empty list of event', function() {
    browser.get('/');
    // TODO: make sure the session is reset.
  });
});
