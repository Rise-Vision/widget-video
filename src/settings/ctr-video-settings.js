angular.module("risevision.widget.video.settings")
  .controller("videoSettingsController", ["$scope", "$log", "commonSettings",
    function ($scope, $log, commonSettings) {

      $scope.$watch("settings.additionalParams.url", function (url) {
        if (typeof url !== "undefined" && url !== "") {
          if ($scope.settingsForm.videoUrl.$valid) {
            $scope.settings.additionalParams.storage = commonSettings.getStorageUrlData(url);
          } else {
            $scope.settings.additionalParams.storage = {};
          }
        }
      });

    }])
  .value("defaultSettings", {
    params: {},
    additionalParams: {
      type: "file",
      url: "",
      storage: {},
      video: {
        scaleToFit: true,
        volume: 50,
        controls: true,
        autoplay: true
      }
    }
  });
