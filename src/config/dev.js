/* exported config */
if (typeof angular !== "undefined") {
  angular.module("risevision.common.i18n.config", [])
    .constant("LOCALES_PREFIX", "components/rv-common-i18n/dist/locales/translation_")
    .constant("LOCALES_SUFIX", ".json");

  angular.module("risevision.widget.common.storage-selector.config")
    .value("STORAGE_MODAL", "https://apps-stage-0.risevision.com/storage-selector.html#/?cid=");
}

var config = {
  STORAGE_ENV: "test",
  COMPONENTS_PATH: "components/"
};
