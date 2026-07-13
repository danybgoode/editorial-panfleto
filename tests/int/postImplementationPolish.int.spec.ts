import { describe, expect, it, vi } from 'vitest'

import { Footer } from '@/Footer/config'
import { Header } from '@/Header/config'
import {
  inviteEmailHTML,
  onboardingEmailHTML,
  resetPasswordEmailHTML,
  sendOnboardingEmailAfterPasswordSetup,
  sendUserInvite,
} from '@/collections/Users'
import { preventAssignedTaskOrphans } from '@/collections/Users/hooks/protectRoles'
import { getNextScheduledSyncLabel } from '@/collections/MinifluxMappings'
import { getArticleAgeHours, getTrendingScore } from '@/lib/trending/ranking'

describe('post-implementation polish safeguards', () => {
  it('blocks deleting users with assigned tasks before relationship cleanup can orphan tasks', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 1 }],
    })

    await expect(
      preventAssignedTaskOrphans({
        id: 123,
        req: {
          payload: {
            find,
          },
        },
      } as never),
    ).rejects.toThrow('Cannot delete this user while they have assigned tasks.')

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tasks',
        overrideAccess: true,
        where: {
          assignedTo: {
            equals: 123,
          },
        },
      }),
    )
  })

  it('allows deleting users that do not have assigned tasks', async () => {
    const find = vi.fn().mockResolvedValue({
      docs: [],
    })

    await expect(
      preventAssignedTaskOrphans({
        id: 123,
        req: {
          payload: {
            find,
          },
        },
      } as never),
    ).resolves.toBeUndefined()
  })

  it('sends invite reset emails for every admin-created user role', async () => {
    const forgotPassword = vi.fn().mockResolvedValue('reset-token')
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const logger = {
      info: vi.fn(),
    }
    const req = {
      payload: {
        forgotPassword,
        logger,
        sendEmail,
      },
      user: {
        role: 'admin',
      },
    }

    for (const role of ['admin', 'editor', 'writer'] as const) {
      await expect(
        sendUserInvite({
          doc: {
            id: `${role}-user`,
            email: `${role}@editorial.test`,
            role,
          },
          operation: 'create',
          req,
        } as never),
      ).resolves.toMatchObject({
        role,
      })
    }

    expect(forgotPassword).toHaveBeenCalledTimes(3)
    expect(forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: {
          email: 'admin@editorial.test',
        },
        disableEmail: true,
        overrideAccess: true,
      }),
    )
    expect(forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: {
          email: 'editor@editorial.test',
        },
        disableEmail: true,
        overrideAccess: true,
      }),
    )
    expect(forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: {
          email: 'writer@editorial.test',
        },
        disableEmail: true,
        overrideAccess: true,
      }),
    )
    expect(sendEmail).toHaveBeenCalledTimes(3)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Tu acceso a PANFLETO',
        to: 'writer@editorial.test',
      }),
    )
  })

  it('keeps writer invite email copy and branding intact', () => {
    const html = inviteEmailHTML({
      req: {
        origin: 'https://panfleto.example',
      },
      token: 'reset-token',
      user: {
        name: 'Leroy',
        role: 'writer',
      },
    } as never)

    expect(html).toContain('Hola Leroy,')
    expect(html).toContain('Te invitamos a escribir en')
    expect(html).toContain('<strong>PANFLETO</strong>')
    expect(html).toContain('solo necesitas crear tu contraseña')
    expect(html).toContain('También puedes copiar y pegar este enlace en tu navegador:')
    expect(html).toContain('Cuando entres, podrás crear borradores')
    expect(html).toContain('https://panfleto.example/admin/reset/reset-token')
    expect(html).toContain('background:#ffffff')
    expect(html).not.toContain('Activa tu acceso')
    expect(html).not.toContain('Invitación al espacio editorial')
    expect(html).not.toContain('icon-512.png')
    expect(html).not.toContain('Mesa de operaciones editoriales')
  })

  it('keeps forgot password email separate from invite copy', () => {
    const html = resetPasswordEmailHTML({
      req: {
        origin: 'https://panfleto.example',
      },
      token: 'reset-token',
      user: {
        name: 'Leroy',
      },
    } as never)

    expect(html).toContain('Restablece tu contraseña')
    expect(html).toContain('Recibimos una solicitud para restablecer tu contraseña de Panfleto.')
    expect(html).toContain('Restablecer contraseña')
    expect(html).not.toContain('Te invitamos a escribir')
    expect(html).not.toContain('Activa tu acceso')
  })

  it('sends onboarding email once after password setup', async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const update = vi.fn().mockResolvedValue(undefined)
    const logger = {
      info: vi.fn(),
    }

    const result = {
      user: {
        id: 123,
        email: 'writer@editorial.test',
        name: 'Leroy',
        role: 'writer',
      },
    }

    await expect(
      sendOnboardingEmailAfterPasswordSetup({
        operation: 'resetPassword',
        req: {
          origin: 'https://panfleto.example',
          payload: {
            logger,
            sendEmail,
            update,
          },
        },
        result,
      } as never),
    ).resolves.toBe(result)

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Primeros pasos en Panfleto',
        to: 'writer@editorial.test',
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 123,
        collection: 'users',
        data: {
          onboardingEmailSentAt: expect.any(String),
        },
        overrideAccess: true,
      }),
    )
  })

  it('uses role-specific onboarding copy', () => {
    expect(
      onboardingEmailHTML({
        user: {
          role: 'admin',
        },
      }),
    ).toContain('revisar usuarios, navegación, secciones')

    expect(
      onboardingEmailHTML({
        user: {
          role: 'editor',
        },
      }),
    ).toContain('convertir borradores en piezas listas')

    expect(
      onboardingEmailHTML({
        user: {
          role: 'writer',
        },
      }),
    ).toContain('crear borradores claros')
  })

  it('keeps header and footer globals manageable by admins', async () => {
    const args = {
      req: {
        user: {
          role: 'admin',
        },
      },
    } as never

    await expect(Promise.resolve(Header.access?.read?.(args))).resolves.toBe(true)
    await expect(Promise.resolve(Header.access?.update?.(args))).resolves.toBe(true)
    await expect(Promise.resolve(Footer.access?.read?.(args))).resolves.toBe(true)
    await expect(Promise.resolve(Footer.access?.update?.(args))).resolves.toBe(true)
  })

  it('makes section-owned navigation explicit in header and footer globals', () => {
    const headerNavItems = Header.fields.find(
      (field) => 'name' in field && field.name === 'navItems',
    )
    const footerNavItems = Footer.fields.find(
      (field) => 'name' in field && field.name === 'navItems',
    )

    expect(Header.fields.some((field) => 'name' in field && field.name === 'sectionNavNotice')).toBe(
      true,
    )
    expect(Footer.fields.some((field) => 'name' in field && field.name === 'sectionNavNotice')).toBe(
      true,
    )
    expect(headerNavItems && 'label' in headerNavItems ? headerNavItems.label : '').toBe(
      'Supplemental nav items',
    )
    expect(footerNavItems && 'label' in footerNavItems ? footerNavItems.label : '').toBe(
      'Supplemental nav items',
    )
  })

  it('summarizes the next Miniflux sync from existing mapping state', () => {
    expect(
      getNextScheduledSyncLabel({
        enabled: false,
      }),
    ).toContain('Paused')

    expect(
      getNextScheduledSyncLabel({
        enabled: true,
        lastSynced: '2026-07-11T12:00:00.000Z',
      }),
    ).toContain('Jul 12, 2026')
  })

  it('keeps trending score transparent and tied to article age', () => {
    const now = new Date('2026-07-11T18:00:00.000Z')
    const publishedAt = '2026-07-11T12:00:00.000Z'

    expect(getArticleAgeHours({ now, publishedAt })).toBe(6)
    expect(
      getTrendingScore({
        multiplier: 1,
        now,
        publishedAt,
        views: 1420,
      }),
    ).toBeCloseTo(62.76, 2)
  })
})
