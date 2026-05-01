import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: 'https',
        hostname: 'kquhemtuhprdrijxwzfp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Google OAuth 프로필 이미지
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // Kakao OAuth 프로필 이미지
      {
        protocol: 'http',
        hostname: 'k.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 'k.kakaocdn.net',
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  customWorkerSrc: "worker",
})(nextConfig);
