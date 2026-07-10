declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URL: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      MEDIA_STORAGE_PROVIDER?: 'local' | 's3'
      NEXT_PUBLIC_MEDIA_DELIVERY?: 'payload' | 'direct'
      S3_ACCESS_KEY_ID?: string
      S3_BUCKET?: string
      S3_ENDPOINT?: string
      S3_FORCE_PATH_STYLE?: string
      S3_REGION?: string
      S3_SECRET_ACCESS_KEY?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
