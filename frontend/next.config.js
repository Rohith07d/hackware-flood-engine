const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../"),
  devIndicators: false,
};

module.exports = nextConfig;
