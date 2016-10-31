/* global require, browser, describe, beforeEach, it, element, by */

/* eslint-disable func-names */

( function() {
  "use strict";

  /* https://github.com/angular/protractor/blob/master/docs/getting-started.md */

  var chai = require( "chai" ),
    expect = chai.expect,
    chaiAsPromised = require( "chai-as-promised" );

  chai.use( chaiAsPromised );

  browser.driver.manage().window().setSize( 1024, 768 );

  describe( "Video Settings - e2e Testing", function() {

    var validUrl = "http://www.valid-url.com",
      invalidUrl = "http://w",
      invalidVideoUrl = validUrl + "/video.mpg",
      validVideoUrl = validUrl + "/video.webm";

    beforeEach( function() {
      browser.get( "/src/settings-e2e.html" );
    } );

    it( "Should load all components", function() {
      // Widget Button Toolbar
      expect( element( by.css( "button#save" ) ).isPresent() ).to.eventually.be.true;
      expect( element( by.css( "button#cancel" ) ).isPresent() ).to.eventually.be.true;

      // File Selector
      expect( element( by.css( "#fileSelector button[name='customBtn']" ) ).isPresent() ).to.eventually.be.true;
      expect( element( by.css( "#fileSelector storage-selector[type='single-file']" ) ).isPresent() ).to.eventually.be.true;
      expect( element( by.css( "#fileSelector storage-selector[type='single-folder']" ) ).isPresent() ).to.eventually.be.true;

      expect( element( by.css( "#fileSelector div[subscription-status]" ) ).isPresent() ).to.eventually.be.false;

    } );

    it( "Should correctly load default settings", function() {
      // save button should be disabled
      expect( element( by.css( "button#save[disabled=disabled" ) ).isPresent() ).to.eventually.be.true;

      // form should be invalid due to nothing selected or input via File Selector
      expect( element( by.css( "form[name='settingsForm'].ng-invalid" ) ).isPresent() ).to.eventually.be.true;

      // Resume playing should be 5
      expect( element( by.model( "settings.additionalParams.video.pause" ) ).getAttribute( "value" ) ).to.eventually.equal( "5" );

      // Resume Playing from Last Position should be true
      expect( element( by.model( "settings.additionalParams.video.resume" ) ).isSelected() ).to.eventually.be.true;

      // Scale To Fit should be true
      expect( element( by.model( "settings.additionalParams.video.scaleToFit" ) ).isSelected() ).to.eventually.be.true;

      // Show Video Controls should be true
      expect( element( by.model( "settings.additionalParams.video.controls" ) ).isSelected() ).to.eventually.be.true;

      // Autoplay should be true
      expect( element( by.model( "settings.additionalParams.video.autoplay" ) ).isSelected() ).to.eventually.be.true;
    } );

    it( "Should be invalid form and Save button disabled due to invalid URL", function() {
      element( by.css( "#fileSelector button[name='customBtn']" ) ).click();

      element( by.css( "#fileSelector input[name='url']" ) ).sendKeys( invalidUrl );

      // save button should be disabled
      expect( element( by.css( "button#save[disabled=disabled" ) ).isPresent() ).to.eventually.be.true;

      // form should be invalid due to invalid URL
      expect( element( by.css( "form[name='settingsForm'].ng-invalid" ) ).isPresent() ).to.eventually.be.true;
    } );

    it( "Should be invalid form and Save button disabled due to invalid video file format", function() {
      element( by.css( "#fileSelector button[name='customBtn']" ) ).click();

      element( by.css( "#fileSelector input[name='url']" ) ).sendKeys( invalidVideoUrl );

      // save button should be disabled
      expect( element( by.css( "button#save[disabled=disabled" ) ).isPresent() ).to.eventually.be.true;

      // form should be invalid due to incorrect file format
      expect( element( by.css( "form[name='settingsForm'].ng-invalid" ) ).isPresent() ).to.eventually.be.true;
    } );

    it( "Should be valid form and Save button enabled due to valid URL entry and valid file format", function() {
      element( by.css( "#fileSelector button[name='customBtn']" ) ).click();

      element( by.css( "#fileSelector input[name='url']" ) ).sendKeys( validVideoUrl );

      // save button should be enabled
      expect( element( by.css( "button#save[disabled=disabled" ) ).isPresent() ).to.eventually.be.false;

      // form should be valid due to valid URL and valid format
      expect( element( by.css( "form[name='settingsForm'].ng-invalid" ) ).isPresent() ).to.eventually.be.false;
    } );

    it( "Should hide Autoplay and Resume if Show Video Controls unchecked", function() {
      element( by.model( "settings.additionalParams.video.controls" ) ).click();

      expect( element( by.model( "settings.additionalParams.video.autoplay" ) ).isDisplayed() ).to.eventually.be.false;
      expect( element( by.model( "settings.additionalParams.video.pause" ) ).isDisplayed() ).to.eventually.be.false;
    } );

    it( "Should correctly save settings", function() {
      var settings = {
        params: {},
        additionalParams: {
          "url": "",
          "selector": {
            "selection": "custom",
            "storageName": "",
            "url": validVideoUrl
          },
          "storage": {},
          "video": {
            "scaleToFit": true,
            "volume": 50,
            "controls": true,
            "autoplay": true,
            "resume": true,
            "pause": 5
          }
        }
      };

      element( by.css( "#fileSelector button[name='customBtn']" ) ).click();

      element( by.css( "#fileSelector input[name='url']" ) ).sendKeys( validVideoUrl );

      element( by.id( "save" ) ).click();

      expect( browser.executeScript( "return window.result" ) ).to.eventually.deep.equal(
        {
          "additionalParams": JSON.stringify( settings.additionalParams ),
          "params": ""
        } );
    } );

  } );

} )();
