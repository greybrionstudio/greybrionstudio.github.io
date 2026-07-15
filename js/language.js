/**
 * language.js - 共通言語管理モジュール
 * 全ページで読み込み、言語切り替え機能を提供する。
 */

(function () {
  "use strict";

  var SUPPORTED_LANGUAGES = ["ja", "en"];
  var DEFAULT_LANGUAGE = "ja";
  var STORAGE_KEY = "greybrion.language";

  /**
   * 現在の選択言語を取得する。
   * localStorageに保存されていない場合、または不正な値の場合はデフォルト(ja)を返す。
   */
  function getCurrentLanguage() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.indexOf(stored) !== -1) {
      return stored;
    }
    return DEFAULT_LANGUAGE;
  }

  /**
   * 言語を設定し、localStorageへ保存してページをリロードする。
   * 同じ言語が選択された場合はリロードしない。
   */
  function setLanguage(lang) {
    if (!lang || SUPPORTED_LANGUAGES.indexOf(lang) === -1) {
      lang = DEFAULT_LANGUAGE;
    }

    var current = getCurrentLanguage();
    if (lang === current) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, lang);
    window.location.reload();
  }

  /**
   * 多言語オブジェクトまたは文字列からローカライズ済みテキストを取得する。
   *
   * 対応パターン:
   *   文字列       → そのまま返す
   *   { ja, en }  → 現在言語 > ja > en の優先順でフォールバック
   *   null/undefined → 空文字を返す
   */
  function getLocalized(value) {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "object") {
      var lang = getCurrentLanguage();
      return value[lang] || value["ja"] || value["en"] || "";
    }
    return "";
  }

  /**
   * <html lang=""> 属性を現在の言語に更新する。
   * ページ読み込み時に自動実行される。
   */
  function updateDocumentLanguage() {
    var lang = getCurrentLanguage();
    document.documentElement.setAttribute("lang", lang);
  }

  // ページ読み込み時に即座にlang属性を更新
  updateDocumentLanguage();

  // グローバルに公開
  window.GreybrionLang = {
    getCurrentLanguage: getCurrentLanguage,
    setLanguage: setLanguage,
    getLocalized: getLocalized,
    updateDocumentLanguage: updateDocumentLanguage
  };
})();
