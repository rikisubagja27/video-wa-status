export interface ShareVideoResult {
  status: 'shared' | 'cancelled' | 'unsupported' | 'error';
  message: string;
}

export function canShareVideoFiles(file?: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    const probeFile =
      file ?? new File([new Uint8Array([0])], 'status.mp4', {type: 'video/mp4'});
    return navigator.canShare({files: [probeFile]});
  } catch {
    return false;
  }
}

export async function shareVideoToWhatsApp(file: File, title: string): Promise<ShareVideoResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return {
      status: 'unsupported',
      message:
        'Browser ini tidak mendukung Web Share API untuk file. Gunakan tombol Simpan Video lalu bagikan manual ke WhatsApp.',
    };
  }

  if (typeof navigator.canShare === 'function') {
    try {
      if (!navigator.canShare({files: [file]})) {
        return {
          status: 'unsupported',
          message:
            'Browser tidak mengizinkan berbagi langsung file video ini. Silakan simpan video terlebih dahulu lalu unggah melalui WhatsApp.',
        };
      }
    } catch {
      return {
        status: 'unsupported',
        message:
          'Berbagi file langsung tidak didukung di lingkungan browser saat ini. Simpan video terlebih dahulu.',
      };
    }
  }

  try {
    await navigator.share({
      files: [file],
      title,
    });
    return {
      status: 'shared',
      message:
        'Menu berbagi perangkat dibuka. Selesaikan pengiriman video di aplikasi WhatsApp Status Anda.',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        status: 'cancelled',
        message: 'Proses berbagi dibatalkan oleh pengguna.',
      };
    }
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      return {
        status: 'unsupported',
        message:
          'Safari membatasi share sheet pada konteks ini. Gunakan Simpan Video lalu bagikan lewat aplikasi Foto atau Files.',
      };
    }
    return {
      status: 'error',
      message:
        err instanceof Error
          ? err.message
          : 'Gagal membuka menu berbagi sistem.',
    };
  }
}

export function downloadVideoFile(file: File | Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke after browser initiates download
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
