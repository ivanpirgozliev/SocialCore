import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'pages/login.html'),
        register: resolve(__dirname, 'pages/register.html'),
        feed: resolve(__dirname, 'pages/feed.html'),
        profile: resolve(__dirname, 'pages/profile.html'),
        createPost: resolve(__dirname, 'pages/create-post.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
