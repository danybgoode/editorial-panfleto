import type { PayloadRequest } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

type SystemEmailAction = {
  href: string
  label: string
}

type SystemEmailTextSegment = string | { strong: string }

type SystemEmailParagraph = string | { segments: SystemEmailTextSegment[] }

type SystemEmailArgs = {
  action?: SystemEmailAction
  body: SystemEmailParagraph[]
  eyebrow?: string
  greeting?: string
  req?: PayloadRequest
  showFooter?: boolean
  title: string
}

export const escapeHTML = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const getWorkspaceURL = (req?: PayloadRequest) => req?.origin || getServerSideURL()

const renderParagraph = (paragraph: SystemEmailParagraph) => {
  const content =
    typeof paragraph === 'string'
      ? escapeHTML(paragraph)
      : paragraph.segments
          .map((segment) =>
            typeof segment === 'string'
              ? escapeHTML(segment)
              : `<strong>${escapeHTML(segment.strong)}</strong>`,
          )
          .join('')

  return `<p style="margin:0 0 16px;color:#1A1A1A;font-size:16px;line-height:1.55;">${content}</p>`
}

export const renderSystemEmail = ({
  action,
  body,
  eyebrow = 'PANFLETO',
  greeting = 'Hola,',
  req,
  showFooter = true,
  title,
}: SystemEmailArgs) => {
  const baseURL = getWorkspaceURL(req)
  const logoURL = `${baseURL}/icon-512.png`
  const safeActionHref = action ? escapeHTML(action.href) : null

  return `
    <div style="margin:0;padding:0;background:#F9F9F9;color:#1A1A1A;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#F9F9F9;">
        <tr>
          <td align="center" style="padding:28px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:collapse;background:#FFFFFF;border:1px solid #E6E6E6;">
              <tr>
                <td style="padding:28px 28px 18px;border-bottom:1px solid #E6E6E6;">
                  <img src="${escapeHTML(logoURL)}" alt="Panfleto" width="72" style="display:block;width:72px;max-width:100%;height:auto;" />
                </td>
              </tr>
              <tr>
                <td style="padding:28px;">
                  <p style="margin:0 0 10px;color:#5F5F5F;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;">${escapeHTML(eyebrow)}</p>
                  <h1 style="margin:0 0 18px;color:#1A1A1A;font-size:26px;line-height:1.2;font-weight:800;">${escapeHTML(title)}</h1>
                  <p style="margin:0 0 16px;color:#1A1A1A;font-size:16px;line-height:1.55;">${escapeHTML(greeting)}</p>
                  ${body.map(renderParagraph).join('')}
                  ${
                    action && safeActionHref
                      ? `
                        <p style="margin:24px 0 16px;">
                          <a href="${safeActionHref}" style="display:inline-block;background:#FFFFFF;color:#171513;padding:13px 18px;text-decoration:none;font-weight:800;border:2px solid #171513;border-radius:4px;">${escapeHTML(
                            action.label,
                          )}</a>
                        </p>
                        <p style="margin:0 0 18px;color:#4A4A4A;font-size:13px;line-height:1.5;word-break:break-word;">
                          ${safeActionHref}
                        </p>
                      `
                      : ''
                  }
                  ${
                    showFooter
                      ? `
                        <div style="margin-top:28px;padding-top:18px;border-top:3px solid #1A1A1A;">
                          <p style="margin:0;color:#1A1A1A;font-size:15px;line-height:1.5;font-weight:800;">Panfleto</p>
                          <p style="margin:4px 0 0;color:#5F5F5F;font-size:13px;line-height:1.45;">Mesa de operaciones editoriales</p>
                        </div>
                      `
                      : ''
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}
