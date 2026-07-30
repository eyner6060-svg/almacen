const YEAR_DENOMINATIONS: Record<number, string> = {
  2022: 'Año del Fortalecimiento de la Soberanía Nacional',
  2023: 'Año de la Unidad, la Paz y el Desarrollo',
  2024: 'Año del Bicentenario, de la consolidación de nuestra Independencia, y de la conmemoración de las heroicas batallas de Junín y Ayacucho',
  2025: 'Año de la Recuperación y Consolidación de la Economía Peruana',
}

const DEFAULT_DENOMINATION = 'Año de la Recuperación y Consolidación de la Economía Peruana'

let cachedDenomination: string | null = null

export function getCurrentYearDenomination(): string {
  if (cachedDenomination) return cachedDenomination

  const currentYear = new Date().getFullYear()
  cachedDenomination = YEAR_DENOMINATIONS[currentYear] || DEFAULT_DENOMINATION
  return cachedDenomination
}

export function getDocumentHeaderHTML(config: {
  institutionName?: string
  logoUrl?: string | null
  primaryColor?: string
}): string {
  const denomination = getCurrentYearDenomination()
  const name = config?.institutionName || 'Almacén Institucional'
  const color = config?.primaryColor || '#1e40af'
  const logoHtml = config?.logoUrl
    ? `<img src="${config.logoUrl}" alt="Logo" style="height:70px;width:auto;object-fit:contain;" />`
    : ''

  return `
    <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid ${color};">
      ${logoHtml ? `<div style="flex-shrink:0;">${logoHtml}</div>` : ''}
      <div style="flex:1;text-align:center;">
        <h1 style="font-size:18px;font-family:'Times New Roman',Times,serif;margin:0 0 2px 0;color:${color};">${name.toUpperCase()}</h1>
        <h2 style="font-size:14px;font-family:'Times New Roman',Times,serif;margin:0;font-weight:normal;font-style:italic;color:#444;">${denomination}</h2>
      </div>
    </div>`
}


