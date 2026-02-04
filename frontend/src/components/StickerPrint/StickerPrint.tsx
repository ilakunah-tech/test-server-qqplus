import { useEffect } from 'react';
import { formatDateDDMM } from '@/utils/formatters';
import type { Roast } from '@/types/api';

/** URL публичного API для генерации QR-кода (без npm-зависимостей) */
function getQrImageUrl(url: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}`;
}

/** Цель: green/yellow → Н.О., red → З.О. Без статуса — не показываем. */
function getGoalLabel(goalsStatus?: 'green' | 'yellow' | 'red'): string | null {
  if (!goalsStatus) return null;
  if (goalsStatus === 'red') return 'З.О.';
  if (goalsStatus === 'green' || goalsStatus === 'yellow') return 'Н.О.';
  return null;
}

function getBatchNumberArtisan(roast: Roast): string {
  const n = roast.batch_number;
  if (n != null && n > 0) return String(n);
  return '—';
}

function getRoastNumberSite(roast: Roast): string {
  const seq = roast.roast_seq;
  if (seq != null && seq > 0) return `#${seq}`;
  return '—';
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

interface StickerPrintProps {
  roasts: Roast[];
  /** Базовый URL (window.location.origin) для QR */
  baseUrl: string;
  onClose: () => void;
}

export function StickerPrint({ roasts, baseUrl, onClose }: StickerPrintProps) {
  useEffect(() => {
    if (roasts.length === 0) return;

    const run = () => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Разрешите всплывающие окна для печати наклеек.');
        onClose();
        return;
      }

      const stickersHtml = roasts
        .map((roast) => {
          const batchArtisan = getBatchNumberArtisan(roast);
          const roastSite = getRoastNumberSite(roast);
          const name = roast.title ?? roast.label ?? '—';
          const date = formatDateDDMM(roast.roasted_at ?? roast.roast_date);
          const goalLabel = getGoalLabel(roast.goals_status);
          const roastUrl = `${baseUrl}/roasts/${roast.id}`;
          const qrSrc = getQrImageUrl(roastUrl);

          return `
        <div class="sticker">
          <div class="sticker__content">
            <div class="sticker__text">
              <div class="sticker__row">
                <span>Батч Artisan: ${escapeHtml(batchArtisan)}</span>
                <span>Обжарка: ${escapeHtml(roastSite)}</span>
              </div>
              <div class="sticker__title">${escapeHtml(name)}</div>
              <div class="sticker__row">
                <span class="sticker__date">${escapeHtml(date)}</span>
                ${goalLabel ? `<span class="sticker__goal">${escapeHtml(goalLabel)}</span>` : ''}
              </div>
            </div>
            <div class="sticker__qr">
              <img src="${qrSrc}" width="40" height="40" alt="QR" />
            </div>
          </div>
        </div>`;
        })
        .join('');

      const doc = printWindow.document;
      doc.open();
      doc.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Наклейки обжарок</title>
  <script>
    window.addEventListener('load', function() {
      window.onafterprint = function() { window.close(); };
      // Инструкция для пользователя
      console.log('ВАЖНО: В настройках печати выберите "Альбомная ориентация" (Landscape) и масштаб 100%');
      setTimeout(function() {
        window.print();
      }, 100);
    });
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    /* Размеры страницы: 58mm (ширина) × 40mm (высота) - альбомная ориентация */
    @page {
      size: 58mm 40mm;
      margin: 0;
    }
    
    @media print {
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      html, body {
        width: 58mm !important;
        height: 40mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      
      .stickers {
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        width: 58mm !important;
        height: 40mm !important;
      }
      
      .sticker {
        width: 58mm !important;
        height: 40mm !important;
        max-width: 58mm !important;
        max-height: 40mm !important;
        min-width: 58mm !important;
        min-height: 40mm !important;
        margin: 0 !important;
        padding: 1mm !important;
        border: 1px solid #999 !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
        page-break-before: avoid !important;
        break-after: page !important;
        break-inside: avoid !important;
        break-before: avoid !important;
        orphans: 999 !important;
        widows: 999 !important;
        display: flex !important;
        flex-direction: row !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      
      .sticker * {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        orphans: 999 !important;
        widows: 999 !important;
      }
      
      .sticker:last-child { 
        page-break-after: auto !important;
        break-after: auto !important;
      }
      
      .sticker__content {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        orphans: 999 !important;
        widows: 999 !important;
        display: flex !important;
        flex-direction: row !important;
      }
      
      .sticker__text {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        orphans: 999 !important;
        widows: 999 !important;
        display: flex !important;
        flex-direction: column !important;
      }
      
      .sticker__row {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        orphans: 999 !important;
        widows: 999 !important;
        display: flex !important;
        flex-direction: row !important;
      }
      
      .sticker__title {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        orphans: 999 !important;
        widows: 999 !important;
      }
      
      .sticker__qr {
        width: 40px !important;
        height: 40px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        flex-shrink: 0 !important;
      }
      
      .sticker__qr img {
        width: 40px !important;
        height: 40px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
        image-rendering: pixelated !important;
      }
    }
    
    html, body { 
      font-family: Arial, sans-serif; 
      font-size: 12pt; 
      margin: 0;
      padding: 0;
      width: 58mm;
      height: 40mm;
      overflow: hidden;
    }
    
    .stickers { 
      display: block;
      margin: 0;
      padding: 0;
      width: 58mm;
      height: 40mm;
    }
    
    .sticker {
      width: 58mm;
      height: 40mm;
      border: 1px solid #999;
      padding: 1mm;
      display: flex;
      flex-direction: row;
      margin: 0;
      box-sizing: border-box;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .sticker__content {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      width: 100%;
      height: 100%;
      gap: 1mm;
      min-width: 0;
      page-break-inside: avoid;
      break-inside: avoid;
      flex-shrink: 1;
      orphans: 999;
      widows: 999;
    }
    
    .sticker__text {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      justify-content: flex-start;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
      orphans: 999;
      widows: 999;
    }
    
    .sticker__row { 
      display: flex; 
      flex-direction: row;
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 0.5mm; 
      font-size: 12pt; 
      line-height: 1; 
      white-space: normal;
      page-break-inside: avoid;
      break-inside: avoid;
      flex-shrink: 0;
      orphans: 999;
      widows: 999;
    }
    
    .sticker__row:last-of-type {
      margin-bottom: 0;
    }
    
    .sticker__title { 
      font-weight: bold; 
      font-size: 12pt; 
      margin-bottom: 0.5mm; 
      word-break: break-word; 
      line-height: 1; 
      overflow: hidden;
      text-overflow: ellipsis;
      page-break-inside: avoid;
      break-inside: avoid;
      flex-shrink: 0;
    }
    
    .sticker__date { 
      font-size: 12pt; 
    }
    
    .sticker__goal { 
      font-weight: bold; 
      font-size: 12pt; 
    }
    
    .sticker__qr { 
      flex-shrink: 0; 
      width: 40px;
      height: 40px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .sticker__qr img {
      width: 40px;
      height: 40px;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
    
    .sticker__qr img {
      width: 50px;
      height: 50px;
    }
    
    .sticker__qr img { 
      width: 40px; 
      height: 40px; 
      display: block;
      object-fit: contain;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
  </style>
</head>
<body>
  <div class="stickers">${stickersHtml}</div>
</body>
</html>
      `);
      doc.close();

      printWindow.focus();
      onClose();
    };

    run();
  }, [roasts, baseUrl, onClose]);

  return null;
}
