/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 로 두면 GitHub Pages 같은 하위 경로에도 그대로 배포할 수 있어요.
// (라우팅은 해시(#/feed) 방식이라 서버 설정이 필요 없어요.)
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
