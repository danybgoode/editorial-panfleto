import * as migration_20260710_022009_initial_newspaper_schema from './20260710_022009_initial_newspaper_schema';
import * as migration_20260711_061353_miniflux_ingestion from './20260711_061353_miniflux_ingestion';
import * as migration_20260711_180000_automation_trending from './20260711_180000_automation_trending';
import * as migration_20260711_210758_newsroom_tasks from './20260711_210758_newsroom_tasks';
import * as migration_20260713_171500_user_onboarding_email from './20260713_171500_user_onboarding_email';

export const migrations = [
  {
    up: migration_20260710_022009_initial_newspaper_schema.up,
    down: migration_20260710_022009_initial_newspaper_schema.down,
    name: '20260710_022009_initial_newspaper_schema',
  },
  {
    up: migration_20260711_061353_miniflux_ingestion.up,
    down: migration_20260711_061353_miniflux_ingestion.down,
    name: '20260711_061353_miniflux_ingestion',
  },
  {
    up: migration_20260711_180000_automation_trending.up,
    down: migration_20260711_180000_automation_trending.down,
    name: '20260711_180000_automation_trending',
  },
  {
    up: migration_20260711_210758_newsroom_tasks.up,
    down: migration_20260711_210758_newsroom_tasks.down,
    name: '20260711_210758_newsroom_tasks',
  },
  {
    up: migration_20260713_171500_user_onboarding_email.up,
    down: migration_20260713_171500_user_onboarding_email.down,
    name: '20260713_171500_user_onboarding_email',
  },
];
