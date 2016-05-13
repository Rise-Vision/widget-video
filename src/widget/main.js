/* global gadgets, RiseVision */

(function (window, gadgets) {
  "use strict";

  var prefs = new gadgets.Prefs(),
    id = prefs.getString("id");

  // Disable context menu (right click menu)
  window.oncontextmenu = function () {
    return false;
  };

  function configure(names, values) {
    var additionalParams = null,
      mode = "",
      companyId = "",
      displayId = "";

    if (Array.isArray(names) && names.length > 0 && Array.isArray(values) && values.length > 0) {
      if (names[0] === "companyId") {
        companyId = values[0];
      }

      if (names[1] === "displayId") {
        if (values[1]) {
          displayId = values[1];
        }
        else {
          displayId = "preview";
        }
      }

      RiseVision.Common.LoggerUtils.setIds(companyId, displayId);
      RiseVision.Common.LoggerUtils.setVersion(version);

      if (names[2] === "additionalParams") {
        additionalParams = JSON.parse(values[2]);

        if (Object.keys(additionalParams.storage).length !== 0) {
          // storage file or folder selected
          if (!additionalParams.storage.fileName) {
            // folder was selected
            mode = "folder";
          } else {
            // file was selected
            mode = "file";
          }
        } else {
          // non-storage file was selected
          mode = "file";
        }

        RiseVision.Video.setAdditionalParams(additionalParams, mode);
      }
    }
  }

  function play() {
    RiseVision.Video.play();
  }

  function pause() {
    RiseVision.Video.pause();
  }

  function stop() {
    RiseVision.Video.stop();
  }

  function polymerReady() {
    window.removeEventListener("WebComponentsReady", polymerReady);

    if (id && id !== "") {
      gadgets.rpc.register("rscmd_play_" + id, play);
      gadgets.rpc.register("rscmd_pause_" + id, pause);
      gadgets.rpc.register("rscmd_stop_" + id, stop);

      gadgets.rpc.register("rsparam_set_" + id, configure);
      gadgets.rpc.call("", "rsparam_get", null, id, ["companyId", "displayId", "additionalParams"]);
    }
  }

  window.addEventListener("WebComponentsReady", polymerReady);

})(window, gadgets);


