// @ts-check
// 文件说明：Astro 项目配置文件，定义站点元信息、i18n 国际化路由与本地字体资源。

// 原代码注释：原 MDX 集成导入（已停用，博客功能已移除）
// import mdx from "@astrojs/mdx";
// 原代码注释：原 sitemap 集成导入（已停用，站点地图功能已移除）
// import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",

  // 原代码注释：原集成配置（已停用）
  // integrations: [mdx(), sitemap()],
  // 国际化配置：默认语言为简体中文（根路径访问），同时支持英文（/en 前缀访问）
  i18n: {
    defaultLocale: "zh-CN",
    locales: ["zh-CN", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  server: {
    host: true, // 这会监听所有网络接口（包括 IPv4 和 IPv6）
  },

  fonts: [
    {
      provider: fontProviders.local(),
      name: "Atkinson",
      cssVariable: "--font-atkinson",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/atkinson-regular.woff"],
            weight: 400,
            style: "normal",
            display: "swap",
          },
          {
            src: ["./src/assets/fonts/atkinson-bold.woff"],
            weight: 700,
            style: "normal",
            display: "swap",
          },
        ],
      },
    },
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-dev-runtime",
        "react/jsx-runtime",
        "@lottiefiles/dotlottie-react",
        "@lottiefiles/dotlottie-web",
      ],
    },
    ssr: {
      external: ["@lottiefiles/dotlottie-react", "@lottiefiles/dotlottie-web"],
    },
  },

  integrations: [react()],
});