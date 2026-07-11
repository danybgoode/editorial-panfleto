'use client'

import { Button, toast, useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useState } from 'react'

export const MinifluxSyncButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = useCallback(async () => {
    if (!id) {
      toast.error('Save this mapping before syncing.')
      return
    }

    setIsSyncing(true)

    try {
      const response = await fetch('/api/miniflux/sync-mapping', {
        body: JSON.stringify({ mappingId: id }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Miniflux sync failed.')
      }

      toast.success(
        `Miniflux sync complete: ${result.created} created, ${result.updated} refreshed, ${result.fetched} fetched.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Miniflux sync failed.'
      toast.error(message)
    } finally {
      setIsSyncing(false)
    }
  }, [id])

  return (
    <div>
      <Button buttonStyle="primary" disabled={isSyncing || !id} onClick={handleSync} size="medium">
        {isSyncing ? 'Syncing...' : 'Sync mapping now'}
      </Button>
    </div>
  )
}

export default MinifluxSyncButton
