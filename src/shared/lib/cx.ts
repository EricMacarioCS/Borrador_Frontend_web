/** Une clases de CSS e ignora los valores vacíos: `cx(styles.option, checked && styles.checked)`. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
