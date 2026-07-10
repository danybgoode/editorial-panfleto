import * as migration_20260710_022009_initial_newspaper_schema from './20260710_022009_initial_newspaper_schema';

export const migrations = [
  {
    up: migration_20260710_022009_initial_newspaper_schema.up,
    down: migration_20260710_022009_initial_newspaper_schema.down,
    name: '20260710_022009_initial_newspaper_schema'
  },
];
