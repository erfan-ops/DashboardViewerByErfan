import { BarAttributes } from '../core/BarChartItem'
import { LineAttributes } from './LineChartItem';
import { PieAttributes } from './PieChartItem';

// === Utility: lighten color ===
export function lightenColor(hex: string, amount: number = 0.6): string {
    hex = hex.replace("#", "");
    if (hex.length === 3 || hex.length === 4) hex = hex.split("").map(ch => ch + ch).join("");

    const num = parseInt(hex, 16);

    let r;
    let g;
    let b;
    let a = 1;

    if (hex.length === 6) {
        r = (num >> 16) & 255;
        g = (num >> 8) & 255;
        b = num & 255;
    } else {
        r = (num >> 24) & 255;
        g = (num >> 16) & 255;
        b = (num >> 8) & 255;
        a = (num & 255) / 255;
    }
    

    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);

    return `rgba(${r},${g},${b},${a})`;
};

export function addOpacity(hex: string, amount: number = 0): string {
    hex = hex.replace("#", "");
    if (hex.length === 3 || hex.length === 4) hex = hex.split("").map(ch => ch + ch).join("");

    const num = parseInt(hex, 16);

    let r;
    let g;
    let b;
    let a = 1;

    if (hex.length === 6) {
        r = (num >> 16) & 255;
        g = (num >> 8) & 255;
        b = num & 255;
    } else {
        r = (num >> 24) & 255;
        g = (num >> 16) & 255;
        b = (num >> 8) & 255;
        a = (num & 255) / 255;
    }
    
    a = Math.max(0, Math.min(1, a + amount));

    return `rgba(${r},${g},${b},${a})`;
};


const persianDigitsMap = {
    '0': '۰',
    '1': '۱',
    '2': '۲',
    '3': '۳',
    '4': '۴',
    '5': '۵',
    '6': '۶',
    '7': '۷',
    '8': '۸',
    '9': '۹'
} as const;

export function toPersianDigits(text: string | number): string {
    return text.toString().replace(/[0-9]/g, (digit) => 
    persianDigitsMap[digit as keyof typeof persianDigitsMap]
    );
}

export function parseGeometry(xml?: string | null) {
    try {
        if (!xml) return { x: 0, y: 0, w: 600, h: 380 }
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const item = doc.querySelector('item')
        if (!item) return { x: 0, y: 0, w: 600, h: 380 }
        return {
        x: Number(item.getAttribute('x') || 0),
        y: Number(item.getAttribute('y') || 0),
        w: Number(item.getAttribute('w') || 600),
        h: Number(item.getAttribute('h') || 380),
        }
    } catch {
        return { x: 0, y: 0, w: 600, h: 380 }
    }
}

export function parseBarAttributes(xml?: string | null): BarAttributes {
    const defaults: BarAttributes = {
    type: 'vertical',

    title: {
      text: '',
      color: '#333333',
      alignment: 'center',
    },

    axes: {
      xAxis: {
        fields: [],
      },
      yAxis: {
        measures: [],
      },
    },

    appearance: {
      backgroundColor: '#ffffff',

      grid: {
        color: '#dddddd',
        show: true,
      },

      labels: {
        color: '#222222',
        font: 'Vazir',
        size: 12,
      },
    },

    summary: {
      include: false,
      sumSuffix: '',
    }
  };

  try {
    if (!xml) return defaults;

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const chart = doc.querySelector('barChart');
    if (!chart) return defaults;

    const getBool = (v?: string | null) => v?.toLowerCase() === 'true';

    /* ------------------ TYPE ------------------ */
    const rawType = chart.getAttribute('type')?.toLowerCase();
    const type = rawType === 'horizontal' ? 'horizontal' : 'vertical';

    /* ------------------ TITLE ------------------ */
    const titleEl = chart.querySelector('title');

    /* ------------------ X AXIS ------------------ */
    const xFields = Array.from(
      chart.querySelectorAll('axes > xAxis > field')
    ).map(field => ({
      name: field.getAttribute('name') || '',
      label: field.getAttribute('label') || undefined,
    })).filter(f => f.name);

    /* ------------------ Y AXIS ------------------ */
    const yMeasures = Array.from(
      chart.querySelectorAll('axes > yAxis > measure')
    ).map(measure => ({
      name: measure.getAttribute('name') || '',
      label: measure.getAttribute('label') || undefined,
      color: measure.getAttribute('color') || undefined,
    })).filter(m => m.name);

    /* ------------------ APPEARANCE ------------------ */
    const appearanceEl = chart.querySelector('appearance');
    const gridEl = appearanceEl?.querySelector('grid');
    const labelsEl = appearanceEl?.querySelector('labels');
    const bgEl = appearanceEl?.querySelector('background');

    /* ------------------ SUMMARY ------------------ */
    const summaryEl = chart.querySelector('summary');
    const sumEl = summaryEl?.querySelector('sum');

    return {
      ...defaults,
      type,

      title: {
        text: titleEl?.getAttribute('text') || defaults.title?.text,
        color: titleEl?.getAttribute('color') || defaults.title?.color,
        alignment: (titleEl?.getAttribute('alignment') as any) || defaults.title?.alignment,
      },

      axes: {
        xAxis: {
          fields: xFields.length ? xFields : defaults.axes.xAxis.fields,
        },
        yAxis: {
          measures: yMeasures.length ? yMeasures : defaults.axes.yAxis.measures,
        },
      },

      appearance: {
        backgroundColor: bgEl?.getAttribute('color') || defaults.appearance.backgroundColor,

        grid: {
          color: gridEl?.getAttribute('color') || defaults.appearance.grid.color,
          show: getBool(gridEl?.getAttribute('show')) ?? defaults.appearance.grid.show,
        },

        labels: {
          color: labelsEl?.getAttribute('color') || defaults.appearance.labels.color,
          font: labelsEl?.getAttribute('font') || defaults.appearance.labels.font,
          size: Number(labelsEl?.getAttribute('size') || defaults.appearance.labels.size),
        },
      },

      summary: {
        include: getBool(summaryEl?.getAttribute('include')) ?? false,
        sumSuffix: sumEl?.getAttribute('suffix') || '',
      }
    };
  } catch {
    return defaults;
  }
}

export function parseLineAttributes(xml?: string | null): LineAttributes {
    const defaults: LineAttributes = {
      title: {
        text: '',
        color: '#333333',
        alignment: 'center',
      },

      axes: {
        xAxis: {
          fields: [],
        },
        yAxis: {
          measures: [],
        },
      },

      appearance: {
        backgroundColor: '#ffffff',

        grid: {
          color: '#dddddd',
          show: true,
        },

        labels: {
          color: '#222222',
          font: 'Vazir',
          size: 12,
        },
      },

      summary: {
        include: false,
        sumSuffix: '',
      }
    }

    try {
      if (!xml) return defaults;

      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const chart = doc.querySelector('lineChart');
      if (!chart) return defaults;

      const getBool = (v?: string | null) => v?.toLowerCase() === 'true';

      /* ------------------ TITLE ------------------ */
      const titleEl = chart.querySelector('title');

      /* ------------------ X AXIS ------------------ */
      const xFields = Array.from(
        chart.querySelectorAll('axes > xAxis > field')
      ).map(field => ({
        name: field.getAttribute('name') || '',
        label: field.getAttribute('label') || undefined,
      })).filter(f => f.name);

      /* ------------------ Y AXIS ------------------ */
      const yMeasures = Array.from(
        chart.querySelectorAll('axes > yAxis > measure')
      ).map(measure => ({
        name: measure.getAttribute('name') || '',
        label: measure.getAttribute('label') || undefined,
        color: measure.getAttribute('color') || undefined,
      })).filter(m => m.name);

      /* ------------------ APPEARANCE ------------------ */
      const appearanceEl = chart.querySelector('appearance');
      const gridEl = appearanceEl?.querySelector('grid');
      const labelsEl = appearanceEl?.querySelector('labels');
      const bgEl = appearanceEl?.querySelector('background');

      /* ------------------ SUMMARY ------------------ */
      const summaryEl = chart.querySelector('summary');
      const sumEl = summaryEl?.querySelector('sum');

      return {
        ...defaults,
        title: {
          text: titleEl?.getAttribute('text') || defaults.title?.text,
          color: titleEl?.getAttribute('color') || defaults.title?.color,
          alignment: (titleEl?.getAttribute('alignment') as any) || defaults.title?.alignment,
        },

        axes: {
          xAxis: {
            fields: xFields.length ? xFields : defaults.axes.xAxis.fields,
          },
          yAxis: {
            measures: yMeasures.length ? yMeasures : defaults.axes.yAxis.measures,
          },
        },

        appearance: {
          backgroundColor: bgEl?.getAttribute('color') || defaults.appearance.backgroundColor,

          grid: {
            color: gridEl?.getAttribute('color') || defaults.appearance.grid.color,
            show: getBool(gridEl?.getAttribute('show')) ?? defaults.appearance.grid.show,
          },

          labels: {
            color: labelsEl?.getAttribute('color') || defaults.appearance.labels.color,
            font: labelsEl?.getAttribute('font') || defaults.appearance.labels.font,
            size: Number(labelsEl?.getAttribute('size') || defaults.appearance.labels.size),
          },
        },

        summary: {
          include: getBool(summaryEl?.getAttribute('include')) ?? false,
          sumSuffix: sumEl?.getAttribute('suffix') || '',
        }
      };
    } catch {
      return defaults;
    }
  }

export function parsePieAttributes(xml?: string | null): PieAttributes {
    const defaults: PieAttributes = {
      colors: "#3b82f6,#ef4444,#10b981,#f59e0b,#8b5cf6,#ec4899,#06b6d4,#84cc16,#f97316,#6366f1,#d946ef,#0ea5e9,#22c55e,#eab308,#a855f7,#f43f5e,#14b8a6,#84cc16,#f59e0b,#3b82f6,#ef4444,#10b981,#8b5cf6,#ec4899,#06b6d4,#f97316,#6366f1,#d946ef,#0ea5e9,#22c55e",
      slice: 'slice',
      measure: 'measure',
      pies: 'pies',
      lineWidth: 50,
      radius: 60,
      labelColor: '#222222',
      labelFont: 'Vazir',
      labelFontSize: 12,
      title: '',
      titleColor: '#333333',
      titleAlignment: 'center',
      backgroundColor: '#ffffff'
    }

    try {
      if (!xml) return defaults
      const doc = new DOMParser().parseFromString(xml, 'application/xml')
      const pie = doc.querySelector('pie')
      if (!pie) return defaults

      return {
        ...defaults,
        colors: pie.getAttribute('colors') || defaults.colors,
        slice: pie.getAttribute('slice') || defaults.slice,
        measure: pie.getAttribute('messure') || defaults.measure,
        pies: pie.getAttribute('pies') || defaults.pies,
        lineWidth: Number(pie.getAttribute('lineWidth') || defaults.lineWidth),
        radius: Number(pie.getAttribute('radius') || defaults.radius),
        labelColor: pie.getAttribute('labelColor') || defaults.labelColor,
        labelFont: pie.getAttribute('labelFont') || defaults.labelFont,
        labelFontSize: Number(pie.getAttribute('labelFontSize') || defaults.labelFontSize),
        title: pie.getAttribute('title') || defaults.title,
        titleColor: pie.getAttribute('titleColor') || defaults.titleColor,
        titleAlignment: pie.getAttribute('titleAlignment') || defaults.titleAlignment,
        backgroundColor: pie.getAttribute('backgroundColor') || defaults.backgroundColor
      }
    } catch {
      return defaults
    }
  }


export function formatWithThousandSeparators(num: number): string {
  // Convert to string and split into integer and decimal parts
  const [integerPart, decimalPart] = num.toString().split('.');

  // Add thousand separators to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '،');

  // Combine with decimal part if exists
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}
