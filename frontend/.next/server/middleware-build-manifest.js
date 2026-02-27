self.__BUILD_MANIFEST = {
  "polyfillFiles": [
    "static/chunks/polyfills.js"
  ],
  "devFiles": [
    "static/chunks/react-refresh.js"
  ],
  "ampDevFiles": [],
  "lowPriorityFiles": [],
  "rootMainFiles": [],
  "pages": {
    "/": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/index.js"
    ],
    "/_app": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_app.js"
    ],
    "/_error": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/_error.js"
    ],
    "/donor/book-appointment": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/donor/book-appointment.js"
    ],
    "/donor/dashboard": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/donor/dashboard.js"
    ],
    "/donor/organ": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/donor/organ.js"
    ],
    "/hospital/appointments": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/hospital/appointments.js"
    ],
    "/hospital/dashboard": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/hospital/dashboard.js"
    ],
    "/hospital/donors": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/hospital/donors.js"
    ],
    "/hospital/needs": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/hospital/needs.js"
    ],
    "/register/organ": [
      "static/chunks/webpack.js",
      "static/chunks/main.js",
      "static/chunks/pages/register/organ.js"
    ]
  },
  "ampFirstPages": []
};
self.__BUILD_MANIFEST.lowPriorityFiles = [
"/static/" + process.env.__NEXT_BUILD_ID + "/_buildManifest.js",
,"/static/" + process.env.__NEXT_BUILD_ID + "/_ssgManifest.js",

];