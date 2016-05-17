(function (window) {
  "use strict";

  window.RiseVision.Video.FrameController = function() {
    return {
      add: function(index) {
        var frameContainer = this.getFrameContainer(index),
          iframe = document.createElement("iframe");

        frameContainer.appendChild(iframe);
      },
      createFramePlayer: function(index, params, files, src, origin) {
      },
      getFrameContainer: function(index) {
        return document.getElementById("if_" + index);
      },
      getFrameObject: function(index) {
        var frameContainer = this.getFrameContainer(index),
          iframe;

        iframe = frameContainer.querySelector("iframe");

        if (iframe) {
          return {
            play: function () {},
            pause: function () {},
            remove: function () {},
            postMessage: function () {}
          };
        }

        return null;
      },
      remove: function(index, origin, callback) {
        var frameContainer = this.getFrameContainer(index),
          frameObj = this.getFrameObject(index);

        if (frameObj) {
          frameObj.remove();
        }

        while (frameContainer.firstChild) {
          frameContainer.removeChild(frameContainer.firstChild);
        }

        if (callback && typeof callback === "function") {
          callback();
        }
      }
    };
  }
})(window);
