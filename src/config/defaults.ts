import { z } from 'zod';

export const ConfigSchema = z.object({
  defaultTeam: z.string().optional(),
  defaultFormat: z.enum(['json', 'table', 'csv', 'markdown']).default('json'),
  defaultAudience: z.enum(['coach', 'gm', 'scout', 'analyst']).default('analyst'),
  cache: z.object({
    enabled: z.boolean().default(true),
    maxAgeDays: z.number().default(30),
    directory: z.string().default(''),
  }).default({}),
  templates: z.object({
    directory: z.string().default(''),
  }).default({}),
  sources: z.object({
    savant: z.object({ enabled: z.boolean().default(true) }).default({}),
    fangraphs: z.object({ enabled: z.boolean().default(true) }).default({}),
    mlbStatsApi: z.object({ enabled: z.boolean().default(true) }).default({}),
    baseballReference: z.object({ enabled: z.boolean().default(false) }).default({}),
  }).default({}),
});

export type BbdataConfig = z.infer<typeof ConfigSchema>;

export function getDefaultConfig(): BbdataConfig {
  return ConfigSchema.parse({});
}
