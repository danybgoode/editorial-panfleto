import 'dotenv/config'

import configPromise from '@payload-config'
import os from 'node:os'
import path from 'path'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const imageDir = path.resolve(os.tmpdir(), 'panfleto-seed-media')

const richText = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      children: [
        {
          type: 'text',
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          text,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      version: 1,
    })),
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

const imageSVG = ({
  accent,
  bg,
  label,
  title,
}: {
  accent: string
  bg: string
  label: string
  title: string
}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
  <rect width="1600" height="1000" fill="${bg}"/>
  <rect x="52" y="52" width="1496" height="896" fill="none" stroke="#171513" stroke-width="4"/>
  <line x1="112" y1="238" x2="1488" y2="238" stroke="${accent}" stroke-width="12"/>
  <circle cx="1220" cy="610" r="245" fill="${accent}" opacity="0.18"/>
  <rect x="128" y="334" width="540" height="330" fill="#ffffff" opacity="0.72"/>
  <rect x="736" y="334" width="308" height="330" fill="#171513" opacity="0.12"/>
  <rect x="112" y="720" width="1110" height="2" fill="#171513" opacity="0.35"/>
  <text x="112" y="170" fill="${accent}" font-family="Arial, sans-serif" font-size="38" font-weight="800">${label}</text>
  <text x="112" y="820" fill="#171513" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700">${title}</text>
  <text x="112" y="894" fill="#6f6860" font-family="Arial, sans-serif" font-size="30">PANFLETO / imagen editorial de muestra</text>
</svg>`

const demoImages = [
  ['economia', 'ECONOMIA', 'Mercados en pausa', '#7b1e2b', '#f5efe4'],
  ['finanzas', 'FINANZAS', 'El costo del dinero', '#154f68', '#eef5f7'],
  ['politica', 'POLITICA', 'La mesa publica', '#7a5c20', '#f8f3e8'],
  ['deportes', 'DEPORTES', 'La nueva temporada', '#1f6b44', '#edf6ef'],
  ['tecnologia', 'TECNOLOGIA', 'Pantallas y poder', '#3f4b91', '#f0f2fb'],
  ['cultura', 'CULTURA', 'La ciudad que lee', '#8a3d64', '#faf0f5'],
  ['viajes', 'VIAJES', 'Rutas de trabajo', '#6b5135', '#f4efe8'],
] as const

const sections = [
  ['Política', 'Poder público, instituciones y vida democrática.', 1],
  ['Economía', 'Indicadores, consumo, empleo y empresas.', 2],
  ['Finanzas', 'Mercados, bancos, inversiones y dinero.', 3],
  ['Deportes', 'Competencia, negocios del deporte y cultura deportiva.', 4],
  ['Tecnología', 'Plataformas, ciencia aplicada y futuro digital.', 5],
  ['Cultura', 'Libros, cine, música, arte y conversación pública.', 6],
  ['Viajes', 'Rutas, hospitalidad, movilidad y formas de mirar el mundo.', 7],
] as const

const authors = ['Mariana Rios', 'Tomas Beltran', 'Lucia Paredes', 'Rafael Correa'] as const

const articles = [
  {
    section: 'Economía',
    image: 'economia',
    type: 'news',
    featured: true,
    breakingNews: false,
    headline: 'La economía se enfría, pero el consumo todavía resiste',
    subtitle: 'Empresas y hogares se preparan para un segundo semestre más selectivo.',
    summary: 'El gasto cotidiano mantiene el pulso mientras los analistas observan señales mixtas en inversión, empleo y crédito.',
  },
  {
    section: 'Finanzas',
    image: 'finanzas',
    type: 'news',
    featured: false,
    breakingNews: true,
    headline: 'Los bancos ajustan sus previsiones ante tasas más persistentes',
    subtitle: 'El crédito barato se aleja y las carteras vuelven a medirse con cautela.',
    summary: 'La banca privada espera una normalización más lenta y un apetito moderado por nuevos préstamos.',
  },
  {
    section: 'Política',
    image: 'politica',
    type: 'investigation',
    featured: false,
    breakingNews: false,
    headline: 'El gabinete abre una negociación discreta con gobernadores',
    subtitle: 'La agenda fiscal se mueve entre urgencias locales y disciplina presupuestal.',
    summary: 'Funcionarios federales buscan una salida que permita financiar obras sin romper las metas públicas.',
  },
  {
    section: 'Tecnología',
    image: 'tecnologia',
    type: 'feature',
    featured: false,
    breakingNews: false,
    headline: 'La inteligencia artificial llega al escritorio de las pequeñas empresas',
    subtitle: 'Herramientas de bajo costo cambian la operación diaria de comercios y despachos.',
    summary: 'Automatizar facturas, inventarios y atención al cliente empieza a ser una ventaja competitiva común.',
  },
  {
    section: 'Cultura',
    image: 'cultura',
    type: 'review',
    featured: false,
    breakingNews: false,
    headline: 'Cinco libros para leer antes de que termine el verano',
    subtitle: 'Narrativa, ensayo y memoria para una temporada de conversaciones largas.',
    summary: 'Una guía breve de novedades y rescates para llevar en la maleta o dejar en la mesa de noche.',
  },
  {
    section: 'Deportes',
    image: 'deportes',
    type: 'news',
    featured: false,
    breakingNews: false,
    headline: 'La liga redefine su calendario para cuidar a los jugadores',
    subtitle: 'Los clubes empujan un modelo con menos traslados y mejores ventanas de descanso.',
    summary: 'El debate cruza intereses deportivos, derechos de transmisión y la salud de las plantillas.',
  },
  {
    section: 'Viajes',
    image: 'viajes',
    type: 'feature',
    featured: false,
    breakingNews: false,
    headline: 'El regreso del viaje de negocios viene con menos lujos y más estrategia',
    subtitle: 'Las compañías autorizan menos trayectos, pero cuidan más cada agenda.',
    summary: 'Hoteles, aerolíneas y viajeros corporativos se adaptan a una etapa más medida.',
  },
  {
    section: 'Economía',
    image: 'economia',
    type: 'opinion',
    featured: false,
    breakingNews: false,
    headline: 'La austeridad también necesita imaginación',
    subtitle: 'Recortar no basta cuando los servicios públicos exigen una gestión más fina.',
    summary: 'La conversación fiscal suele hablar de techos, pero pocas veces de capacidad institucional.',
  },
  {
    section: 'Tecnología',
    image: 'tecnologia',
    type: 'news',
    featured: false,
    breakingNews: false,
    headline: 'Los reguladores ponen la lupa sobre los datos de entrenamiento',
    subtitle: 'Empresas de software enfrentan nuevas preguntas sobre derechos, trazabilidad y consentimiento.',
    summary: 'La presión normativa obliga a documentar mejor el origen de los modelos y sus límites.',
  },
  {
    section: 'Finanzas',
    image: 'finanzas',
    type: 'feature',
    featured: false,
    breakingNews: false,
    headline: 'Cómo leen los inversionistas una semana sin grandes anuncios',
    subtitle: 'Cuando no hay sobresaltos, los detalles pequeños mueven las expectativas.',
    summary: 'Volumen, liquidez y reportes secundarios ayudan a anticipar el siguiente cambio de tono.',
  },
  {
    section: 'Cultura',
    image: 'cultura',
    type: 'interview',
    featured: false,
    breakingNews: false,
    headline: 'Una editora explica por qué el ensayo vuelve a vender',
    subtitle: 'La no ficción literaria encuentra lectores que quieren contexto sin solemnidad.',
    summary: 'La conversación sobre libros se mueve entre clubes, newsletters y librerías independientes.',
  },
  {
    section: 'Deportes',
    image: 'deportes',
    type: 'editorial',
    featured: false,
    breakingNews: false,
    headline: 'El deporte base no puede depender solo de héroes ocasionales',
    subtitle: 'Las medallas importan, pero las canchas abiertas importan más.',
    summary: 'Una política deportiva seria empieza lejos del podio y cerca de los barrios.',
  },
] as const

const toSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const ensureImageFiles = async () => {
  await mkdir(imageDir, { recursive: true })

  await Promise.all(
    demoImages.map(async ([key, label, title, accent, bg]) => {
      await sharp(Buffer.from(imageSVG({ accent, bg, label, title })))
        .jpeg({ quality: 88 })
        .toFile(path.join(imageDir, `${key}.jpg`))
    }),
  )
}

export const seedDemoContent = async () => {
  await ensureImageFiles()

  const payload = await getPayload({ config: configPromise })

  const sectionDocs = new Map<string, number | string>()
  for (const [name, description, displayOrder] of sections) {
    const slug = toSlug(name)
    const existing = await payload.find({
      collection: 'sections',
      limit: 1,
      pagination: false,
      where: { slug: { equals: slug } },
    })

    const doc = existing.docs[0]
      ? await payload.update({
          collection: 'sections',
          id: existing.docs[0].id,
          data: { name, description, displayOrder, isActive: true },
        })
      : await payload.create({
          collection: 'sections',
          data: { name, slug, description, displayOrder, isActive: true },
        })

    sectionDocs.set(name, doc.id)
  }

  const authorDocs = new Map<string, number | string>()
  for (const name of authors) {
    const slug = toSlug(name)
    const existing = await payload.find({
      collection: 'authors',
      limit: 1,
      pagination: false,
      where: { slug: { equals: slug } },
    })

    const doc = existing.docs[0]
      ? await payload.update({
          collection: 'authors',
          id: existing.docs[0].id,
          data: { name, isActive: true },
        })
      : await payload.create({
          collection: 'authors',
          data: { name, slug, isActive: true },
        })

    authorDocs.set(name, doc.id)
  }

  const mediaDocs = new Map<string, number | string>()
  for (const [key, label] of demoImages) {
    const alt = `PANFLETO demo ${label.toLowerCase()}`
    const existing = await payload.find({
      collection: 'media',
      limit: 1,
      pagination: false,
      where: { alt: { equals: alt } },
    })

    const doc =
      existing.docs[0] ||
      (await payload.create({
        collection: 'media',
        data: {
          alt,
          credit: 'PANFLETO',
          source: 'Imagen editorial de muestra',
        },
        filePath: path.join(imageDir, `${key}.jpg`),
      }))

    mediaDocs.set(key, doc.id)
  }

  const now = Date.now()
  for (const [index, article] of articles.entries()) {
    const slug = toSlug(article.headline)
    const author = authorDocs.get(authors[index % authors.length])
    const section = sectionDocs.get(article.section)
    const featuredImage = mediaDocs.get(article.image)
    const publishedAt = new Date(now - index * 1000 * 60 * 60 * 8).toISOString()
    const body = richText(
      article.summary,
      'La redacción preparó esta pieza como contenido de muestra para probar jerarquías, módulos de portada, navegación por secciones y experiencia de lectura en móvil.',
      'El objetivo es vestir el sitio con notas publicadas que se sientan realistas mientras el equipo editorial prepara sus primeras historias reales.',
      'Cada nota puede editarse, archivarse o borrarse desde el panel de Payload cuando ya no haga falta como placeholder.',
    )

    const data = {
      headline: article.headline,
      subtitle: article.subtitle,
      slug,
      summary: article.summary,
      featuredImage,
      body,
      author,
      section,
      articleType: article.type,
      editorialStatus: 'published',
      _status: 'published',
      publishedAt,
      featured: article.featured,
      breakingNews: article.breakingNews,
      meta: {
        title: article.headline,
        description: article.summary,
        image: featuredImage,
      },
    }

    const existing = await payload.find({
      collection: 'articles',
      limit: 1,
      pagination: false,
      where: { slug: { equals: slug } },
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'articles',
        context: {
          disableRevalidate: true,
        },
        id: existing.docs[0].id,
        data: data as RequiredDataFromCollectionSlug<'articles'>,
      })
    } else {
      await payload.create({
        collection: 'articles',
        context: {
          disableRevalidate: true,
        },
        data: data as RequiredDataFromCollectionSlug<'articles'>,
      })
    }
  }

  return {
    articles: articles.length,
    authors: authors.length,
    sections: sections.length,
  }
}

if (process.argv[1]?.endsWith('seed-demo-content.ts')) {
  const result = await seedDemoContent()
  console.log(
    `Seeded ${result.sections} sections, ${result.authors} authors, and ${result.articles} published articles.`,
  )
  process.exit(0)
}
