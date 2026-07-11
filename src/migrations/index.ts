import * as migration_20260710_022009_initial_newspaper_schema from './20260710_022009_initial_newspaper_schema';
import * as migration_20260711_061353_miniflux_ingestion from './20260711_061353_miniflux_ingestion';
import * as migration_20260711_180000_automation_trending from './20260711_180000_automation_trending';

export const migrations = [
  {
    up: migration_20260710_022009_initial_newspaper_schema.up,
    down: migration_20260710_022009_initial_newspaper_schema.down,
    name: '20260710_022009_initial_newspaper_schema',
  },
  {
    up: migration_20260711_061353_miniflux_ingestion.up,
    down: migration_20260711_061353_miniflux_ingestion.down,
    name: '20260711_061353_miniflux_ingestion'
  },
  {
    up: migration_20260711_180000_automation_trending.up,
    down: migration_20260711_180000_automation_trending.down,
    name: '20260711_180000_automation_trending'
  },
];
