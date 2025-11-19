import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'formatFechaCompra' })
export class FormatFechaCompraPipe implements PipeTransform {
  transform(value: any): string {
    if (!value) return '';
    let d: Date | null = null;

    // Try dd-MM-yyyy
    const str = String(value).trim();
    const m = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = parseInt(m[3], 10);
      d = new Date(year, month, day);
    } else if (value instanceof Date) {
      d = value;
    } else {
      const t = Date.parse(str);
      d = isNaN(t) ? null : new Date(t);
    }

    if (!d || isNaN(d.getTime())) {
      return str; // fallback: show raw
    }

    const dd = String(d.getDate()).padStart(2, '0');
    const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(d);
    const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const yyyy = d.getFullYear();
    return `${dd} de ${capMonth} del ${yyyy}`;
  }
}
