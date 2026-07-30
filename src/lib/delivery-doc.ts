'use client'

import { apiFetch } from '@/lib/http'

export interface DeliveryDocItem {
  name: string
  code: string
  patrimonialCode: string
  quantity: number
  itemType: string
  category: string
  unit: string
  status: string
}

export interface DeliveryDocData {
  docNumber: string
  date: string
  recipientName: string
  recipientOffice: string
  deliveredBy: string
  warehouseManager: string
  authorizedBy: string
  authorizationDetail: string
  items: DeliveryDocItem[]
  signatureDeliveredBy?: string
  signatureReceivedBy?: string
}

export interface ReturnDocData {
  docNumber: string
  date: string
  returnDocNumber: string
  recipientName: string
  recipientOffice: string
  deliveredBy: string
  items: Array<{ name: string; code: string; patrimonialCode: string; quantity: number; itemType: string }>
}

interface BrandingConfig {
  institutionName?: string
  logoUrl?: string | null
  primaryColor?: string
}

function getDocumentHeaderHTML(config?: BrandingConfig): string {
  const institutionName = config?.institutionName || 'INSTITUCIÓN'
  const logoHtml = config?.logoUrl
    ? `<img src="${config.logoUrl}" alt="Logo" style="height:70px;margin-bottom:5px" />`
    : ''
  const color = config?.primaryColor || '#1e40af'
  return `
<div class="header">
  ${logoHtml}
  <h1 style="color:${color}">${institutionName}</h1>
  <p>Sistema de Gestión de Almacén</p>
</div>`
}

function itemsRows(items: DeliveryDocItem[]): string {
  return items.map((item, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #000;text-align:center">${i + 1}</td>
      <td style="padding:8px;border:1px solid #000">${item.code}</td>
      <td style="padding:8px;border:1px solid #000">${item.name}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.patrimonialCode || 'S/N'}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.itemType}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.category || '---'}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.unit || 'UNIDAD'}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.status || 'OPERATIVO'}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.itemType === 'CONSUMIBLE' ? item.quantity : '---'}</td>
    </tr>`).join('')
}

function returnItemsRows(items: ReturnDocData['items']): string {
  return items.map((item, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #000;text-align:center">${i + 1}</td>
      <td style="padding:8px;border:1px solid #000">${item.code}</td>
      <td style="padding:8px;border:1px solid #000">${item.name}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.patrimonialCode || 'S/N'}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.itemType}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.quantity}</td>
    </tr>`).join('')
}

const DOC_STYLE = `
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; margin: 0; padding: 0; width: 210mm; }
  .page { width: 170mm; margin: 0 auto; padding: 20px 0; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h1 { font-size: 14pt; margin: 0 0 5px; text-transform: uppercase; font-weight: bold; }
  .header h2 { font-size: 12pt; margin: 0 0 5px; text-transform: uppercase; font-weight: bold; }
  .header p { font-size: 11pt; margin: 2px 0; }
  .title { text-align: center; margin: 25px 0; }
  .title h3 { font-size: 13pt; margin: 0; text-decoration: underline; }
  .info { margin-bottom: 20px; }
  .info p { margin: 3px 0; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; page-break-inside: avoid; }
  th { background: #f0f0f0; padding: 4px 3px; border: 1px solid #000; font-size: 7.5pt; text-align: center; font-weight: bold; }
  td { padding: 3px; border: 1px solid #000; font-size: 8pt; }
  td:nth-child(2) { font-family: 'Courier New', monospace; font-size: 7.5pt; }
  .signatures { margin-top: 30px; page-break-inside: avoid; }
  .signatures-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px 30px; max-width: 500px; margin: 0 auto; }
  .signature-box { text-align: center; }
  .signature-box img.sig-img { max-width: 140px; max-height: 35px; margin-bottom: 2px; display: block; margin-left: auto; margin-right: auto; filter: brightness(0.5) sepia(1) saturate(500%) hue-rotate(200deg); }
  .sig-spacer { min-height: 80px; }
  .signature-line { border-top: 2px solid #000; padding-top: 4px; font-size: 10pt; font-weight: bold; }
  .footer { margin-top: 30px; font-size: 8pt; text-align: center; color: #666; }
  @media print { .no-print { display: none; } body { width: auto; } .page { width: auto; margin: 0; } }
`

function printButtons(downloadName: string): string {
  return `
<div class="no-print" style="text-align:right;margin-bottom:20px">
  <button onclick="window.print()" style="padding:8px 20px;margin-right:8px;cursor:pointer">Imprimir / PDF</button>
  <button onclick="downloadDoc()" style="padding:8px 20px;cursor:pointer">Descargar Word</button>
</div>
<script>
function downloadDoc() {
  var html = document.documentElement.outerHTML
  var bom = '\uFEFF'
  var blob = new Blob([bom + html], { type: 'application/msword;charset=utf-8' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = '${downloadName}.doc'
  a.click()
  URL.revokeObjectURL(url)
}
</script>`
}

export function generateDeliveryHtml(data: DeliveryDocData, config?: BrandingConfig): string {
  const headerBranding = getDocumentHeaderHTML(config)
  const downloadName = `Acta_Entrega_${data.docNumber.replace(/[^\p{L}\p{N}]/gu, '_')}`
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Acta de Entrega - ${data.docNumber}</title><style>${DOC_STYLE}</style></head>
<body>
<div class="page">
${printButtons(downloadName)}
${headerBranding}
<div class="title">
  <h3>ACTA DE ENTREGA DE BIENES</h3>
  <p>N° <strong>${data.docNumber}</strong></p>
</div>
<div class="info">
  <p><strong>FECHA DE ENTREGA:</strong> ${data.date}</p>
  <p><strong>ENTREGADO POR:</strong> ${data.deliveredBy}</p>
  <p><strong>RESPONSABLE DE ALMACÉN:</strong> ${data.warehouseManager}</p>
  <p><strong>AUTORIZADO POR:</strong> ${data.authorizedBy}</p>
  <p><strong>RECEPCIONA:</strong> ${data.recipientName}</p>
  <p><strong>OFICINA:</strong> ${data.recipientOffice}</p>
  ${data.authorizationDetail ? `<p style="font-size:10pt;color:#7c3aed;font-style:italic">${data.authorizationDetail}</p>` : ''}
</div>
<p style="font-size:11pt">Por medio de la presente, se hace entrega formal de los siguientes bienes al usuario indicado, para el cumplimiento de sus funciones institucionales:</p>
<table>
  <thead>
    <tr>
      <th style="width:30px">N°</th><th style="width:90px">Código</th><th>Descripción del Bien</th>
      <th style="width:100px">Cód. Patrim.</th><th style="width:80px">Tipo</th><th style="width:80px">Categoría</th>
      <th style="width:55px">Unidad</th><th style="width:70px">Estado</th><th style="width:45px">Cant.</th>
    </tr>
  </thead>
  <tbody>${itemsRows(data.items)}</tbody>
</table>
<p style="font-size:11pt">Los bienes descritos son entregados en el estado indicado y el receptor se compromete a utilizarlos exclusivamente para fines institucionales.</p>
<div class="signatures">
  <div class="signatures-grid">
    <div class="signature-box">
      ${data.signatureDeliveredBy ? `<img src="${data.signatureDeliveredBy}" class="sig-img" />` : '<div class="sig-spacer"></div>'}
      <div class="signature-line">ENTREGÓ</div>
      <p style="font-size:10pt;margin-top:4px"><strong>${data.deliveredBy}</strong></p>
      <p style="font-size:9pt;color:#666">${data.warehouseManager}</p>
    </div>
    <div class="signature-box">
      ${data.signatureReceivedBy ? `<img src="${data.signatureReceivedBy}" class="sig-img" />` : '<div class="sig-spacer"></div>'}
      <div class="signature-line">RECIBÍ CONFORME</div>
      <p style="font-size:10pt;margin-top:4px"><strong>${data.recipientName}</strong></p>
      <p style="font-size:9pt;color:#666">${data.recipientOffice}</p>
    </div>
  </div>
</div>
<div class="footer"><p>Documento generado por el Sistema de Almacén Institucional</p></div>
</div>
</body></html>`
}

export function generateReturnHtml(data: ReturnDocData, config?: BrandingConfig): string {
  const headerBranding = getDocumentHeaderHTML(config)
  const downloadName = `Acta_Devolucion_${data.returnDocNumber.replace(/[^\p{L}\p{N}]/gu, '_')}`
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Acta de Devolución - ${data.returnDocNumber}</title><style>${DOC_STYLE}</style></head>
<body>
<div class="page">
${printButtons(downloadName)}
${headerBranding}
<div class="title">
  <h3>ACTA DE DEVOLUCIÓN DE BIENES</h3>
  <p>N° <strong>${data.returnDocNumber}</strong></p>
</div>
<div class="info">
  <p><strong>FECHA DE DEVOLUCIÓN:</strong> ${data.date}</p>
  <p><strong>RECIBIDO POR:</strong> ${data.deliveredBy}</p>
  <p><strong>DEVUELTO POR:</strong> ${data.recipientName}</p>
  <p><strong>OFICINA:</strong> ${data.recipientOffice}</p>
  <p><strong>DOCUMENTO DE ASIGNACIÓN:</strong> ${data.docNumber}</p>
</div>
<p style="font-size:11pt">Por medio de la presente, se deja constancia de la devolución formal de los siguientes bienes:</p>
<table>
  <thead>
    <tr>
      <th style="width:30px">N°</th><th style="width:90px">Código</th><th>Descripción del Bien</th>
      <th style="width:100px">Cód. Patrim.</th><th style="width:80px">Tipo</th><th style="width:45px">Cant.</th>
    </tr>
  </thead>
  <tbody>${returnItemsRows(data.items)}</tbody>
</table>
<div class="signatures">
  <div class="signatures-grid">
    <div class="signature-box">
      <div class="signature-line">RECIBÍ CONFORME</div>
      <p style="font-size:10pt;margin-top:4px"><strong>${data.deliveredBy}</strong></p>
      <p style="font-size:9pt;color:#666">Responsable de Almacén</p>
    </div>
    <div class="signature-box">
      <div class="signature-line">DEVOLVIÓ</div>
      <p style="font-size:10pt;margin-top:4px"><strong>${data.recipientName}</strong></p>
      <p style="font-size:9pt;color:#666">${data.recipientOffice}</p>
    </div>
  </div>
</div>
<div class="footer"><p>Documento generado por el Sistema de Almacén Institucional</p></div>
</div>
</body></html>`
}

export function openDeliveryDocument(data: DeliveryDocData, config?: BrandingConfig) {
  const html = generateDeliveryHtml(data, config)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
  }
}

export async function saveDeliveryDocument(data: DeliveryDocData, assetsIds: number[], config?: BrandingConfig): Promise<string | null> {
  const html = generateDeliveryHtml(data, config)
  try {
    const res = await apiFetch('/api/assigned-assets/save-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, docNumber: data.docNumber, assetsIds }),
    })
    if (res.ok) {
      const result = await res.json()
      return result.url
    }
  } catch {
    // ignorar
  }
  return null
}

export interface LostDocData {
  docNumber: string
  date: string
  declarantName: string
  declarantOffice: string
  lossReason: string
  lossDate: string
  items: Array<{
    name: string
    code: string
    patrimonialCode: string
    quantity: number
    estimatedValue?: string
  }>
}

export function generateLostDeclarationHtml(data: LostDocData, config?: BrandingConfig): string {
  const headerBranding = getDocumentHeaderHTML(config)
  const downloadName = `Declaracion_Perdida_${data.docNumber.replace(/[^\p{L}\p{N}]/gu, '_')}`
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Declaración Jurada de Pérdida - ${data.docNumber}</title><style>${DOC_STYLE.replace('width: 210mm', 'width: 210mm').replace('width: 170mm', 'width: 170mm')}</style></head>
<body>
<div class="page">
${printButtons(downloadName)}
${headerBranding}
<div class="title">
  <h3>DECLARACIÓN JURADA DE PÉRDIDA / ROBO DE BIENES</h3>
  <p>N° <strong>${data.docNumber}</strong></p>
</div>
<div class="info">
  <p><strong>FECHA DE DECLARACIÓN:</strong> ${data.date}</p>
  <p><strong>DECLARANTE:</strong> ${data.declarantName}</p>
  <p><strong>OFICINA:</strong> ${data.declarantOffice}</p>
  <p><strong>FECHA DE PÉRDIDA:</strong> ${data.lossDate}</p>
</div>
<div style="margin:20px 0;padding:15px;border:1px solid #000;border-radius:4px;background:#fef2f2">
  <p style="font-size:11pt;font-weight:bold;color:#991b1b">MOTIVO DE LA PÉRDIDA / ROBÓ</p>
  <p style="font-size:11pt;margin-top:8px">${data.lossReason.replace(/\n/g, '<br/>')}</p>
</div>
<p style="font-size:11pt">Por medio de la presente, el declarante manifiesta bajo juramento la pérdida de los siguientes bienes patrimoniales:</p>
<table>
  <thead>
    <tr>
      <th style="width:30px">N°</th><th style="width:90px">Código</th><th>Descripción del Bien</th>
      <th style="width:100px">Cód. Patrim.</th><th style="width:45px">Cant.</th><th style="width:80px">Valor Est.</th>
    </tr>
  </thead>
  <tbody>${data.items.map((item, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #000;text-align:center">${i + 1}</td>
      <td style="padding:8px;border:1px solid #000">${item.code}</td>
      <td style="padding:8px;border:1px solid #000">${item.name}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.patrimonialCode || 'S/N'}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border:1px solid #000;text-align:center">${item.estimatedValue || '---'}</td>
    </tr>`).join('')}</tbody>
</table>
<p style="font-size:11pt;margin-top:15px">El declarante se compromete a realizar la denuncia correspondiente ante la autoridad competente y asume la responsabilidad por la veracidad de la información proporcionada.</p>
<div class="signatures">
  <div class="signatures-grid" style="grid-template-columns:repeat(2, 1fr)">
    <div class="signature-box">
      <div class="signature-line">DECLARANTE</div>
      <p style="font-size:10pt;margin-top:4px"><strong>${data.declarantName}</strong></p>
      <p style="font-size:9pt;color:#666">${data.declarantOffice}</p>
    </div>
    <div class="signature-box">
      <div class="signature-line">RESPONSABLE DE ALMACÉN</div>
      <p style="font-size:10pt;margin-top:4px">Recibí Conforme</p>
    </div>
  </div>
</div>
<div class="footer"><p>Documento generado por el Sistema de Almacén Institucional</p></div>
</div>
</body></html>`
}

export function openLostDocument(data: LostDocData, config?: BrandingConfig) {
  const html = generateLostDeclarationHtml(data, config)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
  }
}

export async function saveLostDocument(data: LostDocData, assetsIds: number[], config?: BrandingConfig): Promise<string | null> {
  const html = generateLostDeclarationHtml(data, config)
  try {
    const res = await apiFetch('/api/assigned-assets/save-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, docNumber: `PERDIDA-${data.docNumber}`, assetsIds, docType: 'PERDIDA' }),
    })
    if (res.ok) {
      const result = await res.json()
      return result.url
    }
  } catch {
    // ignorar
  }
  return null
}

export async function fetchUserSignature(userId?: number): Promise<string | null> {
  if (!userId) return null
  try {
    const res = await apiFetch(`/api/digital-signatures?userId=${userId}&limit=1`)
    if (res.ok) {
      const data = await res.json()
      if (data.signatures && Array.isArray(data.signatures) && data.signatures.length > 0) {
        return data.signatures[0].signatureData || null
      }
    }
  } catch { /* ignorar */ }
  return null
}

export async function saveReturnDocument(data: ReturnDocData, assetsIds: number[], config?: BrandingConfig): Promise<string | null> {
  const html = generateReturnHtml(data, config)
  try {
    const res = await apiFetch('/api/assigned-assets/save-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, docNumber: data.returnDocNumber, assetsIds, docType: 'RETORNO' }),
    })
    if (res.ok) {
      const result = await res.json()
      return result.url
    }
  } catch {
    // ignorar
  }
  return null
}