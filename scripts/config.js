"use strict";

const SITE_BASE_URL = "https://greybrionstudio.github.io";

module.exports = {
  SITE_BASE_URL,
  DEFAULT_LANG: "ja",

  ORGANIZATION: {
    name: "Greybrion Studio",
    url: SITE_BASE_URL
  },

  // 生成先ディレクトリ（リポジトリルートからの相対パス）
  OUTPUT_DIR_JA: "devlog/log/ja",
  OUTPUT_DIR_EN: "devlog/log/en",

  // sitemap で使う変更頻度・優先度
  SITEMAP: {
    devlogIndex: {
      changefreq: "weekly",
      priority:   "0.8"
    },
    logDetail: {
      changefreq: "monthly",
      priority:   "0.6"
    }
  }
};
