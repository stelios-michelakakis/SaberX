/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["argon2", "pg", "exceljs"],
  typedRoutes: false
};

export default nextConfig;
