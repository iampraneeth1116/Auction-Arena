// Joins class names, skipping falsy ones: cn('a', isOn && 'b')
export const cn = (...classes) => classes.filter(Boolean).join(' ');
