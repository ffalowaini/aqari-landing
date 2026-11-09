/* App configuration: which backend the frontend talks to.

   Local dev (served from localhost/127.0.0.1, or from a LAN IP when the
   frontend is opened from another device on the same network) talks to the
   local backend (aqari-backend, port 8081) on that same host; anywhere else
   (e.g. the live GitHub Pages site) talks to the deployed Render backend. */

export const isLocalHost = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})$/
  .test(location.hostname);

export const API_BASE_URL = isLocalHost
  ? `${location.protocol}//${location.hostname}:8081`
  : "https://aqari-backend-tkmq.onrender.com";
