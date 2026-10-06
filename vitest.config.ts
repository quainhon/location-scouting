import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.{ts,mjs}'], pool: 'threads', poolOptions: { threads: { singleThread: true } }, cache: false } });
