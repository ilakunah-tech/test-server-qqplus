import { useEffect, useRef } from 'react';
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
  const openedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (roasts.length === 0) return;
    if (openedRef.current) return;
    openedRef.current = true;

    const run = () => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Разрешите всплывающие окна для печати наклеек.');
        openedRef.current = false;
        onCloseRef.current();
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
          <div class="sticker__inner">
            <div class="sticker__meta">
              <span class="sticker__meta-item"><span class="sticker__label">Батч Artisan</span> ${escapeHtml(batchArtisan)}</span>
              <span class="sticker__meta-item"><span class="sticker__label">Обжарка</span> ${escapeHtml(roastSite)}</span>
            </div>
            <div class="sticker__divider"></div>
            <div class="sticker__body">
              <div class="sticker__text">
                <h2 class="sticker__title">${escapeHtml(name)}</h2>
                <div class="sticker__footer">
                  <span class="sticker__date">${escapeHtml(date)}</span>
                  ${goalLabel ? `<span class="sticker__goal">${escapeHtml(goalLabel)}</span>` : ''}
                </div>
              </div>
              <div class="sticker__qr-wrap">
                <img src="${qrSrc}" class="sticker__qr" width="44" height="44" alt="QR" />
              </div>
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
    
    @page { size: 58mm 40mm; margin: 0; }
    
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { width: 58mm !important; height: 40mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
      .stickers { margin: 0 !important; padding: 0 !important; display: block !important; width: 58mm !important; height: 40mm !important; }
      .sticker {
        width: 58mm !important; height: 40mm !important; min-width: 58mm !important; min-height: 40mm !important;
        margin: 0 !important; padding: 0 !important; border: none !important;
        page-break-after: always !important; page-break-inside: avoid !important; break-after: page !important;
        display: flex !important; box-sizing: border-box !important; overflow: hidden !important;
      }
      .sticker:last-child { page-break-after: auto !important; break-after: auto !important; }
      .sticker * { page-break-inside: avoid !important; break-inside: avoid !important; }
      .sticker__inner, .sticker__body, .sticker__text, .sticker__meta, .sticker__footer, .sticker__qr-wrap { display: flex !important; }
      .sticker__qr { width: 44px !important; height: 44px !important; }
      .sticker__qr img { width: 44px !important; height: 44px !important; image-rendering: crisp-edges !important; }
    }
    
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      width: 58mm;
      height: 40mm;
      overflow: hidden;
    }
    
    .stickers { display: block; margin: 0; padding: 0; width: 58mm; height: 40mm; }
    
    .sticker {
      width: 58mm;
      height: 40mm;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
      border: 0.35mm solid #000;
      background: #fff;
    }
    
    .sticker__inner {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 1.8mm;
      gap: 0;
    }
    
    .sticker__meta {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: baseline;
      font-size: 6.5pt;
      line-height: 1.35;
      color: #333;
      letter-spacing: 0.02em;
      padding-bottom: 1mm;
    }
    
    .sticker__label {
      font-weight: 600;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-right: 0.5mm;
    }
    
    .sticker__meta-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 48%; }
    
    .sticker__divider {
      height: 0.25mm;
      background: #000;
      margin-bottom: 1.2mm;
      flex-shrink: 0;
    }
    
    .sticker__body {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      justify-content: space-between;
      gap: 2mm;
      flex: 1;
      min-height: 0;
    }
    
    .sticker__text {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .sticker__title {
      font-size: 9.5pt;
      font-weight: 700;
      line-height: 1.2;
      color: #000;
      word-break: break-word;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-bottom: 1mm;
      letter-spacing: 0.01em;
    }
    
    .sticker__footer {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      line-height: 1.3;
      color: #333;
      margin-top: auto;
    }
    
    .sticker__date { font-weight: 500; color: #000; }
    
    .sticker__goal {
      font-weight: 700;
      color: #000;
      padding: 0.4mm 1.2mm;
      border: 0.25mm solid #000;
      border-radius: 0.5mm;
      font-size: 6.5pt;
      letter-spacing: 0.03em;
    }
    
    .sticker__qr-wrap {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border: 0.25mm solid #000;
      border-radius: 1mm;
      padding: 1.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    
    .sticker__qr {
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
      onCloseRef.current();
    };

    run();
    // Не добавляем onClose в deps — иначе эффект перезапускается при каждом рендере родителя
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roasts, baseUrl]);

  return null;
}
