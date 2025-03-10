import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export',
    distDir: 'out',
    images: {
        unoptimized: true
    },
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    // Add rewrites for development API proxy
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:28080/api/:path*', // Proxy to backend
            },
        ];
    }
};

export default nextConfig;
