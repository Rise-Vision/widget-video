angular.module( "risevision.widget.video.settings" )
  .controller( "videoSettingsController", [ "$scope", "$log", "commonSettings",
    function( $scope, $log, commonSettings ) {

      // handle pre-merge use of "url" from previous Settings
      $scope.$watch( "settings.additionalParams.url", function( url ) {
        var storage = {};

        if ( typeof url !== "undefined" && url !== "" ) {

          storage = commonSettings.getStorageUrlData( url );

          if ( Object.keys( storage ).length !== 0 ) {
            // is a storage single file
            $scope.settings.additionalParams.selector = {
              "selection": "single-file",
              "storageName": storage.folder + storage.fileName,
              "url": url
            };
          } else {
            // is a custom 3rd party server file
            $scope.settings.additionalParams.selector = {
              "selection": "custom",
              "storageName": "",
              "url": url
            };
          }

          // ensure this value is empty so it no longer gets used
          $scope.settings.additionalParams.url = "";
        }
      } );

      $scope.$watch( "settings.additionalParams.selector.url", function( url ) {
        if ( typeof url !== "undefined" && url !== "" ) {
          $scope.settings.additionalParams.storage = commonSettings.getStorageUrlData( url );
        }
      } );

      $scope.$watch( "settings.additionalParams.video", function( video ) {
        if ( ( typeof video !== "undefined" ) && ( typeof video.resume === "undefined" ) ) {
          $scope.settings.additionalParams.video.resume = true;
        }
      } );

    } ] )
  .value( "defaultSettings", {
    params: {},
    additionalParams: {
      // pre-merge
      url: "",
      selector: {},
      storage: {},
      video: {
        scaleToFit: true,
        volume: 50,
        controls: true,
        autoplay: true,
        resume: true,
        // merged from folder
        pause: 5
      }
    }
  } );
