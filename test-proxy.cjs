const https = require('https');

const handleRequest = (url, redirectCount = 0) => {
  if (redirectCount > 5) {
    console.log("Too many redirects");
    return;
  }
  https.get(url, (proxyRes) => {
    console.log("Status:", proxyRes.statusCode);
    if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
      console.log("Redirecting to:", proxyRes.headers.location);
      return handleRequest(proxyRes.headers.location, redirectCount + 1);
    }
    console.log("Final content type:", proxyRes.headers['content-type']);
  }).on("error", (err) => {
    console.error("Error:", err);
  });
};

handleRequest("https://drive.google.com/thumbnail?id=1p0O4zG9e4vE50qP5wPz_sP9Z8q3_Y-G2&sz=w800");
