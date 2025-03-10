import type { NextConfig } from "next";

// Generate a unique build ID based on the current timestamp
const buildId = new Date().toISOString().replace(/[:.]/g, '-');

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
    // Add a custom build ID for cache busting
    generateBuildId: async () => {
        return buildId;
    },
    // Only include rewrites in development mode
    ...(process.env.NODE_ENV === 'development' ? {
        async rewrites() {
            return [
                {
                    source: '/api/:path*',
                    destination: 'http://localhost:28080/api/:path*', // Proxy to backend
                },
            ];
        }
    } : {})
};

export default nextConfig;
